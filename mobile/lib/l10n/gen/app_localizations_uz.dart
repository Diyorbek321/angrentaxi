// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Uzbek (`uz`).
class AppLocalizationsUz extends AppLocalizations {
  AppLocalizationsUz([String locale = 'uz']) : super(locale);

  @override
  String get appLanguage => 'Ilova tili';

  @override
  String get authWrongAppDriver =>
      'Bu raqam haydovchi sifatida ro\'yxatdan o\'tgan. Haydovchi ilovasidan foydalaning yoki yo\'lovchi sifatida boshqa raqam bilan kiring.';

  @override
  String get authWrongAppStaff =>
      'Bu raqam xodim yoki sotuvchi hisobi — u boshqaruv panelida ishlaydi. Mobil ilova uchun boshqa raqam kiriting.';

  @override
  String get commonCancel => 'Bekor qilish';

  @override
  String get commonDone => 'Tayyor';

  @override
  String get commonErrorTitle => 'Xatolik yuz berdi';

  @override
  String get commonRetry => 'Qayta urinish';

  @override
  String get commonSave => 'Saqlash';

  @override
  String get commonSend => 'Yuborish';

  @override
  String get drvAbout => 'Dastur haqida';

  @override
  String get drvAccept => 'Qabul qilish';

  @override
  String get drvAcceptFailed => 'Buyurtmani qabul qilib bo\'lmadi';

  @override
  String get drvAcceptedOrders => 'Qabul qilinadigan buyurtmalar';

  @override
  String get drvAmenitiesIntro =>
      'Mashinangizda bor narsalarni belgilang — yo\'lovchi shularni so\'rasa, buyurtma sizga keladi.';

  @override
  String get drvAmenitiesTitle => 'Qo\'shimcha imkoniyatlar';

  @override
  String get drvAmenitiesWarning =>
      'Mashinada yo\'q narsani belgilamang: yo\'lovchi bola o\'rindig\'i kutib chiqadi va safarni bekor qiladi.';

  @override
  String get drvAmount => 'Summa';

  @override
  String drvAmountExceedsWallet(String balance) {
    return 'Summa hamyondan oshib ketdi. Hamyon: $balance';
  }

  @override
  String get drvAmountHint => 'Masalan: 60000';

  @override
  String get drvAppName => 'Angren Taxi - Haydovchi';

  @override
  String drvApplicationIntro(String phone) {
    return '$phone raqami hali haydovchi sifatida ro\'yxatdan o\'tmagan. Mashina ma\'lumotlarini kiriting — admin tasdiqlagach onlayn bo\'la olasiz.';
  }

  @override
  String get drvApplicationPending => 'Ariza ko\'rib chiqilmoqda';

  @override
  String get drvApplicationPendingBody =>
      'Sizning haydovchilik arizangiz admin tomonidan tasdiqlanishini kutmoqda. Tasdiqlangach shu yerdan avtomatik davom etasiz.';

  @override
  String get drvApplicationRoleWarning =>
      'Diqqat: ariza yuborilgach bu raqam haydovchi hisobiga aylanadi va u bilan yo\'lovchi ilovasida taksi, ovqat yoki market buyurtma qila olmaysiz. Yo\'lovchi sifatida foydalanish uchun boshqa raqam kerak bo\'ladi.';

  @override
  String get drvApplicationTitle => 'Haydovchi bo\'lish uchun ariza';

  @override
  String get drvArrivedCargo => 'Yuk olish joyidasiz!';

  @override
  String get drvArrivedParcel => 'Posilka olish joyidasiz!';

  @override
  String get drvArrivedRestaurant => 'Restorandasiz!';

  @override
  String get drvArrivedShop => 'Do\'kondasiz!';

  @override
  String get drvArrivedTaxi => 'Olish joyida turibsiz!';

  @override
  String get drvArrivedTitle => 'Yetib keldim';

  @override
  String get drvBack => 'Orqaga';

  @override
  String drvBalanceNegative(String balance) {
    return 'Hisobingiz manfiy ($balance). Avval qarzni yoping.';
  }

  @override
  String get drvBankAndWithdraw => 'Bank hisobi va pul yechish';

  @override
  String drvBonusDone(String amount) {
    return 'Bajarildi — $amount';
  }

  @override
  String get drvBonusProgram => 'Bonus dasturi';

  @override
  String drvBonusRemaining(int count, String amount) {
    return 'Yana $count ta safar — $amount';
  }

  @override
  String drvBonusTrips(int current, int threshold) {
    return '$current/$threshold safar';
  }

  @override
  String get drvCall => 'Qo\'ng\'iroq';

  @override
  String get drvCallCustomer => 'Mijozga qo\'ng\'iroq';

  @override
  String get drvCallFailed => 'Qo\'ng\'iroq qilib bo\'lmadi';

  @override
  String get drvCallRecipient => 'Qabul qiluvchiga qo\'ng\'iroq';

  @override
  String get drvCallSeller => 'Sotuvchiga qo\'ng\'iroq';

  @override
  String get drvCamera => 'Kamera';

  @override
  String get drvCancel => 'Bekor qilish';

  @override
  String get drvCancelFailed => 'Bekor qilib bo\'lmadi';

  @override
  String get drvCarColor => 'Rangi';

  @override
  String get drvCarDetails => 'Mashina ma\'lumotlari';

  @override
  String get drvCarModel => 'Rusumi';

  @override
  String get drvCarModelField => 'Mashina modeli';

  @override
  String get drvCarModelHint => 'Masalan: Chevrolet Cobalt';

  @override
  String get drvCarModelRequired => 'Mashina rusumini kiriting';

  @override
  String get drvCarYear => 'Ishlab chiqarilgan yili';

  @override
  String get drvCarYearField => 'Mashina ishlab chiqarilgan yili';

  @override
  String get drvCarYearHelper =>
      'Qaysi tarif darajasida ishlay olishingiz shu ma\'lumot asosida ko\'rib chiqiladi';

  @override
  String get drvCarYearHint => 'Masalan: 2019';

  @override
  String get drvCarYearOptional => 'Ishlab chiqarilgan yili (ixtiyoriy)';

  @override
  String drvCarYearRange(int max) {
    return '1990 dan $max gacha yil kiriting';
  }

  @override
  String get drvCardOrPhone => 'Karta yoki telefon raqami';

  @override
  String get drvCargo => 'Yuk';

  @override
  String get drvCargoDelivered => 'Yuk muvaffaqiyatli yetkazildi!';

  @override
  String get drvCargoInProgress => 'Yuk yetkazilmoqda';

  @override
  String get drvCargoNotGiven => 'Yuk berilmadi';

  @override
  String get drvCargoPickupPlace => 'Yukni olish joyi';

  @override
  String get drvChatCustomer => 'Mijoz bilan yozishish';

  @override
  String get drvChatPassenger => 'Yo\'lovchi bilan yozishish';

  @override
  String get drvCheckStatus => 'Holatni tekshirish';

  @override
  String get drvCollectCash => 'Mijozdan naqd oling';

  @override
  String get drvCompleteCargoConfirm =>
      'Yukni topshirganingizni tasdiqlaysizmi?';

  @override
  String get drvCompleteDelivery => 'Yetkazishni yakunlash';

  @override
  String get drvCompleteFailed => 'Yakunlab bo\'lmadi';

  @override
  String get drvCompleteOrderConfirm =>
      'Buyurtmani mijozga topshirganingizni tasdiqlaysizmi?';

  @override
  String get drvCompleteParcelConfirm =>
      'Qabul qiluvchidan 4 xonali PIN kodni so\'rang va kiriting.';

  @override
  String get drvCompleteTrip => 'Safarni yakunlash';

  @override
  String get drvCompleteTripConfirm => 'Safarni yakunlashni tasdiqlaysizmi?';

  @override
  String get drvCompletedTrips => 'Yakunlangan safarlar';

  @override
  String get drvContinue => 'Davom etish';

  @override
  String get drvCurrentCar => 'Hozirgi mashina';

  @override
  String get drvCustomer => 'Mijoz';

  @override
  String get drvDataNotLoaded => 'Ma\'lumot yuklanmadi';

  @override
  String get drvDeadlineApproaching => 'Muddat yaqinlashmoqda';

  @override
  String get drvDebt => 'Qarz';

  @override
  String drvDebtAmount(String amount) {
    return 'Qarz: $amount';
  }

  @override
  String get drvDebtConsequence =>
      'Naqd safarlar komissiyasi. Qarz yopilmaguncha onlayn chiqib bo\'lmaydi.';

  @override
  String get drvDecline => 'Rad etish';

  @override
  String get drvDeliveryAddress => 'Yetkazish manzili';

  @override
  String get drvDemandEvenMessage =>
      'Zonalar orasida farq yo‘q — istalgan joyda kutishingiz mumkin. Maʼlumot har daqiqada yangilanadi.';

  @override
  String get drvDemandEvenTitle => 'Hozir talab hamma joyda oddiy';

  @override
  String get drvDemandHigh => 'Talab yuqori';

  @override
  String get drvDemandLoadFailed => 'Talab maʼlumoti olinmadi';

  @override
  String get drvDemandMapLinkSem =>
      'Talab xaritasi, qayerda buyurtma ko\'pligini ko\'rish';

  @override
  String get drvDemandMapTitle => 'Talab xaritasi';

  @override
  String get drvDemandNormal => 'Talab oddiy';

  @override
  String get drvDemandPaintedMore => 'Bo‘yalgan joylarda buyurtma ko‘proq';

  @override
  String drvDemandRowSem(String title, String count) {
    return '$title, $count';
  }

  @override
  String drvDemandRowSemNearest(String title, String count, String distance) {
    return '$title, $count, eng yaqini $distance';
  }

  @override
  String get drvDemandStayNear =>
      'Shu zonalarga yaqin turing — buyurtma tezroq keladi.';

  @override
  String get drvDemandUnpaintedNormal =>
      'Bo‘yalmagan joylarda talab odatdagidek.';

  @override
  String get drvDemandVeryHigh => 'Talab juda yuqori';

  @override
  String get drvDemandZone => 'Talab zonasi';

  @override
  String get drvDestination => 'Manzil';

  @override
  String get drvDispatchersNotified => 'Dispetcherlarga xabar yuborildi';

  @override
  String get drvDistanceToCargo => 'Yukkacha';

  @override
  String get drvDistanceToParcel => 'Posilkagacha';

  @override
  String get drvDistanceToPassenger => 'Yo\'lovchigacha';

  @override
  String get drvDistanceToRestaurant => 'Restorangacha';

  @override
  String get drvDistanceToShop => 'Do\'kongacha';

  @override
  String get drvDocApproved => 'Tasdiqlangan';

  @override
  String get drvDocLicenseBack => 'Haydovchilik guvohnomasi (orqa tomoni)';

  @override
  String get drvDocLicenseFront => 'Haydovchilik guvohnomasi (old tomoni)';

  @override
  String get drvDocPassport => 'Pasport';

  @override
  String get drvDocRejectedReupload => 'Rad etilgan — qayta yuklang';

