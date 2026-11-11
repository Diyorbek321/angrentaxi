import * as fs from 'fs';
import * as path from 'path';
import { VALIDATION_CATALOGUE, localizeValidationMessage } from './validation-messages';

describe('localizeValidationMessage', () => {
  it("class-validator xabari o'zbekchaga — maydon nomi saqlanadi", () => {
    expect(localizeValidationMessage('phone must be a string', 'uz')).toBe("«phone» matn bo'lishi kerak");
  });

  it('ruschaga', () => {
    expect(localizeValidationMessage('pickupLat must be a latitude string or number', 'ru')).toBe(
      '«pickupLat» должно быть широтой',
    );
  });

  it("chegaraviy qiymat tarjimaga ko'chiriladi", () => {
    expect(localizeValidationMessage('seats must not be greater than 4', 'uz')).toBe(
      "«seats» 4 dan katta bo'lmasligi kerak",
    );
    expect(localizeValidationMessage('comment must be shorter than or equal to 200 characters', 'ru')).toBe(
      '«comment» — не более 200 символов',
    );
  });

  it('whitelist: ortiqcha maydon', () => {
    expect(localizeValidationMessage('property foo should not exist', 'uz')).toBe("«foo» maydoni qabul qilinmaydi");
  });

  it('`each: true` prefiksi', () => {
    expect(
      localizeValidationMessage('each value in serviceTypes must be one of the following values: taxi, food', 'uz'),
    ).toBe("«serviceTypes» ning har bir qiymati quyidagilardan biri bo'lishi kerak: taxi, food");
  });

  it("ichma-ich DTO yo'li ham maydon nomi sifatida qoladi", () => {
    expect(localizeValidationMessage('stops.0.lat must be a number conforming to the specified constraints', 'uz')).toBe(
      "«stops.0.lat» son bo'lishi kerak",
    );
  });

  it("noma'lum xabar o'zgarmay qaytadi", () => {
    expect(localizeValidationMessage("Bu hududda hozircha xizmat ko'rsatilmaymiz", 'ru')).toBe(
      "Bu hududda hozircha xizmat ko'rsatilmaymiz",
    );
  });
});

/**
 * DRIFT HIMOYASI: class-validator yangilanib xabar matnini o'zgartirsa,
 * tarjima jimgina ishlamay qolardi. Har bir manba kutubxonada bo'lishi shart.
 */
describe('VALIDATION_CATALOGUE — class-validator bilan sinxron', () => {
  const library = (() => {
    const root = path.dirname(require.resolve('class-validator/package.json'));
    const texts: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith('.js')) texts.push(fs.readFileSync(full, 'utf8'));
      }
    };
    walk(path.join(root, 'cjs'));
    return texts.join('\n');
  })();

  it.each(VALIDATION_CATALOGUE.map((e) => [e.source]))('%s', (source) => {
    for (const fragment of source.split(/\{\d\}/)) {
      if (fragment.trim().length < 4) continue;
      expect(library.includes(fragment)).toBe(true);
    }
  });
});
