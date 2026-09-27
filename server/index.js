import http from 'node:http';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, statSync, writeFileSync, createReadStream } from 'node:fs';
import { basename, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, migrate, transaction } from './db.js';
import { calculatePrice, forecastDemand, hashPassword, parseRequirement, scoreMatch, verifyPassword } from './core.js';
import { catalogueSuggestion } from './ai.js';
import { put } from '@vercel/blob';

await migrate();
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dist = join(root, 'dist');
const uploads = join(root, 'uploads');
if (!process.env.VERCEL) mkdirSync(uploads, { recursive: true });
const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || '127.0.0.1';
const loginAttempts = new Map();

function fail(status, message) { const error = new Error(message); error.status = status; throw error; }
function json(res, status, data, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(data));
}
function body(req) {
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) fail(415, 'Send JSON content.');
  if (req.body !== undefined) {
    try { return Promise.resolve(typeof req.body === 'string' ? JSON.parse(req.body) : req.body); }
    catch { fail(400, 'Invalid JSON.'); }
  }
  return new Promise((resolveBody, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 4_300_000) { reject(Object.assign(new Error('Request is too large.'), { status: 413 })); req.destroy(); }
    });
    req.on('end', () => { try { resolveBody(raw ? JSON.parse(raw) : {}); } catch { reject(Object.assign(new Error('Invalid JSON.'), { status: 400 })); } });
    req.on('error', reject);
  });
}
function cookie(req) {
  const token = /(?:^|;\s*)tantu_session=([^;]+)/.exec(req.headers.cookie || '')?.[1];
  return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
}
async function currentUser(req) {
  const token = cookie(req);
  if (!token) return null;
  const tokenHash = createHash('sha256').update(token).digest('hex');
  return await db.prepare(`SELECT u.id,u.name,u.email,u.role,u.language,a.craft,a.region,a.story,a.capacity,a.lead_days,a.customisation,a.verified
    FROM sessions s JOIN users u ON u.id=s.user_id LEFT JOIN artisans a ON a.user_id=u.id
    WHERE s.token_hash=? AND s.expires_at > ?`).get(tokenHash, new Date().toISOString()) || null;
}
function requireRole(user, ...roles) {
  if (!user) fail(401, 'Sign in to continue.');
  if (!roles.includes(user.role)) fail(403, 'This account cannot perform that action.');
}
function sessionCookie(token, age = 60 * 60 * 24 * 7) {
  return `tantu_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
}
async function createSession(res, userId) {
  const token = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 7 * 86400000).toISOString();
  await db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES (?,?,?)')
    .run(createHash('sha256').update(token).digest('hex'), userId, expires);
  res.setHeader('Set-Cookie', sessionCookie(token));
}
function cleanText(value, max = 500) { return String(value ?? '').trim().slice(0, max); }
function validInt(value, label, min = 0, max = 1000000) {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < min || n > max) fail(400, `${label} must be between ${min} and ${max}.`);
  return n;
}
function productView(row) {
  if (!row) return null;
  let breakdown = {};
  try { breakdown = JSON.parse(row.price_breakdown || '{}'); } catch { /* older records remain readable */ }
  return { ...row, price_breakdown: breakdown };
}
async function productById(id) {
  return productView(await db.prepare(`SELECT p.*,u.name artisan_name,a.story artisan_story,a.customisation,pas.certificate_id,pas.review_status
    FROM products p JOIN users u ON u.id=p.artisan_id JOIN artisans a ON a.user_id=p.artisan_id
    LEFT JOIN passports pas ON pas.product_id=p.id WHERE p.id=?`).get(id));
}
async function saveImage(value) {
  if (!value) return '';
  if (typeof value !== 'string') fail(400, 'Invalid product photo.');
  if (value.startsWith('/uploads/') && /^\/uploads\/[a-f0-9-]+\.(png|jpg|webp)$/.test(value)) return value;
  const match = /^data:image\/(png|jpeg|webp);base64,([a-zA-Z0-9+/=]+)$/.exec(value);
  if (!match) fail(400, 'Photo must be PNG, JPEG or WebP.');
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > 3_000_000) fail(413, 'Photo must be smaller than 3 MB.');
  const kind = match[1];
  const valid = kind === 'png' ? bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
    : kind === 'jpeg' ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9
    : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (!valid) fail(400, 'Photo content does not match its file type.');
  const filename = `${randomUUID()}.${kind === 'jpeg' ? 'jpg' : kind}`;
  if (process.env.VERCEL || process.env.USE_BLOB_STORAGE === '1') {
    const blob = await put(`products/${filename}`, bytes, { access: 'public', contentType: `image/${kind}` });
    return blob.url;
  }
  const path = `/uploads/${filename}`;
  writeFileSync(join(root, path.slice(1)), bytes);
  return path;
}
async function normalizeProduct(input, existing) {
  const title = cleanText(input.title, 120);
  const category = cleanText(input.category, 80);
  const craft = cleanText(input.craft, 100);
  if (!title || !category || !craft) fail(400, 'Title, category and craft are required.');
  const status = input.status === 'published' ? 'published' : 'draft';
  const price = validInt(input.price ?? 0, 'Price', 0, 10000000);
  const stock = validInt(input.stock ?? 0, 'Stock', 0, 100000);
  const capacity = validInt(input.capacity ?? 20, 'Capacity', 1, 100000);
  const leadDays = validInt(input.lead_days ?? 14, 'Lead time', 1, 365);
  const image = input.image?.startsWith?.('data:') ? await saveImage(input.image) : (input.image || existing?.image || '');
  if (status === 'published' && (!image || price <= 0)) fail(400, 'Published products need a photo and price.');
  if (image && !/^\/(uploads|images)\/[a-zA-Z0-9._-]+$/.test(image)
    && !/^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/products\/[a-f0-9-]+\.(png|jpg|webp)$/.test(image)) fail(400, 'Invalid photo path.');
  const breakdown = input.price_breakdown && typeof input.price_breakdown === 'object' && !Array.isArray(input.price_breakdown) ? input.price_breakdown : {};
  return { title, category, craft, description: cleanText(input.description, 2000), material: cleanText(input.material, 150),
    colors: cleanText(input.colors, 150), technique: cleanText(input.technique, 200), region: cleanText(input.region, 120),
    care: cleanText(input.care, 400), story: cleanText(input.story, 1200), image, price, stock, capacity,
    lead_days: leadDays, status, price_breakdown: JSON.stringify(breakdown) };
}
async function passportFor(productId) {
  await db.prepare('INSERT OR IGNORE INTO passports(certificate_id,product_id) VALUES (?,?)').run(`TANTU-${randomUUID()}`, productId);
}

async function api(req, res, url) {
  const path = url.pathname;
  const user = await currentUser(req);
  if (req.method === 'GET' && path === '/api/health') return json(res, 200, { ok: true, database: process.env.DATABASE_URL || process.env.POSTGRES_URL ? 'postgres' : 'sqlite' });
  if (req.method === 'GET' && path === '/api/session') return json(res, 200, { user });
  if (req.method === 'POST' && path === '/api/auth/register') {
    const input = await body(req);
    const name = cleanText(input.name, 100), email = cleanText(input.email, 200).toLowerCase(), password = String(input.password || '');
    const role = input.role === 'artisan' ? 'artisan' : 'buyer';
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 10 || password.length > 128) fail(400, 'Enter a name, valid email and password of at least 10 characters.');
    if (await db.prepare('SELECT id FROM users WHERE email=?').get(email)) fail(409, 'Email is already registered.');
    const id = randomUUID();
    await transaction(async () => {
      await db.prepare('INSERT INTO users(id,name,email,password_hash,role,language) VALUES (?,?,?,?,?,?)').run(id, name, email, hashPassword(password), role, ['mr','hi','en'].includes(input.language) ? input.language : 'en');
      if (role === 'artisan') await db.prepare('INSERT INTO artisans(user_id,craft,region,story,capacity,lead_days) VALUES (?,?,?,?,?,?)')
        .run(id, cleanText(input.craft, 100) || 'Artisan craft', cleanText(input.region, 120) || 'India', cleanText(input.story, 1200), 20, 14);
    });
    await createSession(res, id);
    return json(res, 201, { user: await db.prepare('SELECT id,name,email,role,language FROM users WHERE id=?').get(id) });
  }
  if (req.method === 'POST' && path === '/api/auth/login') {
    const ip = req.socket.remoteAddress || 'unknown';
    const attempt = loginAttempts.get(ip) || { count: 0, since: Date.now() };
    if (Date.now() - attempt.since > 60000) { attempt.count = 0; attempt.since = Date.now(); }
    if (attempt.count >= 10) fail(429, 'Too many sign-in attempts. Try again in one minute.');
    const input = await body(req);
    const account = await db.prepare('SELECT * FROM users WHERE email=?').get(cleanText(input.email, 200).toLowerCase());
    if (!account || !verifyPassword(String(input.password || ''), account.password_hash)) {
      attempt.count++; loginAttempts.set(ip, attempt); fail(401, 'Incorrect email or password.');
    }
    loginAttempts.delete(ip);
    await createSession(res, account.id);
    return json(res, 200, { user: await db.prepare(`SELECT u.id,u.name,u.email,u.role,u.language,a.craft,a.region,a.capacity,a.verified FROM users u LEFT JOIN artisans a ON a.user_id=u.id WHERE u.id=?`).get(account.id) });
  }
  if (req.method === 'POST' && path === '/api/auth/logout') {
    await body(req);
    const token = cookie(req);
    if (token) await db.prepare('DELETE FROM sessions WHERE token_hash=?').run(createHash('sha256').update(token).digest('hex'));
    return json(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie('', 0) });
  }
  if (req.method === 'GET' && path === '/api/products') {
    const search = cleanText(url.searchParams.get('search'), 100).toLowerCase();
    const category = cleanText(url.searchParams.get('category'), 80);
    const rows = await db.prepare(`SELECT p.*,u.name artisan_name,a.customisation,pas.certificate_id,pas.review_status
      FROM products p JOIN users u ON u.id=p.artisan_id JOIN artisans a ON a.user_id=p.artisan_id
      LEFT JOIN passports pas ON pas.product_id=p.id WHERE p.status='published' ORDER BY p.created_at DESC`).all();
    return json(res, 200, { products: rows.filter((row) => (!category || row.category === category) && (!search || `${row.title} ${row.description} ${row.craft} ${row.region} ${row.artisan_name}`.toLowerCase().includes(search))).map(productView) });
  }
  if (req.method === 'GET' && /^\/api\/products\/[^/]+$/.test(path)) {
    const product = await productById(path.split('/')[3]);
    if (!product || (product.status !== 'published' && user?.id !== product.artisan_id && user?.role !== 'admin')) fail(404, 'Product not found.');
    return json(res, 200, { product });
  }
  if (req.method === 'GET' && /^\/api\/artisans\/[^/]+$/.test(path)) {
    const id = path.split('/')[3];
    const artisan = await db.prepare(`SELECT u.id,u.name,u.language,a.craft,a.region,a.story,a.experience_years,a.capacity,a.lead_days,a.customisation,a.verified
      FROM artisans a JOIN users u ON u.id=a.user_id WHERE a.user_id=?`).get(id);
    if (!artisan) fail(404, 'Artisan not found.');
    return json(res, 200, { artisan, products: await db.prepare("SELECT id,title,image,price,category,certificate_id FROM products p LEFT JOIN passports pas ON pas.product_id=p.id WHERE p.artisan_id=? AND p.status='published'").all(id) });
  }
  if (req.method === 'GET' && /^\/api\/passports\/[^/]+$/.test(path)) {
    const certificateId = path.split('/')[3];
    const record = await db.prepare(`SELECT pas.*,p.id product_id,p.title,p.description,p.craft,p.material,p.technique,p.region,p.story,p.image,p.created_at product_created_at,u.name artisan_name,u.id artisan_id,a.story artisan_story
      FROM passports pas JOIN products p ON p.id=pas.product_id JOIN users u ON u.id=p.artisan_id JOIN artisans a ON a.user_id=p.artisan_id
      WHERE pas.certificate_id=? AND p.status='published'`).get(certificateId);
    if (!record) fail(404, 'Passport not found.');
    return json(res, 200, { passport: record });
  }
  if (req.method === 'POST' && path === '/api/price') { const input = await body(req); return json(res, 200, { price: calculatePrice(input) }); }
  if (req.method === 'POST' && path === '/api/catalog/suggest') {
    requireRole(user, 'artisan'); const input = await body(req);
    try { return json(res, 200, { suggestion: await catalogueSuggestion(input.notes, input.image) }); }
    catch (error) { fail(400, error.message); }
  }
  if (req.method === 'POST' && path === '/api/products') {
    requireRole(user, 'artisan');
    const input = await body(req);
    const clientId = cleanText(input.client_id, 100) || null;
    if (clientId) {
      const existing = await db.prepare('SELECT id FROM products WHERE client_id=? AND artisan_id=?').get(clientId, user.id);
      if (existing) return json(res, 200, { product: await productById(existing.id), replayed: true });
    }
    const product = await normalizeProduct(input);
    const id = randomUUID();
    await transaction(async () => {
      await db.prepare(`INSERT INTO products(id,artisan_id,client_id,title,description,category,craft,material,colors,technique,region,care,story,image,price,stock,capacity,lead_days,status,price_breakdown)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, user.id, clientId, product.title, product.description, product.category, product.craft, product.material, product.colors, product.technique, product.region, product.care, product.story, product.image, product.price, product.stock, product.capacity, product.lead_days, product.status, product.price_breakdown);
      if (product.status === 'published') await passportFor(id);
    });
    return json(res, 201, { product: await productById(id) });
  }
  if (req.method === 'PUT' && /^\/api\/products\/[^/]+$/.test(path)) {
    requireRole(user, 'artisan');
    const id = path.split('/')[3]; const old = await productById(id);
    if (!old || old.artisan_id !== user.id) fail(404, 'Product not found.');
    const input = await body(req);
    const version = validInt(input.version, 'Version', 1);
    const product = await normalizeProduct(input, old);
    await transaction(async () => {
      const result = await db.prepare(`UPDATE products SET title=?,description=?,category=?,craft=?,material=?,colors=?,technique=?,region=?,care=?,story=?,image=?,price=?,stock=?,capacity=?,lead_days=?,status=?,price_breakdown=?,version=version+1,updated_at=CURRENT_TIMESTAMP
        WHERE id=? AND version=?`).run(product.title, product.description, product.category, product.craft, product.material, product.colors, product.technique, product.region, product.care, product.story, product.image, product.price, product.stock, product.capacity, product.lead_days, product.status, product.price_breakdown, id, version);
      if (!result.changes) fail(409, 'Product changed elsewhere. Reload it before saving.');
      if (product.status === 'published') await passportFor(id);
    });
    return json(res, 200, { product: await productById(id) });
  }
  if (req.method === 'POST' && path === '/api/match') {
    const requirement = parseRequirement(await body(req));
    const rows = await db.prepare(`SELECT p.id,p.title,p.image,p.category,p.craft,p.material,p.price,p.capacity,p.lead_days,p.region,p.artisan_id,u.name artisan_name,a.customisation
      FROM products p JOIN artisans a ON a.user_id=p.artisan_id JOIN users u ON u.id=p.artisan_id WHERE p.status='published'`).all();
    const ranked = rows.map((product) => ({ ...product, ...scoreMatch(requirement, product) }))
      .sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.score - a.score || a.price - b.price);
    const eligible = ranked.filter((product) => product.eligible);
    const pool = eligible.length ? eligible : ranked.slice(0, 5);
    const makers = new Map();
    for (const product of pool) if (!makers.has(product.artisan_id)) makers.set(product.artisan_id, product);
    const matches = [...makers.values()].slice(0, 8);
    return json(res, 200, { requirement, matches, method: 'Transparent rules and business constraints; no trained matching model.' });
  }
  if (req.method === 'POST' && path === '/api/requirements') {
    requireRole(user, 'buyer'); const requirement = parseRequirement(await body(req));
    if (!requirement.text) fail(400, 'Describe what you need.');
    const id = randomUUID();
    await db.prepare(`INSERT INTO requirements(id,buyer_id,text,category,material,quantity,budget,location,deadline,customisation)
      VALUES (?,?,?,?,?,?,?,?,?,?)`).run(id, user.id, requirement.text, requirement.category, requirement.material, requirement.quantity, requirement.budget, requirement.location, requirement.deadline, Number(requirement.customisation));
    return json(res, 201, { requirement: { id, ...requirement } });
  }
  if (req.method === 'GET' && path === '/api/requirements') {
    requireRole(user, 'buyer', 'admin');
    return json(res, 200, { requirements: user.role === 'admin' ? await db.prepare('SELECT * FROM requirements ORDER BY created_at DESC').all() : await db.prepare('SELECT * FROM requirements WHERE buyer_id=? ORDER BY created_at DESC').all(user.id) });
  }
  if (req.method === 'POST' && path === '/api/enquiries') {
    requireRole(user, 'buyer'); const input = await body(req);
    const product = await productById(cleanText(input.product_id, 100));
    if (!product || product.status !== 'published') fail(404, 'Product not found.');
    const message = cleanText(input.message, 1200);
    if (message.length < 10) fail(400, 'Add a message of at least 10 characters.');
    const requirementId = cleanText(input.requirement_id, 100) || null;
    if (requirementId && !await db.prepare('SELECT id FROM requirements WHERE id=? AND buyer_id=?').get(requirementId, user.id)) fail(403, 'Requirement does not belong to you.');
    const id = randomUUID();
    await db.prepare('INSERT INTO enquiries(id,buyer_id,artisan_id,product_id,requirement_id,message) VALUES (?,?,?,?,?,?)').run(id, user.id, product.artisan_id, product.id, requirementId, message);
    return json(res, 201, { enquiry: { id, product_id: product.id, status: 'new' } });
  }
  if (req.method === 'GET' && path === '/api/enquiries') {
    requireRole(user, 'buyer', 'artisan', 'admin');
    const where = user.role === 'admin' ? '' : `WHERE e.${user.role === 'artisan' ? 'artisan_id' : 'buyer_id'}=?`;
    const rows = await db.prepare(`SELECT e.*,p.title product_title,p.image,u.name buyer_name FROM enquiries e JOIN products p ON p.id=e.product_id JOIN users u ON u.id=e.buyer_id ${where} ORDER BY e.created_at DESC`).all(...(user.role === 'admin' ? [] : [user.id]));
    return json(res, 200, { enquiries: rows });
  }
  if (req.method === 'PATCH' && /^\/api\/enquiries\/[^/]+$/.test(path)) {
    requireRole(user, 'artisan'); const input = await body(req); const id = path.split('/')[3];
    if (!['new','replied','closed'].includes(input.status)) fail(400, 'Invalid enquiry status.');
    const result = await db.prepare('UPDATE enquiries SET status=? WHERE id=? AND artisan_id=?').run(input.status, id, user.id);
    if (!result.changes) fail(404, 'Enquiry not found.');
    return json(res, 200, { ok: true });
  }
  if (req.method === 'POST' && path === '/api/orders') {
    requireRole(user, 'buyer'); const input = await body(req);
    const quantity = validInt(input.quantity, 'Quantity', 1, 10000), id = randomUUID();
    await transaction(async () => {
      const product = await db.prepare(`SELECT id,price,stock,status FROM products WHERE id=?${process.env.DATABASE_URL || process.env.POSTGRES_URL ? ' FOR UPDATE' : ''}`).get(cleanText(input.product_id, 100));
      if (!product || product.status !== 'published') fail(404, 'Product not found.');
      if (product.stock < quantity) fail(409, `Only ${product.stock} units are in stock.`);
      await db.prepare('UPDATE products SET stock=stock-?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(quantity, product.id);
      await db.prepare('INSERT INTO orders(id,buyer_id,product_id,quantity,unit_price) VALUES (?,?,?,?,?)').run(id, user.id, product.id, quantity, product.price);
    });
    return json(res, 201, { order: { id, status: 'placed' } });
  }
  if (req.method === 'GET' && path === '/api/orders') {
    requireRole(user, 'buyer', 'artisan', 'admin');
    const where = user.role === 'admin' ? '' : user.role === 'artisan' ? 'WHERE p.artisan_id=?' : 'WHERE o.buyer_id=?';
    const orders = await db.prepare(`SELECT o.*,p.title product_title,p.image,u.name buyer_name FROM orders o JOIN products p ON p.id=o.product_id JOIN users u ON u.id=o.buyer_id ${where} ORDER BY o.created_at DESC`).all(...(user.role === 'admin' ? [] : [user.id]));
    return json(res, 200, { orders });
  }
  if (req.method === 'PATCH' && /^\/api\/orders\/[^/]+$/.test(path)) {
    requireRole(user, 'artisan'); const input = await body(req), id = path.split('/')[3];
    if (!['accepted','shipped','completed'].includes(input.status)) fail(400, 'Invalid order status.');
    const result = await db.prepare('UPDATE orders SET status=? WHERE id=? AND product_id IN (SELECT id FROM products WHERE artisan_id=?)').run(input.status, id, user.id);
    if (!result.changes) fail(404, 'Order not found.');
    return json(res, 200, { ok: true });
  }
  if (req.method === 'GET' && path === '/api/demand') {
    requireRole(user, 'artisan', 'admin');
    return json(res, 200, { forecasts: forecastDemand(await db.prepare('SELECT category,month,units,synthetic FROM sales_history ORDER BY month').all()),
      notice: 'Illustrative projection from synthetic demo sales. Not a live market forecast.' });
  }
  if (req.method === 'GET' && path === '/api/dashboard') {
    requireRole(user, 'artisan');
    return json(res, 200, { products: (await db.prepare('SELECT p.*,pas.certificate_id FROM products p LEFT JOIN passports pas ON pas.product_id=p.id WHERE p.artisan_id=? ORDER BY p.updated_at DESC').all(user.id)).map(productView),
      orders: (await db.prepare('SELECT COUNT(*) count FROM orders o JOIN products p ON p.id=o.product_id WHERE p.artisan_id=?').get(user.id)).count,
      enquiries: (await db.prepare("SELECT COUNT(*) count FROM enquiries WHERE artisan_id=? AND status='new'").get(user.id)).count });
  }
  if (req.method === 'GET' && path === '/api/admin') {
    requireRole(user, 'admin');
    const count = async (table) => (await db.prepare(`SELECT COUNT(*) count FROM ${table}`).get()).count;
    return json(res, 200, { stats: { artisans: await count('artisans'), products: await count('products'), orders: await count('orders'), enquiries: await count('enquiries') },
      passports: await db.prepare('SELECT pas.*,p.title,u.name artisan_name FROM passports pas JOIN products p ON p.id=pas.product_id JOIN users u ON u.id=p.artisan_id ORDER BY pas.issued_at DESC').all(),
      artisans: await db.prepare('SELECT a.*,u.name FROM artisans a JOIN users u ON u.id=a.user_id ORDER BY u.name').all() });
  }
  if (req.method === 'PATCH' && /^\/api\/admin\/passports\/[^/]+$/.test(path)) {
    requireRole(user, 'admin'); await body(req);
    const result = await db.prepare("UPDATE passports SET review_status='reviewed',reviewed_by=? WHERE certificate_id=?").run(user.id, path.split('/')[4]);
    if (!result.changes) fail(404, 'Passport not found.');
    return json(res, 200, { ok: true });
  }
  fail(404, 'API route not found.');
}