  @override
  String get drvDocUnderReview => 'Tekshirilmoqda';

  @override
  String get drvDocVehicleRegistration => 'Texnik pasport';

  @override
  String get drvDocsExpiringSoon =>
      'Ba\'zi hujjatlarning muddati tugayapti. Ishingiz to\'xtab qolmasligi uchun oldindan yangilang.';

  @override
  String get drvDocsExpiringSoonShort =>
      'Ba\'zi hujjatlarning muddati tugayapti. Oldindan yangilab qo\'ying.';

  @override
  String get drvDriver => 'Haydovchi';

  @override
  String get drvEarnings => 'Daromad';

  @override
  String get drvEditProfile => 'Ma\'lumotlarni tahrirlash';

  @override
  String get drvEmergencyCall => 'Favqulodda chaqiruv (102/103)';

  @override
  String get drvEmergencyHelp => 'Favqulodda yordam';

  @override
  String get drvEmergencySos => 'Favqulodda yordam (SOS)';

  @override
  String get drvEnable => 'Yoqish';

  @override
  String get drvEnterCardOrPhone => 'Karta yoki telefon raqamini kiriting';

  @override
  String get drvEnterValidAmount => 'To\'g\'ri summa kiriting';

  @override
  String get drvErrorOccurred => 'Xatolik yuz berdi';

  @override
  String get drvEstimatedEarnings => 'Taxminiy daromad';

  @override
  String get drvEstimatedPrice => 'Taxminiy narx:';

  @override
  String get drvFindMyLocation => 'Joylashuvimni topish';

  @override
  String get drvFitZones => 'Zonalarni ekranga sig\'dirish';

  @override
  String get drvForegroundChannel => 'Onlayn holat';

  @override
  String get drvForegroundText =>
      'Buyurtma va safar uchun joylashuvingiz yuborilmoqda';

  @override
  String get drvForegroundTitle => 'Angren Taxi — siz onlaynsiz';

  @override
  String get drvFreeWait => 'Bepul kutish';

  @override
  String get drvGallery => 'Galereya';

  @override
  String get drvGoOffline => 'Offline bo\'lish';

  @override
  String get drvGoOnline => 'Online bo\'lish';

  @override
  String get drvGoOnlineBlocked => 'Onlayn bo\'lish yopiq';

  @override
  String get drvGoToNearestZone => 'Eng yaqin zonaga yo‘l olish';

  @override
  String drvGoToNearestZoneSem(String level, String distance) {
    return 'Eng yaqin talab zonasiga navigatsiyani ochish, $level, $distance';
  }

  @override
  String get drvGpsDisabled =>
      'Telefoningizda joylashuv (GPS) o\'chirilgan — xarita to\'g\'ri ishlashi uchun uni yoqing.';

  @override
  String get drvHelp => 'Yordam';

  @override
  String drvHeroSemBonus(String name, int threshold, int count) {
    return '$name: $threshold tadan $count ta bajarildi';
  }

  @override
  String drvHeroSemEarnings(String amount) {
    return 'Bugungi daromad $amount';
  }

  @override
  String get drvHeroSemOpenHistory => 'Daromad tarixini ochish';

  @override
  String drvItemsCount(int count) {
    return '$count ta mahsulot';
  }

  @override
  String get drvLast30Days => 'So\'nggi 30 kun';

  @override
  String get drvLast7Days => 'So\'nggi 7 kun';

  @override
  String get drvLoading => 'Yuklanmoqda';

  @override
  String get drvLocationDenied =>
      'Ilova joylashuvga ruxsat olmadi — xaritada aniq joyingizni ko\'rish uchun ruxsat bering.';

  @override
  String get drvLocationFailed =>
      'Joylashuvni aniqlab bo\'lmadi. Ochiq joyga o\'ting yoki qayta urinib ko\'ring.';

  @override
  String get drvLocationUnavailable =>
      'Joylashuvingiz aniqlanmadi. GPS yoqilganini va ilovaga ruxsat berilganini tekshiring.';

  @override
  String get drvLogout => 'Chiqish';

  @override
  String get drvLogoutConfirmBody => 'Hisobdan chiqmoqchimisiz?';

  @override
  String get drvLogoutConfirmTitle => 'Chiqishni tasdiqlang';

  @override
  String get drvLostItems => 'Yo\'qolgan buyumlar';

  @override
  String get drvMenu => 'Menyu';

  @override
  String get drvMessage => 'Xabar';

  @override
  String get drvMoreActions => 'Qo\'shimcha amallar';

  @override
  String get drvNavAppNotFound => 'Navigatsiya ilovasi topilmadi';

  @override
  String drvNeedsAttention(int count) {
    return '$count ta e\'tibor talab qiladi';
  }

  @override
  String drvNetEarnings(String period) {
    return 'Sof daromad · $period';
  }

  @override
  String get drvNewCar => 'Yangi mashina';

  @override
  String get drvNewOrder => 'Yangi buyurtma!';

  @override
  String get drvNoFundsToWithdraw => 'Yechish uchun mablag\' yo\'q';

  @override
  String get drvNoKeepWaiting => 'Yo\'q, kutaman';

  @override
  String get drvNoOrderHistory => 'Buyurtmalar tarixi yo\'q';

  @override
  String get drvNoRequestsYet => 'Hozircha so\'rovlar yo\'q';

  @override
  String get drvNoShowConfirm => 'Buyurtmani bekor qilmoqchimisiz?';

  @override
  String drvNoShowConfirmWaited(String elapsed) {
    return '$elapsed kutdingiz. Buyurtmani bekor qilmoqchimisiz?';
  }

  @override
  String drvNoShowConfirmWaitedFee(String elapsed, String fare) {
    return '$elapsed kutdingiz, $fare kutish haqi yig\'ildi. Buyurtmani bekor qilmoqchimisiz?';
  }

  @override
  String drvNotUpdated(String message) {
    return 'Yangilanmadi: $message';
  }

  @override
  String get drvNotUploaded => 'Yuklanmagan';

  @override
  String get drvNotifications => 'Bildirishnomalar';

  @override
  String get drvNotifyDispatchers => 'Dispetcherlarga xabar berish';

  @override
  String get drvOfferNotificationChannel => 'Yangi buyurtmalar';

  @override
  String get drvOfferNotificationTitle => 'Yangi buyurtma';

  @override
  String get drvOffline => 'Offline';

  @override
  String get drvOfflineLower => 'offline';

  @override
  String get drvOnline => 'Online';

  @override
  String get drvOnlineLower => 'online';

  @override
  String get drvOpenNavigation => 'Navigatsiyani ochish';

  @override
  String get drvOpenOrder => 'Buyurtmani ochish';

  @override
  String drvOpenOrderSem(String type) {
    return '$type buyurtmasini ochish';
  }

  @override
  String get drvOpenVerification => 'Tekshiruvni ochish';

  @override
  String get drvOptional => 'Majburiy emas';

  @override
  String get drvOrderDelivered => 'Buyurtma muvaffaqiyatli yetkazildi!';

  @override
  String get drvOrderDetails => 'Buyurtma ma\'lumotlari';

  @override
  String get drvOrderHistory => 'Buyurtmalar tarixi';

  @override
  String get drvOrderInProgress => 'Buyurtma yetkazilmoqda';

  @override
  String get drvOrderNotGiven => 'Buyurtma berilmadi';

  @override
  String get drvPaidOnline => 'Onlayn to\'langan — pul olmaysiz';

  @override
  String get drvParcel => 'Posilka';

  @override
  String get drvParcelDelivered => 'Posilka topshirildi!';

  @override
  String get drvParcelInProgress => 'Posilka yetkazilmoqda';

  @override
  String get drvParcelNotGiven => 'Posilka berilmadi';

  @override
  String get drvParcelPickupPlace => 'Posilkani olish joyi';

  @override
  String get drvParcelPinHint =>
      '4 xonali kod — yuboruvchi uni qabul qiluvchiga aytgan.';

  @override
  String get drvParcelPinSubmit => 'Topshirish';

  @override
  String get drvParcelPinTitle => 'Qabul qiluvchidan PIN kodni so\'rang';

  @override
  String get drvParcelRecipient => 'Qabul qiluvchi';

  @override
  String get drvParcelSizeLarge => 'Katta';

  @override
  String get drvParcelSizeMedium => 'O\'rta';

  @override
  String get drvParcelSizeSmall => 'Kichik';

  @override
  String get drvPassenger => 'Yo\'lovchi';

  @override
  String get drvPassengerNoShow => 'Yo\'lovchi kelmadi';

  @override
  String drvPassengerRequested(String options) {
    return 'Yo\'lovchi so\'ragan: $options';
  }

  @override
  String get drvPayment => 'To\'lov';

  @override
  String drvPeriodEarningsSem(String period) {
    return '$period daromadi';
  }

  @override
  String get drvPeriodMonth => 'Oy';

  @override
  String get drvPeriodWeek => 'Hafta';

  @override
  String get drvPickupCargo => 'Yukni oling';

  @override
  String get drvPickupOrder => 'Buyurtmani oling';

  @override
  String get drvPickupParcel => 'Posilkani oling';

  @override
  String get drvPickupPassenger => 'Yo\'lovchini oling';

  @override
  String get drvPickupPlace => 'Olish joyi';

  @override
  String get drvPlateHint => 'Masalan: 01 A 123 BC';

  @override
  String get drvPlateNumber => 'Davlat raqami';

  @override
  String get drvPlateRequired => 'Davlat raqamini kiriting';

  @override
  String get drvPlatformCommission => 'Platforma komissiyasi';

  @override
  String get drvPleaseRate => 'Iltimos, baho bering';

  @override
  String get drvProfileTitle => 'Profil';

  @override
  String drvRateCommentHint(String client) {
    return '$client haqida izoh...';
  }

  @override
  String drvRateHowWas(String client) {
    return '$client qanday edi?';
  }

  @override
  String drvRateStars(int count) {
    return '$count yulduz';
  }

  @override
  String get drvRating1 => 'Juda yomon';

  @override
  String get drvRating2 => 'Yomon';

  @override
  String get drvRating3 => 'Oddiy';

  @override
  String get drvRating4 => 'Yaxshi';

  @override
  String get drvRating5 => 'Ajoyib!';

  @override
  String get drvRatingPick => 'Yulduz tanlang';

  @override
  String drvRatingStarsSem(String rating) {
    return '$rating yulduz reyting';
  }

  @override
  String drvRatingValue(String rating) {
    return '$rating reyting';
  }

  @override
  String drvRatingsCount(int count) {
    return '$count ta baholash';
  }

  @override
  String get drvReadyBattery => 'Batareya cheklovisiz';

  @override
  String get drvReadyBatteryWhy =>
      'Telefon ilovani fonda o\'chirib qo\'ymasligi uchun. Sozlamalarda: Batareya → Cheklovsiz.';

  @override
  String get drvReadyDone => 'Bajarildi';

  @override
  String get drvReadyEnable => 'Yoqish';

  @override
  String get drvReadyGoOnline => 'Onlayn bo\'lish';

  @override
  String get drvReadyGps => 'GPS yoqilgan';

