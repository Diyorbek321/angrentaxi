import { describe, expect, it } from 'vitest';
import { auditActorView } from './audit-actor';

const actor = { id: 'u1', name: 'Ali Valiyev', phone: '+998901234567', role: 'manager' };

describe('auditActorView', () => {
  it('shows name and translated role', () => {
    expect(auditActorView(actor, 'u1')).toEqual({ name: 'Ali Valiyev', role: 'Menejer', isSystem: false });
  });

  it('falls back to the formatted phone, then to a placeholder', () => {
    expect(auditActorView({ ...actor, name: null }, 'u1', (p) => `tel ${p}`).name).toBe('tel +998901234567');
    expect(auditActorView({ ...actor, name: '  ', phone: null }, 'u1').name).toBe('Ism kiritilmagan');
  });

  it('keeps unknown roles verbatim', () => {
    expect(auditActorView({ ...actor, role: 'auditor' }, 'u1').role).toBe('auditor');
  });

  it('distinguishes system actions from deleted users', () => {
    expect(auditActorView(null, null)).toEqual({ name: 'Tizim', role: null, isSystem: true });
    expect(auditActorView(undefined, 'u9')).toEqual({
      name: 'Foydalanuvchi oʻchirilgan',
      role: null,
      isSystem: false,
    });
  });
});
