import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { DataSource, QueryRunner } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as dotenv from 'dotenv';
import { createObjectStorage } from '../../modules/storage/storage.module';
import { catalogImageKey, stableUuid } from '../../modules/storage/catalog-images';
import type { ObjectStorage } from '../../modules/storage/object-storage';

dotenv.config();

/**
 * Ko'rsatuv uchun to'liq katalog: 5 ta restoran (menyu + fotolar), do'kon
 * mahsulotlari fotolar bilan va bosh ekran uchun 3 ta reklama banneri.
 *
 * Idempotent: hech narsani o'chirmaydi, nom/SKU bo'yicha topib to'ldiradi,
 * rasm kalitlari urug'dan barqaror — qayta ishga tushirish xavfsiz.
 * Avval `seed:food` / `seed:market` shart emas (Mix Burger va Dehqon Bozori
 * bo'lmasa yaratiladi).
 *
 * Rasmlar `backend/demo-assets/` da (Unsplash litsenziyasi, mualliflar
 * `CREDITS.json` da). Ishga tushirish: `npm run seed:demo`.
 */
const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env['DB_HOST'] || 'localhost',
  port: parseInt(process.env['DB_PORT'] || '5432'),
  username: process.env['DB_USER'] || 'postgres',
  password: process.env['DB_PASS'] || 'postgres',
  database: process.env['DB_NAME'] || 'angren_taxi',
  entities: [__dirname + '/../entities/*.entity{.ts,.js}'],
  synchronize: false,
  logging: false,
});

const ASSETS_DIR = path.resolve(process.cwd(), 'demo-assets');

// Angren markazi (mobil AppConfig.defaultLat/Lng bilan bir xil). Avvalgi
// seed koordinatalari ~120 km narida edi — yetkazish radiusidan tashqarida.
const CENTER = { lat: 41.0212, lng: 70.0795 };

const HOURS = [
  'Dushanba',
  'Seshanba',
  'Chorshanba',
  'Payshanba',
  'Juma',
  'Shanba',
  'Yakshanba',
].map((day) => ({ day, open: true, from: '09:00', to: '23:00' }));

interface DemoDish {
  name: string;
  description: string;
  category: string;
  price: number;
  prepMinutes: number;
  image: string;
  tags?: string[];
}

interface DemoRestaurant {
  name: string;
  phone: string;
  address: string;
  offset: [number, number];
  image: string;
  categories: string[];
  dishes: DemoDish[];
}