  @override
  String get drvReadyGpsWhy => 'Telefon joylashuvingizni aniqlay olishi uchun.';

  @override
  String get drvReadyGrant => 'Ruxsat berish';

  @override
  String get drvReadyLocation => 'Joylashuv ruxsati';

  @override
  String get drvReadyLocationWhy =>
      'Yaqin buyurtmalarni olish va yo\'lovchiga qayerdaligingizni ko\'rsatish uchun.';

  @override
  String get drvReadyMissing => 'Bajarilmagan';

  @override
  String get drvReadyNotifications => 'Bildirishnomalar';

  @override
  String get drvReadyNotificationsWhy =>
      'Ilova fonda ishlayotganini ko\'rsatish va yangi buyurtma haqida xabar berish uchun.';

  @override
  String get drvReadyOpenSettings => 'Sozlamalar';

  @override
  String get drvReadyOverlay => 'Boshqa ilovalar ustida ko\'rsatish';

  @override
  String get drvReadyOverlayWhy =>
      'Ilovadan chiqib ketganingizda zakaz kelsa, ilova o\'zi ochiladi. Ekran chetida kichik tugma turadi — bosib qaytasiz.';

  @override
  String get drvReadyOverlayXiaomi =>
      'Xiaomi/Redmi: Sozlamalar → Ilovalar → Angren Taxi Driver → Boshqa ruxsatlar → «Fonda ishlayotganda qalqib chiquvchi oynalarni ko\'rsatish» ni ham yoqing.';

  @override
  String get drvReadyPrecise => 'Aniq joylashuv';

  @override
  String get drvReadyPreciseWhy =>
      'Taksometr va «yetib keldim» tekshiruvi uchun. «Taxminiy» joylashuv taxminan 1 km xato beradi.';

  @override
  String get drvReadyRecommended => 'Tavsiya';

  @override
  String get drvReadySubtitle =>
      'Buyurtma olish uchun quyidagilar kerak. Belgilanganlarsiz onlayn bo\'lib bo\'lmaydi.';

  @override
  String get drvReadyTitle => 'Ishga tayyorlik';

  @override
  String drvReason(String reason) {
    return 'Sabab: $reason';
  }

  @override
  String get drvRefreshDemand => 'Talab maʼlumotini yangilash';

  @override
  String get drvRefreshing => 'Yangilanmoqda…';

  @override
  String get drvRequestApproved => 'Tasdiqlandi — profil yangilandi';

  @override
  String get drvRequestPending => 'So\'rov ko\'rib chiqilmoqda';

  @override
  String get drvRequestRejected => 'Rad etildi';

  @override
  String drvRequirementsNeeded(String items) {
    return 'Kerak: $items';
  }

  @override
  String get drvRestaurant => 'Restoran';

  @override
  String get drvRetry => 'Qayta urinish';

  @override
  String get drvReupload => 'Qayta yuklash';

  @override
  String get drvRouteToCargo => 'Yukka yo\'l';

  @override
  String get drvRouteToParcel => 'Posilkaga yo\'l';

  @override
  String get drvRouteToPassenger => 'Yo\'lovchiga yo\'l';

  @override
  String get drvRouteToRestaurant => 'Restoranga yo\'l';

  @override
  String get drvRouteToShop => 'Do\'konga yo\'l';

  @override
  String get drvSafetyNote =>
      'Xavfsizligingiz biz uchun muhim. Kerak bo\'lsa, quyidagi tugmalardan birini bosing.';

  @override
  String get drvSave => 'Saqlash';

  @override
  String get drvSaved => 'Saqlandi';

  @override
  String drvSecondsToAccept(int seconds) {
    return 'Qabul qilish uchun $seconds soniya qoldi';
  }

  @override
  String get drvSeller => 'Sotuvchi';

  @override
  String get drvSend => 'Yuborish';

  @override
  String get drvSendRequest => 'So\'rov yuborish';

  @override
  String get drvServiceBlockedDefault =>
      'Bu turni yoqish uchun tekshiruv talablari bajarilishi kerak.';

  @override
  String drvServiceChipOff(String label) {
    return '$label, o\'chirilgan. Xizmat turlarini ochish';
  }

  @override
  String drvServiceChipOn(String label) {
    return '$label, yoqilgan. Xizmat turlarini ochish';
  }

  @override
  String drvServiceChipUnavailable(String label) {
    return '$label, mavjud emas. Xizmat turlarini ochish';
  }

  @override
  String drvServiceChipUnavailableReason(String label, String reason) {
    return '$label, mavjud emas: $reason. Xizmat turlarini ochish';
  }

  @override
  String get drvServicesEmptyMessage =>
      'Hozircha sizga hech qanday xizmat turi taklif qilinmayapti. Yangisi paydo bo\'lsa shu yerda ko\'rinadi.';

  @override
  String get drvServicesEmptySelection =>
      'Kamida bitta xizmat turi yoqilgan bo\'lishi kerak — aks holda sizga buyurtma kelmaydi.';

  @override
  String get drvServicesEmptyTitle => 'Xizmat turi yo\'q';

  @override
  String get drvServicesHeading => 'Qaysi buyurtmalarni olasiz';

  @override
  String get drvServicesSaved => 'Xizmat turlari saqlandi';

  @override
  String get drvServicesSubtitle =>
      'Faqat yoqilgan turlar bo\'yicha buyurtma keladi. Talablari bajarilmagan turni yoqib bo\'lmaydi.';

  @override
  String get drvServicesTitle => 'Xizmat turlari';

  @override
  String get drvSettings => 'Sozlamalar';

  @override
  String get drvShop => 'Do\'kon';

  @override
  String get drvSkip => 'O\'tkazib yuborish';

  @override
  String get drvSom => 'so\'m';

  @override
  String get drvSosSem => 'SOS — favqulodda yordam';

  @override
  String get drvStartDelivery => 'Yetkazishni boshlash';

  @override
  String get drvStartTrip => 'Safarni boshlash';

  @override
  String get drvSubmitApplication => 'Arizani yuborish';

  @override
  String get drvToday => 'Bugun';

  @override
  String get drvTodayEarnings => 'Bugungi daromad';

  @override
  String get drvTotalTrips => 'Jami safarlar';

  @override
  String get drvTripCompleted => 'Safar muvaffaqiyatli yakunlandi!';

  @override
  String get drvTripInProgress => 'Safar davom etmoqda';

  @override
  String drvTripsCount(int count) {
    return '$count ta safar';
  }

  @override
  String get drvTripsGross => 'Safarlardan jami';

  @override
  String get drvTypeCargo => 'Yuk tashish';

  @override
  String get drvTypeFood => 'Ovqat yetkazish';

  @override
  String get drvTypeMarket => 'Market yetkazish';

  @override
  String get drvTypeParcel => 'Posilka';

  @override
  String get drvTypeTaxi => 'Taksi';

  @override
  String drvUpdatedAt(String time) {
    return 'Yangilandi: $time';
  }

  @override
  String get drvUpload => 'Yuklash';

  @override
  String get drvUploadDocuments => 'Hujjatlarni yuklang';

  @override
  String get drvUploadDocumentsHint =>
      'Tasdiqlash tezroq bo\'lishi uchun quyidagi hujjatlarning aniq suratlarini yuklang.';

  @override
  String get drvUploadError => 'Yuklashda xatolik';

  @override
  String get drvUploadNew => 'Yangisini yuklash';

  @override
  String drvUploadingPercent(String percent) {
    return 'Yuklanmoqda... $percent%';
  }

  @override
  String drvUploadingPercentSem(String percent) {
    return 'Yuklanmoqda, $percent foiz';
  }

  @override
  String get drvVehicleChangeNote =>
      'Menejer tasdiqlaguncha profilingizda hozirgi mashina qoladi. Yangi mashina fotolarini tekshiruv bo\'limidan so\'rashlari mumkin.';

  @override
  String get drvVehicleChangeTitle => 'Mashinani almashtirish';

  @override
  String get drvVehicleRequestSent => 'So\'rov yuborildi — menejer tekshiradi';

  @override
  String get drvVerificationEmptyMessage =>
      'Hozircha sizdan hech qanday hujjat yoki surat talab qilinmayapti. Yangi talab paydo bo\'lsa shu yerda ko\'rinadi.';

  @override
  String get drvVerificationEmptyTitle => 'Talab yo\'q';

  @override
  String get drvVerificationIncomplete =>
      'Tekshiruv to\'liq emas — quyidagi talablarni bajaring.';

  @override
  String get drvVerificationIncompleteShort =>
      'Tekshiruv to\'liq emas — talablarni bajaring.';

  @override
  String get drvVerificationTitle => 'Tekshiruv';

  @override
  String get drvView => 'Ko\'rish';

  @override
  String drvWaitBillingCaption(String elapsed, String perMinute) {
    return 'Jami $elapsed · $perMinute/daqiqa';
  }

  @override
  String drvWaitBillingSem(String fare, String elapsed) {
    return 'Kutish haqi $fare, jami $elapsed kutildi';
  }

  @override
  String get drvWaitFee => 'Kutish haqi';

  @override
  String drvWaitFreeCaption(String perMinute) {
    return 'Keyin $perMinute/daqiqa';
  }

  @override
  String drvWaitFreeSem(String remaining, String perMinute) {
    return 'Bepul kutish tugashiga $remaining qoldi, keyin $perMinute har daqiqa uchun';
  }

  @override
  String get drvWallet => 'Hamyon';

  @override
  String drvWalletAmount(String amount) {
    return 'Hamyon: $amount';
  }

  @override
  String drvWeekAmount(String amount) {
    return 'Hafta: $amount';
  }

  @override
  String get drvWhereMoreOrders => 'Qayerda buyurtma ko\'p';

  @override
  String get drvWithdraw => 'Pul yechish';

  @override
  String get drvWithdrawApproved => 'Tasdiqlandi';

  @override
  String get drvWithdrawPaid => 'To\'landi';

  @override
  String get drvWithdrawPending => 'Kutilmoqda';

  @override
  String get drvWithdrawRequests => 'Pul yechish so\'rovlari';

  @override
  String get drvYesCancel => 'Ha, bekor qilaman';

  @override
  String get drvYouKeep => 'Qo\'lingizga qoladi';

  @override
  String drvZonesCount(int count) {
    return '$count zona';
  }

  @override
  String fmtCurrencySom(String amount) {
    return '$amount so\'m';
  }

  @override
  String fmtDaysAgo(int days) {
    return '$days kun oldin';
  }

  @override
  String fmtHours(int hours) {
    return '$hours soat';
  }

  @override
  String fmtHoursAgo(int hours) {
    return '$hours soat oldin';
  }

  @override
  String fmtHoursMinutes(int hours, int minutes) {
    return '$hours soat $minutes daqiqa';
  }

  @override
  String get fmtJustNow => 'Hozirgina';

  @override
  String fmtMillionUzs(String value) {
    return '$value mln UZS';
  }

  @override
  String fmtMinutes(int minutes) {
    return '$minutes daqiqa';
  }

