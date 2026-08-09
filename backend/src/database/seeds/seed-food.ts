import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

// Idempotent seed for the Food vertical demo data — mirrors seed-market.ts:
// never deletes existing rows, safe to re-run. Run with `npm run seed:food`.
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

const VENDOR_PHONE = '+998901234574';
const RESTAURANT_NAME = 'Mix Burger';

const HOURS = [
  { day: 'Dushanba', open: true, from: '10:00', to: '23:00' },
  { day: 'Seshanba', open: true, from: '10:00', to: '23:00' },
  { day: 'Chorshanba', open: true, from: '10:00', to: '23:00' },
  { day: 'Payshanba', open: true, from: '10:00', to: '23:00' },
  { day: 'Juma', open: true, from: '10:00', to: '00:00' },
  { day: 'Shanba', open: true, from: '11:00', to: '00:00' },
  { day: 'Yakshanba', open: false, from: '11:00', to: '23:00' },
];

const CATEGORIES = ['Burgerlar', 'Garnirlar', 'Ichimliklar', 'Souslar', 'Desertlar'];

const DISHES: Array<{
  name: string;
  description: string;
  category: string;
  price: number;
  prepMinutes: number;
  isAvailable: boolean;
  tags: string[];
}> = [
  { name: 'Klassik Burger', description: "Mol go'shti kotleti, pomidor, salat, sous", category: 'Burgerlar', price: 32000, prepMinutes: 12, isAvailable: true, tags: ['Ommabop'] },
  { name: 'Chizburger', description: 'Cheddar pishloqli klassik burger', category: 'Burgerlar', price: 36000, prepMinutes: 12, isAvailable: true, tags: [] },
  { name: 'Double Mix Burger', description: "Ikki qavat go'sht, ikki qavat pishloq", category: 'Burgerlar', price: 52000, prepMinutes: 15, isAvailable: true, tags: ['Hit', 'Achchiq'] },
  { name: 'Chicken Burger', description: 'Tovuq filesi, cheddar, chipotle sous', category: 'Burgerlar', price: 38000, prepMinutes: 13, isAvailable: false, tags: [] },
  { name: 'Kartoshka fri', description: 'Tuzli, xrustyashiy kartoshka', category: 'Garnirlar', price: 18000, prepMinutes: 6, isAvailable: true, tags: [] },
  { name: 'Nagets (6 dona)', description: 'Tovuq naggetslari, sous bilan', category: 'Garnirlar', price: 24000, prepMinutes: 8, isAvailable: true, tags: [] },
  { name: 'Coca-Cola 0.5L', description: 'Sovuq gazlangan ichimlik', category: 'Ichimliklar', price: 9000, prepMinutes: 1, isAvailable: true, tags: [] },
  { name: 'Ayron', description: 'Tabiiy ayron, 0.33L', category: 'Ichimliklar', price: 7000, prepMinutes: 1, isAvailable: true, tags: [] },
  { name: 'BBQ sous', description: 'Tutunli barbekyu sousi', category: 'Souslar', price: 5000, prepMinutes: 1, isAvailable: true, tags: [] },
  { name: 'Cheesecake', description: "Nyu-York uslubidagi chizkeyk", category: 'Desertlar', price: 28000, prepMinutes: 3, isAvailable: true, tags: ['Yangi'] },
];

