/**
 * Haydovchi mavjudligining Redis kalitlari — `DriversService` yozadi,
 * surge taklifi (`TaxiSupplyService`) o'qiydi. Ikkalasi shu yerdan oladi:
 * kalit bir joyda o'zgarib, ikkinchisida qolib ketmasin. Ma'nosi —
 * `DriversService` dagi `DRIVER_PRESENCE_PREFIX` izohida.
 */
export const DRIVERS_ONLINE_KEY = 'drivers:online';
export const DRIVER_PRESENCE_PREFIX = 'driver:presence:';