  @override
  String fmtMinutesAgo(int minutes) {
    return '$minutes daqiqa oldin';
  }

  @override
  String get fmtMonthsShort =>
      'yan,fev,mar,apr,may,iyn,iyl,avg,sen,okt,noy,dek';

  @override
  String fmtThousandUzs(String value) {
    return '$value ming UZS';
  }

  @override
  String get fmtToday => 'Bugun';

  @override
  String fmtTodayAt(String time) {
    return 'Bugun, $time';
  }

  @override
  String get fmtTomorrow => 'Ertaga';

  @override
  String fmtYesterdayAt(String time) {
    return 'Kecha, $time';
  }

  @override
  String get languageRussian => 'Русский';

  @override
  String get languageUzbek => 'O\'zbekcha';

  @override
  String get paxAbout => 'Dastur haqida';

  @override
  String get paxAddFavorite => 'Qo\'shish';

  @override
  String get paxAddStop => 'To\'xtash qo\'shish';

  @override
  String get paxAddressNotFound => 'Manzilni topib bo\'lmadi';

  @override
  String get paxAddressResolveFailed => 'Manzilni aniqlab bo\'lmadi';

  @override
  String paxApproxDistance(String distance) {
    return 'taxminan $distance';
  }

  @override
  String get paxBack => 'Orqaga';

  @override
  String get paxCall => 'Qo\'ng\'iroq';

  @override
  String get paxCallFailed => 'Qo\'ng\'iroq qilib bo\'lmadi';

  @override
  String get paxCancel => 'Bekor qilish';

  @override
  String get paxCancelConfirmYes => 'Ha, bekor qilish';

  @override
  String get paxCancelFailed => 'Bekor qilib bo\'lmadi';

  @override
  String get paxCancelReasonChangedMind => 'Fikrimni o\'zgartirdim';

  @override
  String get paxCancelReasonHint => 'Sababni yozing...';

  @override
  String get paxCancelReasonLongWait => 'Juda uzoq kutdim';

  @override
  String get paxCancelReasonOther => 'Boshqa sabab';

  @override
  String get paxCancelReasonPrompt =>
      'Buyurtmani bekor qilish sababini tanlang:';

  @override
  String get paxCancelReasonTitle => 'Bekor qilish sababi';

  @override
  String get paxCancelReasonTooExpensive => 'Narx juda qimmat';

  @override
  String paxCancelScheduleBody(String when) {
    return '$when ga rejalashtirilgan safar bekor qilinsinmi?';
  }

  @override
  String get paxCancelScheduleTitle => 'Rejani bekor qilish';

  @override
  String paxCardPaymentStartFailed(String error) {
    return 'To\'lovni hozir boshlab bo\'lmadi: $error. Buyurtma qabul qilindi, safar oxirida to\'lov amalga oshiriladi.';
  }

  @override
  String get paxClear => 'Tozalash';

  @override
  String get paxClose => 'Yopish';

  @override
  String paxCoverageWarning(String area) {
    return 'Bu hududda hozircha xizmat ko\'rsatilmaymiz. Eng yaqin xizmat hududi: $area.';
  }

  @override
  String get paxCurrentLocation => 'Joriy joylashuv';

  @override
  String get paxDestination => 'Manzil';

  @override
  String get paxDetailCar => 'Mashina';

  @override
  String get paxDetailDate => 'Sana';

  @override
  String get paxDetailDistance => 'Masofa';

  @override
  String get paxDetailDriver => 'Haydovchi';

  @override
  String get paxDetailDuration => 'Vaqt';

  @override
  String get paxDetailFrom => 'Chiqish';

  @override
  String get paxDetailPrice => 'Narx';

  @override
  String get paxDetailStatus => 'Holat';

  @override
  String get paxDone => 'Tayyor';

  @override
  String get paxDriverAlmostThere => 'Haydovchi deyarli yetib keldi';

  @override
  String paxDriverEta(int minutes) {
    return 'Haydovchi $minutes daqiqada yetib keladi';
  }

  @override
  String get paxEditProfile => 'Ma\'lumotlarni tahrirlash';

  @override
  String get paxEnterAddress => 'Manzilni kiriting';

  @override
  String get paxExtras => 'Qo\'shimcha';

  @override
  String paxExtrasCount(int count) {
    return 'Qo\'shimcha · $count';
  }

  @override
  String paxExtrasListSemantics(String options) {
    return 'Qo\'shimcha talablar: $options';
  }

  @override
  String get paxExtrasNoneSemantics => 'Qo\'shimcha talablar: yo\'q';

  @override
  String get paxFavoriteHome => 'Uy';

  @override
  String get paxFavoriteNameHint => 'Nomi (masalan, Bozor)';

  @override
  String get paxFavoriteWork => 'Ish';

  @override
  String get paxFirstName => 'Ism';

  @override
  String get paxFirstNameHint => 'Ismingiz';

  @override
  String get paxFrom => 'Qayerdan';

  @override
  String paxFromChangeSemantics(String address) {
    return 'Qayerdan: $address. O\'zgartirish';
  }

  @override
  String get paxGenericError => 'Xatolik yuz berdi';

  @override
  String get paxHasScheduledTrip => 'Rejalashtirilgan safar bor';

  @override
  String get paxHelp => 'Yordam';

  @override
  String get paxHighDemand => 'Talab yuqori';

  @override
  String get paxHistoryEmpty => 'Sayohat tarixi yo\'q';

  @override
  String get paxHistoryTitle => 'Sayohat tarixi';

  @override
  String get paxLastName => 'Familiya';

  @override
  String get paxLastNameHint => 'Familiyangiz';

  @override
  String get paxLocatingAddress => 'Joylashuv aniqlanmoqda...';

  @override
  String get paxLocation => 'Joylashuv';

  @override
  String get paxLogout => 'Chiqish';

  @override
  String get paxLogoutConfirmBody => 'Hisobdan chiqmoqchimisiz?';

  @override
  String get paxLogoutConfirmTitle => 'Chiqishni tasdiqlang';

  @override
  String get paxLostItemButton => 'Buyum qoldirdim';

  @override
  String get paxLostItemDialogHint => 'Masalan: qora hamyon, orqa o\'rindiqda';

  @override
  String get paxLostItemDialogTitle => 'Nima qoldirdingiz?';

  @override
  String get paxLostItemSent =>
      'Haydovchiga xabar yuborildi — javobni «Yo\'qolgan buyumlar» bo\'limida ko\'rasiz';

  @override
  String get paxLostItems => 'Yo\'qolgan buyumlar';

  @override
  String get paxMenu => 'Menyu';

  @override
  String get paxMessage => 'Xabar';

  @override
  String paxMeteredRates(String base, String perKm, String perMin, String min) {
    return 'Taksometr: $base + $perKm/km + $perMin/daq, kamida $min. Yakuniy narx bosib o\'tilgan yo\'l va vaqtga qarab safar oxirida hisoblanadi.';
  }

  @override
  String get paxMeteredTo => 'Manzilsiz — taksometr bo\'yicha';

  @override
  String get paxNo => 'Yo\'q';

  @override
  String get paxNoDestination => 'Manzilsiz';

  @override
  String get paxNoDriversNearby => 'Yaqin atrofda haydovchi topilmadi';

  @override
  String get paxNoDriversNearbyRetry =>
      'Yaqin atrofda haydovchi topilmadi. Birozdan so\'ng qayta urinib ko\'ring.';

  @override
  String get paxNoResults => 'Natija topilmadi';

  @override
  String get paxNoTariffs => 'Tariflar mavjud emas';

  @override
  String get paxNotifications => 'Bildirishnomalar';

  @override
  String get paxNow => 'Hozir';

  @override
  String get paxOrderCta => 'Buyurtma';

  @override
  String get paxOrderDetails => 'Buyurtma tafsilotlari';

  @override
  String get paxOrderMissingRouteOrTariff => 'Manzil va tarif tanlanmagan';

  @override
  String get paxOutsideServiceArea => 'Xizmat hududidan tashqarida';

  @override
  String get paxParcelPinHint =>
      'Qabul qiluvchiga ayting. Haydovchi posilkani shu kodsiz topshira olmaydi.';

  @override
  String get paxParcelPinTitle => 'Topshirish kodi';

  @override
  String get paxPaymentCard => 'Karta';

  @override
  String get paxPaymentCash => 'Naqd';

  @override
  String get paxPaymentMethods => 'To\'lov usullari';

  @override
  String get paxPickOnMap => 'Xaritadan tanlash';

  @override
  String get paxPickThisPlace => 'Shu joyni tanlash';

  @override
  String get paxPickupPoint => 'Olish nuqtasi';

  @override
  String get paxPriceLocked => 'Narx qotirilgan — safar paytida o\'zgarmaydi.';

  @override
  String get paxProfileSaved => 'Ma\'lumotlar saqlandi';

  @override
  String get paxProfileTitle => 'Profil';

  @override
  String get paxRateCloseWithoutTip => 'Chaqimsiz yopish';

  @override
  String get paxRateCommentHint => 'Haydovchi haqida izoh...';

  @override
  String get paxRateHowWasTrip => 'Sayohat qanday kechdi?';

  @override
  String get paxRatePleaseRate => 'Iltimos, baho bering';

  @override
  String paxRatePrimaryNoTipSemantics(String action) {
    return '$action, chaqimsiz';
  }

  @override
  String paxRatePrimaryWithTipSemantics(String action, String amount) {
    return '$action, $amount chaqim bilan';
  }

  @override
  String get paxRateSkip => 'O\'tkazib yuborish';

  @override
  String paxRateStarSemantics(int count) {
    return '$count yulduz';
  }

  @override
  String get paxRateThanks => 'Bahoyingiz uchun rahmat!';

  @override
  String paxRateTipSent(String amount) {
    return '$amount chaqim haydovchiga yuborildi. Rahmat!';
  }

  @override
  String get paxRatingBad => 'Yomon';

  @override
  String get paxRatingExcellent => 'Ajoyib!';

  @override
  String get paxRatingGood => 'Yaxshi';

  @override
  String get paxRatingOk => 'Oddiy';

  @override
  String get paxRatingPickStars => 'Yulduz tanlang';

  @override
  String paxRatingValue(String rating) {
    return '$rating reyting';
  }

  @override
  String get paxRatingVeryBad => 'Juda yomon';

  @override
  String get paxReceiptAddressMissing => 'Manzil saqlanmagan';

  @override
  String get paxReceiptCopySemantics => 'Chek matnini nusxalash';

  @override
  String get paxReceiptDiscount => 'Chegirma';

  @override
  String paxReceiptDiscountWithCode(String code) {
    return 'Chegirma ($code)';
  }

  @override
  String get paxReceiptDropoff => 'Tushish';

  @override
  String get paxReceiptDuration => 'Davomiyligi';

  @override
  String get paxReceiptFareBreakdown => 'Narx tarkibi';

  @override
  String get paxReceiptForbiddenBody =>
      'Chekni faqat safar yo\'lovchisi, tayinlangan haydovchi yoki menejer ko\'ra oladi.';

  @override
  String get paxReceiptForbiddenTitle => 'Bu chek sizga tegishli emas';

