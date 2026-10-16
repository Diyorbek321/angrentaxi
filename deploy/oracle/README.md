# Angren super-app — Oracle Cloud (Always Free) ga deploy qo'llanmasi

Butun platforma (PostGIS, Redis, OSRM, backend, 4 ta web panel, HTTPS) **bitta**
Oracle Cloud virtual serverida ishlaydi: Ampere A1 (ARM64), 4 OCPU, 24 GB RAM.
Bu qo'llanma DevOps tajribasi bo'lmagan odam uchun — qadamlarni tartib bilan bajaring.

> **Nega EU (Frankfurt / Amsterdam)?** O'zbekiston "Shaxsga doir ma'lumotlar
> to'g'risida"gi qonun talabi: chegaradan tashqariga ma'lumot faqat yetarli
> himoya ta'minlaydigan davlatlarga (VMQ 415-son ro'yxati — Germaniya,
> Niderlandiya) uzatiladi. Lokalizatsiya talabini yuristingiz bilan alohida
> tasdiqlang — bu texnik qo'llanma, yuridik xulosa emas.

## Arxitektura

```
Internet ──► Caddy :80/:443 (avtomatik Let's Encrypt HTTPS)
               ├─ api.<DOMAIN>         → backend:3000   (REST + socket.io /ws)
               ├─ admin.<DOMAIN>       → web-admin:3001
               ├─ manager.<DOMAIN>     → web-manager:3002 (socket proxy)
               ├─ market.<DOMAIN>      → web-market:3003  (socket proxy)
               └─ restaurant.<DOMAIN>  → web-restaurant:3004 (socket proxy)
Ichki tarmoq (tashqaridan yopiq): postgres(PostGIS) · redis · osrm
```

Fayllar (`deploy/oracle/`):

| Fayl | Vazifasi |
|---|---|
| `docker-compose.prod.yml` | butun stack: healthcheck, xotira limitlari, log rotatsiya |
| `Caddyfile` | subdomenlar + HTTPS + WebSocket |
| `.env.prod.example` | barcha sozlamalar namunasi |
| `gen-secrets.sh` | parol/kalitlarni avtomatik yaratadi |
| `bootstrap.sh` | yangi serverni bir marta sozlaydi (Docker, firewall, swap...) |
| `deploy.sh` | yangilash / rollback |
| `backup.sh` / `restore.sh` | zaxira nusxa va tiklash |
| `migrate-from-railway.sh` | Railway bazasini ko'chirish |
| `healthcheck-alert.sh` + `install-timers.sh` | monitoring (Telegram) va tungi backup |

---

## 1. Oracle Cloud hisobini ochish

1. <https://signup.cloud.oracle.com> → ro'yxatdan o'ting. Bank kartasi so'raladi
   (tekshirish uchun kichik summa bloklanib, qaytariladi).
2. **Home Region** — **Germany Central (Frankfurt)** yoki **Netherlands Northwest
   (Amsterdam)**. ⚠️ Bu tanlov **keyin o'zgartirib bo'lmaydi**, Always Free
   resurslar faqat home region'da beriladi.
3. Hisob faollashishi bir necha daqiqadan bir necha soatgacha.

**Bepul limitlar va "idle reclaim" haqida.** Always Free'da Ampere A1 jami
4 OCPU + 24 GB RAM, 200 GB disk bepul. Oracle uzoq vaqt deyarli yuklamasiz
turgan Always Free serverlarni **to'xtatib qo'yishi mumkin** (idle reclaim).
Hisobni **Pay As You Go (PAYG)** ga o'tkazish bu xavfni kamaytiradi va
"Out of host capacity" ni ham kamroq ko'rsatadi; PAYG'da ham Always Free
limit ichida qolsangiz to'lov bo'lmasligi kerak — lekin **Oracle'ning joriy
siyosatini o'zingiz tekshiring** (Billing → Cost Analysis, va budget alert
qo'ying: Billing → Budgets → masalan 1 USD).

## 2. Virtual server (VM) yaratish

1. Menyu → **Compute → Instances → Create instance**.
2. **Image**: Canonical **Ubuntu 24.04** (yoki 22.04) — "aarch64" varianti.
3. **Shape** → Change shape → **Ampere** → `VM.Standard.A1.Flex` →
   **4 OCPU, 24 GB** memory.
