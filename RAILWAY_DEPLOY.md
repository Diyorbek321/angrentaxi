# Angren Taxi — Railway Deploy Qo'llanmasi

Bu qo'llanma butun platformani (backend + 2 web panel + PostGIS + Redis) Railway'ga
test/MVP server sifatida deploy qilish uchun. Mobil ilova alohida build qilinadi (oxirida).

> **Eslatma:** nginx Railway'da KERAK EMAS — har bir servisga Railway o'zi HTTPS domen beradi.
> `docker-compose.yml` faqat lokal ishlash uchun qoladi.

---

## 0. Tayyorgarlik (bir marta)

1. Kodni GitHub repo'ga push qiling (Railway GitHub'dan deploy qiladi).
2. [railway.app](https://railway.app) da hisob oching → **New Project** → **Deploy from GitHub repo**.
3. Bitta Railway *Project* ichida 6 ta *Service* bo'ladi:

| # | Service | Manba | Ichki port |
|---|---------|-------|-----------|
| 1 | **postgres** | Docker image `postgis/postgis:16-3.4-alpine` | 5432 |
| 2 | **redis** | Railway "Redis" template | 6379 |
| 3 | **backend** | repo `/backend` (Dockerfile) | `$PORT` |
| 4 | **web-admin** | repo `/web-admin` (Dockerfile) | `$PORT` |
| 5 | **web-manager** | repo `/web-manager` (Dockerfile) | `$PORT` |

Tartib muhim: avval **postgres** va **redis**, keyin **backend**, oxirida web panellar.

---

## 1. PostgreSQL + PostGIS (eng muhim qadam!)

⚠️ Railway'ning default "PostgreSQL" template'i **PostGIS'siz** keladi — `CREATE EXTENSION postgis`
xato beradi va butun matching tizimi ishlamaydi. Shuning uchun **Docker image'dan** qo'shamiz.

1. Project ichida **+ New** → **Empty Service** → nomini `postgres` qo'ying.
2. Service → **Settings** → **Source** → **Docker Image**: `postgis/postgis:16-3.4-alpine`
3. **Variables** bo'limiga qo'shing:
   ```
   POSTGRES_USER=angren
   POSTGRES_PASSWORD=<kuchli-parol-yozing>
   POSTGRES_DB=angren_taxi
   ```
4. **Settings → Volumes** → yangi volume, mount path: `/var/lib/postgresql/data`
   (volumesiz ma'lumot deploy'da o'chib ketadi!)
5. Deploy bo'lsin. Railway bu servisga `RAILWAY_PRIVATE_DOMAIN` beradi (masalan `postgres.railway.internal`).

---

## 2. Redis

1. **+ New** → **Database** → **Add Redis** (Railway template).
2. Bu avtomatik `REDISHOST`, `REDISPORT`, `REDISPASSWORD` o'zgaruvchilarini beradi.
   (Backend kodi endi `REDIS_PASSWORD`ni qo'llab-quvvatlaydi — tuzatildi.)

---

## 3. Backend (NestJS)

1. **+ New** → **GitHub Repo** → repo'ni tanlang.
2. **Settings → Root Directory**: `/backend`
3. Railway `backend/Dockerfile`ni avtomatik topadi.
4. **Settings → Networking → Generate Domain** (public domen oling, masalan `angren-backend.up.railway.app`).
5. **Variables** (reference variable'lar `${{...}}` bilan):

   ```
   NODE_ENV=production
   PORT=3000

   # Database (postgres servisidan reference)
   DB_HOST=${{postgres.RAILWAY_PRIVATE_DOMAIN}}
   DB_PORT=5432
   DB_USER=${{postgres.POSTGRES_USER}}
   DB_PASS=${{postgres.POSTGRES_PASSWORD}}
   DB_NAME=${{postgres.POSTGRES_DB}}

   # Redis (Redis template'dan reference)
   REDIS_HOST=${{Redis.REDISHOST}}
   REDIS_PORT=${{Redis.REDISPORT}}
   REDIS_PASSWORD=${{Redis.REDISPASSWORD}}

   # JWT (yangi generatsiya: openssl rand -hex 32)
   APP_SECRET=ba64e371944d1cc78155b3a2220efce403a37e15837865bdb3f9fade9da014d5

   # CORS — web panellar domenlari (vergul bilan emas, bittadan; '*' credentials bilan ishlamaydi)
   CORS_ORIGIN=https://<web-admin-domeni>

   # OTP — test uchun bypass (123456). Real prod'da false qiling!
   OTP_BYPASS_ENABLED=true
   OTP_BYPASS_CODE=123456

   # Tashqi xizmatlar (hozircha bo'sh — keyin to'ldiriladi)
   ESKIZ_EMAIL=
   ESKIZ_PASSWORD=
   ESKIZ_FROM=4546
   PAYME_MERCHANT_ID=
   PAYME_SECRET_KEY=
   PAYME_CHECKOUT_URL=https://checkout.paycom.uz
   ```

   > `${{postgres.*}}` ishlashi uchun postgres servisi nomi aynan `postgres` bo'lsin
   > (boshqa nom qo'ysangiz, reference'ni ham o'zgartiring).

6. Deploy tugagach, **migration + seed**ni Railway terminalida ishga tushiring:

   **Variant A — Railway dashboard:** backend service → **Settings → Deploy** ostidagi
   one-off command, yoki Railway CLI orqali (tavsiya):

   ```bash
   npm i -g @railway/cli
   railway login
   railway link            # project/service tanlang (backend)
   railway run npm run migration:run
   railway run npm run seed:prod
   ```

   `seed:prod` — compiled `dist/.../seed.js`ni ishga tushiradi (ts-node muammosi tuzatilgan).

   Seed quyidagi test akkauntlarni yaratadi:
   - Admin: `+998901234567`
   - Manager: `+998901234568`
   - Yo'lovchilar: `+998901234569`, `+998901234570`
   - Haydovchilar: `+998901234571` (online), `+998901234572`
   - Tariflar: Standard, Comfort, Business
   - OTP kod hamma uchun: **123456**

7. Tekshirish: `https://<backend-domen>/api/docs` (Swagger ochilishi kerak).

---

## 4. Web-Admin (Next.js)

1. **+ New** → **GitHub Repo** → o'sha repo.
2. **Settings → Root Directory**: `/web-admin`
3. **Networking → Generate Domain**.
4. **Variables** (DIQQAT — bular **build vaqtida** kerak, Railway build-arg sifatida uzatadi;
   Dockerfile endi `ARG` qabul qiladi — tuzatilgan):

   ```
   NEXT_PUBLIC_API_URL=https://<backend-domen>/api/v1
   NEXT_PUBLIC_SOCKET_URL=https://<backend-domen>
   ```

5. Deploy. Domen ochilgach login: `+998901234567` / OTP `123456`.

> ⚠️ `NEXT_PUBLIC_*` o'zgartirsangiz, ilova **qayta build** bo'lishi shart (Railway → Redeploy),
> chunki bu qiymatlar build paytida JS ichiga "yopishtiriladi".

---

## 5. Web-Manager (Next.js)

Web-Admin bilan bir xil, faqat:
- **Root Directory**: `/web-manager`
- Login: `+998901234568` (manager) / OTP `123456`

Env (bir xil):
```
NEXT_PUBLIC_API_URL=https://<backend-domen>/api/v1
NEXT_PUBLIC_SOCKET_URL=https://<backend-domen>
```

---

## 6. CORS'ni yakunlash

Backend deploy bo'lib, web domenlar tayyor bo'lgach, backend `CORS_ORIGIN`ni
aniq web domenga moslang (xavfsizroq):

```
CORS_ORIGIN=https://<web-admin-domeni>
```

> Test bosqichida tez ishlashi uchun vaqtincha `CORS_ORIGIN=*` qoldirsa ham bo'ladi,
> lekin `credentials: true` bilan brauzer `*`ni rad etadi — shuning uchun aniq domen tavsiya etiladi.

---

## 7. Mobil ilova (alohida build)

Mobil Railway'da emas — telefon/emulyatorga build qilinadi. Backend domeniga yo'naltiring:

```bash
# Yo'lovchi ilovasi
flutter build apk --flavor passenger -t lib/main_passenger.dart \
  --dart-define=API_BASE_URL=https://<backend-domen>/api/v1 \
  --dart-define=WS_URL=https://<backend-domen>

# Haydovchi ilovasi
flutter build apk --flavor driver -t lib/main_driver.dart \
  --dart-define=API_BASE_URL=https://<backend-domen>/api/v1 \
  --dart-define=WS_URL=https://<backend-domen>
```

---

## Tezkor checklist

- [ ] postgres servisi `postgis/postgis` image'dan (default template EMAS) + volume
- [ ] redis servisi qo'shilgan
- [ ] backend: Root Dir `/backend`, hamma env, domen generatsiya qilingan
- [ ] `railway run npm run migration:run` bajarilgan
- [ ] `railway run npm run seed:prod` bajarilgan
- [ ] `/api/docs` ochiladi
- [ ] web-admin: Root Dir `/web-admin`, `NEXT_PUBLIC_*` to'g'ri backend domeniga
- [ ] web-manager: Root Dir `/web-manager`, env to'g'ri
- [ ] backend `CORS_ORIGIN` web domenlarga moslangan
- [ ] OTP `123456` bilan login ishlaydi

---

## Keng tarqalgan xatolar

| Belgi | Sabab | Yechim |
|-------|-------|--------|
| `extension "postgis" is not available` | default Postgres template ishlatilgan | postgres'ni `postgis/postgis` image'dan qo'ying |
| Web ilova `localhost:3000`ga uradi | `NEXT_PUBLIC_*` build'da yetib bormagan | env'ni o'rnating + **Redeploy** (build-time) |
| Redis `NOAUTH Authentication required` | parol uzatilmagan | `REDIS_PASSWORD=${{Redis.REDISPASSWORD}}` qo'shing |
| Deploy'da DB bo'shab qoladi | volume yo'q | postgres'ga `/var/lib/postgresql/data` volume |
| Brauzerda CORS xato | `*` + credentials | `CORS_ORIGIN`ni aniq domenga qo'ying |