  @override
  String get paxReceiptGrandTotal => 'Yakuniy';

  @override
  String get paxReceiptLoading => 'Chek yuklanmoqda';

  @override
  String get paxReceiptNoBreakdown =>
      'Bu safar uchun narx tarkibi saqlanmagan. Quyida faqat yakuniy hisob ko\'rsatilgan.';

  @override
  String get paxReceiptNoPaymentInfo => 'To\'lov ma\'lumoti saqlanmagan.';

  @override
  String paxReceiptOrderNumber(String number) {
    return 'Buyurtma № $number';
  }

  @override
  String get paxReceiptOrderNumberLabel => 'Buyurtma raqami';

  @override
  String get paxReceiptParseError => 'Chek ma\'lumotlari o\'qilmadi';

  @override
  String get paxReceiptPayment => 'To\'lov';

  @override
  String get paxReceiptPaymentMethod => 'Usul';

  @override
  String get paxReceiptPaymentStatus => 'Holati';

  @override
  String get paxReceiptPickup => 'Olib ketish';

  @override
  String get paxReceiptService => 'Xizmat';

  @override
  String paxReceiptStop(int index) {
    return 'To\'xtash $index';
  }

  @override
  String get paxReceiptSubtotal => 'Jami';

  @override
  String get paxReceiptTariff => 'Tarif';

  @override
  String get paxReceiptTextCopied => 'Chek matni nusxalandi';

  @override
  String get paxReceiptTip => 'Chaqim';

  @override
  String get paxReceiptTipHint => 'Komissiyasiz — to\'liq haydovchiga';

  @override
  String get paxReceiptTitle => 'Safar cheki';

  @override
  String paxReceiptUnpaid(String amount) {
    return 'To\'lanmagan qoldiq: $amount. Hamyonni to\'ldiring — qarz yangi buyurtma berishni to\'sib qo\'yadi.';
  }

  @override
  String get paxReceiptWaitingNote =>
      'Kutish haqi belgilangan narxga kirmaydi: bepul daqiqalardan keyin har boshlangan daqiqa alohida qo\'shiladi.';

  @override
  String get paxReferralApplied => 'Referral kodi qo\'llandi!';

  @override
  String get paxReferralAppliedBanner =>
      'Referral kodi muvaffaqiyatli qo\'llandi';

  @override
  String get paxReferralApply => 'Qo\'llash';

  @override
  String get paxReferralCardHint =>
      'Do\'stingiz ilovaga birinchi safarida ushbu kodni kiritsa, ikkovingiz ham bonus olasiz';

  @override
  String get paxReferralCodeCopied => 'Kod nusxalandi';

  @override
  String get paxReferralCopy => 'Nusxalash';

  @override
  String get paxReferralEnterCode => 'Kodni kiriting';

  @override
  String get paxReferralEnterFriendCode => 'Do\'stingizning kodini kiriting';

  @override
  String get paxReferralErrAlreadyApplied =>
      'Sizda allaqachon referral kodi qo\'llangan';

  @override
  String get paxReferralErrInvalid => 'Bunday referral kod topilmadi';

  @override
  String get paxReferralErrOwnCode =>
      'O\'zingizning kodingizni qo\'llay olmaysiz';

  @override
  String get paxReferralInvitedCount => 'Taklif qilinganlar';

  @override
  String get paxReferralShare => 'Ulashish';

  @override
  String get paxReferralShareCopied =>
      'Taklif matni nusxalandi — do\'stingizga yuboring';

  @override
  String paxReferralShareMessage(String code) {
    return 'Angren Taxi\'ga taklif qilaman! Ro\'yxatdan o\'tishda mening kodimni kiriting: $code';
  }

  @override
  String get paxReferralTitle => 'Do\'stlarni taklif qilish';

  @override
  String get paxReferralTotalBonus => 'Jami bonus';

  @override
  String get paxReferralYourCode => 'SIZNING REFERRAL KODINGIZ';

  @override
  String get paxRemoveStop => 'To\'xtashni olib tashlash';

  @override
  String get paxRepeatRide => 'Safarni takrorlash';

  @override
  String get paxResolvingAddress => 'Manzil aniqlanmoqda...';

  @override
  String get paxRouteLoading => 'Yo\'nalish yuklanmoqda...';

  @override
  String get paxSave => 'Saqlash';

  @override
  String get paxSaveAddress => 'Manzilni saqlash';

  @override
  String get paxSaveAddressFailed => 'Manzilni saqlab bo\'lmadi';

  @override
  String get paxSavedAddresses => 'Saqlangan manzillar';

  @override
  String get paxSavedPlaces => 'Saqlangan joylar';

  @override
  String get paxScheduleCancelled => 'Reja bekor qilindi';

  @override
  String get paxScheduleCta => 'Rejalashtirish';

  @override
  String get paxScheduleHint =>
      'Haydovchi belgilangan vaqtdan 10 daqiqa oldin qidiriladi. Narx hozir qotiriladi va o\'zgarmaydi.';

  @override
  String get paxScheduleNoSlots =>
      'Bu kun uchun vaqt qolmadi — keyingi kunni tanlang.';

  @override
  String get paxScheduleOrderNow => 'Hozir buyurtma qilaman';

  @override
  String get paxSchedulePickTime => 'Vaqtni tanlang';

  @override
  String get paxScheduleTitle => 'Safarni rejalashtirish';

  @override
  String get paxScheduledEmptyBody =>
      'Tarif ekranida vaqtni belgilab, safarni oldindan buyurtma qilishingiz mumkin.';

  @override
  String get paxScheduledEmptyTitle => 'Rejalashtirilgan safarlar yo\'q';

  @override
  String get paxScheduledPriceNote =>
      'Narx hozir qotiriladi va safar kunida o\'zgarmaydi — kutish haqi bundan tashqari. Haydovchi belgilangan vaqtdan 10 daqiqa oldin qidiriladi.';

  @override
  String get paxScheduledTripsTitle => 'Rejalashtirilgan safarlar';

  @override
  String get paxSearchAddressHint => 'Manzilni qidiring...';

  @override
  String get paxSearchAddressSemantics => 'Manzilni qidiring';

  @override
  String get paxSearchPlaceHint => 'Ko\'cha, mahalla, joy nomi...';

  @override
  String paxSeats(int count) {
    return '$count o\'rin';
  }

  @override
  String get paxSend => 'Yuborish';

  @override
  String get paxShareTripCopied => 'Safar ma\'lumoti nusxalandi';

  @override
  String paxShareTripDriver(String name, String car) {
    return 'Haydovchi: $name, $car';
  }

  @override
  String paxShareTripFrom(String address) {
    return 'Qayerdan: $address';
  }

  @override
  String get paxShareTripHeader => 'Angren Taxi — safarim';

  @override
  String paxShareTripStatus(String status) {
    return 'Holat: $status';
  }

  @override
  String paxShareTripTo(String address) {
    return 'Qayerga: $address';
  }

  @override
  String get paxSomSuffix => 'so\'m';

  @override
  String get paxSosAlertDispatchers => 'Dispetcherlarga xabar berish';

  @override
  String get paxSosBody =>
      'Xavfsizligingiz biz uchun muhim. Kerak bo\'lsa, quyidagi tugmalardan birini bosing.';

  @override
  String get paxSosDispatchersAlerted => 'Dispetcherlarga xabar yuborildi';

  @override
  String get paxSosEmergencyCall => 'Favqulodda chaqiruv (102/103)';

  @override
  String get paxSosSemantics => 'SOS — favqulodda yordam';

  @override
  String get paxSosTitle => 'Favqulodda yordam';

  @override
  String get paxStop => 'To\'xtash';

  @override
  String get paxStopPoint => 'To\'xtash nuqtasi';

  @override
  String paxSurgeNotice(String multiplier) {
    return 'Hozir talab yuqori — narx ${multiplier}x. Bir necha daqiqadan keyin arzonlashishi mumkin.';
  }

  @override
  String paxTariffWaitingNote(int freeMinutes, String perMinute) {
    return 'Haydovchi kelgach $freeMinutes daqiqa kutish bepul, keyin har boshlangan daqiqa uchun $perMinute. Bu haq ko\'rsatilgan narxdan alohida qo\'shiladi.';
  }

  @override
  String get paxTipAlreadyGiven => 'Bu safar uchun chaqim allaqachon berilgan.';

  @override
  String get paxTipExplainer =>
      'Summa to\'liq haydovchiga o\'tadi — komissiya ushlanmaydi. Hamyoningizdan yechiladi.';

  @override
  String get paxTipInsufficientFunds =>
      'Hamyonda mablag\' yetarli emas. Hamyonni to\'ldiring yoki kichikroq summa tanlang.';

  @override
  String get paxTipNotYourTrip => 'Bu safar sizga tegishli emas.';

  @override
  String get paxTipOptional => 'Ixtiyoriy';

  @override
  String get paxTipOther => 'Boshqa';

  @override
  String paxTipRangeError(String min, String max) {
    return 'Chaqim $min dan ${max}gacha bo\'lishi kerak';
  }

  @override
  String get paxTipTitle => 'Haydovchiga chaqim';

  @override
  String get paxTo => 'Qayerga';

  @override
  String get paxTripOptionsHint =>
      'Faqat shu talablarni bajara oladigan haydovchi qidiriladi — bu biroz ko\'proq vaqt olishi mumkin.';

  @override
  String get paxTripOptionsTitle => 'Qo\'shimcha talablar';

  @override
  String get paxTripScheduled => 'Safar rejalashtirildi';

  @override
  String paxTripTimeSemantics(String time) {
    return 'Safar vaqti: $time';
  }

  @override
  String get paxTripsStat => 'Sayohatlar';

  @override
  String get paxUnknownAddress => 'Noma\'lum manzil';

  @override
  String paxUpcomingTrip(String when) {
    return 'Kelgusi safar: $when';
  }

  @override
  String get paxUserFallback => 'Foydalanuvchi';

  @override
  String get paxWaitingFree => 'Bepul kutish';

  @override
  String paxWaitingFreeCaption(String perMinute) {
    return 'Keyin $perMinute/daqiqa, safar narxiga qo\'shiladi';
  }

  @override
  String paxWaitingFreeSemantics(String remaining, String perMinute) {
    return 'Bepul kutish tugashiga $remaining qoldi, keyin har daqiqa uchun $perMinute safar narxiga qo\'shiladi';
  }

  @override
  String get paxWaitingPaid => 'Kutish haqi';

  @override
  String paxWaitingPaidCaption(String elapsed) {
    return 'Jami $elapsed · safar narxiga qo\'shiladi';
  }

  @override
  String paxWaitingPaidSemantics(String amount, String elapsed) {
    return 'Kutish haqi $amount, jami $elapsed kutildi. Safar narxiga qo\'shiladi.';
  }

  @override
  String get paxWhereTo => 'Qayoqqa boramiz?';

  @override
  String saActiveOrderLabel(String service, String title, String stage) {
    return 'Faol buyurtma: $service. $title. $stage';
  }

  @override
  String get saAdBadge => 'Reklama';

