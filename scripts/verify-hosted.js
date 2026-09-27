import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { del } from '@vercel/blob';
import { db } from '../server/db.js';

const base = process.argv[2] || process.env.TANTU_BASE_URL || 'http://127.0.0.1:3002';
const idempotency = `deployment-check-${randomUUID()}`;
const photo = 'data:image/png;base64,' + Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000b49444154789c636000020000050001a5f645400000000049454e44ae426082', 'hex').toString('base64');
let productId;
let imageUrl;

async function request(path, method = 'GET', payload, cookie) {
  const response = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  const data = await response.json();
  assert.equal(response.ok, true, `${method} ${path}: ${JSON.stringify(data)}`);
  return { data, cookie: response.headers.get('set-cookie')?.split(';')[0] };
}

try {
  const health = await request('/api/health');
  assert.equal(health.data.database, 'postgres');
  const login = await request('/api/auth/login', 'POST', { email: 'savita@tantu.demo', password: process.env.DEMO_PASSWORD || 'Demo@26090' });
  const artisan = login.cookie;
  assert.ok(artisan);
  const listing = await request('/api/products', 'POST', {
    client_id: idempotency, title: 'Deployment check', category: 'Textiles', craft: 'Paithani weaving',
    image: photo, price: 100, stock: 2, status: 'published',
  }, artisan);
  productId = listing.data.product.id;
  imageUrl = listing.data.product.image;
  assert.match(imageUrl, /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/products\//);
  assert.ok(listing.data.product.certificate_id);
  const image = await fetch(imageUrl);
  assert.equal(image.status, 200);
  await request(`/api/passports/${listing.data.product.certificate_id}`);
  const updated = await request(`/api/products/${productId}`, 'PUT', {
    ...listing.data.product, title: 'Deployment check updated',
  }, artisan);
  assert.equal(updated.data.product.title, 'Deployment check updated');
  const buyer = await request('/api/auth/login', 'POST', { email: 'buyer@tantu.demo', password: process.env.DEMO_PASSWORD || 'Demo@26090' });
  await request('/api/orders', 'POST', { product_id: productId, quantity: 1 }, buyer.cookie);
  const afterOrder = await request(`/api/products/${productId}`);
  assert.equal(afterOrder.data.product.stock, 1);
  console.log('Hosted database, Blob upload, passport, edit, and order verified.');
} finally {
  if (productId) {
    await db.prepare('DELETE FROM orders WHERE product_id=?').run(productId);
    await db.prepare('DELETE FROM passports WHERE product_id=?').run(productId);
    await db.prepare('DELETE FROM products WHERE id=? AND client_id=?').run(productId, idempotency);
  }
  if (imageUrl) await del(imageUrl);
}
