import { db, migrate, transaction } from './db.js';
import { hashPassword } from './core.js';

if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_SEED !== '1') {
  throw new Error('Demo seed is disabled in production. Set ALLOW_DEMO_SEED=1 only for a public demo.');
}

await migrate();
const password = hashPassword(process.env.DEMO_PASSWORD || 'Demo@26090');
const users = [
  ['artisan-savita', 'Savita Shinde', 'savita@tantu.demo', 'artisan', 'mr'],
  ['artisan-meera', 'Meera Kumari', 'meera@tantu.demo', 'artisan', 'hi'],
  ['artisan-asha', 'Asha Patil', 'asha@tantu.demo', 'artisan', 'mr'],
  ['artisan-farah', 'Farah Khan', 'farah@tantu.demo', 'artisan', 'hi'],
  ['artisan-nandini', 'Nandini Das', 'nandini@tantu.demo', 'artisan', 'hi'],
  ['buyer-demo', 'Riya Mehta', 'buyer@tantu.demo', 'buyer', 'en'],
  ['admin-demo', 'Tantu Admin', 'admin@tantu.demo', 'admin', 'en'],
];
const artisans = [
  ['artisan-savita', 'Paithani weaving', 'Yeola, Maharashtra', 'Third-generation weaver keeping the peacock-border Paithani tradition alive through a family workshop.', 18, 16, 21, 1],
  ['artisan-meera', 'Terracotta', 'Jaipur, Rajasthan', 'Creates everyday clay pieces with patterns inspired by the courtyards of her neighbourhood.', 12, 260, 8, 1],
  ['artisan-asha', 'Jute craft', 'Pune, Maharashtra', 'Leads a small women-run workshop making durable, useful bags for local and bulk orders.', 9, 180, 12, 1],
  ['artisan-farah', 'Blue pottery', 'Jaipur, Rajasthan', 'Paints cobalt floral motifs by hand and works with local potters on small batches.', 14, 45, 16, 0],
  ['artisan-nandini', 'Jute craft', 'Kolkata, West Bengal', 'Runs a small workshop making sturdy jute bags with hand-printed patterns for events and everyday use.', 11, 135, 16, 1],
];
const products = [
  ['prod-paithani', 'artisan-savita', 'Midnight Peacock Paithani Saree', 'A handwoven silk Paithani with an intricate peacock zari border.', 'Textiles', 'Paithani weaving', 'Silk and zari', 'Indigo, antique gold', 'Handloom weaving', 'Yeola, Maharashtra', 'Dry clean only', 'Woven over eighteen days on a family handloom.', '/images/paithani.png', 12400, 8, 16, 21],
  ['prod-diya', 'artisan-meera', 'Courtyard Terracotta Diyas · Set of 6', 'Six hand-shaped clay diyas with a quiet carved pattern.', 'Home & Decor', 'Terracotta', 'Terracotta clay', 'Natural clay', 'Hand shaping and firing', 'Jaipur, Rajasthan', 'Wipe with a dry cloth', 'Made in small batches using locally sourced clay.', '/images/diyas.png', 420, 120, 260, 8],
  ['prod-jute', 'artisan-asha', 'Leaf Print Jute Gift Bag', 'A reusable jute bag made for thoughtful gifting and bulk events.', 'Bags & Accessories', 'Jute craft', 'Jute', 'Natural, olive', 'Stitching and block printing', 'Pune, Maharashtra', 'Spot clean', 'Hand assembled by a women-run workshop in Pune.', '/images/jute.png', 280, 72, 180, 12],
  ['prod-pottery', 'artisan-farah', 'Cobalt Garden Blue Pottery Vase', 'Handpainted blue pottery vase with floral cobalt motifs.', 'Home & Decor', 'Blue pottery', 'Ceramic', 'Cobalt, white', 'Hand painting and glazing', 'Jaipur, Rajasthan', 'Wipe gently; do not soak', 'Painted by hand in Farah’s Jaipur studio.', '/images/pottery.png', 1850, 18, 45, 16],
  ['prod-shawl', 'artisan-savita', 'Indigo Paithani Silk Wrap', 'A lighter handwoven wrap inspired by Paithani borders.', 'Textiles', 'Paithani weaving', 'Silk and zari', 'Indigo, gold', 'Handloom weaving', 'Yeola, Maharashtra', 'Dry clean only', 'A smaller piece with the same care as a full saree.', '/images/paithani.png', 4700, 12, 24, 14],
  ['prod-bulkbag', 'artisan-asha', 'Custom Jute Event Bags · Bulk', 'Practical reusable bags for events, with optional custom print.', 'Bags & Accessories', 'Jute craft', 'Jute', 'Natural', 'Stitching and block printing', 'Pune, Maharashtra', 'Spot clean', 'Prepared in coordinated batches for event buyers.', '/images/jute.png', 245, 90, 220, 14],
  ['prod-indigo-jute', 'artisan-nandini', 'Indigo Block Print Jute Tote', 'A sturdy jute tote with handprinted indigo motifs for gifts and everyday use.', 'Bags & Accessories', 'Jute craft', 'Jute', 'Natural, indigo', 'Stitching and block printing', 'Kolkata, West Bengal', 'Spot clean', 'Made in Nandini’s small Kolkata workshop.', '/images/indigo-jute.png', 290, 45, 135, 16],
];