const RESTAURANTS: DemoRestaurant[] = [
  {
    name: 'Osh Markazi',
    phone: '+998901234598',
    address: "Angren sh., Navoiy ko'chasi 12",
    offset: [0.004, -0.006],
    image: 'r-osh',
    categories: ['Milliy taomlar', 'Shashlik', 'Salatlar', 'Ichimliklar'],
    dishes: [
      { name: 'Toshkent oshi', description: "Devzira guruch, mol go'shti, sariq sabzi, bedana tuxumi", category: 'Milliy taomlar', price: 35000, prepMinutes: 10, image: 'd-toshkent-oshi', tags: ['Ommabop'] },
      { name: 'Samarqand oshi', description: "Qatlam-qatlam damlangan, qazi bilan", category: 'Milliy taomlar', price: 38000, prepMinutes: 10, image: 'd-samarqand-oshi' },
      { name: "Lag'mon", description: "Qo'lda cho'zilgan xamir, go'shtli sabzavotli sous", category: 'Milliy taomlar', price: 30000, prepMinutes: 15, image: 'd-lagmon' },
      { name: 'Manti (5 dona)', description: "Qo'y go'shti va piyoz, qatiq bilan", category: 'Milliy taomlar', price: 28000, prepMinutes: 20, image: 'd-manti' },
      { name: 'Tandir somsa', description: "Go'shtli, qatlama xamirda", category: 'Milliy taomlar', price: 8000, prepMinutes: 5, image: 'd-somsa', tags: ['Hit'] },
      { name: "Mol go'shti shashlik", description: '1 six, piyoz va non bilan', category: 'Shashlik', price: 18000, prepMinutes: 15, image: 'd-shashlik' },
      { name: 'Assorti shashlik', description: "Go'sht, sabzavot va garnir", category: 'Shashlik', price: 45000, prepMinutes: 20, image: 'd-jigar' },
      { name: 'Achchiq-chuchuk', description: 'Pomidor, piyoz, rayhon', category: 'Salatlar', price: 10000, prepMinutes: 5, image: 'd-achchiq-chuchuk' },
      { name: 'Patir non', description: 'Tandirdan issiq', category: 'Salatlar', price: 5000, prepMinutes: 2, image: 'd-non' },
      { name: "Ko'k choy (choynak)", description: "Damlangan ko'k choy", category: 'Ichimliklar', price: 5000, prepMinutes: 3, image: 'd-kok-choy' },
    ],
  },
  {
    name: 'Lavash House',
    phone: '+998901234591',
    address: "Angren sh., Mustaqillik ko'chasi 4",
    offset: [-0.003, 0.005],
    image: 'r-lavash',
    categories: ['Lavash', 'Fast food', 'Ichimliklar'],
    dishes: [
      { name: 'Lavash klassik', description: "Tovuq go'shti, pomidor, bodring, sous", category: 'Lavash', price: 28000, prepMinutes: 8, image: 'd-lavash', tags: ['Ommabop'] },
      { name: 'Pishloqli lavash', description: 'Ikki karra pishloq, tovuq', category: 'Lavash', price: 32000, prepMinutes: 8, image: 'd-pishloqli-lavash' },
      { name: 'Shaurma', description: "Mol go'shti, karam salati, sarimsoq sous", category: 'Lavash', price: 30000, prepMinutes: 8, image: 'd-shaurma' },
      { name: 'Hot-dog', description: 'Sosiska, xantal, ketchup', category: 'Fast food', price: 18000, prepMinutes: 5, image: 'd-hotdog' },
      { name: 'Kartoshka fri', description: 'Katta porsiya', category: 'Fast food', price: 15000, prepMinutes: 6, image: 'd-fri-lavash' },
      { name: 'Limonad', description: 'Uy limonadi, yalpiz bilan, 0.5L', category: 'Ichimliklar', price: 12000, prepMinutes: 2, image: 'd-lemonad', tags: ['Yangi'] },
    ],
  },
  {
    name: 'Mix Burger',
    phone: '+998901234574',
    address: "Angren sh., Mustaqillik ko'chasi 30",
    offset: [0.002, 0.009],
    image: 'r-burger',
    categories: ['Burgerlar', 'Garnirlar', 'Ichimliklar', 'Souslar', 'Desertlar'],
    dishes: [
      { name: 'Klassik Burger', description: "Mol go'shti kotleti, pomidor, salat, sous", category: 'Burgerlar', price: 32000, prepMinutes: 12, image: 'd-klassik-burger', tags: ['Ommabop'] },
      { name: 'Chizburger', description: 'Cheddar pishloqli klassik burger', category: 'Burgerlar', price: 36000, prepMinutes: 12, image: 'd-chizburger' },
      { name: 'Double Mix Burger', description: "Ikki qavat go'sht, ikki qavat pishloq", category: 'Burgerlar', price: 52000, prepMinutes: 15, image: 'd-double-burger', tags: ['Hit', 'Achchiq'] },
      { name: 'Chicken Burger', description: 'Tovuq filesi, cheddar, chipotle sous', category: 'Burgerlar', price: 38000, prepMinutes: 13, image: 'd-chicken-burger' },
      { name: 'Kartoshka fri', description: 'Tuzli, qarsildoq kartoshka', category: 'Garnirlar', price: 18000, prepMinutes: 6, image: 'd-kartoshka-fri' },
      { name: 'Nagets (6 dona)', description: 'Tovuq naggetslari, sous bilan', category: 'Garnirlar', price: 24000, prepMinutes: 8, image: 'd-nagets' },
      { name: 'Coca-Cola 0.5L', description: 'Sovuq gazlangan ichimlik', category: 'Ichimliklar', price: 9000, prepMinutes: 1, image: 'd-cola' },
      { name: 'Ayron', description: 'Tabiiy ayron, 0.33L', category: 'Ichimliklar', price: 7000, prepMinutes: 1, image: 'd-ayron' },
      { name: 'BBQ sous', description: 'Tutunli barbekyu sousi', category: 'Souslar', price: 5000, prepMinutes: 1, image: 'd-bbq' },
      { name: 'Cheesecake', description: 'Nyu-York uslubidagi chizkeyk', category: 'Desertlar', price: 28000, prepMinutes: 3, image: 'd-cheesecake', tags: ['Yangi'] },
    ],
  },
  {
    name: 'Pizza Angren',
    phone: '+998901234592',
    address: "Angren sh., Bobur ko'chasi 7",
    offset: [-0.006, -0.004],
    image: 'r-pizza',
    categories: ['Pitsalar', 'Salatlar', 'Ichimliklar'],
    dishes: [
      { name: 'Margarita', description: 'Pomidor sousi, motsarella, rayhon · 30 sm', category: 'Pitsalar', price: 55000, prepMinutes: 18, image: 'd-margarita' },
      { name: 'Pepperoni', description: 'Achchiq kolbasa, motsarella · 30 sm', category: 'Pitsalar', price: 65000, prepMinutes: 18, image: 'd-pepperoni', tags: ['Ommabop'] },
      { name: "To'rt pishloq", description: 'Motsarella, cheddar, parmezan, dorblyu · 30 sm', category: 'Pitsalar', price: 70000, prepMinutes: 18, image: 'd-4cheese' },
      { name: "Go'shtli pitsa", description: "Mol go'shti, tovuq, qo'ziqorin · 30 sm", category: 'Pitsalar', price: 72000, prepMinutes: 20, image: 'd-meat-pizza', tags: ['Hit'] },
      { name: 'Sezar salat', description: 'Tovuq, aysberg, parmezan, krutonlar', category: 'Salatlar', price: 32000, prepMinutes: 8, image: 'd-sezar' },
      { name: 'Gazli ichimlik 1L', description: 'Coca-Cola, Fanta yoki Sprite', category: 'Ichimliklar', price: 14000, prepMinutes: 1, image: 'd-cola-1l' },
    ],
  },
  {
    name: 'Shirin Kafe',
    phone: '+998901234593',
    address: "Angren sh., Ohangaron ko'chasi 21",
    offset: [0.007, 0.002],
    image: 'r-kafe',
    categories: ['Qahva', 'Desertlar', 'Pishiriqlar'],
    dishes: [
      { name: 'Kapuchino', description: 'Espresso va ko\'pirtirilgan sut · 300 ml', category: 'Qahva', price: 18000, prepMinutes: 4, image: 'd-kapuchino', tags: ['Ommabop'] },
      { name: 'Latte', description: 'Yumshoq sutli qahva · 400 ml', category: 'Qahva', price: 20000, prepMinutes: 4, image: 'd-latte' },
      { name: 'Napoleon', description: 'Qatlama xamir, vanil kremi', category: 'Desertlar', price: 22000, prepMinutes: 2, image: 'd-napoleon' },
      { name: 'Medovik', description: 'Asalli tort, smetanali krem', category: 'Desertlar', price: 22000, prepMinutes: 2, image: 'd-medovik', tags: ['Hit'] },
      { name: 'Tiramisu', description: 'Maskarpone, savoyardi, kakao', category: 'Desertlar', price: 26000, prepMinutes: 2, image: 'd-tiramisu' },
      { name: 'Muzqaymoq (3 shar)', description: 'Vanil, shokolad, qulupnay', category: 'Desertlar', price: 15000, prepMinutes: 2, image: 'd-muzqaymoq' },
      { name: 'Kruassan', description: "Sariyog'li, yangi pishgan", category: 'Pishiriqlar', price: 14000, prepMinutes: 2, image: 'd-kruassan' },
    ],
  },
];

