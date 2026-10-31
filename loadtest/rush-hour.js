// Angren "tig'iz soat" yuk sinovi (k6).
//
//   docker run --rm -i --network host -e BASE_URL=http://localhost:3010/api/v1 \
//     -v "$PWD/loadtest:/scripts" grafana/k6:0.54.0 run /scripts/rush-hour.js
//
// Ikki oqim parallel:
//   drivers    — onlayn haydovchilar har 3 s joylashuv yuboradi (HTTP zaxira yo'li)
//   passengers — yo'lovchi bosh ekranni ochadi (tarif, reklama, restoranlar),
//                narx hisoblaydi, buyurtmalar tarixini ko'radi
//
// Har virtual foydalanuvchi alohida X-Forwarded-For bilan keladi (backend
// `trust proxy 1`) — aks holda hammasi bitta IP limitiga (10/s) urilib, sinov
// server o'rniga throttler'ni o'lchaydi. Login OTP bypass (123456) talab qiladi,
// shuning uchun faqat lokal/staging'da ishlaydi; production'ga ALLOW_PROD=1 siz
// ruxsat berilmaydi.
//
// Cheklov: hamma "haydovchi" bitta test akkaunt tokenidan foydalanadi — Redis
// GEO va DB yozuv yo'li yuklanadi, lekin matching ko'p haydovchini ko'rmaydi.
import http from 'k6/http';
import { check, fail, sleep } from 'k6';
import { Counter } from 'k6/metrics';

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:3000/api/v1').replace(/\/$/, '');
const DRIVER_PHONE = __ENV.DRIVER_PHONE || '+998901234571';
const PASSENGER_PHONE = __ENV.PASSENGER_PHONE || '+998901234569';
const OTP_CODE = __ENV.OTP_CODE || '123456';
const DRIVERS = Number(__ENV.DRIVERS || 60);
const PASSENGERS = Number(__ENV.PASSENGERS || 40);
const DURATION = __ENV.DURATION || '2m';

// Angren markazi atrofida ~3 km.
const CENTER = { lat: 41.0167, lng: 70.1436 };

const throttled = new Counter('throttled_429');

export const options = {
  scenarios: {
    drivers: {
      executor: 'constant-vus',
      exec: 'driver',
      vus: DRIVERS,
      duration: DURATION,
    },
    passengers: {
      executor: 'ramping-vus',
      exec: 'passenger',
      startVUs: 0,
      stages: [
        { duration: '30s', target: PASSENGERS },
        { duration: DURATION, target: PASSENGERS },
        { duration: '15s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{flow:location}': ['p(95)<300'],
    'http_req_duration{flow:price}': ['p(95)<800'],
    'http_req_duration{flow:browse}': ['p(95)<500'],
    throttled_429: ['count<1'],
  },
};

function login(phone) {
  const headers = { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.200.0.1' };
  http.post(`${BASE_URL}/auth/send-otp`, JSON.stringify({ phone }), { headers });
  const res = http.post(`${BASE_URL}/auth/verify-otp`, JSON.stringify({ phone, code: OTP_CODE }), { headers });
  const token = res.json('data.accessToken');
  if (!token) fail(`login ${phone} yiqildi: ${res.status} ${res.body}`);
  return token;
}

export function setup() {
  if (/railway\.app|angrentaxi\.uz/.test(BASE_URL) && __ENV.ALLOW_PROD !== '1') {
    fail('Production manzili — ALLOW_PROD=1 bermasdan yuk sinovi qilinmaydi');
  }
  const tariffs = http.get(`${BASE_URL}/tariffs`).json('data') || [];
  if (!tariffs.length) fail('Faol taksi tarifi yo\'q — seed qiling');
  return {
    driverToken: login(DRIVER_PHONE),
    passengerToken: login(PASSENGER_PHONE),
    tariffId: tariffs[0].id,
  };
}

function jitter(km) {
  return (Math.random() - 0.5) * 2 * (km / 111);
}

function headersFor(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'X-Forwarded-For': `10.${100 + (__VU % 100)}.${Math.floor(__VU / 250)}.${__VU % 250}`,
    'Accept-Language': 'uz',
  };
}

function track(res) {
  if (res.status === 429) throttled.add(1);
  return res;
}

export function driver(data) {
  const res = track(
    http.post(
      `${BASE_URL}/drivers/location`,
      JSON.stringify({ lat: CENTER.lat + jitter(3), lng: CENTER.lng + jitter(3) }),
      { headers: headersFor(data.driverToken), tags: { flow: 'location' } },
    ),
  );
  check(res, { 'location 2xx': (r) => r.status >= 200 && r.status < 300 });
  sleep(3);
}

export function passenger(data) {
  const params = { headers: headersFor(data.passengerToken) };

  const home = http.batch(
    ['/tariffs', '/ads/active', '/food/restaurants'].map((path) => [
      'GET',
      `${BASE_URL}${path}`,
      null,
      { ...params, tags: { flow: 'browse' } },
    ]),
  );
  home.forEach(track);
  check(home, { 'home screen 200': (rs) => rs.every((r) => r.status === 200) });
  sleep(1 + Math.random() * 2);

  const price = track(
    http.post(
      `${BASE_URL}/orders/calculate-price`,
      JSON.stringify({
        tariffId: data.tariffId,
        distanceKm: 2 + Math.random() * 8,
        durationMin: 5 + Math.random() * 20,
        pickupLat: CENTER.lat + jitter(2),
        pickupLng: CENTER.lng + jitter(2),
      }),
      { ...params, tags: { flow: 'price' } },
    ),
  );
  check(price, { 'price 2xx': (r) => r.status >= 200 && r.status < 300 });
  sleep(2 + Math.random() * 3);

  const history = track(
    http.get(`${BASE_URL}/orders/history?page=1&limit=10`, { ...params, tags: { flow: 'browse' } }),
  );
  check(history, { 'history 200': (r) => r.status === 200 });
  sleep(3 + Math.random() * 5);
}
