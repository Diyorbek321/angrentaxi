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
    await queryRunner.query(`DELETE FROM driver_verification_submissions;`);
    await queryRunner.query(`DELETE FROM driver_verification_requirements;`);
    await queryRunner.query(`DELETE FROM drivers;`);
    await queryRunner.query(`DELETE FROM otps;`);
    await queryRunner.query(`DELETE FROM tariffs;`);
    await queryRunner.query(`DELETE FROM users;`);

    console.log('Existing data cleared.');

    // Insert TAXI tariffs
    const [standardTariff] = await queryRunner.query(`
      INSERT INTO tariffs (name, service_type, base_price, price_per_km, price_per_min, min_price, is_active)
      VALUES ('Standard', 'taxi', 3000, 1500, 200, 5000, true)
      RETURNING id;
    `) as Array<{ id: string }>;

    const [comfortTariff] = await queryRunner.query(`
      INSERT INTO tariffs (name, service_type, base_price, price_per_km, price_per_min, min_price, is_active)
      VALUES ('Comfort', 'taxi', 5000, 2500, 300, 8000, true)
      RETURNING id;
    `) as Array<{ id: string }>;

    await queryRunner.query(`
      INSERT INTO tariffs (name, service_type, base_price, price_per_km, price_per_min, min_price, is_active)
      VALUES ('Business', 'taxi', 8000, 4000, 500, 15000, true)
      RETURNING id;
    `);

    // Insert CARGO tariffs (yuk tashish) — by vehicle type
    await queryRunner.query(`
      INSERT INTO tariffs (name, service_type, vehicle_type, base_price, price_per_km, price_per_min, min_price, is_active)
      VALUES
        ('Furgon',      'cargo', 'van',         15000, 3000, 300, 20000, true),
        ('Kichik yuk',  'cargo', 'small_truck', 25000, 5000, 400, 35000, true),
        ('Katta yuk',   'cargo', 'large_truck', 50000, 9000, 600, 70000, true);
    `);

    // YETKAZIB BERISH tariflari (ovqat / market).
    //
    // ⚠️ BULAR SHART, chunki bu seed yuqorida `DELETE FROM tariffs` qiladi.
    // Ilgari ular faqat `seed:food` / `seed:market` da yaratilardi, ya'ni
    // asosiy seed qayta ishga tushirilgan zahoti restoran va do'konlar
    // joyida qolib, ularning tarifi O'CHIB ketardi. Natijada restoran
    // «tayyor» bosganda `FoodService#dispatchDelivery` 400 qaytarardi
    // ("No active delivery tariff configured for food orders") — buyurtma
    // umuman haydovchi qidirish bosqichiga YETIB BORMASDI.
    //
    // `seed:food`/`seed:market` dagi qo'shish `if (!existingTariff)` bilan
    // himoyalangan, shuning uchun bu yerdagi qatorlar ular bilan
    // to'qnashmaydi — qaysi tartibda ishga tushirilishidan qat'i nazar
    // natija bitta.
    //
    // `vehicle_type` ATAYLAB bo'sh: yetkazib berish yengil avtomobilda ham
    // bajariladi. Aniq tur yozilsa, matching filtri (`Tariff.vehicleType`
    // tenglik bo'yicha solishtiriladi) faqat o'sha transportdagi
    // haydovchini qidirardi va Sardor (yengil avtomobil, `vehicle_type`
    // NULL) ovqat buyurtmasini hech qachon olmasdi.
    await queryRunner.query(`
      INSERT INTO tariffs (name, service_type, base_price, price_per_km, price_per_min, min_price, is_active)
      VALUES
        ('Ovqat yetkazish',  'food',   5000, 1000, 200, 8000, true),
        ('Market yetkazish', 'market', 5000, 1000, 200, 8000, true);
    `);

    console.log(
      `Tariffs created: Standard (${standardTariff.id}), Comfort (${comfortTariff.id}) + 3 cargo + food + market`,
    );

    // ------------------------------------------------------------------
    // Haydovchi davriy tekshiruvi — BOSHLANG'ICH QOIDALAR
    // ------------------------------------------------------------------
    //
    // ⚠️ BU TO'PLAM VAQTINCHA. Haqiqiy ro'yxatni (qaysi transport turi
    // uchun qanday tekshiruv kerakligini) foydalanuvchi keyinroq beradi.
    // Shuning uchun ro'yxat KODDA emas, aynan shu jadvalda turadi: yangi
    // talab qo'shish = bitta INSERT, mobil ilova o'zgarmaydi va yangi APK
    // chiqarish shart emas.
    //
    // `cadence_days`: 0 = bir martalik (muddatsiz), 30 = oyiga bir marta.
    // `grace_days`: qoida yaratilgan sanadan boshlab beriladigan moslashish
    // oynasi. 0 emas — aks holda qoida yozilgan soniyada butun park onlayn
    // chiqa olmay qolardi (`DriverVerificationService#computeBlockDeadline`).
    await queryRunner.query(`
      INSERT INTO driver_verification_requirements
        (code, label, hint, kind, service_type, vehicle_type, cadence_days, grace_days, is_required, is_active, sort_order)
      VALUES
        -- Mavjud 4 ta KYC hujjati: bir martalik, muddatsiz.
        ('license_front',        'Haydovchilik guvohnomasi (old tomon)',  'Ism-familiya va amal qilish muddati o''qilsin', 'document', NULL, NULL, 0,  7, true, true, 10),
        ('license_back',         'Haydovchilik guvohnomasi (orqa tomon)', 'Toifalar ko''rinsin',                           'document', NULL, NULL, 0,  7, true, true, 20),
        ('passport',             'Pasport',                               'Rasmli sahifa to''liq tushsin',                 'document', NULL, NULL, 0,  7, true, true, 30),
        ('vehicle_registration', 'Texnik pasport',                        'Davlat raqami va egasi ko''rinsin',             'document', NULL, NULL, 0,  7, true, true, 40),

        -- Avtomobil fotolari: oyiga bir marta yangilanadi. Aynan shu qism
        -- uchun davriylik tushunchasi kiritilgan — avtomobil holati vaqt
        -- o'tishi bilan o'zgaradi, hujjatlardan farqli.
        ('vehicle_photo_front',    'Avtomobil old tomondan',   'Davlat raqami ko''rinsin', 'vehicle_photo', NULL, NULL, 30, 5, true, true, 50),
        ('vehicle_photo_back',     'Avtomobil orqa tomondan',  'Davlat raqami ko''rinsin', 'vehicle_photo', NULL, NULL, 30, 5, true, true, 60),
        ('vehicle_photo_left',     'Avtomobil chap tomondan',  NULL,                       'vehicle_photo', NULL, NULL, 30, 5, true, true, 70),
        ('vehicle_photo_right',    'Avtomobil o''ng tomondan', NULL,                       'vehicle_photo', NULL, NULL, 30, 5, true, true, 80),
        ('vehicle_photo_interior', 'Salon',                    'Old va orqa o''rindiqlar ko''rinsin', 'vehicle_photo', NULL, NULL, 30, 5, true, true, 90),

        -- Faqat furgon uchun: vehicle_type = van bo'lgani uchun bu qator
        -- yengil avtomobil haydovchisining ro'yxatida UMUMAN ko'rinmaydi.
        ('vehicle_photo_cargo_bay', 'Yuk bo''limi', 'Bo''sh holatda, eshigi ochiq', 'vehicle_photo', NULL, 'van', 30, 5, true, true, 100),

        -- Faqat OVQAT yetkazish uchun: service_type = food. Bu qator aynan
        -- xizmat turi darvozasini ishlatadi — haydovchi «Ovqat yetkazish» ni
        -- yoqmoqchi bo'lsa, avval shu foto tasdiqlangan bo'lishi kerak
        -- (DriverVerificationService#findUnmetRequirementsForServiceType).
        ('thermal_bag_photo', 'Termo-sumka fotosi', 'Sumka ochiq holatda, ichki qismi ko''rinsin', 'vehicle_photo', 'food', NULL, 30, 5, true, true, 110);
    `);

    console.log('Driver verification requirements created: 4 KYC + 5 vehicle photos + 1 van-only + 1 food-only');

    // Insert admin user
    const [adminUser] = await queryRunner.query(`
      INSERT INTO users (phone, first_name, last_name, role, status, referral_code)
      VALUES ('+998901234567', 'Admin', 'User', 'admin', 'active', 'ADMIN1')
      RETURNING id;
    `) as Array<{ id: string }>;

    console.log(`Admin user created: ${adminUser.id} (+998901234567)`);

    // Insert manager user
    const [managerUser] = await queryRunner.query(`
      -- A manager with an empty permission list can open the dispatcher panel
      -- but every action inside it returns 403, so a fresh install looked
      -- broken until an admin hand-granted these from Staff & Roles.
      INSERT INTO users (phone, first_name, last_name, role, status, referral_code, permissions)
      VALUES ('+998901234568', 'Manager', 'User', 'manager', 'active', 'MNGR01',
              '["dispatch","drivers_view","promo_manage","bonuses_view","support_manage"]'::jsonb)
      RETURNING id;
    `) as Array<{ id: string }>;

    console.log(`Manager user created: ${managerUser.id} (+998901234568)`);

    // Insert passenger users
    const [passenger1] = await queryRunner.query(`
      INSERT INTO users (phone, first_name, last_name, role, status, referral_code)
      VALUES ('+998901234569', 'Alisher', 'Karimov', 'passenger', 'active', 'PSNGR1')
      RETURNING id;
    `) as Array<{ id: string }>;

    const [passenger2] = await queryRunner.query(`
      INSERT INTO users (phone, first_name, last_name, role, status, referral_code)
      VALUES ('+998901234570', 'Dilnoza', 'Yusupova', 'passenger', 'active', 'PSNGR2')
      RETURNING id;
    `) as Array<{ id: string }>;

    console.log(`Passengers created: ${passenger1.id}, ${passenger2.id}`);

    // Insert driver users
    const [driverUser1] = await queryRunner.query(`
      INSERT INTO users (phone, first_name, last_name, role, status, referral_code)
      VALUES ('+998901234571', 'Sardor', 'Toshmatov', 'driver', 'active', 'DRVR01')
      RETURNING id;
    `) as Array<{ id: string }>;

    const [driverUser2] = await queryRunner.query(`
      INSERT INTO users (phone, first_name, last_name, role, status, referral_code)
      VALUES ('+998901234572', 'Bobur', 'Nazarov', 'driver', 'active', 'DRVR02')
      RETURNING id;
    `) as Array<{ id: string }>;

    // Uchinchi haydovchi ATAYLAB furgonchi: cargo oqimini sinaydigan
    // haydovchi shu paytgacha umuman yo'q edi, ya'ni yuk buyurtmasi
    // seed qilingan bazada hech qachon taqsimlanmasdi.
    const [driverUser3] = await queryRunner.query(`
      INSERT INTO users (phone, first_name, last_name, role, status, referral_code)
      VALUES ('+998901234573', 'Jasur', 'Ergashev', 'driver', 'active', 'DRVR03')
      RETURNING id;
    `) as Array<{ id: string }>;

    console.log(`Driver users created: ${driverUser1.id}, ${driverUser2.id}, ${driverUser3.id}`);

    // Insert driver profiles with Angren city coordinates
    // Sardor — ko'p xizmatli demo haydovchisi. Aynan u ovqat va market
    // yetkazish oqimini sinash imkonini beradi: bu ustun kiritilgandan keyin
    // migratsiya HAMMAGA ['taxi'] yozgan edi, ya'ni seed'dan keyin food/market
    // buyurtmalari hech kimga mos kelmasdi va 60 soniyada "haydovchi
    // topilmadi" ga tushardi.
    const [driver1] = await queryRunner.query(`
      INSERT INTO drivers (user_id, car_model, car_number, license_plate, rating, is_online, service_types, current_location)
      VALUES (
        $1,
        'Chevrolet Cobalt',
        '01 A 123 AA',
        'AA12345',
        4.85,
        true,
        '["taxi","food","market"]'::jsonb,
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

    // Furgon: `vehicle_type = van` bo'lgani uchun unga «Yuk bo'limi» fotosi
    // qoidasi ham qo'llanadi va faqat `cargo` buyurtmalari keladi.
    const [driver3] = await queryRunner.query(`
      INSERT INTO drivers (user_id, car_model, car_number, license_plate, rating, is_online, vehicle_type, service_types, current_location)
      VALUES (
        $1,
        'GAZelle Next',
        '01 C 789 CC',
        'CC13579',
        4.60,
        true,
        'van',
        '["cargo"]'::jsonb,
        ST_SetSRID(ST_MakePoint(70.9380, 40.0900), 4326)
      )
      RETURNING id;
    `, [driverUser3.id]) as Array<{ id: string }>;

    console.log(`Driver profiles created: ${driver1.id}, ${driver2.id}, ${driver3.id}`);

    // ------------------------------------------------------------------
    // Demo haydovchilarga TASDIQLANGAN tekshiruv materiallari
    // ------------------------------------------------------------------
    //
    // ⚠️ SHARTSIZ KERAK: yuqoridagi qoidalar bugun yaratilganini hisobga
    // olsak, `grace_days` tugagan zahoti (5-7 kun) demo haydovchilarning
    // hammasi onlayn chiqa olmay qolardi, `thermal_bag_photo` esa Sardorga
    // «Ovqat yetkazish» ni darhol bloklardi. Ya'ni seed qilingan baza bir
    // hafta ichida o'z-o'zidan ishlamay qolardi.
    //
    // Qatorlar QO'LDA sanalmaydi: qaysi qoida qaysi haydovchiga tegishli
    // ekanini `service_type`/`vehicle_type` ustunlarining O'ZI aytadi —
    // xuddi servis hisoblagani kabi. Shu tufayli yangi qoida qo'shilganda
    // bu blokni tahrirlash shart emas.
    //
    // `file_url` — soxta yo'l: demo bazada haqiqiy fayl yo'q, shuning uchun
    // menejer panelidan ochilsa 404 beradi. Bu ataylab: seed real hujjat
    // skanlarini tarqatmaydi.
    await queryRunner.query(`
      INSERT INTO driver_verification_submissions
        (driver_id, code, file_url, review_status, submitted_at, reviewed_at, reviewed_by, valid_until)
      SELECT
        d.id,
        r.code,
        '/uploads/drivers/seed-demo.jpg',
        'approved',
        NOW() - INTERVAL '1 day',
        NOW() - INTERVAL '1 day',
        $1,
        CASE WHEN r.cadence_days = 0
             THEN NULL
             ELSE NOW() + (r.cadence_days || ' days')::interval
        END
      FROM drivers d
      CROSS JOIN driver_verification_requirements r
      WHERE r.is_active = true
        -- jsonb_exists = "?" operatorining funksiya shakli. Massiv ichidagi
        -- elementni tekshiradi; "?" belgisining o'zi yozilsa ba'zi
        -- drayverlar uni parametr o'rni deb o'qib yuborishi mumkin.
        AND (r.service_type IS NULL OR jsonb_exists(d.service_types, r.service_type))
        AND (r.vehicle_type IS NULL OR d.vehicle_type = r.vehicle_type);
    `, [adminUser.id]);

    console.log('Approved verification submissions created for all demo drivers');

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
    console.log('Driver:   +998901234571 (Sardor Toshmatov) - Chevrolet Cobalt, ONLINE [taxi, food, market]');
    console.log('Driver:   +998901234572 (Bobur Nazarov) - Chevrolet Nexia, OFFLINE [taxi]');
    console.log('Driver:   +998901234573 (Jasur Ergashev) - GAZelle Next (van), ONLINE [cargo]');
    console.log('Tariffs: Standard, Comfort, Business + 3 cargo + Ovqat/Market yetkazish');
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