const STORE = {
  name: 'Dehqon Bozori',
  phone: '+998901234573',
  address: "Angren sh., Bozor ko'chasi 14",
  offset: [-0.002, -0.009] as [number, number],
  image: 's-market',
};

const MARKET_CATEGORIES = [
  { name: 'Oziq-ovqat', emoji: '🍚' },
  { name: 'Ichimliklar', emoji: '🥤' },
  { name: 'Sabzavot', emoji: '🥕' },
  { name: 'Mevalar', emoji: '🍎' },
  { name: 'Sut mahsulotlari', emoji: '🥛' },
  { name: 'Shirinliklar', emoji: '🍫' },
  { name: "Uy-ro'zg'or", emoji: '🧴' },
];

interface DemoProduct {
  sku: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  unit: string;
  emoji: string;
  hue: number;
  image: string;
}

// Mavjud SKU larga faqat rasm qo'shiladi (narx/zaxira sotuvchiniki);
// yo'qlari to'liq yaratiladi.
const PRODUCTS: DemoProduct[] = [
  { sku: 'GRC-1001', name: 'Guruch Lazer 1kg', category: 'Oziq-ovqat', price: 22000, stock: 48, unit: 'kg', emoji: '🌾', hue: 45, image: 'p-guruch' },
  { sku: 'OIL-2003', name: "Osh yog'i Oleyna 1L", category: 'Oziq-ovqat', price: 31000, stock: 26, unit: 'litr', emoji: '🫗', hue: 38, image: 'p-yog' },
  { sku: 'UN-1120', name: 'Un Oltin Boshoq 2kg', category: 'Oziq-ovqat', price: 18000, stock: 0, unit: 'dona', emoji: '🌾', hue: 40, image: 'p-un' },
  { sku: 'SHK-1005', name: 'Shakar oq 1kg', category: 'Oziq-ovqat', price: 13500, stock: 120, unit: 'kg', emoji: '🧂', hue: 210, image: 'p-shakar' },
  { sku: 'CHY-3007', name: 'Choy Ahmad 100g', category: 'Ichimliklar', price: 24000, stock: 9, unit: 'dona', emoji: '🍵', hue: 150, image: 'p-choy' },
  { sku: 'SUV-4001', name: 'Suv Nestle 1.5L', category: 'Ichimliklar', price: 6000, stock: 0, unit: 'dona', emoji: '💧', hue: 200, image: 'p-suv' },
  { sku: 'SBZ-5002', name: 'Kartoshka', category: 'Sabzavot', price: 4500, stock: 230, unit: 'kg', emoji: '🥔', hue: 30, image: 'p-kartoshka' },
  { sku: 'TXM-6010', name: 'Tuxum 10 dona', category: 'Oziq-ovqat', price: 18000, stock: 40, unit: 'dona', emoji: '🥚', hue: 48, image: 'p-tuxum' },
  { sku: 'UYR-7008', name: 'Sovun Safeguard', category: "Uy-ro'zg'or", price: 9500, stock: 0, unit: 'dona', emoji: '🧼', hue: 280, image: 'p-sovun' },
  { sku: 'SBZ-5010', name: 'Pomidor', category: 'Sabzavot', price: 12000, stock: 80, unit: 'kg', emoji: '🍅', hue: 5, image: 'p-pomidor' },
  { sku: 'SBZ-5011', name: 'Bodring', category: 'Sabzavot', price: 9000, stock: 65, unit: 'kg', emoji: '🥒', hue: 110, image: 'p-bodring' },
  { sku: 'SBZ-5012', name: 'Piyoz', category: 'Sabzavot', price: 4000, stock: 150, unit: 'kg', emoji: '🧅', hue: 300, image: 'p-piyoz' },
  { sku: 'SBZ-5013', name: 'Sabzi (sariq)', category: 'Sabzavot', price: 5000, stock: 140, unit: 'kg', emoji: '🥕', hue: 25, image: 'p-sabzi' },
  { sku: 'MVA-8001', name: 'Olma Golden', category: 'Mevalar', price: 15000, stock: 90, unit: 'kg', emoji: '🍎', hue: 0, image: 'p-olma' },
  { sku: 'MVA-8002', name: 'Banan', category: 'Mevalar', price: 22000, stock: 55, unit: 'kg', emoji: '🍌', hue: 52, image: 'p-banan' },
  { sku: 'SUT-9001', name: 'Sut 2.5% 1L', category: 'Sut mahsulotlari', price: 12000, stock: 40, unit: 'dona', emoji: '🥛', hue: 210, image: 'p-sut' },
  { sku: 'SUT-9002', name: 'Qatiq 0.5L', category: 'Sut mahsulotlari', price: 9000, stock: 35, unit: 'dona', emoji: '🥛', hue: 200, image: 'p-qatiq' },
  { sku: 'SUT-9003', name: 'Pishloq Gollandskiy 300g', category: 'Sut mahsulotlari', price: 38000, stock: 20, unit: 'dona', emoji: '🧀', hue: 45, image: 'p-pishloq' },
  { sku: 'OZQ-1201', name: 'Makaron Makfa 400g', category: 'Oziq-ovqat', price: 11000, stock: 70, unit: 'dona', emoji: '🍝', hue: 42, image: 'p-makaron' },
  { sku: 'ICH-4010', name: 'Apelsin sharbati 1L', category: 'Ichimliklar', price: 19000, stock: 30, unit: 'dona', emoji: '🧃', hue: 30, image: 'p-sharbat' },
  { sku: 'ICH-4011', name: 'Qahva donalari 250g', category: 'Ichimliklar', price: 65000, stock: 15, unit: 'dona', emoji: '☕', hue: 25, image: 'p-kofe' },
  { sku: 'SHR-9101', name: 'Shokolad batonchiklari to\'plami', category: 'Shirinliklar', price: 45000, stock: 25, unit: 'dona', emoji: '🍫', hue: 20, image: 'p-shokolad' },
];