  @override
  String get saAdOpenFailed => 'Havolani ochib bo\'lmadi';

  @override
  String saAddItemToCartLabel(String name) {
    return '$name — savatga qo\'shish';
  }

  @override
  String saAddToCartWithPrice(String price) {
    return 'Savatga · $price';
  }

  @override
  String get saAddressResolving => 'Manzil aniqlanmoqda…';

  @override
  String get saAngrenCity => 'Angren shahri';

  @override
  String get saBack => 'Orqaga';

  @override
  String get saBackToHome => 'Bosh sahifaga';

  @override
  String saBadgeCount(String count) {
    return '$count ta';
  }

  @override
  String get saCallDriver => 'Haydovchiga qo\'ng\'iroq qilish';

  @override
  String get saCallFailed => 'Qo\'ng\'iroq qilib bo\'lmadi';

  @override
  String saCallFailedDialManually(String phone) {
    return 'Qo\'ng\'iroq qilib bo\'lmadi — $phone raqamiga o\'zingiz qo\'ng\'iroq qiling';
  }

  @override
  String get saCancel => 'Bekor qilish';

  @override
  String get saCargoAddressHint =>
      'Manzillarni keyingi qadamda xaritadan tanlaysiz — aniq narx masofaga qarab o\'sha yerda hisoblanadi.';

  @override
  String get saCargoCallCourier => 'Kuryer chaqirish';

  @override
  String get saCargoCourier => 'Kuryer';

  @override
  String get saCargoLight => 'Yengil';

  @override
  String get saCargoSubtitle => 'Shahar ichida tez yetkazib berish';

  @override
  String get saCargoTitle => 'Cargo · Yuk yetkazish';

  @override
  String get saCargoTruck => 'Yuk';

  @override
  String get saCargoUpTo1t => '1 t gacha';

  @override
  String get saCargoUpTo300kg => '300 kg gacha';

  @override
  String get saCargoUpTo5kg => '5 kg gacha';

  @override
  String get saCargoVehicleType => 'Transport turi';

  @override
  String get saCart => 'Savat';

  @override
  String get saCartBarLabel => 'Savatga buyurtma';

  @override
  String saCartBarSemantics(int count, String total, String action) {
    return 'Savat: $count ta mahsulot, $total. $action';
  }

  @override
  String get saCartEmptyMessage =>
      'Ovqat yoki market mahsulotlarini qo\'shing va bu yerda ko\'rinadi.';

  @override
  String get saCartEmptyTitle => 'Savat bo\'sh';

  @override
  String get saCartNoExtraFees =>
      'Rasmiylashtirishda qo\'shimcha haq qo\'shilmaydi.';

  @override
  String saCartWithCount(int count) {
    return 'Savat, $count ta mahsulot';
  }

  @override
  String get saCheckoutTitle => 'Rasmiylashtirish';

  @override
  String saCheckoutWithTotal(String total) {
    return 'Rasmiylashtirish · $total';
  }

  @override
  String saCheckoutWithTotalLabel(String total) {
    return 'Rasmiylashtirish, jami $total';
  }

  @override
  String get saChooseAddress => 'Manzilni tanlang';

  @override
  String get saChooseDeliveryAddress => 'Yetkazib berish manzilini tanlang';

  @override
  String get saChoosePaymentMethod => 'To\'lov usulini tanlang';

  @override
  String get saClose => 'Yopish';

  @override
  String get saClosed => 'Yopiq';

  @override
  String get saCompletedAt => 'Yakunlandi';

  @override
  String get saConfirmOrder => 'Buyurtmani tasdiqlash';

  @override
  String get saContactOperator => 'Operator bilan bog\'lanish';

  @override
  String get saCurrentAddress => 'Joriy manzil';

  @override
  String get saCurrentLocation => 'Joriy joylashuv';

  @override
  String get saDefaultUserName => 'Foydalanuvchi';

  @override
  String get saDelivery => 'Yetkazib berish';

  @override
  String get saDeliveryAddress => 'Yetkazib berish manzili';

  @override
  String get saDestination => 'Manzil';

  @override
  String saDishesCount(int count) {
    return '$count ta taom';
  }

  @override
  String get saDistance => 'Masofa';

  @override
  String get saDuration => 'Davomiyligi';

  @override
  String get saEditProfile => 'Profilni tahrirlash';

  @override
  String get saErrorOccurred => 'Xatolik yuz berdi';

  @override
  String get saFaqCancelA =>
      'Faol buyurtma ekranida \"Bekor qilish\" tugmasini bosing va sababni tanlang. Haydovchi yetib kelgunga qadar bekor qilish bepul.';

  @override
  String get saFaqCancelQ => 'Buyurtmani qanday bekor qilaman?';

  @override
  String get saFaqComplaintA =>
      'Safar tugagach baho qo\'yish ekranida izoh qoldiring yoki operator bilan chatga safar raqamini yuboring. Har bir shikoyat ko\'rib chiqiladi.';

  @override
  String get saFaqComplaintQ => 'Haydovchi ustidan shikoyat';

  @override
  String get saFaqLostItemA =>
      'Buyurtmalar tarixidan safarni oching va haydovchiga qo\'ng\'iroq qiling. Javob bo\'lmasa, operator bilan chatga yozing — biz haydovchi bilan bog\'lanamiz.';

  @override
  String get saFaqLostItemQ => 'Mashinada narsa qoldirdim';

  @override
  String get saFaqPaymentA =>
      'Hamyon balansingizni tekshiring. Balans yetmasa safar qarz sifatida qayd etiladi va uni to\'lamaguningizcha yangi buyurtma bera olmaysiz. Naqd to\'lovni tanlab ham davom etishingiz mumkin.';

  @override
  String get saFaqPaymentQ => 'To\'lov o\'tmadi, nima qilaman?';

  @override
  String get saFaqTitle => 'Tez-tez beriladigan savollar';

  @override
  String get saFoodNoRestaurantsMessage =>
      'Hozircha ochiq restoran yo\'q. Birozdan keyin qayta urinib ko\'ring.';

  @override
  String get saFoodNoRestaurantsTitle => 'Restoran topilmadi';

  @override
  String get saFoodSubtitle => 'Angren · 20–40 daqiqa';

  @override
  String get saFoodTitle => 'Ovqat yetkazish';

  @override
  String get saGoToCart => 'Savatga o\'tish';

  @override
  String get saGoToHome => 'Bosh sahifaga o\'tish';

  @override
  String get saHelpCenter => 'Yordam markazi';

  @override
  String get saInviteFriends => 'Do\'stlarni taklif qilish';

  @override
  String get saLoading => 'Yuklanmoqda';

  @override
  String get saLogout => 'Chiqish';

  @override
  String saLostItemDriverNote(String note) {
    return 'Haydovchi: $note';
  }

  @override
  String get saLostItemFound => 'Topdim';

  @override
  String get saLostItemFoundTitle => 'Buyum topildi';

  @override
  String get saLostItemNotFound => 'Topmadim';

  @override
  String saLostItemOperatorNote(String note) {
    return 'Operator: $note';
  }

  @override
  String get saLostItemWhereHint => 'Qayerda turibdi? (ixtiyoriy)';

  @override
  String get saLostItemsEmptyDriver =>
      'Yo\'lovchi safaringizda buyum qoldirsa, shu yerda ko\'rasiz.';

  @override
  String get saLostItemsEmptyPassenger =>
      'Safarda biror narsa qoldirsangiz, chek sahifasidan xabar bering.';

  @override
  String get saLostItemsEmptyTitle => 'Xabarlar yo\'q';

  @override
  String get saLostItemsTitle => 'Yo\'qolgan buyumlar';

  @override
  String get saMarket => 'Market';

  @override
  String get saMarketNoProductsMessage =>
      'Bu do\'konda hozircha mahsulot yo\'q.';

  @override
  String get saMarketNoProductsTitle => 'Mahsulot topilmadi';

  @override
  String get saMarketProducts => 'Mahsulotlar';

  @override
  String get saMarketSearchHint => 'Mahsulot qidirish…';

  @override
  String get saMarketSubtitle => '15–25 daqiqa · Yaqin do\'kon';

  @override
  String get saMenu => 'Menyu';

  @override
  String get saMenuEmptyMessage => 'Bu restoran hozircha taom qo\'shmagan.';

  @override
  String get saMenuEmptyTitle => 'Menyu bo\'sh';

  @override
  String get saNoStoreYet => 'Hozircha do\'kon yo\'q';

  @override
  String saNotificationUnreadLabel(String title) {
    return 'O\'qilmagan: $title';
  }

  @override
  String get saNotificationsEmpty => 'Hozircha bildirishnomalar yo\'q';

  @override
  String get saNotificationsMarkAllRead => 'Barchasini o\'qilgan deb belgilash';

  @override
  String get saNotificationsReadAction => 'O\'qildi';

  @override
  String get saNotificationsTitle => 'Bildirishnomalar';

  @override
  String get saOpen => 'Ochiq';

  @override
  String get saOpenTripReceipt => 'Safar chekini ochish';

  @override
  String get saOrderAccepted => 'Buyurtma qabul qilindi';

  @override
  String get saOrderHistory => 'Buyurtmalar tarixi';

  @override
  String get saOrderNotSent => 'Buyurtma yuborilmadi';

  @override
  String saOrderNumber(String number) {
    return 'Buyurtma raqami: $number';
  }

  @override
  String get saOrderNumberLabel => 'Buyurtma raqami';

  @override
  String get saOrderPaidOnlineHint =>
      'To\'lov qabul qilindi. Holatni «Buyurtmalar» bo\'limida kuzating.';

  @override
  String get saOrderPayOnDeliveryHint =>
      'Yetkazib berishda to\'laysiz. Holatni «Buyurtmalar» bo\'limida kuzating.';

  @override
  String get saOrdersActive => 'Faol';

  @override
  String get saOrdersHistory => 'Tarix';

  @override
  String get saOrdersNoActiveMessage =>
      'Taksi chaqiring yoki ovqat buyurtma qiling — jonli buyurtma shu yerda kuzatiladi.';

  @override
  String get saOrdersNoActiveTitle => 'Faol buyurtma yo\'q';

  @override
  String get saOrdersNoHistoryMessage =>
      'Yakunlangan buyurtmalar shu yerda saqlanadi.';

  @override
  String get saOrdersNoHistoryTitle => 'Buyurtmalar tarixi yo\'q';

  @override
  String get saOrdersTitle => 'Buyurtmalar';

  @override
  String get saParcelContinue => 'Manzilni tanlash';

  @override
  String get saParcelPinInfo =>
      'Haydovchi posilkani faqat PIN kod bilan topshiradi. Kodni buyurtma berganingizdan keyin ko\'rasiz — uni qabul qiluvchiga ayting.';

  @override
  String get saParcelRecipientName => 'Qabul qiluvchi ismi (ixtiyoriy)';

  @override
  String get saParcelRecipientPhone => 'Qabul qiluvchi telefoni';

  @override
  String get saParcelSize => 'O\'lchami';

  @override
  String get saParcelSizeLarge => 'Katta';

