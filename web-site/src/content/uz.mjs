// Saytning o'zbekcha matni. Har bir kalit ru.mjs da ham bo'lishi shart —
// build.test.mjs buni tekshiradi. Raqam va va'dalar faqat haqiqatda ishlayotgan
// narsalar haqida: soxta statistika, sharh yoki "24/7" yozilmaydi.

export default {
  lang: 'uz',
  htmlLang: 'uz-Latn',
  ogLocale: 'uz_UZ',
  path: '/',
  langName: 'Oʻzbekcha',
  langShort: 'UZ',

  meta: {
    title: 'Angren Taxi — Angren uchun taksi, yetkazib berish va ovqat ilovasi',
    description:
      'Angren Taxi — narxi oldindan maʼlum taksi, posilka yetkazish, ovqat va market buyurtmasi bitta ilovada. Tekshirilgan haydovchilar, SOS tugmasi va safarni yaqinlar bilan ulashish.',
  },

  nav: {
    skip: 'Asosiy mazmunga oʻtish',
    services: 'Xizmatlar',
    safety: 'Xavfsizlik',
    drivers: 'Haydovchilarga',
    partners: 'Hamkorlarga',
    company: 'Kompaniya',
    faq: 'Savollar',
    contact: 'Aloqa',
    download: 'Ilovani olish',
    menu: 'Menyu',
    close: 'Yopish',
    home: 'Bosh sahifa',
  },

  apps: {
    soon: 'Google Playʼda tez orada',
    play: 'Google Playʼdan yuklab olish',
    passenger: 'Yoʻlovchi ilovasi',
    driver: 'Haydovchi ilovasi',
    title: 'Angren Taxi telefoningizda',
    lead: 'Yoʻlovchi va haydovchi uchun alohida ilova — Android telefonlar uchun.',
  },

  hero: {
    eyebrow: 'Angren shahrining oʻz ilovasi',
    titleA: 'Shahar boʻylab safar —',
    titleB: 'bir tegishda',
    lead:
      'Narxni safardan oldin koʻrasiz, haydovchi ilovada tekshirilgan, yoʻl esa xaritada kuzatiladi. Taksi, posilka, ovqat va market — barchasi bitta ilovada.',
    ctaPrimary: 'Ilovani olish',
    ctaSecondary: 'Haydovchi boʻlish',
    chips: ['Narx oldindan maʼlum', 'Tekshirilgan haydovchilar', 'Har safarda SOS tugmasi'],
  },

  mock: {
    greeting: 'Qayerga boramiz?',
    from: 'Bobur koʻchasi, 10',
    to: 'Mustaqillik maydoni',
    tariffs: ['Ekonom', 'Komfort', 'Biznes', 'Miniven'],
    priceNote: 'Narx buyurtmadan oldin',
    button: 'Buyurtma berish',
    driverTitle: 'Haydovchi yoʻlda',
    driverEta: '3 daqiqada yetib keladi',
  },

  services: {
    kicker: 'Xizmatlar',
    title: 'Kundalik ishlar uchun bitta ilova',
    lead: 'Har bir xizmat Angren koʻchalari va odatlari hisobga olingan holda qurilgan.',
    soon: 'Tez orada',
    items: [
      {
        id: 'taxi',
        icon: 'car',
        title: 'Taksi',
        text: 'Oddiydan komfortgacha bir necha tarif. Narx buyurtmadan oldin koʻrinadi — koʻchada savdolashish shart emas.',
      },
      {
        id: 'parcel',
        icon: 'box',
        title: 'Posilka',
        text: 'Hujjat, kalit yoki kichik yukni shahar ichida yetkazamiz. Qabul qiluvchi kodni aytmaguncha posilka topshirilmaydi.',
      },
      {
        id: 'food',
        icon: 'food',
        title: 'Ovqat',
        text: 'Shahardagi restoran va kafelardan buyurtma. Holati real vaqtda: tayyorlanmoqda, yoʻlda, yetib keldi.',
      },
      {
        id: 'market',
        icon: 'bag',
        title: 'Market',
        text: 'Doʻkonlardan oziq-ovqat va kundalik mahsulotlar. Savatni toʻldiring — kuryer eshigingizgacha olib keladi.',
      },
      {
        id: 'cargo',
        icon: 'truck',
        title: 'Yuk tashish',
        text: 'Koʻchish, mebel yoki qurilish materiali uchun yuk mashinasi. Yuk hajmini koʻrsatasiz, mos transport keladi.',
      },
      {
        id: 'intercity',
        icon: 'route',
        title: 'Shaharlararo',
        text: 'Toshkent va boshqa shaharlarga joy band qilish yoki butun mashinani buyurtma qilish.',
        flag: 'intercityLive',
      },
    ],
  },

  steps: {
    kicker: 'Qanday ishlaydi',
    title: 'Uch qadamda yoʻlga chiqasiz',
    items: [
      { title: 'Manzilni belgilang', text: 'Xaritadan nuqtani tanlang yoki manzilni yozing. Joriy joylashuv oʻzi aniqlanadi.' },
      { title: 'Tarif va narxni koʻring', text: 'Har bir tarif narxi oldindan koʻrsatiladi. Mos keladiganini tanlab, buyurtma berasiz.' },
      { title: 'Safarni kuzating', text: 'Haydovchi, mashina raqami va yetib kelish vaqti ekranda. Yoʻl xaritada jonli koʻrinadi.' },
    ],
  },

  safety: {
    kicker: 'Xavfsizlik',
    title: 'Har bir safar nazorat ostida',
    lead: 'Xavfsizlik — qoʻshimcha funksiya emas, ilovaning asosi. Yoʻlovchi ham, haydovchi ham himoyalangan.',
    items: [
      { icon: 'idcard', title: 'Tekshirilgan haydovchilar', text: 'Haydovchilik guvohnomasi, texpasport va shaxsni tasdiqlovchi hujjatlar ishga chiqishdan oldin tekshiriladi.' },
      { icon: 'sos', title: 'SOS tugmasi', text: 'Safar davomida bir tegishda favqulodda yordam soʻrash. Murojaat darhol operatorga yetib boradi.' },
      { icon: 'share', title: 'Safarni ulashish', text: 'Yaqinlaringizga havola yuboring — ular mashina qayerdaligini xaritada kuzatib turadi.' },
      { icon: 'phone', title: 'Raqamlar yashirin', text: 'Haydovchi bilan ilova orqali bogʻlanasiz. Shaxsiy telefon raqamingiz begonaga koʻrinmaydi.' },
      { icon: 'key', title: 'Topshirish kodi', text: 'Posilka faqat toʻgʻri kodni aytgan qabul qiluvchiga beriladi. Adashib topshirish istisno.' },
      { icon: 'star', title: 'Ikki tomonlama baho', text: 'Har safardan keyin yoʻlovchi va haydovchi bir-birini baholaydi. Shikoyatlar koʻrib chiqiladi.' },
    ],
  },

  drivers: {
    kicker: 'Haydovchilarga',
    title: 'Mashinangiz boʻsh turmasin',
    lead: 'Bekatda kutish oʻrniga buyurtmalar telefoningizga oʻzi keladi. Ish vaqtini oʻzingiz belgilaysiz.',
    perks: [
      { icon: 'bell', title: 'Buyurtmalar oʻzi keladi', text: 'Yaqin atrofdagi zakaz ekraningizga chiqadi — ekran qulflangan boʻlsa ham ovoz bilan.' },
      { icon: 'nav', title: 'Navigator va taksometr', text: 'Yoʻl koʻrsatuvchi va taksometr ilova ichida. Boshqa dastur kerak emas.' },
      { icon: 'wallet', title: 'Shaffof daromad', text: 'Har bir safar, komissiya va balans ilovada koʻrinadi. Pul yechish soʻrovi ham ilovadan.' },
      { icon: 'clock', title: 'Erkin jadval', text: 'Onlayn boʻlganingizda ishlaysiz. Majburiy smena yoʻq.' },
    ],
    joinTitle: 'Qanday qoʻshilish mumkin',
    join: [
      'Haydovchi ilovasini oʻrnating va telefon raqamingiz bilan kiring.',
      'Hujjatlar suratini ilovaning oʻzida yuklang.',
      'Tekshiruvdan oʻting — natija ilovada bildiriladi.',
      'Onlayn boʻling va birinchi buyurtmani qabul qiling.',
    ],
    cta: 'Haydovchi boʻlish',
    note: 'Komissiya va shartlar haydovchi ofertasida batafsil yozilgan — roziligingizdan oldin ilovada koʻrsatiladi.',
  },

  partners: {
    kicker: 'Hamkorlarga',
    title: 'Restoran va doʻkonlar uchun',
    lead: 'Buyurtmalarni qabul qiling, menyu va zaxirani boshqaring — yetkazib berishni bizga qoldiring.',
    items: [
      { icon: 'store', title: 'Hamkor paneli', text: 'Brauzerda ishlaydigan panel: yangi buyurtma ovoz bilan keladi, holatini bir tugmada oʻzgartirasiz.' },
      { icon: 'list', title: 'Menyu va zaxira', text: 'Mahsulot, narx, rasm va qoldiqni oʻzingiz yangilaysiz — oʻzgarish ilovada darhol koʻrinadi.' },
      { icon: 'bike', title: 'Kuryer bizdan', text: 'Buyurtma tayyor boʻlganda eng yaqin kuryer keladi. Oʻz kuryer xizmatingiz shart emas.' },
      { icon: 'chart', title: 'Hisobotlar', text: 'Sotuvlar, buyurtmalar va toʻlovlar boʻyicha hisobot panelning oʻzida.' },
    ],
    cta: 'Hamkor boʻlish',
  },

  company: {
    kicker: 'Kompaniya',
    title: 'Angren uchun, Angrenda yaratilgan',
    paras: [
      'Angren Taxi — shahar aholisini haydovchilar, restoranlar va doʻkonlar bilan bogʻlaydigan mahalliy texnologik platforma. Maqsadimiz oddiy: koʻchada qoʻl koʻtarib kutish va narx boʻyicha tortishuv oʻrniga — tez, xavfsiz va halol xizmat.',
      'Biz shahar ichidagi kundalik ehtiyojlardan boshladik va platformani bosqichma-bosqich kengaytiryapmiz. Har bir yangi xizmat avval yopiq sinovdan oʻtadi.',
    ],
    values: [
      { title: 'Halol narx', text: 'Narx buyurtmadan oldin koʻrsatiladi va yoʻlda oʻzgarmaydi.' },
      { title: 'Mahalliy jamoa', text: 'Shaharni biladigan odamlar qoʻllab-quvvatlaydi.' },
      { title: 'Maʼlumotlar himoyasi', text: 'Shaxsiy maʼlumotlar Oʻzbekiston qonunchiligi asosida qayta ishlanadi.' },
    ],
  },

  faq: {
    kicker: 'Savollar',
    title: 'Koʻp beriladigan savollar',
    items: [
      {
        q: 'Narx qanday hisoblanadi?',
        a: 'Narx masofa, taxminiy vaqt va tanlangan tarifdan kelib chiqadi. U buyurtmadan oldin ekranda koʻrinadi.',
      },
      {
        q: 'Qanday toʻlash mumkin?',
        a: (cfg) =>
          cfg.services.cardPaymentsLive
            ? 'Naqd pul yoki bank kartasi bilan — buyurtma berishda tanlaysiz.'
            : 'Hozircha naqd pul bilan. Bank kartasi orqali toʻlov tez orada qoʻshiladi.',
      },
      {
        q: 'Mashinada buyumimni unutib qoldim. Nima qilay?',
        a: 'Ilovadagi safarlar tarixidan oʻsha safarni oching va “Muammo bor” boʻlimi orqali murojaat qoldiring. Biz haydovchi bilan bogʻlanamiz.',
      },
      {
        q: 'Haydovchi boʻlish uchun nima kerak?',
        a: 'Amaldagi haydovchilik guvohnomasi, mashina hujjatlari va shaxsni tasdiqlovchi hujjat. Hammasi haydovchi ilovasida yuklanadi va tekshiriladi.',
      },
      {
        q: 'Hisobimni qanday oʻchiraman?',
        a: 'Ilovadagi profil sozlamalarida “Hisobni oʻchirish” bor. Batafsil tartib pastdagi “Hisobni oʻchirish” sahifasida.',
      },
      {
        q: 'Xizmat qaysi hududda ishlaydi?',
        a: 'Hozir Angren shahri va uning atrofida. Yangi yoʻnalishlar qoʻshilganda shu sahifada eʼlon qilamiz.',
      },
    ],
  },

  contact: {
    kicker: 'Aloqa',
    title: 'Biz bilan bogʻlaning',
    lead: 'Hamkorlik, haydovchilik yoki xizmat haqida savolingiz boʻlsa — yozing yoki qoʻngʻiroq qiling.',
    phone: 'Telefon',
    email: 'Elektron pochta',
    telegram: 'Telegram',
    address: 'Manzil',
    hours: 'Ish vaqti',
    pending: 'Aloqa maʼlumotlari tez orada shu yerda eʼlon qilinadi. Hozircha ilova ichidagi “Yordam” boʻlimi orqali yozishingiz mumkin.',
  },

  footer: {
    tagline: 'Angren uchun taksi, yetkazib berish va ovqat ilovasi.',
    sections: 'Boʻlimlar',
    legal: 'Huquqiy',
    privacy: 'Maxfiylik siyosati',
    deletion: 'Hisobni oʻchirish',
    rights: 'Barcha huquqlar himoyalangan.',
  },

  notFound: {
    title: 'Sahifa topilmadi',
    text: 'Siz qidirgan sahifa mavjud emas yoki koʻchirilgan.',
    back: 'Bosh sahifaga qaytish',
  },
};
