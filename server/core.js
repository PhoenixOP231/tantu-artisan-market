import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash || !/^[a-f0-9]{128}$/i.test(hash)) return false;
  return timingSafeEqual(scryptSync(password, salt, 64), Buffer.from(hash, 'hex'));
}

const nonNegative = (value) => Math.max(0, Number(value) || 0);
const money = (value) => Math.round(nonNegative(value));

export function calculatePrice(input) {
  const material = money(input.material);
  const labour = money(nonNegative(input.labourHours) * nonNegative(input.labourRate));
  const packaging = money(input.packaging);
  const logistics = money(input.logistics);
  const overhead = money(input.overhead);
  const base = material + labour + packaging + logistics + overhead;
  const marginPercent = Math.min(100, nonNegative(input.marginPercent ?? 20));
  const margin = Math.round(base * marginPercent / 100);
  const costBased = base + margin;
  const marketReference = input.marketReference ? money(input.marketReference) : null;
  const suggested = Math.ceil(costBased / 10) * 10;
  return { material, labour, packaging, logistics, overhead, base, margin, marginPercent,
    costBased, marketReference, suggested,
    explanation: `₹${base.toLocaleString('en-IN')} covers entered costs. ₹${margin.toLocaleString('en-IN')} is the ${marginPercent}% artisan margin. The selling suggestion is rounded to the next ₹10.` };
}

const categories = [
  { category: 'Textiles', craft: 'Paithani weaving', product: 'Paithani Saree', words: /paithani|पैठणी|saree|साडी|साड़ी|weav|विण|बुन/i, material: 'Silk and zari', region: 'Maharashtra' },
  { category: 'Home & Decor', craft: 'Terracotta', product: 'Terracotta Diyas', words: /diya|दिया|दिवा|terracotta|clay|माती|मिट्टी/i, material: 'Terracotta clay', region: '' },
  { category: 'Bags & Accessories', craft: 'Jute craft', product: 'Handmade Jute Bag', words: /bag|bags|jute|पिशवी|थैली|बैग/i, material: 'Jute', region: '' },
  { category: 'Home & Decor', craft: 'Blue pottery', product: 'Blue Pottery Vase', words: /pottery|vase|ceramic|मातीची भांडी|मिट्टी के बर्तन/i, material: 'Ceramic', region: 'Rajasthan' },
  { category: 'Art & Paintings', craft: 'Warli painting', product: 'Warli Painting', words: /warli|वारली|paint|चित्र/i, material: 'Canvas', region: 'Maharashtra' },
];

export function suggestCatalogue(notes) {
  const text = String(notes || '').trim().slice(0, 1200);
  if (!text) throw new Error('Describe the product first.');
  const known = categories.find((item) => item.words.test(text));
  const language = /[\u0900-\u097f]/.test(text) ? (/ही|आहे|हाताने|विणलेली|माझे|मला/.test(text) ? 'mr' : 'hi') : 'en';
  const item = known || { product: 'Handmade Product', category: 'Other Crafts', craft: 'Artisan craft', material: '', region: '' };
  return {
    title: item.product, category: item.category, craft: item.craft, material: item.material,
    region: item.region, technique: known?.craft || '', language,
    description: text, story: text,
    reviewNote: 'Suggestions use local keyword rules. Check craft, material and region before publishing.',
    source: 'local_rules',
  };
}

export function parseRequirement(input) {
  const text = String(input.text || '').trim().slice(0, 1000);
  const known = categories.find((item) => item.words.test(text));
  const quantity = Number(input.quantity) || Number(text.match(/\b(\d{1,5})\b/)?.[1]) || 1;
  return {
    text, category: String(input.category || known?.category || '').trim(),
    material: String(input.material || (/jute/i.test(text) ? 'Jute' : '')).trim(),
    quantity: Math.max(1, Math.min(100000, Math.round(quantity))),
    budget: money(input.budget), location: String(input.location || '').trim(),
    deadline: String(input.deadline || '').trim(),
    customisation: Boolean(input.customisation || /custom|logo|personal/i.test(text)),
  };
}

export function scoreMatch(requirement, product) {
  let score = 0;
  const reasons = [];
  const gaps = [];
  const sameCategory = !requirement.category || product.category.toLowerCase() === requirement.category.toLowerCase();
  if (sameCategory) { score += 30; reasons.push('Craft category fits'); }
  else gaps.push('Different category');
  const capacity = Number(product.capacity) || 0;
  if (capacity >= requirement.quantity) { score += 24; reasons.push(`Capacity for ${requirement.quantity} units`); }
  else { score += Math.round(24 * Math.min(1, capacity / requirement.quantity)); gaps.push(`Capacity is ${capacity} units`); }
  const budgetFits = !requirement.budget || product.price <= requirement.budget;
  if (budgetFits) { score += 18; reasons.push('Within unit budget'); }
  else gaps.push(`₹${product.price.toLocaleString('en-IN')} exceeds unit budget`);
  const daysAvailable = requirement.deadline ? Math.ceil((new Date(requirement.deadline) - new Date()) / 86400000) : null;
  const timeFits = daysAvailable === null || product.lead_days <= daysAvailable;
  if (timeFits) { score += 13; reasons.push('Lead time fits'); }
  else gaps.push('Lead time may exceed deadline');
  const ecoRequested = /eco.friendly|sustainable/i.test(requirement.text);
  const materialFits = requirement.material ? product.material.toLowerCase().includes(requirement.material.toLowerCase())
    : !ecoRequested || /jute|bamboo|cotton|recycled/i.test(product.material);
  if (materialFits) { score += 8; reasons.push(ecoRequested && !requirement.material ? 'Natural-fibre material' : 'Material fits'); }
  else gaps.push('Different material');
  if (!requirement.location || product.region.toLowerCase().includes(requirement.location.toLowerCase())) { score += 4; if (requirement.location) reasons.push('Region fits'); }
  const customFits = !requirement.customisation || product.customisation;
  if (customFits) { score += 3; if (requirement.customisation) reasons.push('Customisation available'); }
  else gaps.push('Customisation unconfirmed');
  return { score: Math.min(100, score), reasons, gaps, eligible: sameCategory && capacity >= requirement.quantity && budgetFits && timeFits && materialFits && customFits };
}

export function forecastDemand(rows) {
  const byCategory = Map.groupBy(rows, (row) => row.category);
  return [...byCategory].map(([category, values]) => {
    const sorted = [...values].sort((a, b) => a.month.localeCompare(b.month));
    const recent = sorted.slice(-3).map((row) => row.units);
    const prior = sorted.slice(-6, -3).map((row) => row.units);
    const average = (list) => list.length ? list.reduce((sum, value) => sum + value, 0) / list.length : 0;
    const current = average(recent);
    const previous = average(prior) || current;
    const trend = previous ? Math.max(-0.35, Math.min(0.35, (current - previous) / previous)) : 0;
    return { category, recent, previousAverage: Math.round(previous), currentAverage: Math.round(current),
      nextMonth: Math.max(0, Math.round(current * (1 + trend / 2))), trendPercent: Math.round(trend * 100),
      synthetic: sorted.some((row) => row.synthetic === 1), method: 'three-month moving average with capped trend' };
  }).sort((a, b) => b.nextMonth - a.nextMonth);
}
