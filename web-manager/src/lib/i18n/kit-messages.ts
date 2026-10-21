// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
import { createTranslator } from './core';

/**
 * UI kit (components/ui, components/shell) va `format.ts` matnlari.
 * Panel matnlari bu yerda EMAS — ular har panelning `src/locales/` ida.
 *
 * `kitT()` ni faqat render paytida (yoki chaqiriladigan funksiya ichida)
 * o'qing — modul yuklanganda emas, aks holda til almashganda eskisi qoladi.
 */
const uz = {
  common: {
    close: 'Yopish',
    cancel: 'Bekor qilish',
    retry: 'Qayta urinish',
    refresh: 'Yangilash',
    search: 'Qidirish…',
    clearSearch: 'Qidiruvni tozalash',
    clearFilters: 'Filtrlarni tozalash',
    loading: 'Yuklanmoqda…',
    logout: 'Chiqish',
  },
  confirm: {
    ok: 'Tasdiqlash',
  },
  dataTable: {
    noResultsTitle: 'Hech narsa topilmadi',
    noResultsDescription: 'Filtr shartlarini oʻzgartiring yoki tozalang.',
    emptyTitle: 'Maʼlumot yoʻq',
    selectRow: (label: string) => `Tanlash: ${label}`,
    selectRowGeneric: 'Qatorni tanlash',
    selectAll: 'Hammasini tanlash',
    bulkRegion: 'Tanlanganlar bilan amallar',
    selected: (n: number) => `${n} ta tanlandi`,
  },
  dateRange: {
    presets: {
      today: 'Bugun',
      '7d': '7 kun',
      '30d': '30 kun',
      custom: 'Oraliq',
    },
    group: 'Sana oraligʻi',
    from: 'Boshlanish sanasi',
    to: 'Tugash sanasi',
  },
  errorState: {
    title: 'Maʼlumotni yuklab boʻlmadi',
  },
  retryBanner: {
    title: 'Maʼlumotni yangilab boʻlmadi.',
    keptAt: (at: string) => `Ekranda ${at} holatidagi maʼlumot.`,
    kept: 'Ekranda oxirgi yuklangan maʼlumot.',
    refreshFailed: 'Yangilab boʻlmadi',
    connectionLost: 'Aloqa uzildi — yangilanish muvaffaqiyatsiz',
  },
  filters: {
    active: 'Faol filtrlar',
    remove: (label: string) => `${label} filtrini olib tashlash`,
  },
  pagination: {
    nav: 'Sahifalash',
    perPage: 'Sahifada',
    prev: 'Oldingi sahifa',
    next: 'Keyingi sahifa',
  },
  statCard: {
    flat: 'oʻzgarmadi',
    up: 'oshdi',
    down: 'kamaydi',
  },
  theme: {
    toLight: 'Yorugʻ rejimga oʻtish',
    toDark: 'Qorongʻi rejimga oʻtish',
    generic: 'Mavzu',
  },
  toast: {
    success: 'Muvaffaqiyatli: ',
    error: 'Xato: ',
    info: 'Maʼlumot: ',
    region: 'Bildirishnomalar',
  },
  shell: {
    skipToContent: 'Asosiy kontentga oʻtish',
    sidebar: 'Yon panel',
    mainNav: 'Asosiy navigatsiya',
    expand: 'Panelni yoyish',
    collapse: 'Panelni yigʻish',
    collapseShort: 'Yigʻish',
    userMenu: (name: string) => `Foydalanuvchi menyusi: ${name}`,
    openMenu: 'Menyuni ochish',
    profile: (name: string) => `Profil: ${name}`,
    userFallback: 'Foydalanuvchi',
  },
  live: {
    live: 'Jonli',
    connecting: 'Ulanmoqda',
    reconnecting: 'Qayta ulanmoqda',
    stale: 'Eskirgan',
    offline: 'Aloqa yoʻq',
    asOf: (at: string) => `${at} holatiga`,
    metricLoading: 'yuklanmoqda',
  },
  format: {
    currency: 'soʻm',
    units: { day: 'kun', hour: 'soat', minute: 'daq', second: 'son' },
    overdue: (duration: string) => `${duration} kechikdi`,
    nameFallback: 'Ism kiritilmagan',
    prep: {
      staleLabel: (at: string) => `Juda eski buyurtma — ${at} da tushgan`,
      lateText: (late: string) => `Kechikmoqda · ${late}`,
      lateLabel: (late: string) => `Tayyorlash ${late} kechikmoqda`,
      leftLabel: (left: string) => `Tayyorlash uchun ${left} qoldi`,
    },
  },
};