interface DemoBanner {
  title: string;
  image: string;
  link: { type: 'none' } | { type: 'restaurant'; name: string } | { type: 'store' };
}

const BANNERS: DemoBanner[] = [
  { title: 'Demo: Osh Markazi', image: 'b-food', link: { type: 'restaurant', name: 'Osh Markazi' } },
  { title: "Demo: Dehqon Bozori", image: 'b-market', link: { type: 'store' } },
  { title: 'Demo: Angren Taxi', image: 'b-taxi', link: { type: 'none' } },
];

async function uploadImage(storage: ObjectStorage, name: string, key: string): Promise<string> {
  const file = path.join(ASSETS_DIR, `${name}.jpg`);
  await storage.put(key, fs.readFileSync(file), 'image/jpeg');
  return key;
}

function catalogImage(storage: ObjectStorage, name: string): Promise<string> {
  return uploadImage(storage, name, catalogImageKey(`demo:${name}`, '.jpg'));
}

/** Vendor foydalanuvchi — telefon bo'yicha topiladi yoki yaratiladi. */
async function ensureVendor(qr: QueryRunner, phone: string, name: string, role: 'restaurant' | 'market'): Promise<string> {
  const [found] = (await qr.query(`SELECT id FROM users WHERE phone = $1`, [phone])) as Array<{ id: string }>;
  if (found) return found.id;
  const [created] = (await qr.query(
    `INSERT INTO users (phone, first_name, last_name, role, status, referral_code)
     VALUES ($1, $2, '', $3, 'active', $4) RETURNING id`,
    [phone, name, role, `DM${phone.slice(-6)}`],
  )) as Array<{ id: string }>;
  return created.id;
}

