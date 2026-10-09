import * as fs from 'fs';
import * as path from 'path';
import { ERROR_CATALOGUE } from './error-catalogue';
import { localizeMessage, resolveLanguage } from './error-messages';

describe('resolveLanguage', () => {
  it('ruscha faqat birinchi til ru bo\'lsa', () => {
    expect(resolveLanguage('ru')).toBe('ru');
    expect(resolveLanguage('ru-RU,ru;q=0.9,en;q=0.8')).toBe('ru');
    expect(resolveLanguage('RU')).toBe('ru');
  });

  it("qolgan hammasi — o'zbekcha (standart)", () => {
    expect(resolveLanguage(undefined)).toBe('uz');
    expect(resolveLanguage('')).toBe('uz');
    expect(resolveLanguage('uz')).toBe('uz');
    expect(resolveLanguage('en-US,ru;q=0.9')).toBe('uz');
    expect(resolveLanguage(['ru'])).toBe('ru');
  });
});

describe('localizeMessage', () => {
  it("inglizcha xabar o'zbek foydalanuvchiga o'zbekcha", () => {
    expect(localizeMessage('Selected tariff is not available', 'uz')).toBe('Tanlangan tarif hozir mavjud emas');
  });

  it("o'zbekcha xabar rus foydalanuvchiga ruscha", () => {
    expect(localizeMessage("Bu hududda hozircha xizmat ko'rsatilmaymiz", 'ru')).toBe(
      'В этом районе мы пока не работаем',
    );
  });

  it("o'zbekcha xabar o'zbekchaga o'zgarmaydi", () => {
    const msg = "Bu hududda hozircha xizmat ko'rsatilmaymiz";
    expect(localizeMessage(msg, 'uz')).toBe(msg);
  });

  it("o'zgaruvchili xabar — qiymat tarjimaga ko'chiriladi", () => {
    expect(localizeMessage("PIN noto'g'ri. Qolgan urinishlar: 2.", 'ru')).toBe(
      'Неверный PIN. Осталось попыток: 2.',
    );
    expect(
      localizeMessage(
        "You have an unpaid balance of 12500 so'm from a previous trip. Please top up your wallet before ordering again.",
        'uz',
      ),
    ).toBe("Oldingi safardan 12500 so'm to'lanmagan qarzingiz bor. Yangi buyurtmadan oldin hamyonni to'ldiring.");
  });

  it("lug'atda yo'q xabar o'zgarmay qaytadi", () => {
    expect(localizeMessage('pickupLat must be a number', 'ru')).toBe('pickupLat must be a number');
  });
});

/**
 * DRIFT HIMOYASI: lug'atdagi har bir manba xabar kodda hali ham bor bo'lishi
 * shart. Kimdir xabar matnini o'zgartirsa, tarjima JIMGINA ishlamay qolardi —
 * bu test o'sha lahzada yiqiladi.
 */
describe('ERROR_CATALOGUE — kod bilan sinxron', () => {
  const sources = (() => {
    const root = path.resolve(__dirname, '../..');
    const texts: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts') && !full.includes('i18n')) {
          texts.push(
            fs
              .readFileSync(full, 'utf8')
              // Ikki qatorga bo'lingan xabar: `'...' +\n '...'` → bitta satr.
              .replace(/[`'"]\s*\+\s*[`'"]/g, '')
              .replace(/\\(['"])/g, '$1'),
          );
        }
      }
    };
    walk(root);
    return texts.join('\n');
  })();

  it.each(ERROR_CATALOGUE.map((e) => [e.source]))('%s', (source) => {
    // O'zgaruvchilar `{0}` ko'rinishida; kodda ular `${...}`. Har bir
    // doimiy bo'lak kodda AYNAN shunday turishi kerak.
    for (const fragment of source.split(/\{\d\}/)) {
      if (fragment.trim().length < 4) continue;
      expect(sources.includes(fragment)).toBe(true);
    }
  });

  // Tarjima manbadagi o'zgaruvchining bir qismini TASHLAB ketishi mumkin
  // (foydalanuvchiga buyurtma UUID'i kerak emas), lekin yo'q belgini
  // ishlatsa — matnda bo'sh joy qoladi.
  it('tarjima manbada yo\'q o\'zgaruvchini ishlatmaydi', () => {
    for (const e of ERROR_CATALOGUE) {
      const slots = (s: string) => new Set(s.match(/\{\d\}/g) ?? []);
      const source = slots(e.source);
      for (const text of [e.ru, e.uz ?? '']) {
        const extra = [...slots(text)].filter((slot) => !source.has(slot));
        expect([e.source, extra]).toEqual([e.source, []]);
      }
    }
  });
});