export type KitMessages = typeof uz;

const ru: KitMessages = {
  common: {
    close: 'Закрыть',
    cancel: 'Отмена',
    retry: 'Повторить',
    refresh: 'Обновить',
    search: 'Поиск…',
    clearSearch: 'Очистить поиск',
    clearFilters: 'Сбросить фильтры',
    loading: 'Загрузка…',
    logout: 'Выйти',
  },
  confirm: {
    ok: 'Подтвердить',
  },
  dataTable: {
    noResultsTitle: 'Ничего не найдено',
    noResultsDescription: 'Измените условия фильтра или сбросьте его.',
    emptyTitle: 'Нет данных',
    selectRow: (label: string) => `Выбрать: ${label}`,
    selectRowGeneric: 'Выбрать строку',
    selectAll: 'Выбрать все',
    bulkRegion: 'Действия с выбранными',
    selected: (n: number) => `Выбрано: ${n}`,
  },
  dateRange: {
    presets: {
      today: 'Сегодня',
      '7d': '7 дней',
      '30d': '30 дней',
      custom: 'Период',
    },
    group: 'Диапазон дат',
    from: 'Дата начала',
    to: 'Дата окончания',
  },
  errorState: {
    title: 'Не удалось загрузить данные',
  },
  retryBanner: {
    title: 'Не удалось обновить данные.',
    keptAt: (at: string) => `На экране данные по состоянию на ${at}.`,
    kept: 'На экране последние загруженные данные.',
    refreshFailed: 'Не удалось обновить',
    connectionLost: 'Связь потеряна — обновление не удалось',
  },
  filters: {
    active: 'Активные фильтры',
    remove: (label: string) => `Убрать фильтр «${label}»`,
  },
  pagination: {
    nav: 'Постраничная навигация',
    perPage: 'На странице',
    prev: 'Предыдущая страница',
    next: 'Следующая страница',
  },
  statCard: {
    flat: 'без изменений',
    up: 'рост',
    down: 'снижение',
  },
  theme: {
    toLight: 'Включить светлую тему',
    toDark: 'Включить тёмную тему',
    generic: 'Тема',
  },
  toast: {
    success: 'Успешно: ',
    error: 'Ошибка: ',
    info: 'Информация: ',
    region: 'Уведомления',
  },
  shell: {
    skipToContent: 'Перейти к основному содержимому',
    sidebar: 'Боковая панель',
    mainNav: 'Основная навигация',
    expand: 'Развернуть панель',
    collapse: 'Свернуть панель',
    collapseShort: 'Свернуть',
    userMenu: (name: string) => `Меню пользователя: ${name}`,
    openMenu: 'Открыть меню',
    profile: (name: string) => `Профиль: ${name}`,
    userFallback: 'Пользователь',
  },
  live: {
    live: 'Онлайн',
    connecting: 'Подключение',
    reconnecting: 'Переподключение',
    stale: 'Устарело',
    offline: 'Нет связи',
    asOf: (at: string) => `на ${at}`,
    metricLoading: 'загрузка',
  },
  format: {
    currency: 'сум',
    units: { day: 'д', hour: 'ч', minute: 'мин', second: 'с' },
    overdue: (duration: string) => `просрочено на ${duration}`,
    nameFallback: 'Имя не указано',
    prep: {
      staleLabel: (at: string) => `Очень старый заказ — поступил ${at}`,
      lateText: (late: string) => `Задержка · ${late}`,
      lateLabel: (late: string) => `Приготовление задерживается на ${late}`,
      leftLabel: (left: string) => `До готовности осталось ${left}`,
    },
  },
};

export const kitT = createTranslator<KitMessages>({ uz, ru });
