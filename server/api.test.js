import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

test('API protects roles and completes catalogue, passport, match and order flows', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'tantu-api-'));
  const port = 32000 + Math.floor(Math.random() * 2000);
  const origin = `http://127.0.0.1:${port}`;
  const env = { ...process.env, DATABASE_PATH: join(directory, 'demo.db'), PORT: String(port), NODE_ENV: 'test', OPENAI_API_KEY: '' };
  execFileSync(process.execPath, ['server/seed.js'], { cwd: root, env });
  const child = spawn(process.execPath, ['server/index.js'], { cwd: root, env, stdio: 'ignore' });
  const request = (path, method = 'GET', payload, cookie = '') => fetch(origin + path, {
    method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  try {
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      try { const response = await request('/api/health'); if (response.ok) { ready = true; break; } } catch { /* server starting */ }
      await new Promise((done) => setTimeout(done, 100));
    }
    assert.equal(ready, true, 'test server should start');
    const artisanLogin = await request('/api/auth/login', 'POST', { email: 'savita@tantu.demo', password: 'Demo@26090' });
    assert.equal(artisanLogin.status, 200);
    const artisanCookie = artisanLogin.headers.get('set-cookie').split(';')[0];
    assert.equal((await request('/api/admin', 'GET', undefined, artisanCookie)).status, 403);
    const photo = 'data:image/png;base64,' + Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000b49444154789c636000020000050001a5f645400000000049454e44ae426082', 'hex').toString('base64');
    const create = await request('/api/products', 'POST', { client_id: 'integration-product', title: 'Test Paithani Wrap', description: 'Handwoven test listing', category: 'Textiles', craft: 'Paithani weaving', material: 'Silk', region: 'Yeola', image: photo, price: 900, stock: 2, capacity: 5, lead_days: 7, status: 'published' }, artisanCookie);
    assert.equal(create.status, 201);
    const product = (await create.json()).product;
    assert.match(product.image, /^\/uploads\//);
    assert.ok(product.certificate_id);
    assert.equal((await request(`/api/passports/${product.certificate_id}`)).status, 200);
    const replay = await request('/api/products', 'POST', { client_id: 'integration-product', title: 'Duplicate' }, artisanCookie);
    assert.equal(replay.status, 200);
    assert.equal((await replay.json()).product.id, product.id);
    const updated = await request(`/api/products/${product.id}`, 'PUT', { ...product, title: 'Updated wrap' }, artisanCookie);
    assert.equal(updated.status, 200);
    const conflict = await request(`/api/products/${product.id}`, 'PUT', { ...product, title: 'Stale wrap' }, artisanCookie);
    assert.equal(conflict.status, 409);
    const match = await request('/api/match', 'POST', { text: 'Need 100 handmade jute bags', budget: 350, location: 'Pune' });
    assert.equal(match.status, 200);
    const ranked = (await match.json()).matches;
    assert.equal(ranked[0].category, 'Bags & Accessories');
    assert.equal(ranked[0].eligible, true);
    const buyerLogin = await request('/api/auth/login', 'POST', { email: 'buyer@tantu.demo', password: 'Demo@26090' });
    const buyerCookie = buyerLogin.headers.get('set-cookie').split(';')[0];
    const order = await request('/api/orders', 'POST', { product_id: product.id, quantity: 1 }, buyerCookie);
    assert.equal(order.status, 201, await order.text());
    const remaining = (await (await request(`/api/products/${product.id}`)).json()).product.stock;
    assert.equal(remaining, 1);
    assert.equal((await request('/api/products', 'POST', { title: 'Buyer listing' }, buyerCookie)).status, 403);
  } finally {
    child.kill();
    if (child.exitCode === null) await Promise.race([once(child, 'exit'), new Promise((done) => setTimeout(done, 2000))]);
    const safeRoot = resolve(tmpdir()) + sep;
    if (resolve(directory).startsWith(safeRoot) && basename(directory).startsWith('tantu-api-')) {
      try { rmSync(directory, { recursive: true, force: true }); } catch { /* Windows may hold SQLite briefly */ }
    }
  }
});