  @override
  String get saParcelSizeLargeHint => 'Bagajga sig\'adi';

  @override
  String get saParcelSizeMedium => 'O\'rta';

  @override
  String get saParcelSizeMediumHint => 'Sumka, quti';

  @override
  String get saParcelSizeSmall => 'Kichik';

  @override
  String get saParcelSizeSmallHint => 'Kalit, hujjat';

  @override
  String get saParcelSubtitle =>
      'Kalit, hujjat yoki buyumni shahar ichida yetkazamiz';

  @override
  String get saParcelTitle => 'Posilka yuborish';

  @override
  String get saParcelWhat => 'Nima yuboryapsiz?';

  @override
  String get saParcelWhatHint => 'Masalan: kalitlar, hujjatlar';

  @override
  String get saParcelWhatRequired => 'Nima yuborilayotganini yozing';

  @override
  String get saPaymentCard => 'Karta (Payme / Click)';

  @override
  String get saPaymentCash => 'Naqd pul';

  @override
  String get saPaymentIPaid => 'To\'ladim';

  @override
  String get saPaymentMethod => 'To\'lov usuli';

  @override
  String get saPaymentNotCompleted =>
      'To\'lov yakunlanmadi — buyurtma qabul qilindi, to\'lovni keyinroq amalga oshirishingiz mumkin';

  @override
  String saPaymentPageLoadFailed(String message) {
    return 'To\'lov sahifasini yuklab bo\'lmadi: $message';
  }

  @override
  String saPaymentStartFailed(String message) {
    return 'To\'lovni boshlab bo\'lmadi: $message';
  }

  @override
  String saPaymentTitle(String provider) {
    return 'To\'lov — $provider';
  }

  @override
  String get saPickup => 'Olib ketish';

  @override
  String get saPopularRestaurants => 'Mashhur restoranlar';

  @override
  String get saProductDeliveryLabel => 'YETKAZISH';

  @override
  String get saProductDeliveryValue => '15–25 daq';

  @override
  String get saProductDescription =>
      'Yangi va sifatli mahsulot, yaqin do\'kondan tez yetkazib beriladi.';

  @override
  String get saProductInStock => 'Mavjud';

  @override
  String get saProductOutOfStock => 'Tugagan';

  @override
  String get saProductRatingLabel => 'REYTING';

  @override
  String get saProductStockLabel => 'OMBOR';

  @override
  String saProductStoreUnit(String unit) {
    return 'Do\'kon · $unit';
  }

  @override
  String saProductsCount(int count) {
    return '$count ta mahsulot';
  }

  @override
  String get saProfileHelpBannerLabel =>
      'Yordam kerakmi? 24/7 qo\'llab-quvvatlash xizmati';

  @override
  String get saProfileNeedHelp => 'Yordam kerakmi?';

  @override
  String get saProfileRating => 'Reyting';

  @override
  String get saProfileSupport247 => '24/7 qo\'llab-quvvatlash xizmati';

  @override
  String get saProfileTrips => 'Safarlar';

  @override
  String get saPromoActive => 'FAOL';

  @override
  String get saPromoCodeCopied => 'Kod nusxalandi';

  @override
  String saPromoCopyLabel(String code) {
    return 'Promokodni nusxalash: $code';
  }

  @override
  String saPromoMinOrder(String amount) {
    return 'Min. buyurtma: $amount';
  }

  @override
  String saPromoUntil(String date) {
    return '${date}gacha';
  }

  @override
  String get saPromosEmpty => 'Hozircha faol promokodlar yo\'q';

  @override
  String get saPromosTitle => 'Aksiyalar va promokodlar';

  @override
  String get saQtyDecrease => 'Miqdorni kamaytirish';

  @override
  String get saQtyIncrease => 'Miqdorni oshirish';

  @override
  String get saRefresh => 'Yangilash';

  @override
  String get saRestaurantNotFound => 'Restoran topilmadi';

  @override
  String get saRestaurantsNotFound => 'Restoranlar topilmadi';

  @override
  String get saSavedAddresses => 'Saqlangan manzillar';

  @override
  String get saSearch => 'Qidiruv';

  @override
  String get saSearchClear => 'Qidiruvni tozalash';

  @override
  String get saSearchEmptyMessage => 'Boshqa nom bilan qidirib ko\'ring.';

  @override
  String get saSearchEmptyTitle => 'Hech narsa topilmadi';

  @override
  String get saSearchHint => 'taom, doʻkon, mahsulot…';

  @override
  String saSearchMarketUnit(String unit) {
    return 'Market · $unit';
  }

  @override
  String get saSearchSectionProducts => 'MAHSULOTLAR';

  @override
  String get saSearchSectionRestaurants => 'RESTORANLAR';

  @override
  String get saSearchingDriver => 'Haydovchi qidirilmoqda';

  @override
  String get saSeeAll => 'Barchasi';

  @override
  String saSegChipLabel(String label, int count) {
    return '$label, $count ta';
  }

  @override
  String saSegChipLabelSelected(String label, int count) {
    return '$label, $count ta, tanlangan';
  }

  @override
  String get saSend => 'Yuborish';

  @override
  String get saSettingsPush => 'Push bildirishnomalar';

  @override
  String get saSettingsPushSyncFailed =>
      'Sozlama saqlandi, lekin serverga yuborilmadi';

  @override
  String get saSettingsSectionGeneral => 'UMUMIY';

  @override
  String get saSettingsSectionHelp => 'YORDAM';

  @override
  String get saSettingsTitle => 'Sozlamalar';

  @override
  String saSettingsVersion(String version) {
    return 'Angren Go · versiya $version';
  }

  @override
  String get saSom => 'so\'m';

  @override
  String get saStageAccepted => 'Qabul qilindi';

  @override
  String get saStageDelivered => 'Yetkazildi';

  @override
  String get saStageDriverEnRoute => 'Haydovchi yo\'lda';

  @override
  String get saStageInTrip => 'Safarda';

  @override
  String get saStageOnTheWay => 'Yo\'lda';

  @override
  String get saStagePacking => 'Yig\'ilmoqda';

  @override
  String get saStagePreparing => 'Tayyorlanmoqda';

  @override
  String saStageProgress(int total, int step, String stage) {
    return '$total bosqichdan $step: $stage';
  }

  @override
  String get saStageSearching => 'Qidirilmoqda';

  @override
  String get saSubmitting => 'Yuborilmoqda...';

  @override
  String get saSupportCall => 'Qo\'ng\'iroq';

  @override
  String saSupportCallSub(String phone) {
    return '$phone · bepul';
  }

  @override
  String get saSupportOperatorChat => 'Operator bilan chat';

  @override
  String get saSupportOperatorChatSub =>
      'Savolingizni yozing — operator javob beradi';

  @override
  String get saTabHome => 'Asosiy';

  @override
  String get saTabOrders => 'Buyurtma';

  @override
  String get saTabProfile => 'Profil';

  @override
  String get saTaxiWhereToLabel => 'Taksi. Qayerga borasiz?';

  @override
  String get saTelegramOpenFailed => 'Telegramni ochib bo\'lmadi';

  @override
  String get saTopUpAmountLabel => 'To\'ldirish summasi';

  @override
  String get saTopUpOnlineUnavailable =>
      'Onlayn to\'ldirish hali ishga tushmagan';

  @override
  String get saTopUpTitle => 'Hisobni to\'ldirish';

  @override
  String get saTopUpViaOperatorHint =>
      'Hozircha hamyonni operator orqali to\'ldirasiz: 1056 raqamiga qo\'ng\'iroq qiling yoki chatda yozing. Safarlarni naqd pul bilan ham to\'lash mumkin.';

  @override
  String get saTotal => 'Jami';

  @override
  String get saTxnBonus => 'Bonus';

  @override
  String get saTxnCommission => 'Platforma komissiyasi';

  @override
  String get saTxnCredit => 'kirim';

  @override
  String get saTxnDebit => 'Yechim';

  @override
  String get saTxnDebitWord => 'chiqim';

  @override
  String saTxnPending(String when) {
    return '$when · kutilmoqda';
  }

  @override
  String get saTxnReferralBonus => 'Referal bonus';

  @override
  String saTxnSemantics(
      String title, String amount, String direction, String subtitle) {
    return '$title, $amount so\'m $direction, $subtitle';
  }

  @override
  String get saTxnTopUp => 'Hisob to\'ldirildi';

  @override
  String get saTxnTripEarning => 'Safar daromadi';

  @override
  String get saTxnTripPayment => 'Safar to\'lovi';

  @override
  String get saTxnWithdrawal => 'Pul yechish';

  @override
  String get saViewOrders => 'Buyurtmalarni koʻrish';

  @override
  String get saViewReceipt => 'Chekni ko\'rish';

  @override
  String get saWalletAllServices => 'Barcha xizmatlar';

  @override
  String get saWalletAndCards => 'Hamyon va kartalar';

  @override
  String saWalletBalanceLabel(String amount) {
    return 'Hamyon balansi $amount so\'m';
  }

  @override
  String get saWalletBalanceNotLoaded => 'Hamyon balansi hali yuklanmadi';

  @override
  String get saWalletBalanceTitle => 'Angren Go balans';

  @override
  String get saWalletCards => 'Kartalar';

  @override
  String get saWalletCardsUnavailableMessage =>
      'Hozircha safarlarni naqd pul yoki hamyon balansi bilan to\'lang.';

  @override
  String get saWalletCardsUnavailableTitle =>
      'Karta bog\'lash hali mavjud emas';

  @override
  String get saWalletNoTxnsMessage =>
      'Birinchi safar yoki to\'ldirishdan keyin bu yerda ko\'rinadi.';

  @override
  String get saWalletNoTxnsTitle => 'Hozircha amallar yo\'q';

  @override
  String get saWalletOneWalletNote =>
      'Taksi, yuk, ovqat va market — bitta hamyon, bitta daftar.';

  @override
  String get saWalletRecentActivity => 'So\'nggi amallar';

  @override
  String get saWalletTitle => 'Hamyon';

  @override
  String get saWalletTopUp => 'To\'ldirish';

  @override
  String get saWalletTransfer => 'O\'tkazish';

  @override
  String get saWhereTo => 'Qayerga borasiz?';

  @override
  String get shAuthContinue => 'Davom etish';

  @override
  String get shAuthEnterPhone => 'Telefon raqamingizni kiriting';

  @override
  String get shAuthPhoneLabel => 'Telefon raqam';

  @override
  String get shAuthTerms =>
      'Davom etish orqali siz foydalanish shartlari va maxfiylik siyosatiga rozilik bildirasiz.';

  @override
  String get shBack => 'Orqaga';

  @override
  String get shCancel => 'Bekor qilish';

  @override
  String get shChatHint => 'Xabar yozing...';

  @override
  String get shConfirm => 'Tasdiqlash';

  @override
  String get shDeliveryAccepted => 'Qabul qilindi';

  @override
  String get shDeliveryDelivered => 'Yetkazildi';

  @override
  String get shDeliveryOnTheWay => 'Yo\'lda';