const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
function serveFile(res, path) {
  if (!existsSync(path) || !statSync(path).isFile()) return false;
  const cache = extname(path) === '.html' || basename(path) === 'sw.js' ? 'no-cache' : path.includes(`${sep}assets${sep}`) ? 'public,max-age=31536000,immutable' : 'public,max-age=3600';
  res.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': cache });
  createReadStream(path).pipe(res);
  return true;
}
export async function handleRequest(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') fail(405, 'Method not allowed.');
    if (url.pathname.startsWith('/uploads/')) {
      const file = basename(url.pathname);
      if (!/^[a-f0-9-]+\.(png|jpg|webp)$/.test(file) || !serveFile(res, join(uploads, file))) fail(404, 'Photo not found.');
      return;
    }
    if (!existsSync(dist)) fail(404, 'Frontend not built. Use npm run dev or npm run build.');
    const candidate = resolve(dist, `.${decodeURIComponent(url.pathname)}`);
    if (candidate !== dist && !candidate.startsWith(dist + sep)) fail(403, 'Invalid path.');
    if (serveFile(res, candidate)) return;
    if (url.pathname.includes('.')) fail(404, 'File not found.');
    serveFile(res, join(dist, 'index.html'));
  } catch (error) {
    if (res.headersSent) return res.end();
    if (error.status !== 404 && error.status !== 401 && error.status !== 403 && error.status !== 409 && error.status !== 400 && error.status !== 413 && error.status !== 415 && error.status !== 429) console.error(error);
    json(res, error.status || 500, { error: error.status ? error.message : 'Server error.' });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  http.createServer(handleRequest).listen(port, host, () => console.log(`Tantu API ready at http://${host}:${port}`));
}
