export const funnel = {
  title: 'Yoʻlovchi voronkasi',
  description:
    'Taksi zakazigacha qaysi bosqichda yoʻlovchilar toʻxtab qolmoqda. Anonim: foydalanuvchi yoki qurilma boʻyicha maʼlumot yigʻilmaydi.',
  loadError: 'Voronkani yuklab boʻlmadi.',
  steps: {
    app_open: 'Ilova ochildi',
    destination_selected: 'Manzil tanlandi',
    price_shown: 'Narx koʻrsatildi',
    order_requested: 'Zakaz berildi',
    order_created: 'Zakaz yaratildi',
    driver_assigned: 'Haydovchi topildi',
    trip_completed: 'Safar yakunlandi',
  },
  sourceApp: 'Ilova',
  sourceServer: 'Server',
  fromPrev: (pct: number) => `oldingidan ${pct}%`,
  fromPrevNone: 'oldingidan —',
  noAppTitle: 'Ilova bosqichlari hali kelmagan',
  noAppDesc:
    'Ilova bosqichlarini yuboradigan versiya oʻrnatilgandan keyin bu yerda paydo boʻladi. Server bosqichlari (zakazdan keyin) allaqachon hisoblanmoqda.',
  note:
    'Ilova bosqichi bir sessiyada bir marta sanaladi (sessiya — zakazgacha yoki 30 daqiqa harakatsizlikkacha). “Zakaz berildi” va “Zakaz yaratildi” teng boʻlmasligi mumkin: dispetcher zakazlari va eski ilova versiyalari faqat serverda koʻrinadi.',
  rangeLimit: 'Davr 92 kundan oshmasin.',
  emptyTitle: 'Bu davrda maʼlumot yoʻq',
  emptyDesc: 'Boshqa davrni tanlab koʻring.',
  chartAria: 'Voronka bosqichlari',
};