async function seedRestaurant(qr: QueryRunner, storage: ObjectStorage, r: DemoRestaurant): Promise<string> {
  const ownerId = await ensureVendor(qr, r.phone, r.name, 'restaurant');
  const imageKey = await catalogImage(storage, r.image);
  const lat = CENTER.lat + r.offset[0];
  const lng = CENTER.lng + r.offset[1];

  let [row] = (await qr.query(`SELECT id FROM restaurants WHERE owner_user_id = $1`, [ownerId])) as Array<{ id: string }>;
  if (row) {
    await qr.query(
      `UPDATE restaurants SET lat = $2, lng = $3, image_key = $4, address = COALESCE(address, $5), status = 'active' WHERE id = $1`,
      [row.id, lat, lng, imageKey, r.address],
    );
  } else {
    [row] = (await qr.query(
      `INSERT INTO restaurants (owner_user_id, name, phone, address, lat, lng, hours, delivery_radius_km, commission_rate, status, image_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 7, 15.00, 'active', $8) RETURNING id`,
      [ownerId, r.name, r.phone, r.address, lat, lng, JSON.stringify(HOURS), imageKey],
    )) as Array<{ id: string }>;
  }

  const categoryIds = new Map<string, string>();
  for (const [i, name] of r.categories.entries()) {
    let [cat] = (await qr.query(`SELECT id FROM menu_categories WHERE restaurant_id = $1 AND name = $2`, [row.id, name])) as Array<{ id: string }>;
    if (!cat) {
      [cat] = (await qr.query(
        `INSERT INTO menu_categories (restaurant_id, name, sort_order) VALUES ($1, $2, $3) RETURNING id`,
        [row.id, name, i],
      )) as Array<{ id: string }>;
    }
    categoryIds.set(name, cat.id);
  }

  for (const dish of r.dishes) {
    const dishImage = await catalogImage(storage, dish.image);
    const [existing] = (await qr.query(`SELECT id FROM dishes WHERE restaurant_id = $1 AND name = $2`, [row.id, dish.name])) as Array<{ id: string }>;
    if (existing) {
      await qr.query(`UPDATE dishes SET image_key = $2 WHERE id = $1`, [existing.id, dishImage]);
      continue;
    }
    await qr.query(
      `INSERT INTO dishes (restaurant_id, category_id, name, description, price, prep_minutes, is_available, tags, image_key)
       VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8)`,
      [row.id, categoryIds.get(dish.category) ?? null, dish.name, dish.description, dish.price, dish.prepMinutes, JSON.stringify(dish.tags ?? []), dishImage],
    );
  }
  console.log(`✓ ${r.name}: ${r.dishes.length} ta taom`);
  return row.id;
}

