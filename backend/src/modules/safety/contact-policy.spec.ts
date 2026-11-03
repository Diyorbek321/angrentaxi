import { OrderStatus } from '../../database/entities/order.entity';
import { UserRole } from '../../database/entities/user.entity';
import {
  callWindowOpen,
  clientSupportsCallRelay,
  maskOrderContacts,
  maskResponseBody,
  MaskableOrder,
} from './contact-policy';

const order = (overrides: Partial<MaskableOrder> = {}): MaskableOrder => ({
  passengerId: 'p1',
  driverId: 'd1',
  status: OrderStatus.ACCEPTED,
  passenger: { phone: '+998900000001' },
  driver: { phone: '+998900000002' },
  details: { customerPhone: '+998900000003', vendorPhone: '+998710000000' },
  ...overrides,
});

const passenger = { id: 'p1', role: UserRole.PASSENGER };
const driver = { id: 'd1', role: UserRole.DRIVER };

describe('contact-policy (INCIDENT-POLICY §4)', () => {
  it("qo'ng'iroq oynasi: qabul qilingandan tugaguncha", () => {
    expect(callWindowOpen(OrderStatus.ACCEPTED)).toBe(true);
    expect(callWindowOpen(OrderStatus.ARRIVED)).toBe(true);
    expect(callWindowOpen(OrderStatus.IN_PROGRESS)).toBe(true);
    expect(callWindowOpen(OrderStatus.SEARCHING)).toBe(false);
    expect(callWindowOpen(OrderStatus.COMPLETED)).toBe(false);
    expect(callWindowOpen(OrderStatus.CANCELLED)).toBe(false);
  });

  it('sarlavha: call-relay bo\'lsa yangi ilova', () => {
    expect(clientSupportsCallRelay('call-relay')).toBe(true);
    expect(clientSupportsCallRelay('foo, Call-Relay')).toBe(true);
    expect(clientSupportsCallRelay(undefined)).toBe(false);
    expect(clientSupportsCallRelay('')).toBe(false);
  });

  it("yo'lovchi haydovchi raqamini ko'rmaydi, o'zinikini ko'radi", () => {
    const shown = maskOrderContacts(order(), passenger, false);
    expect(shown.driver?.phone).toBeNull();
    expect(shown.passenger?.phone).toBe('+998900000001');
  });

  it("haydovchi/kuryer yo'lovchi va mijoz raqamini ko'rmaydi; sotuvchi raqami qoladi", () => {
    const shown = maskOrderContacts(order(), driver, false);
    expect(shown.passenger?.phone).toBeNull();
    expect(shown.details?.customerPhone).toBeNull();
    expect(shown.details?.vendorPhone).toBe('+998710000000');
    expect(shown.driver?.phone).toBe('+998900000002');
  });

  it('asl obyekt o\'zgarmaydi (nusxa)', () => {
    const original = order();
    maskOrderContacts(original, passenger, false);
    expect(original.driver?.phone).toBe('+998900000002');
  });

  it("menejer va shaharlararo — o'zgarishsiz", () => {
    const o = order();
    expect(maskOrderContacts(o, { id: 'm', role: UserRole.MANAGER }, false)).toBe(o);
    const ic = order({ intercityTripId: 't1' });
    expect(maskOrderContacts(ic, passenger, false)).toBe(ic);
  });

  it("eski ilova: faqat faol buyurtmada raqam qoladi, tugagach yo'q", () => {
    expect(maskOrderContacts(order(), passenger, true).driver?.phone).toBe('+998900000002');
    const done = maskOrderContacts(order({ status: OrderStatus.COMPLETED }), passenger, true);
    expect(done.driver?.phone).toBeNull();
  });

  it("begona ko'ruvchi — ikkala raqam ham olinadi", () => {
    const shown = maskOrderContacts(order(), { id: 'x', role: UserRole.PASSENGER }, false);
    expect(shown.driver?.phone).toBeNull();
    expect(shown.passenger?.phone).toBeNull();
  });

  it("javob shakllari: massiv, { items }, oddiy obyekt", () => {
    const list = maskResponseBody([order()], passenger, false) as MaskableOrder[];
    expect(list[0].driver?.phone).toBeNull();
    const page = maskResponseBody({ items: [order()], total: 1 }, passenger, false) as { items: MaskableOrder[]; total: number };
    expect(page.items[0].driver?.phone).toBeNull();
    expect(page.total).toBe(1);
    expect(maskResponseBody({ today: 5 }, passenger, false)).toEqual({ today: 5 });
    expect(maskResponseBody(null, passenger, false)).toBeNull();
  });
});
