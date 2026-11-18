import { describe, expect, it } from 'vitest';
import { ALL_PERMISSIONS, type Permission } from './api';
import { MONEY_OUT_PERMISSIONS, matchRoleTemplate, roleTemplates } from './role-templates';

describe('role-templates', () => {
  it("har bir shablon faqat mavjud ruxsatlardan iborat va bo'sh emas", () => {
    for (const tpl of roleTemplates()) {
      expect(tpl.permissions.length).toBeGreaterThan(0);
      for (const p of tpl.permissions) expect(ALL_PERMISSIONS).toContain(p);
      expect(tpl.label.trim().length).toBeGreaterThan(0);
    }
  });

  it("Operator pulni platformadan chiqara olmaydi", () => {
    const operator = roleTemplates().find((t) => t.id === 'operator');
    expect(operator?.permissions).toContain('dispatch');
    for (const p of MONEY_OUT_PERMISSIONS) expect(operator?.permissions).not.toContain(p);
  });

  it("Moliya pul yechishni ko'radi va tasdiqlaydi, dispetcherlik yo'q", () => {
    const finance = roleTemplates().find((t) => t.id === 'finance');
    expect(finance?.permissions).toEqual(expect.arrayContaining(['withdrawals_view', 'withdrawals_approve']));
    expect(finance?.permissions).not.toContain('dispatch');
  });

  it('ruxsatlar tartibidan qat\'i nazar shablonni taniydi', () => {
    const finance = roleTemplates().find((t) => t.id === 'finance')!;
    const shuffled = [...finance.permissions].reverse();
    expect(matchRoleTemplate(shuffled)?.id).toBe('finance');
  });

  it("shablonga to'liq mos kelmasa null (qo'lda sozlangan)", () => {
    const operator = roleTemplates().find((t) => t.id === 'operator')!;
    const custom: Permission[] = [...operator.permissions, 'promo_manage'];
    expect(matchRoleTemplate(custom)).toBeNull();
    expect(matchRoleTemplate([])).toBeNull();
  });
});
