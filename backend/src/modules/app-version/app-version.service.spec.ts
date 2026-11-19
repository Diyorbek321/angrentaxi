import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppVersionController } from './app-version.controller';
import { AppVersionService } from './app-version.service';

describe('AppVersionService', () => {
  const make = (env: Record<string, string>) =>
    new AppVersionService({ get: (k: string) => env[k] } as unknown as ConfigService);

  it("sozlanmagan bo'lsa hech kim bloklanmaydi", () => {
    expect(make({}).policyFor('driver')).toEqual({ minBuild: 0, latestBuild: 0, updateUrl: null });
  });

  it('har flavor o\'z qiymatini oladi', () => {
    const service = make({
      APP_MIN_BUILD_DRIVER: '120',
      APP_LATEST_BUILD_DRIVER: '130',
      APP_UPDATE_URL_DRIVER: ' https://example.uz/driver.apk ',
      APP_MIN_BUILD_PASSENGER: '90',
    });
    expect(service.policyFor('driver')).toEqual({
      minBuild: 120,
      latestBuild: 130,
      updateUrl: 'https://example.uz/driver.apk',
    });
    expect(service.policyFor('passenger')).toEqual({ minBuild: 90, latestBuild: 90, updateUrl: null });
  });

  it("buzuq qiymat — 0; latest hech qachon min'dan past emas", () => {
    const service = make({ APP_MIN_BUILD_DRIVER: 'abc', APP_LATEST_BUILD_PASSENGER: '-5' });
    expect(service.policyFor('driver').minBuild).toBe(0);
    expect(make({ APP_MIN_BUILD_DRIVER: '50', APP_LATEST_BUILD_DRIVER: '10' }).policyFor('driver').latestBuild).toBe(50);
  });
});

describe('AppVersionService — iOS', () => {
  const make = (env: Record<string, string>) =>
    new AppVersionService({ get: (k: string) => env[k] } as unknown as ConfigService);

  it("iOS o'z kalitlarini oladi (_IOS qo'shimchasi)", () => {
    const service = make({
      APP_MIN_BUILD_PASSENGER: '300',
      APP_UPDATE_URL_PASSENGER: 'https://example.uz/passenger.apk',
      APP_MIN_BUILD_PASSENGER_IOS: '310',
      APP_LATEST_BUILD_PASSENGER_IOS: '320',
      APP_UPDATE_URL_PASSENGER_IOS: 'https://apps.apple.com/app/id1',
    });
    expect(service.policyFor('passenger', 'ios')).toEqual({
      minBuild: 310,
      latestBuild: 320,
      updateUrl: 'https://apps.apple.com/app/id1',
    });
  });

  it("iOS Android qiymatlarini OLMAYDI — APK havolasi iPhone'ga bormaydi, Android min build iOS'ni bloklamaydi", () => {
    const service = make({
      APP_MIN_BUILD_PASSENGER: '300',
      APP_LATEST_BUILD_PASSENGER: '310',
      APP_UPDATE_URL_PASSENGER: 'https://example.uz/passenger.apk',
    });
    expect(service.policyFor('passenger', 'ios')).toEqual({ minBuild: 0, latestBuild: 0, updateUrl: null });
  });

  it('platforma berilmasa — Android (eski ilovalar platform yubormaydi)', () => {
    const service = make({ APP_MIN_BUILD_PASSENGER: '300' });
    expect(service.policyFor('passenger').minBuild).toBe(300);
    expect(service.policyFor('passenger', 'android').minBuild).toBe(300);
  });
});

describe('AppVersionController', () => {
  const controller = new AppVersionController(
    new AppVersionService({ get: () => undefined } as unknown as ConfigService),
  );

  it("noma'lum flavor — 400", () => {
    expect(() => controller.version('admin')).toThrow(BadRequestException);
  });

  it("noma'lum platforma — 400", () => {
    expect(() => controller.version('passenger', 'windows')).toThrow(BadRequestException);
  });

  it('platformasiz va ios bilan ishlaydi', () => {
    expect(controller.version('passenger')).toEqual({ minBuild: 0, latestBuild: 0, updateUrl: null });
    expect(controller.version('passenger', 'ios')).toEqual({ minBuild: 0, latestBuild: 0, updateUrl: null });
  });
});
