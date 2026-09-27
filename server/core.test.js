import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePrice, forecastDemand, hashPassword, parseRequirement, scoreMatch, suggestCatalogue, verifyPassword } from './core.js';

test('pricing explains exact cost and margin', () => {
  const result = calculatePrice({ material: 1400, labourHours: 20, labourRate: 60, packaging: 150, logistics: 250, marginPercent: 20 });
  assert.equal(result.base, 3000);
  assert.equal(result.margin, 600);
  assert.equal(result.suggested, 3600);
});

test('matching exposes capacity gaps', () => {
  const need = parseRequirement({ text: 'Need 100 handmade jute bags', budget: 500 });
  const match = scoreMatch(need, { category: 'Bags & Accessories', capacity: 80, price: 300, lead_days: 10, material: 'Jute', region: 'Pune', customisation: 1 });
  assert.equal(need.quantity, 100);
  assert.equal(match.eligible, false);
  assert.match(match.gaps.join(' '), /Capacity/);
});

test('catalogue keeps spoken text and labels rules', () => {
  const result = suggestCatalogue('ही पैठणी साडी हाताने विणलेली आहे');
  assert.equal(result.language, 'mr');
  assert.equal(result.title, 'Paithani Saree');
  assert.equal(result.source, 'local_rules');
  assert.match(result.description, /पैठणी/);
});

test('demo forecasts identify synthetic data', () => {
  const result = forecastDemand([1, 2, 3, 4, 5, 6].map((units, index) => ({ category: 'Textiles', month: `2026-0${index + 1}`, units: units * 10, synthetic: 1 })));
  assert.equal(result[0].synthetic, true);
  assert.ok(result[0].nextMonth > result[0].currentAverage);
});

test('password hashes verify without storing plaintext', () => {
  const hash = hashPassword('ExamplePass123!');
  assert.equal(verifyPassword('ExamplePass123!', hash), true);
  assert.equal(verifyPassword('wrong', hash), false);
});
