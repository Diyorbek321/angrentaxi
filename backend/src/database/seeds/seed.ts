import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

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

async function seed(): Promise<void> {
  await AppDataSource.initialize();
  console.log('Database connected. Starting seed...');

  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    // Clear existing data in correct order
    await queryRunner.query(`DELETE FROM transactions;`);
    await queryRunner.query(`DELETE FROM trips;`);
    await queryRunner.query(`DELETE FROM orders;`);
    await queryRunner.query(`DELETE FROM drivers;`);
    await queryRunner.query(`DELETE FROM otps;`);
    await queryRunner.query(`DELETE FROM tariffs;`);
    await queryRunner.query(`DELETE FROM users;`);

    console.log('Existing data cleared.');

    // Insert tariffs
    const [standardTariff] = await queryRunner.query(`
      INSERT INTO tariffs (name, base_price, price_per_km, price_per_min, min_price, is_active)
      VALUES ('Standard', 3000, 1500, 200, 5000, true)
      RETURNING id;
    `) as Array<{ id: string }>;

    const [comfortTariff] = await queryRunner.query(`
      INSERT INTO tariffs (name, base_price, price_per_km, price_per_min, min_price, is_active)
      VALUES ('Comfort', 5000, 2500, 300, 8000, true)
      RETURNING id;
    `) as Array<{ id: string }>;

    await queryRunner.query(`
      INSERT INTO tariffs (name, base_price, price_per_km, price_per_min, min_price, is_active)
      VALUES ('Business', 8000, 4000, 500, 15000, true)
      RETURNING id;
    `);

    console.log(`Tariffs created: Standard (${standardTariff.id}), Comfort (${comfortTariff.id})`);

    // Insert admin user
    const [adminUser] = await queryRunner.query(`
      INSERT INTO users (phone, first_name, last_name, role, status)
      VALUES ('+998901234567', 'Admin', 'User', 'admin', 'active')
      RETURNING id;
    `) as Array<{ id: string }>;

    console.log(`Admin user created: ${adminUser.id} (+998901234567)`);

    // Insert manager user
    const [managerUser] = await queryRunner.query(`
      INSERT INTO users (phone, first_name, last_name, role, status)
      VALUES ('+998901234568', 'Manager', 'User', 'manager', 'active')
      RETURNING id;
    `) as Array<{ id: string }>;

    console.log(`Manager user created: ${managerUser.id} (+998901234568)`);

    // Insert passenger users
    const [passenger1] = await queryRunner.query(`
      INSERT INTO users (phone, first_name, last_name, role, status)
      VALUES ('+998901234569', 'Alisher', 'Karimov', 'passenger', 'active')
      RETURNING id;
    `) as Array<{ id: string }>;

    const [passenger2] = await queryRunner.query(`
      INSERT INTO users (phone, first_name, last_name, role, status)
      VALUES ('+998901234570', 'Dilnoza', 'Yusupova', 'passenger', 'active')
      RETURNING id;
    `) as Array<{ id: string }>;

    console.log(`Passengers created: ${passenger1.id}, ${passenger2.id}`);

    // Insert driver users
    const [driverUser1] = await queryRunner.query(`
      INSERT INTO users (phone, first_name, last_name, role, status)
      VALUES ('+998901234571', 'Sardor', 'Toshmatov', 'driver', 'active')
      RETURNING id;
    `) as Array<{ id: string }>;

    const [driverUser2] = await queryRunner.query(`
      INSERT INTO users (phone, first_name, last_name, role, status)
      VALUES ('+998901234572', 'Bobur', 'Nazarov', 'driver', 'active')
      RETURNING id;
    `) as Array<{ id: string }>;

    console.log(`Driver users created: ${driverUser1.id}, ${driverUser2.id}`);

    // Insert driver profiles with Angren city coordinates
    const [driver1] = await queryRunner.query(`
      INSERT INTO drivers (user_id, car_model, car_number, license_plate, rating, is_online, current_location)
      VALUES (
        $1,
        'Chevrolet Cobalt',
        '01 A 123 AA',
        'AA12345',
        4.85,
        true,
        ST_SetSRID(ST_MakePoint(70.9432, 40.0956), 4326)
      )
      RETURNING id;
    `, [driverUser1.id]) as Array<{ id: string }>;

    const [driver2] = await queryRunner.query(`
      INSERT INTO drivers (user_id, car_model, car_number, license_plate, rating, is_online, current_location)
      VALUES (
        $1,
        'Chevrolet Nexia',
        '01 B 456 BB',
        'BB67890',
        4.70,
        false,
        ST_SetSRID(ST_MakePoint(70.9500, 40.1050), 4326)
      )
      RETURNING id;
    `, [driverUser2.id]) as Array<{ id: string }>;

    console.log(`Driver profiles created: ${driver1.id}, ${driver2.id}`);

    // Insert a sample completed order
    const [sampleOrder] = await queryRunner.query(`
      INSERT INTO orders (
        passenger_id, tariff_id, pickup_location, dropoff_location,
        pickup_address, dropoff_address, estimated_price, final_price,
        status, payment_method
      )
      VALUES (
        $1, $2,
        ST_SetSRID(ST_MakePoint(70.9432, 40.0956), 4326),
        ST_SetSRID(ST_MakePoint(70.9700, 40.1200), 4326),
        'Angren shahar markazi',
        'Angren bozori',
        8500,
        8500,
        'completed',
        'cash'
      )
      RETURNING id;
    `, [passenger1.id, standardTariff.id]) as Array<{ id: string }>;

    console.log(`Sample order created: ${sampleOrder.id}`);

    // Insert trip for sample order
    await queryRunner.query(`
      INSERT INTO trips (order_id, start_time, end_time, actual_distance_km, actual_duration_min)
      VALUES ($1, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour 45 minutes', 3.2, 15);
    `, [sampleOrder.id]);

    // Insert sample transaction
    await queryRunner.query(`
      INSERT INTO transactions (user_id, order_id, amount, type, payment_method, status)
      VALUES ($1, $2, 8500, 'debit', 'cash', 'completed');
    `, [passenger1.id, sampleOrder.id]);

    await queryRunner.commitTransaction();

    console.log('\n=== SEED COMPLETED SUCCESSFULLY ===');
    console.log('Admin:    +998901234567 (role: admin)');
    console.log('Manager:  +998901234568 (role: manager)');
    console.log('Passenger: +998901234569 (Alisher Karimov)');
    console.log('Passenger: +998901234570 (Dilnoza Yusupova)');
    console.log('Driver:   +998901234571 (Sardor Toshmatov) - Chevrolet Cobalt, ONLINE');
    console.log('Driver:   +998901234572 (Bobur Nazarov) - Chevrolet Nexia, OFFLINE');
    console.log('Tariffs: Standard, Comfort, Business');
    console.log('===================================\n');
  } catch (err) {
    await queryRunner.rollbackTransaction();
    console.error('Seed failed:', err);
    throw err;
  } finally {
    await queryRunner.release();
    await AppDataSource.destroy();
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