4. **Networking**: yangi VCN + public subnet, **Assign public IPv4** — ha.
5. **SSH keys**: o'zingizning public kalitingizni yuklang
   (`ssh-keygen -t ed25519` → `~/.ssh/id_ed25519.pub`). Private kalitni yo'qotmang.
6. **Boot volume**: 100–150 GB (200 GB gacha bepul).
7. **Create**.

> **"Out of host capacity"** xatosi — A1'da tez-tez uchraydi. Boshqa
> **Availability Domain** (AD-1/2/3) ni tanlab qayta urinib ko'ring, bir necha
> soatdan keyin yoki tunda qayta urining, yoki vaqtincha 2 OCPU/12 GB bilan
> yarating (keyin "Edit → Shape" bilan oshirsa bo'ladi). PAYG hisobda bu
> kamroq bo'ladi.

**Public IP ni statik qiling:** Instance → Attached VNICs → IPv4 Addresses →
Edit → **Reserved public IP**. Aks holda server qayta yaratilsa IP o'zgaradi.

## 3. Portlarni ochish (VCN Security List)

Oracle'da **ikki qavat** firewall bor — ikkalasi ham ochilishi kerak:

1. **VCN Security List** (bulut darajasida): Networking → Virtual Cloud Networks →
   VCN → Subnet → Security List → **Add Ingress Rules**:
   - Source `0.0.0.0/0`, TCP, Destination port **80**
   - Source `0.0.0.0/0`, TCP, Destination port **443**
   - (ixtiyoriy, HTTP/3) Source `0.0.0.0/0`, **UDP**, port **443**
   - SSH (22) default ochiq — xohlasangiz Source'ni o'z IP'ingizga toraytiring.
2. **Server ichidagi iptables** — `bootstrap.sh` o'zi ochadi (4-qadam).
   Oracle Ubuntu image'lari 80/443 ni sukut bo'yicha bloklaydi; Oracle
   ko'rsatmasiga ko'ra `ufw` ishlatilmaydi (u Oracle qoidalarini buzib,
   serverni ochilmaydigan qilib qo'yishi mumkin) — `iptables` +
   `netfilter-persistent` ishlatiladi.

Postgres, Redis, OSRM portlari **hech qachon** ochilmaydi — ular faqat Docker
ichki tarmog'ida.

## 4. Domen va DNS

Domen sotib oling (masalan `.uz` — yiliga ~10–15 USD; **yagona to'lov**).
DNS panelida 5 ta **A record** yarating, hammasi serverning public IP'siga:

```
api.<domen>          A   <server IP>
admin.<domen>        A   <server IP>
manager.<domen>      A   <server IP>
market.<domen>       A   <server IP>
restaurant.<domen>   A   <server IP>
```

(Cloudflare DNS ishlatsangiz — **proxy o'chiq (kulrang bulut, "DNS only")**,
aks holda Let's Encrypt sertifikat olishi va WebSocket murakkablashadi.)
Tekshirish: `dig +short api.<domen>` → server IP chiqishi kerak.

## 5. Cloudflare R2 (fayllar va zaxira nusxalar)

KYC hujjatlari allaqachon private R2 bucket'da (`STORAGE_DRIVER=s3`).
Zaxira nusxalar uchun **alohida** bucket yarating:

1. Cloudflare → R2 → **Create bucket** → `angren-db-backups`,
   **Location: Jurisdiction = European Union** (ma'lumot EU'da qoladi).
2. R2 → **Manage API tokens** → Create → **Object Read & Write**, faqat shu
   bucket'ga. Access Key ID / Secret ni `.env.prod` dagi `BACKUP_S3_*` ga yozing.
3. EU jurisdiction bucket endpoint'i: `https://<account-id>.eu.r2.cloudflarestorage.com`.

## 6. Serverni sozlash (bootstrap)

O'z kompyuteringizdan (repo ichida):

```bash
scp deploy/oracle/bootstrap.sh ubuntu@<server IP>:
ssh ubuntu@<server IP> 'sudo bash ~/bootstrap.sh'
```

Repo **private** bo'lsa: serverda deploy kaliti yarating va GitHub'ga qo'shing:

```bash
sudo -iu deploy
ssh-keygen -t ed25519 -C angren-vm -f ~/.ssh/id_ed25519 -N ''
cat ~/.ssh/id_ed25519.pub   # GitHub → repo → Settings → Deploy keys → Add (read-only)
```

`bootstrap.sh` bajaradi: tizim yangilanishi, Docker + compose, `deploy`
foydalanuvchisi, 80/443 iptables, 4 GB swap, avtomatik xavfsizlik
yangilanishlari (kerak bo'lsa 04:30 da reboot), fail2ban (SSH), vaqt zonasi
Asia/Tashkent, rclone + gnupg. Qayta ishga tushirish xavfsiz.

## 7. Kodni olish va `.env.prod`

```bash
sudo -iu deploy
git clone git@github.com:Diyorbek321/angrentaxi.git /opt/angren/app
cd /opt/angren/app
cp deploy/oracle/.env.prod.example deploy/oracle/.env.prod
deploy/oracle/gen-secrets.sh          # DB/Redis parollari, APP_SECRET, GPG parol
nano deploy/oracle/.env.prod          # DOMAIN, ACME_EMAIL, R2, Eskiz, Payme, Click ...
```

Majburiy: `DOMAIN`, `ACME_EMAIL`, `S3_*` (KYC), `BACKUP_S3_*`. `CHANGE_ME`
qolgan joy bo'lmasin: `grep CHANGE_ME deploy/oracle/.env.prod` bo'sh chiqsin.
**`BACKUP_GPG_PASSPHRASE` ni parol menejeringizga ham saqlang** — usiz R2'dagi
nusxalarni ochib bo'lmaydi.

Railway'dagi qiymatlarni (Eskiz, Payme, Click, Firebase, R2 kalitlari)
Railway → backend → Variables dan ko'chiring. `APP_SECRET` ni yangisini
qoldirsangiz, barcha foydalanuvchilar bir marta qayta kiradi (normal).

## 8. Birinchi deploy

```bash
cd /opt/angren/app
deploy/oracle/deploy.sh main      # yoki legal-compliance merge bo'lgan branch/tag
```

Birinchi marta ~20–40 daqiqa: OSRM grafi (Geofabrik'dan O'zbekiston xaritasi)
va 4 ta Next.js panel ARM serverda build bo'ladi. Backend birinchi ishga
tushganda **migratsiyalarni o'zi bajaradi** (`migrationsRun: true`) — alohida
buyruq kerak emas. Oxirida `scripts/smoke.sh` domen bo'yicha tekshiradi.

Sertifikatlar: Caddy DNS to'g'ri bo'lsa 1–2 daqiqada oladi. Muammo bo'lsa:
`docker compose -p angren logs caddy | grep -i error`.

## 9. Ma'lumotlar: Railway'dan ko'chirish YOKI toza boshlash

**A. Railway bazasi ishlayotgan bo'lsa** — Railway → postgres → Connect →
*Public Network* URL'ni oling:

```bash
RAILWAY_DATABASE_URL='postgresql://angren:...@xxx.proxy.rlwy.net:12345/angren_taxi' \
  deploy/oracle/migrate-from-railway.sh
```

Skript manba versiyasini va PostGIS'ni tekshiradi, `pg_dump` oladi, serverdagi
bazani almashtiradi (oldin xavfsizlik nusxasi oladi), backend'ni qayta
ishga tushiradi (yetishmagan migratsiyalar avtomatik o'tadi).

**B. Railway o'chgan, lekin qo'lingizda dump bor:**
`deploy/oracle/restore.sh /yo'l/railway.dump`

**C. Toza boshlash (seed):**

```bash
dc() { docker compose -p angren -f deploy/oracle/docker-compose.prod.yml --env-file deploy/oracle/.env.prod "$@"; }
dc exec backend node dist/database/seeds/seed.js         # admin, tariflar, test akkauntlar
dc exec backend node dist/database/seeds/seed-food.js    # ixtiyoriy: demo restoran
dc exec backend node dist/database/seeds/seed-market.js  # ixtiyoriy: demo do'kon
```

⚠️ Seed admin raqami `+998901234567` (test raqami). Real ishga tushirishdan
oldin o'z raqamingizga almashtiring:

```bash
dc exec postgres psql -U angren -d angren_taxi \
  -c "UPDATE users SET phone='+99890XXXXXXX' WHERE phone='+998901234567';"
```

va `.env.prod` da OTP bypass qatorlari **izohda** (`#`) qolsin — aks holda
`123456` bilan har kim kira oladi.

## 10. Backup va monitoring'ni yoqish

```bash
sudo deploy/oracle/install-timers.sh
```

- **Backup**: har kuni 03:30 (Toshkent) — `pg_dump` (custom, siqilgan) →
  `/var/backups/angren/daily` (7 ta) + yakshanba `weekly` (4 ta) → GPG bilan
  shifrlab R2'ga. Deploy oldidan avtomatik `predeploy` nusxa ham olinadi.
- **Monitoring**: har daqiqada `https://api.<domen>/api/v1/health` va
  konteyner holati. 3 marta ketma-ket xato → Telegram xabari, tiklanganda
  yana xabar. `.env.prod` da `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
  (@BotFather → bot yarating → botga yozing →
  `https://api.telegram.org/bot<TOKEN>/getUpdates` dan chat id).
- Loglar: `journalctl -u angren-backup -u angren-health --since today`.

**Tiklash mashqi (oyiga bir marta):**

```bash
journalctl -u angren-backup -n 20   # oxirgi yuklangan fayl nomi
deploy/oracle/restore.sh r2:daily/<fayl>.dump.gpg --drill
```

`--drill` nusxani R2'dan olib, shifrini ochib, **vaqtinchalik**
`<DB_NAME>_drill` bazaga tiklaydi, PostGIS va jadvallarni tekshiradi
(`drill OK: ... users=N, orders=M`) va uni o'chiradi — ishlayotgan baza va
ilovaga tegmaydi. `--drill` siz — haqiqiy tiklash (bazani ALMASHTIRADI).
Ishlatilmagan backup — backup emas.

**Shifr paroli** (`BACKUP_GPG_PASSPHRASE`) faqat `.env.prod` da: server
yo'qolsa, R2'dagi nusxalar u parolsiz ochilmaydi — parolni server tashqarisida
(parol menejeri) saqlang.

### Xatolarni kuzatish (Sentry)

Bepul Developer tarif (oyiga 5 000 xato) yetadi. sentry.io → ikkita loyiha:
**Node.js** (backend) va **Flutter** (ikkala ilova bitta loyihada, `flavor`
tegi bilan ajraladi).

- **Backend**: `.env.prod` ga `SENTRY_DSN=<Node DSN>` →
  `deploy/oracle/deploy.sh <branch>`. Faqat 5xx xatolar yuboriladi (4xx —
  mijozniki); reliz = commit sha.
- **Ilova**: `mobile/.env.dart-defines.json` ga `"SENTRY_DSN": "<Flutter DSN>"`
  → `tool/build_release.sh`. Steklarni o'qish uchun `SENTRY_AUTH_TOKEN`,
  `SENTRY_ORG`, `SENTRY_PROJECT` bilan yig'ing (simvollar yuklanadi).
- **Shaxsiy ma'lumot** (ZRU-547, 27¹-modda — ma'lumot O'zbekistonda
  saqlanishi kerak): IP, telefon, so'rov tanasi, cookie va Authorization
  yuborilmaydi, telefon raqamlari `+998***` ga almashtiriladi; faqat
  foydalanuvchi UUID qoladi. Sentry loyiha sozlamalarida ham **Security &
  Privacy → Prevent Storing of IP Addresses** ni yoqing.

## 11. Tekshirish

- `https://api.<domen>/api/v1/health` → 200
- `https://api.<domen>/api/docs` → Swagger
- 4 panel: `https://admin.<domen>/login`, `manager.`, `market.`, `restaurant.`
- Manager panelda dispetcher doskasi "jonli" (socket ulanadi)
- `docker compose -p angren ps` — hammasi `healthy`
- Qo'lda smoke: `API_URL=https://api.<domen>/api/v1 scripts/smoke.sh`

## 12. Yangilash va orqaga qaytarish (rollback)

```bash
cd /opt/angren/app
deploy/oracle/deploy.sh main        # yangi versiya (yoki tag: v1.2.0)
deploy/oracle/deploy.sh --rollback  # oldingi muvaffaqiyatli versiyaga
```

Har deploy: nusxa → build (commit sha bilan teglanadi) → backend → panellar
bitta-bitta → smoke. Har servis almashganda bir necha soniya uzilish bo'ladi
(bitta nusxa); ilovalar avtomatik qayta ulanadi. Oxirgi 3 versiya image'lari
saqlanadi, rollback qayta build qilmaydi.

⚠️ **Migratsiyalar faqat oldinga.** Agar yangi versiya bazani o'zgartirgan
bo'lsa va eski kod u bilan ishlamasa, rollback'dan keyin deploy oldidan
olingan nusxani tiklang:
`deploy/oracle/restore.sh /var/backups/angren/predeploy/<eng oxirgi>.dump`

`NEXT_PUBLIC_*` / `DOMAIN` o'zgarsa — panellar qayta build bo'lishi shart
(`deploy.sh` buni o'zi qiladi).

## 13. Mobil ilova (yangi domen)

Mobil build `API_BASE_URL` va `WS_URL` ni ichiga "yopishtiradi" — domen
o'zgarganda **yangi APK/IPA** kerak:

```bash
cd mobile
API_BASE_URL=https://api.<domen>/api/v1 WS_URL=https://api.<domen> \
  tool/build_release.sh
```

Eski (Railway manzilli) ilovalar Railway o'chgach ishlamay qoladi — yangi
versiyani do'konga chiqarib, majburiy yangilashni yoqing.

## 14. Xarajatlar

| Narsa | Narx |
|---|---|
| Oracle A1 VM 4 OCPU / 24 GB, 150 GB disk, 10 TB/oy trafik | 0 (Always Free limitida) |
| Let's Encrypt sertifikatlar (Caddy) | 0 |
| Cloudflare R2 (10 GB gacha, egress bepul) | 0 (hozirgi hajmda) |
| Domen | ~10–15 USD / yil — **yagona to'lov** |

Always Free limitdan oshmaslik uchun boshqa VM/disk qo'shmang va Budget
alert qo'ying.

## 15. RAM taqsimoti (limitlar)

postgres 6 GB · redis 1.5 GB · osrm 1.5 GB · backend 2 GB · panellar 4×768 MB ·
caddy 256 MB ≈ 14 GB. Qolgan ~9 GB — disk keshi va build uchun. 4 GB swap ham bor.

## 16. Ko'p uchraydigan muammolar

| Belgi | Sabab / yechim |
|---|---|
| Sayt ochilmaydi, `curl` timeout | VCN Security List'da 80/443 yo'q (3-qadam) yoki iptables: `sudo iptables -L INPUT -n --line-numbers` |
| Caddy: `challenge failed` | DNS hali tarqalmagan yoki Cloudflare proxy yoqiq |
| Panelda login SMS yubormaydi | `CORS_ORIGIN` — compose o'zi 4 subdomenni qo'yadi; boshqa domen bo'lsa `CORS_EXTRA_ORIGINS` |
| Backend `Environment validation failed` | `.env.prod` da bo'sh qiymat (masalan `JWT_ACCESS_TTL=`) — ishlatmasangiz izohga oling |
| `extension "postgis" is not available` | postgres image almashgan — faqat `imresamu/postgis` (ARM64) |
| Build paytida server qotib qoladi | RAM — `deploy.sh` panellarni ketma-ket build qiladi; `free -h` va swap'ni tekshiring |
| `Out of host capacity` | 2-qadamdagi maslahat |

## ARM64 (Ampere) mosligi — tekshirilgan (2026-10-15)

| Image | arm64 | Izoh |
|---|---|---|
| `postgis/postgis:16-3.4-alpine` | **yo'q** (faqat amd64) | → **`imresamu/postgis:16-3.4-alpine`** (amd64+arm64, o'sha docker-postgis retsepti, PG16 + PostGIS 3.4) |
| `redis:7-alpine` | ha | |
| `ghcr.io/project-osrm/osrm-backend:v5.27.1` | ha | `osrm/Dockerfile` o'zgarishsiz |
| `debian:bookworm-slim` (OSRM extract bosqichi) | ha | |
| `node:20-alpine` (backend + 4 panel) | ha | lockfile'larda `@next/swc-linux-arm64-musl` bor; backend'da native modul yo'q |
| `caddy:2.10-alpine` | ha | |
| `postgres:16-alpine` (migratsiya klienti) | ha | |
