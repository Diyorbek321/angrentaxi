import { describe, expect, it } from "vitest";
import { clientIp, clientIpHeaders } from "./client-ip";

const h = (xff?: string) =>
  new Headers(xff === undefined ? {} : { "x-forwarded-for": xff });

describe("clientIp", () => {
  it("chekka qo‘shgan oxirgi qiymat olinadi — mijoz yozgani emas", () => {
    expect(clientIp(h("6.6.6.6, 84.54.70.12"))).toBe("84.54.70.12");
  });

  it("bitta qiymat va IPv6", () => {
    expect(clientIp(h("84.54.70.12"))).toBe("84.54.70.12");
    expect(clientIp(h("2001:db8::1"))).toBe("2001:db8::1");
  });

  it("sarlavha yo‘q, bo‘sh yoki IP emas — null", () => {
    expect(clientIp(h())).toBeNull();
    expect(clientIp(h(" , "))).toBeNull();
    expect(clientIp(h("1.2.3.4, evil"))).toBeNull();
  });
});

describe("clientIpHeaders", () => {
  it("IP bo‘lsa faqat shu bitta qiymat uzatiladi", () => {
    expect(clientIpHeaders(h("6.6.6.6, 84.54.70.12"))).toEqual({
      "x-forwarded-for": "84.54.70.12",
    });
  });

  it("IP yo‘q — bo‘sh obyekt", () => {
    expect(clientIpHeaders(h())).toEqual({});
  });
});