async function seedFood(): Promise<void> {
  await AppDataSource.initialize();
  console.log('Database connected. Seeding Food demo data...');
  const qr = AppDataSource.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();

  try {
    let [vendorUser] = (await qr.query(`SELECT id FROM users WHERE phone = $1;`, [
      VENDOR_PHONE,
    ])) as Array<{ id: string }>;

    if (!vendorUser) {
      [vendorUser] = (await qr.query(
        // referral_code is NOT NULL + UNIQUE on the users table; omitting it
        // made every vendor seed fail outright.
        `INSERT INTO users (phone, first_name, last_name, role, status, referral_code)
         VALUES ($1, 'Mix', 'Burger', 'restaurant', 'active', 'RSTRN1')
         RETURNING id;`,
        [VENDOR_PHONE],
      )) as Array<{ id: string }>;
      console.log(`Vendor user created: ${vendorUser.id} (${VENDOR_PHONE})`);
    } else {
      console.log(`Vendor user already exists: ${vendorUser.id}`);
    }

    let [restaurant] = (await qr.query(`SELECT id FROM restaurants WHERE owner_user_id = $1;`, [
      vendorUser.id,
    ])) as Array<{ id: string }>;

    if (!restaurant) {
      [restaurant] = (await qr.query(
        `INSERT INTO restaurants (owner_user_id, name, phone, address, lat, lng, hours, delivery_radius_km, commission_rate, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 7, 15.00, 'active')
         RETURNING id;`,
        [
          vendorUser.id,
          RESTAURANT_NAME,
          VENDOR_PHONE,
          "Angren sh., Mustaqillik ko'chasi 30",
          40.105,
          70.95,
          JSON.stringify(HOURS),
        ],
      )) as Array<{ id: string }>;
      console.log(`Restaurant created: ${restaurant.id} (${RESTAURANT_NAME})`);
    } else {
      console.log(`Restaurant already exists: ${restaurant.id}`);
    }

    const [existingTariff] = (await qr.query(
      `SELECT id FROM tariffs WHERE service_type = 'food' LIMIT 1;`,
    )) as Array<{ id: string }>;
    if (!existingTariff) {
      await qr.query(`
        INSERT INTO tariffs (name, service_type, base_price, price_per_km, price_per_min, min_price, is_active)
        VALUES ('Ovqat yetkazish', 'food', 5000, 1000, 200, 8000, true);
      `);
      console.log('Food delivery tariff created');
    }

    const categoryIds = new Map<string, string>();
    for (let i = 0; i < CATEGORIES.length; i++) {
      const name = CATEGORIES[i];
      let [row] = (await qr.query(
        `SELECT id FROM menu_categories WHERE restaurant_id = $1 AND name = $2;`,
        [restaurant.id, name],
      )) as Array<{ id: string }>;
      if (!row) {
        [row] = (await qr.query(
          `INSERT INTO menu_categories (restaurant_id, name, sort_order) VALUES ($1, $2, $3) RETURNING id;`,
          [restaurant.id, name, i],
        )) as Array<{ id: string }>;
        console.log(`Category created: ${name}`);
      }
      categoryIds.set(name, row.id);
    }

    for (const dish of DISHES) {
      const [existing] = (await qr.query(
        `SELECT id FROM dishes WHERE restaurant_id = $1 AND name = $2;`,
        [restaurant.id, dish.name],
      )) as Array<{ id: string }>;
      if (existing) continue;

      await qr.query(
        `INSERT INTO dishes (restaurant_id, category_id, name, description, price, prep_minutes, is_available, tags)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
        [
          restaurant.id,
          categoryIds.get(dish.category) ?? null,
          dish.name,
          dish.description,
          dish.price,
          dish.prepMinutes,
          dish.isAvailable,
          JSON.stringify(dish.tags),
        ],
      );
      console.log(`Dish created: ${dish.name}`);
    }

    await qr.commitTransaction();

    console.log('\n=== FOOD SEED COMPLETED ===');
    console.log(`Vendor login: ${VENDOR_PHONE} (role: restaurant, OTP per OTP_BYPASS_ENABLED config)`);
    console.log(`Restaurant: ${RESTAURANT_NAME} (${restaurant.id})`);
    console.log('============================\n');
  } catch (err) {
    await qr.rollbackTransaction();
    console.error('Food seed failed:', err);
    throw err;
  } finally {
    await qr.release();
    await AppDataSource.destroy();
  }
}

seedFood().catch((err) => {
  console.error(err);
  process.exit(1);
});