  @override
  String get shDeliveryPreparing => 'Tayyorlanmoqda';

  @override
  String get shDriverFallbackName => 'Haydovchi';

  @override
  String get shErrorGeneric => 'Xatolik yuz berdi';

  @override
  String get shErrorNoInternet => 'Internet bilan muammo bor';

  @override
  String shErrorSemantics(String message) {
    return 'Xatolik: $message';
  }

  @override
  String get shErrorTimeout => 'Ulanish vaqti tugadi. Internetni tekshiring';

  @override
  String get shErrorUnknown => 'Noma\'lum xatolik yuz berdi';

  @override
  String get shFareBase => 'Asos';

  @override
  String shFareDistance(String km, String price) {
    return 'Masofa ($km km × $price)';
  }

  @override
  String get shFareMaxCap => 'Yuqori narx chegarasi';

  @override
  String get shFareMinAdjustment => 'Eng kam haq tuzatmasi';

  @override
  String get shFareRounding => 'Yaxlitlash';

  @override
  String shFareSurge(String multiplier) {
    return 'Talab koeffitsienti (×$multiplier)';
  }

  @override
  String shFareTime(int minutes, String price) {
    return 'Vaqt ($minutes daq × $price)';
  }

  @override
  String shFareWaiting(int minutes) {
    return 'Kutish ($minutes daq)';
  }

  @override
  String get shFareWaitingFree => 'Kutish (0 daq — bepul vaqtdan oshmadi)';

  @override
  String shFareWaitingRate(int minutes, String price) {
    return 'Kutish ($minutes daq × $price)';
  }

  @override
  String get shLoading => 'Yuklanmoqda';

  @override
  String get shLostItemClosed => 'Yopildi';

  @override
  String get shLostItemFound => 'Topildi — operator bog\'lanadi';

  @override
  String get shLostItemNotFound => 'Mashinadan topilmadi';

  @override
  String get shLostItemOpen => 'Haydovchi tekshirmoqda';

  @override
  String get shLostItemReturned => 'Qaytarildi';

  @override
  String get shManeuverArrive => 'Manzilga yetib keldingiz';

  @override
  String shManeuverArriveIn(int meters) {
    return '$meters metrdan keyin manzilga yetib borasiz';
  }

  @override
  String get shManeuverContinue => 'Yo\'lda davom eting';

  @override
  String get shManeuverDepart => 'Yo\'lni boshlang';

  @override
  String shManeuverInDistance(int meters, String instruction) {
    return '$meters metrdan keyin $instruction';
  }

  @override
  String get shManeuverLeft => 'Chapga buriling';

  @override
  String get shManeuverRerouting =>
      'Marshrutdan chiqdingiz. Yo\'l qayta hisoblanmoqda.';

  @override
  String get shManeuverRight => 'O\'ngga buriling';

  @override
  String get shManeuverSharpLeft => 'Keskin chapga buriling';

  @override
  String get shManeuverSharpRight => 'Keskin o\'ngga buriling';

  @override
  String get shManeuverStraight => 'To\'g\'ri davom eting';

  @override
  String get shManeuverUturn => 'Orqaga qayting';

  @override
  String get shMarketPacking => 'Do\'kon yig\'moqda';

  @override
  String shMeterAtLeast(String price) {
    return 'kamida $price';
  }

  @override
  String shMeterDistanceTime(String distance, int minutes) {
    return '$distance · $minutes daq';
  }

  @override
  String get shMeterFinalNote =>
      'Yakuniy narx safar tugaganda yo\'l bo\'yicha aniqlanadi';

  @override
  String get shMeterNoDestination => 'Manzil yo\'q — taksometr';

  @override
  String get shMeterTitle => 'Taksometr';

  @override
  String shNeedsAttentionSemantics(String label) {
    return '$label, e\'tibor talab qiladi';
  }

  @override
  String get shOrderStatusCompleted => 'Yakunlandi';

  @override
  String get shOrderStatusDriverArrived => 'Haydovchi yetib keldi';

  @override
  String get shOrderStatusDriverAssigned => 'Haydovchi tayinlandi';

  @override
  String get shOrderStatusDriverEnRoute => 'Haydovchi kelmoqda';

  @override
  String get shOrderStatusInProgress => 'Sayohat davom etmoqda';

  @override
  String get shOrderStatusScheduled => 'Rejalashtirilgan';

  @override
  String get shOrderStatusSearching => 'Haydovchi izlanmoqda';

  @override
  String get shOtpEnterSixDigits => '6 ta raqamli kodni kiriting';

  @override
  String get shOtpHeading => 'SMS kod kiriting';

  @override
  String get shOtpResend => 'Kodni qayta yuborish';

  @override
  String shOtpResendIn(int seconds) {
    return 'Qayta yuborish: $seconds s';
  }

  @override
  String get shOtpSentPrefix => 'Kod ';

  @override
  String get shOtpSentSuffix => ' raqamiga yuborildi';

  @override
  String get shOtpTitle => 'Tasdiqlash';

  @override
  String get shPayMethodCard => 'Karta';

  @override
  String get shPayMethodCash => 'Naqd pul';

  @override
  String get shPayMethodWallet => 'Hamyon';

  @override
  String get shPayStatusFailed => 'Amalga oshmadi';

  @override
  String get shPayStatusPaid => 'To\'landi';

  @override
  String get shPayStatusRefunded => 'Qaytarildi';

  @override
  String shReceiptDate(String date) {
    return 'Sana: $date';
  }

  @override
  String shReceiptDiscount(String promo, String amount) {
    return 'Chegirma$promo: −$amount';
  }

  @override
  String shReceiptDistance(String distance) {
    return 'Masofa: $distance';
  }

  @override
  String shReceiptDriver(String driver) {
    return 'Haydovchi: $driver';
  }

  @override
  String shReceiptDropoff(String address) {
    return 'Tushish: $address';
  }

  @override
  String shReceiptDuration(String duration) {
    return 'Davomiyligi: $duration';
  }

  @override
  String shReceiptGrandTotal(String amount) {
    return 'Yakuniy: $amount';
  }

  @override
  String get shReceiptHeader => 'Angren Go — safar cheki';

  @override
  String get shReceiptMeteredDropoff => 'Taksometr bo\'yicha (manzilsiz)';

  @override
  String get shReceiptNoFareBreakdown => 'Narx tarkibi saqlanmagan.';

  @override
  String get shReceiptNotSaved => 'saqlanmagan';

  @override
  String shReceiptOrder(String number) {
    return 'Buyurtma: $number';
  }

  @override
  String shReceiptPayment(String payment) {
    return 'To\'lov: $payment';
  }

  @override
  String shReceiptPickup(String address) {
    return 'Olib ketish: $address';
  }

  @override
  String shReceiptService(String service) {
    return 'Xizmat: $service';
  }

  @override
  String shReceiptStop(int index, String address) {
    return 'To\'xtash $index: $address';
  }

  @override
  String shReceiptTariff(String tariff) {
    return 'Tarif: $tariff';
  }

  @override
  String shReceiptTip(String amount) {
    return 'Chaqim: +$amount';
  }

  @override
  String shReceiptTotal(String amount) {
    return 'Jami: $amount';
  }

  @override
  String shReceiptUnpaid(String amount) {
    return 'To\'lanmagan qoldiq: $amount';
  }

  @override
  String get shRetry => 'Qayta urinish';

  @override
  String shRouteFromSemantics(String address) {
    return 'Qayerdan: $address';
  }

  @override
  String get shRouteSwap => 'Manzillarni almashtirish';

  @override
  String shRouteToSemantics(String address) {
    return 'Qayerga: $address';
  }

  @override
  String shRouteToWithDistanceSemantics(String address, String distance) {
    return 'Qayerga: $address, $distance';
  }

  @override
  String get shSend => 'Yuborish';

  @override
  String get shServiceCargo => 'Yuk tashish';

  @override
  String get shServiceCargoShort => 'Yuk';

  @override
  String get shServiceFood => 'Ovqat yetkazish';

  @override
  String get shServiceFoodShort => 'Ovqat';

  @override
  String get shServiceMarket => 'Do\'kon yetkazish';

  @override
  String get shServiceMarketShort => 'Market';

  @override
  String get shServiceParcelShort => 'Posilka';

  @override
  String get shServiceTaxi => 'Taksi';

  @override
  String get shStatusCancelled => 'Bekor qilindi';

  @override
  String get shStatusPending => 'Kutilmoqda';

  @override
  String shStatusSemantics(String status) {
    return 'Holat: $status';
  }

  @override
  String get shSupportChatEmpty =>
      'Xabar yozing — operatorlarimiz 24/7 yordam berishga tayyor';

  @override
  String get shSupportChatTitle => 'Operator bilan chat';

  @override
  String get shTripChatEmpty => 'Hali xabar yo\'q. Birinchi bo\'lib yozing!';

  @override
  String get shTripChatTitle => 'Suhbat';

  @override
  String get shTripOptionAirConditioner => 'Konditsioner';

  @override
  String get shTripOptionBigLuggage => 'Katta bagaj';

  @override
  String get shTripOptionChildSeat => 'Bola o\'rindig\'i';

  @override
  String get shTripOptionPet => 'Hayvon bilan';

  @override
  String get shTxBonus => 'Bonus';

  @override
  String get shTxTopUp => 'Hisobni to\'ldirish';

  @override
  String get shTxTrip => 'Sayohat';

  @override
  String get shTxWithdrawal => 'Pul yechish';

  @override
  String get shValDigitsOnly => 'Faqat raqamlar kiriting';

  @override
  String shValFieldRequired(String field) {
    return '$field bo\'sh bo\'lmasligi kerak';
  }

  @override
  String get shValNameRequired => 'Ismni kiriting';

  @override
  String get shValNameTooShort =>
      'Ism kamida 2 ta harfdan iborat bo\'lishi kerak';

  @override
  String get shValOtpLength => 'Kod 6 raqamdan iborat bo\'lishi kerak';

  @override
  String get shValOtpRequired => 'Kodni kiriting';

  @override
  String get shValPhoneInvalid => 'Telefon raqami noto\'g\'ri (+998XXXXXXXXX)';

  @override
  String get shValPhoneRequired => 'Telefon raqamini kiriting';

  @override
  String get shValThisFieldRequired => 'Bu maydon bo\'sh bo\'lmasligi kerak';

  @override
  String shVerifDaysLeft(int days) {
    return '$days kun qoldi';
  }

  @override
  String shVerifDaysOverdue(int days) {
    return '$days kun kechikkan';
  }

  @override
  String get shVerifDueSoon => 'Muddati tugayapti';

  @override
  String get shVerifExpiresToday => 'Bugun tugaydi';

  @override
  String get shVerifMissing => 'Yuklanmagan';

  @override
  String get shVerifOk => 'Yaroqli';

  @override
  String get shVerifOverdue => 'Muddati o\'tgan';

  @override
  String get shVerifPendingReview => 'Tekshirilmoqda';

  @override
  String get shVerifRejected => 'Rad etilgan';

  @override
  String get shVerifUnknown => 'E\'tibor talab qiladi';
}