await transaction(async () => {
  const addUser = db.prepare('INSERT OR IGNORE INTO users(id,name,email,password_hash,role,language) VALUES (?,?,?,?,?,?)');
  for (const [id, name, email, role, language] of users) await addUser.run(id, name, email, password, role, language);
  const addArtisan = db.prepare('INSERT OR IGNORE INTO artisans(user_id,craft,region,story,experience_years,capacity,lead_days,customisation) VALUES (?,?,?,?,?,?,?,?)');
  for (const artisan of artisans) await addArtisan.run(...artisan);
  const addProduct = db.prepare(`INSERT OR IGNORE INTO products(id,artisan_id,title,description,category,craft,material,colors,technique,region,care,story,image,price,stock,capacity,lead_days,status,price_breakdown)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'published','{}')`);
  for (const product of products) await addProduct.run(...product);
  const addPassport = db.prepare('INSERT OR IGNORE INTO passports(certificate_id,product_id) VALUES (?,?)');
  for (const product of products) await addPassport.run(`TANTU-DEMO-${product[0].replace('prod-', '').toUpperCase()}`, product[0]);
  await db.prepare(`INSERT OR IGNORE INTO requirements(id,buyer_id,text,category,material,quantity,budget,location,customisation)
    VALUES ('req-demo','buyer-demo','Need 100 handmade eco-friendly gift bags for a corporate event','Bags & Accessories','Jute',100,350,'Pune',1)`).run();
  await db.prepare(`INSERT OR IGNORE INTO enquiries(id,buyer_id,artisan_id,product_id,requirement_id,message)
    VALUES ('enq-demo','buyer-demo','artisan-asha','prod-jute','req-demo','Can you prepare 100 bags with a small event print?')`).run();
  await db.prepare(`INSERT OR IGNORE INTO orders(id,buyer_id,product_id,quantity,unit_price,status)
    VALUES ('order-demo','buyer-demo','prod-diya',2,420,'placed')`).run();
  const month = new Date();
  month.setUTCDate(1);
  const histories = {
    'Textiles': [22, 24, 29, 31, 34, 38],
    'Home & Decor': [38, 42, 45, 48, 55, 60],
    'Bags & Accessories': [28, 30, 35, 42, 48, 56],
  };
  const addHistory = db.prepare('INSERT OR IGNORE INTO sales_history(category,month,units,synthetic) VALUES (?,?,?,1)');
  for (const [category, units] of Object.entries(histories)) {
    for (const [index, count] of units.entries()) {
      const date = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() - (5 - index), 1));
      await addHistory.run(category, date.toISOString().slice(0, 7), count);
    }
  }
});

console.log('Demo data ready. Accounts: savita@tantu.demo, buyer@tantu.demo, admin@tantu.demo.');
