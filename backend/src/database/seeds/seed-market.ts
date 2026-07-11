import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

// Idempotent seed for the Market vertical demo data — unlike seed.ts, this
// script never deletes existing rows. Run with `npm run seed:market`
// (or `npm run seed:market:prod` against compiled dist) any time; it's safe
// to re-run and will just skip anything that already exists.
const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env['DB_HOST'] || 'localhost',
  port: parseInt(process.env['DB_PORT'] || '5432'),
  username: process.env['DB_USER'] || 'postgres',
  password: process.env['DB_PASS'] || 'postgres',
  database: process.env['DB_NAME'] || 'angren_taxi',
  entities: [__dirname + '/../entities/*.entity{.ts,.js}'],
  synchronize: false,
  logging: true,
});

const VENDOR_PHONE = '+998901234573';
const STORE_NAME = 'Dehqon Bozori';

const CATEGORIES = [
  { name: 'Oziq-ovqat', emoji: '🍚', sortOrder: 0 },
  { name: 'Ichimliklar', emoji: '🥤', sortOrder: 1 },
  { name: 'Sabzavot', emoji: '🥕', sortOrder: 2 },
  { name: "Uy-ro'zg'or", emoji: '🧴', sortOrder: 3 },
];

const PRODUCTS: Array<{
  name: string;
  sku: string;
  category: string;
  price: number;
  stock: number;
  unit: string;
  status: string;
  emoji: string;
  hue: number;
}> = [
  { name: 'Guruch Lazer 1kg', sku: 'GRC-1001', category: 'Oziq-ovqat', price: 22000, stock: 48, unit: 'kg', status: 'active', emoji: '🌾', hue: 45 },
  { name: "Osh yog'i Oleyna 1L", sku: 'OIL-2003', category: 'Oziq-ovqat', price: 31000, stock: 6, unit: 'litr', status: 'active', emoji: '🫗', hue: 38 },
  { name: 'Un Oltin Boshoq 2kg', sku: 'UN-1120', category: 'Oziq-ovqat', price: 18000, stock: 0, unit: 'dona', status: 'out', emoji: '🌾', hue: 40 },
  { name: 'Shakar oq 1kg', sku: 'SHK-1005', category: 'Oziq-ovqat', price: 13500, stock: 120, unit: 'kg', status: 'active', emoji: '🧂', hue: 210 },
  { name: 'Choy Ahmad 100g', sku: 'CHY-3007', category: 'Ichimliklar', price: 24000, stock: 9, unit: 'dona', status: 'active', emoji: '🍵', hue: 150 },
  { name: 'Suv Nestle 1.5L', sku: 'SUV-4001', category: 'Ichimliklar', price: 6000, stock: 0, unit: 'dona', status: 'out', emoji: '💧', hue: 200 },
  { name: 'Kartoshka', sku: 'SBZ-5002', category: 'Sabzavot', price: 4500, stock: 230, unit: 'kg', status: 'active', emoji: '🥔', hue: 30 },
  { name: 'Tuxum 10 dona', sku: 'TXM-6010', category: 'Oziq-ovqat', price: 18000, stock: 4, unit: 'dona', status: 'active', emoji: '🥚', hue: 48 },
  { name: 'Sovun Safeguard', sku: 'UYR-7008', category: "Uy-ro'zg'or", price: 9500, stock: 0, unit: 'dona', status: 'hidden', emoji: '🧼', hue: 280 },
];

async function seedMarket(): Promise<void> {
  await AppDataSource.initialize();
  console.log('Database connected. Seeding Market demo data...');
  const qr = AppDataSource.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();

  try {
    let [vendorUser] = (await qr.query(`SELECT id FROM users WHERE phone = $1;`, [
      VENDOR_PHONE,
    ])) as Array<{ id: string }>;

    if (!vendorUser) {
      [vendorUser] = (await qr.query(
        `INSERT INTO users (phone, first_name, last_name, role, status)
         VALUES ($1, 'Dehqon', 'Bozori', 'market', 'active')
         RETURNING id;`,
        [VENDOR_PHONE],
      )) as Array<{ id: string }>;
      console.log(`Vendor user created: ${vendorUser.id} (${VENDOR_PHONE})`);
    } else {
      console.log(`Vendor user already exists: ${vendorUser.id}`);
    }

    let [store] = (await qr.query(`SELECT id FROM stores WHERE owner_user_id = $1;`, [
      vendorUser.id,
    ])) as Array<{ id: string }>;

    if (!store) {
      [store] = (await qr.query(
        `INSERT INTO stores (owner_user_id, name, phone, address, lat, lng, delivery_mode, low_stock_threshold, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'platform', 10, 'active')
         RETURNING id;`,
        [
          vendorUser.id,
          STORE_NAME,
          VENDOR_PHONE,
          "Angren sh., Bozor ko'chasi 14, rastalar qatori B-7",
          40.0956,
          70.9432,
        ],
      )) as Array<{ id: string }>;
      console.log(`Store created: ${store.id} (${STORE_NAME})`);
    } else {
      console.log(`Store already exists: ${store.id}`);
    }

    const [existingTariff] = (await qr.query(
      `SELECT id FROM tariffs WHERE service_type = 'market' LIMIT 1;`,
    )) as Array<{ id: string }>;
    if (!existingTariff) {
      await qr.query(`
        INSERT INTO tariffs (name, service_type, base_price, price_per_km, price_per_min, min_price, is_active)
        VALUES ('Market yetkazish', 'market', 5000, 1000, 200, 8000, true);
      `);
      console.log('Market delivery tariff created');
    }

    const categoryIds = new Map<string, string>();
    for (const cat of CATEGORIES) {
      let [row] = (await qr.query(
        `SELECT id FROM market_categories WHERE store_id = $1 AND name = $2;`,
        [store.id, cat.name],
      )) as Array<{ id: string }>;
      if (!row) {
        [row] = (await qr.query(
          `INSERT INTO market_categories (store_id, name, emoji, sort_order, is_active)
           VALUES ($1, $2, $3, $4, true)
           RETURNING id;`,
          [store.id, cat.name, cat.emoji, cat.sortOrder],
        )) as Array<{ id: string }>;
        console.log(`Category created: ${cat.name}`);
      }
      categoryIds.set(cat.name, row.id);
    }

    for (const p of PRODUCTS) {
      const [existing] = (await qr.query(
        `SELECT id FROM products WHERE store_id = $1 AND sku = $2;`,
        [store.id, p.sku],
      )) as Array<{ id: string }>;
      if (existing) continue;

      await qr.query(
        `INSERT INTO products (store_id, category_id, name, sku, price, stock, unit, status, emoji, hue)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);`,
        [
          store.id,
          categoryIds.get(p.category) ?? null,
          p.name,
          p.sku,
          p.price,
          p.stock,
          p.unit,
          p.status,
          p.emoji,
          p.hue,
        ],
      );
      console.log(`Product created: ${p.name}`);
    }

    await qr.commitTransaction();

    console.log('\n=== MARKET SEED COMPLETED ===');
    console.log(`Vendor login: ${VENDOR_PHONE} (role: market, OTP per OTP_BYPASS_ENABLED config)`);
    console.log(`Store: ${STORE_NAME} (${store.id})`);
    console.log('==============================\n');
  } catch (err) {
    await qr.rollbackTransaction();
    console.error('Market seed failed:', err);
    throw err;
  } finally {
    await qr.release();
    await AppDataSource.destroy();
  }
}

seedMarket().catch((err) => {
  console.error(err);
  process.exit(1);
});