async function seedStore(qr: QueryRunner, storage: ObjectStorage): Promise<string> {
  const ownerId = await ensureVendor(qr, STORE.phone, STORE.name, 'market');
  const imageKey = await catalogImage(storage, STORE.image);
  const lat = CENTER.lat + STORE.offset[0];
  const lng = CENTER.lng + STORE.offset[1];

  let [store] = (await qr.query(`SELECT id FROM stores WHERE owner_user_id = $1`, [ownerId])) as Array<{ id: string }>;
  if (store) {
    await qr.query(`UPDATE stores SET lat = $2, lng = $3, image_key = $4 WHERE id = $1`, [store.id, lat, lng, imageKey]);
  } else {
    [store] = (await qr.query(
      `INSERT INTO stores (owner_user_id, name, phone, address, lat, lng, delivery_mode, low_stock_threshold, status, image_key)
       VALUES ($1, $2, $3, $4, $5, $6, 'platform', 10, 'active', $7) RETURNING id`,
      [ownerId, STORE.name, STORE.phone, STORE.address, lat, lng, imageKey],
    )) as Array<{ id: string }>;
  }

  const categoryIds = new Map<string, string>();
  for (const [i, cat] of MARKET_CATEGORIES.entries()) {
    let [row] = (await qr.query(`SELECT id FROM market_categories WHERE store_id = $1 AND name = $2`, [store.id, cat.name])) as Array<{ id: string }>;
    if (!row) {
      [row] = (await qr.query(
        `INSERT INTO market_categories (store_id, name, emoji, sort_order, is_active) VALUES ($1, $2, $3, $4, true) RETURNING id`,
        [store.id, cat.name, cat.emoji, i],
      )) as Array<{ id: string }>;
    }
    categoryIds.set(cat.name, row.id);
  }

  for (const p of PRODUCTS) {
    const productImage = await catalogImage(storage, p.image);
    const [existing] = (await qr.query(`SELECT id FROM products WHERE store_id = $1 AND sku = $2`, [store.id, p.sku])) as Array<{ id: string }>;
    if (existing) {
      await qr.query(`UPDATE products SET image_key = $2 WHERE id = $1`, [existing.id, productImage]);
      continue;
    }
    await qr.query(
      `INSERT INTO products (store_id, category_id, name, sku, price, stock, unit, status, emoji, hue, image_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [store.id, categoryIds.get(p.category) ?? null, p.name, p.sku, p.price, p.stock, p.unit, p.stock > 0 ? 'active' : 'out', p.emoji, p.hue, productImage],
    );
  }
  console.log(`✓ ${STORE.name}: ${PRODUCTS.length} ta mahsulot`);
  return store.id;
}

async function seedBanners(qr: QueryRunner, storage: ObjectStorage, restaurantIds: Map<string, string>, storeId: string): Promise<void> {
  for (const [i, b] of BANNERS.entries()) {
    // Reklama endpoint'i faqat `ads/<uuid>.<ext>` kalitini qabul qiladi.
    const imageKey = await uploadImage(storage, b.image, `ads/${stableUuid(`demo:${b.image}`)}.jpg`);
    const target =
      b.link.type === 'restaurant' ? (restaurantIds.get(b.link.name) ?? null) : b.link.type === 'store' ? storeId : null;
    const [existing] = (await qr.query(`SELECT id FROM ad_banners WHERE title = $1`, [b.title])) as Array<{ id: string }>;
    if (existing) {
      await qr.query(`UPDATE ad_banners SET image_key = $2, link_type = $3, link_target = $4 WHERE id = $1`, [existing.id, imageKey, b.link.type, target]);
      continue;
    }
    await qr.query(
      `INSERT INTO ad_banners (title, image_key, link_type, link_target, is_active, sort_order) VALUES ($1, $2, $3, $4, true, $5)`,
      [b.title, imageKey, b.link.type, target, i],
    );
  }
  console.log(`✓ ${BANNERS.length} ta reklama banneri`);
}

async function seedDemo(): Promise<void> {
  if (!fs.existsSync(ASSETS_DIR)) {
    throw new Error(`Rasmlar papkasi topilmadi: ${ASSETS_DIR} (backend/ papkasidan ishga tushiring)`);
  }
  const storage = createObjectStorage(new ConfigService(process.env));
  await AppDataSource.initialize();
  const qr = AppDataSource.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();
  try {
    const restaurantIds = new Map<string, string>();
    for (const r of RESTAURANTS) {
      restaurantIds.set(r.name, await seedRestaurant(qr, storage, r));
    }
    const storeId = await seedStore(qr, storage);
    await seedBanners(qr, storage, restaurantIds, storeId);
    await qr.commitTransaction();
    console.log(`\nDemo katalog tayyor (rasmlar: ${storage.driver}).`);
  } catch (err) {
    await qr.rollbackTransaction();
    throw err;
  } finally {
    await qr.release();
    await AppDataSource.destroy();
  }
}

seedDemo().catch((err) => {
  console.error('Demo seed xatosi:', err);
  process.exit(1);
});
