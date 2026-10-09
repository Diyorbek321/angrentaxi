import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_ru.dart';
import 'app_localizations_uz.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'gen/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
      : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations? of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations);
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
    delegate,
    GlobalMaterialLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
  ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('ru'),
    Locale('uz')
  ];

  /// No description provided for @appLanguage.
  ///
  /// In uz, this message translates to:
  /// **'Ilova tili'**
  String get appLanguage;

  /// No description provided for @authWrongAppDriver.
  ///
  /// In uz, this message translates to:
  /// **'Bu raqam haydovchi sifatida ro\'yxatdan o\'tgan. Haydovchi ilovasidan foydalaning yoki yo\'lovchi sifatida boshqa raqam bilan kiring.'**
  String get authWrongAppDriver;

  /// No description provided for @authWrongAppStaff.
  ///
  /// In uz, this message translates to:
  /// **'Bu raqam bilan bu ilovaga kirib bo\'lmaydi. Admin hisobi faqat boshqaruv panelida ishlaydi; xodim va sotuvchi taksini yo\'lovchi ilovasidan chaqiradi.'**
  String get authWrongAppStaff;

  /// No description provided for @commonCancel.
  ///
  /// In uz, this message translates to:
  /// **'Bekor qilish'**
  String get commonCancel;

  /// No description provided for @commonDone.
  ///
  /// In uz, this message translates to:
  /// **'Tayyor'**
  String get commonDone;

  /// No description provided for @commonErrorTitle.
  ///
  /// In uz, this message translates to:
  /// **'Xatolik yuz berdi'**
  String get commonErrorTitle;

  /// No description provided for @commonRetry.
  ///
  /// In uz, this message translates to:
  /// **'Qayta urinish'**
  String get commonRetry;

  /// No description provided for @commonSave.
  ///
  /// In uz, this message translates to:
  /// **'Saqlash'**
  String get commonSave;

  /// No description provided for @commonSend.
  ///
  /// In uz, this message translates to:
  /// **'Yuborish'**
  String get commonSend;

  /// No description provided for @drvAbout.
  ///
  /// In uz, this message translates to:
  /// **'Dastur haqida'**
  String get drvAbout;

  /// No description provided for @drvAccept.
  ///
  /// In uz, this message translates to:
  /// **'Qabul qilish'**
  String get drvAccept;

  /// No description provided for @drvAcceptFailed.
  ///
  /// In uz, this message translates to:
  /// **'Buyurtmani qabul qilib bo\'lmadi'**
  String get drvAcceptFailed;

  /// No description provided for @drvAcceptedOrders.
  ///
  /// In uz, this message translates to:
  /// **'Qabul qilinadigan buyurtmalar'**
  String get drvAcceptedOrders;

  /// No description provided for @drvAmenitiesIntro.
  ///
  /// In uz, this message translates to:
  /// **'Mashinangizda bor narsalarni belgilang — yo\'lovchi shularni so\'rasa, buyurtma sizga keladi.'**
  String get drvAmenitiesIntro;

  /// No description provided for @drvAmenitiesTitle.
  ///
  /// In uz, this message translates to:
  /// **'Qo\'shimcha imkoniyatlar'**
  String get drvAmenitiesTitle;

  /// No description provided for @drvAmenitiesWarning.
  ///
  /// In uz, this message translates to:
  /// **'Mashinada yo\'q narsani belgilamang: yo\'lovchi bola o\'rindig\'i kutib chiqadi va safarni bekor qiladi.'**
  String get drvAmenitiesWarning;

  /// No description provided for @drvAmount.
  ///
  /// In uz, this message translates to:
  /// **'Summa'**
  String get drvAmount;

  /// No description provided for @drvAmountExceedsWallet.
  ///
  /// In uz, this message translates to:
  /// **'Summa hamyondan oshib ketdi. Hamyon: {balance}'**
  String drvAmountExceedsWallet(String balance);

  /// No description provided for @drvAmountHint.
  ///
  /// In uz, this message translates to:
  /// **'Masalan: 60000'**
  String get drvAmountHint;

  /// No description provided for @drvAppName.
  ///
  /// In uz, this message translates to:
  /// **'Angren Taxi - Haydovchi'**
  String get drvAppName;

  /// No description provided for @drvApplicationIntro.
  ///
  /// In uz, this message translates to:
  /// **'{phone} raqami hali haydovchi sifatida ro\'yxatdan o\'tmagan. Mashina ma\'lumotlarini kiriting — admin tasdiqlagach onlayn bo\'la olasiz.'**
  String drvApplicationIntro(String phone);

  /// No description provided for @drvApplicationPending.
  ///
  /// In uz, this message translates to:
  /// **'Ariza ko\'rib chiqilmoqda'**
  String get drvApplicationPending;

  /// No description provided for @drvApplicationPendingBody.
  ///
  /// In uz, this message translates to:
  /// **'Sizning haydovchilik arizangiz admin tomonidan tasdiqlanishini kutmoqda. Tasdiqlangach shu yerdan avtomatik davom etasiz.'**
  String get drvApplicationPendingBody;

  /// No description provided for @drvApplicationRoleWarning.
  ///
  /// In uz, this message translates to:
  /// **'Diqqat: ariza yuborilgach bu raqam haydovchi hisobiga aylanadi va u bilan yo\'lovchi ilovasida taksi, ovqat yoki market buyurtma qila olmaysiz. Yo\'lovchi sifatida foydalanish uchun boshqa raqam kerak bo\'ladi.'**
  String get drvApplicationRoleWarning;

  /// No description provided for @drvApplicationTitle.
  ///
  /// In uz, this message translates to:
  /// **'Haydovchi bo\'lish uchun ariza'**
  String get drvApplicationTitle;

  /// No description provided for @drvArrivedCargo.
  ///
  /// In uz, this message translates to:
  /// **'Yuk olish joyidasiz!'**
  String get drvArrivedCargo;

  /// No description provided for @drvArrivedParcel.
  ///
  /// In uz, this message translates to:
  /// **'Posilka olish joyidasiz!'**
  String get drvArrivedParcel;

  /// No description provided for @drvArrivedRestaurant.
  ///
  /// In uz, this message translates to:
  /// **'Restorandasiz!'**
  String get drvArrivedRestaurant;

  /// No description provided for @drvArrivedShop.
  ///
  /// In uz, this message translates to:
  /// **'Do\'kondasiz!'**
  String get drvArrivedShop;

  /// No description provided for @drvArrivedTaxi.
  ///
  /// In uz, this message translates to:
  /// **'Olish joyida turibsiz!'**
  String get drvArrivedTaxi;

  /// No description provided for @drvArrivedTitle.
  ///
  /// In uz, this message translates to:
  /// **'Yetib keldim'**
  String get drvArrivedTitle;

  /// No description provided for @drvBack.
  ///
  /// In uz, this message translates to:
  /// **'Orqaga'**
  String get drvBack;

  /// No description provided for @drvBalanceNegative.
  ///
  /// In uz, this message translates to:
  /// **'Hisobingiz manfiy ({balance}). Avval qarzni yoping.'**
  String drvBalanceNegative(String balance);

  /// No description provided for @drvBankAndWithdraw.
  ///
  /// In uz, this message translates to:
  /// **'Bank hisobi va pul yechish'**
  String get drvBankAndWithdraw;

  /// No description provided for @drvBonusDone.
  ///
  /// In uz, this message translates to:
  /// **'Bajarildi — {amount}'**
  String drvBonusDone(String amount);

  /// No description provided for @drvBonusProgram.
  ///
  /// In uz, this message translates to:
  /// **'Bonus dasturi'**
  String get drvBonusProgram;

  /// No description provided for @drvBonusRemaining.
  ///
  /// In uz, this message translates to:
  /// **'Yana {count} ta safar — {amount}'**
  String drvBonusRemaining(int count, String amount);

  /// No description provided for @drvBonusTrips.
  ///
  /// In uz, this message translates to:
  /// **'{current}/{threshold} safar'**
  String drvBonusTrips(int current, int threshold);

  /// No description provided for @drvCall.
  ///
  /// In uz, this message translates to:
  /// **'Qo\'ng\'iroq'**
  String get drvCall;

  /// No description provided for @drvCallCustomer.
  ///
  /// In uz, this message translates to:
  /// **'Mijozga qo\'ng\'iroq'**
  String get drvCallCustomer;

  /// No description provided for @drvCallFailed.
  ///
  /// In uz, this message translates to:
  /// **'Qo\'ng\'iroq qilib bo\'lmadi'**
  String get drvCallFailed;

  /// No description provided for @drvCallRecipient.
  ///
  /// In uz, this message translates to:
  /// **'Qabul qiluvchiga qo\'ng\'iroq'**
  String get drvCallRecipient;

  /// No description provided for @drvCallSeller.
  ///
  /// In uz, this message translates to:
  /// **'Sotuvchiga qo\'ng\'iroq'**
  String get drvCallSeller;

  /// No description provided for @drvCamera.
  ///
  /// In uz, this message translates to:
  /// **'Kamera'**
  String get drvCamera;

  /// No description provided for @drvCancel.
  ///
  /// In uz, this message translates to:
  /// **'Bekor qilish'**
  String get drvCancel;

  /// No description provided for @drvCancelFailed.
  ///
  /// In uz, this message translates to:
  /// **'Bekor qilib bo\'lmadi'**
  String get drvCancelFailed;

  /// No description provided for @drvCarColor.
  ///
  /// In uz, this message translates to:
  /// **'Rangi'**
  String get drvCarColor;

  /// No description provided for @drvCarDetails.
  ///
  /// In uz, this message translates to:
  /// **'Mashina ma\'lumotlari'**
  String get drvCarDetails;

  /// No description provided for @drvCarModel.
  ///
  /// In uz, this message translates to:
  /// **'Rusumi'**
  String get drvCarModel;

  /// No description provided for @drvCarModelField.
  ///
  /// In uz, this message translates to:
  /// **'Mashina modeli'**
  String get drvCarModelField;

  /// No description provided for @drvCarModelHint.
  ///
  /// In uz, this message translates to:
  /// **'Masalan: Chevrolet Cobalt'**
  String get drvCarModelHint;

  /// No description provided for @drvCarModelRequired.
  ///
  /// In uz, this message translates to:
  /// **'Mashina rusumini kiriting'**
  String get drvCarModelRequired;

  /// No description provided for @drvCarYear.
  ///
  /// In uz, this message translates to:
  /// **'Ishlab chiqarilgan yili'**
  String get drvCarYear;

  /// No description provided for @drvCarYearField.
  ///
  /// In uz, this message translates to:
  /// **'Mashina ishlab chiqarilgan yili'**
  String get drvCarYearField;

  /// No description provided for @drvCarYearHelper.
  ///
  /// In uz, this message translates to:
  /// **'Qaysi tarif darajasida ishlay olishingiz shu ma\'lumot asosida ko\'rib chiqiladi'**
  String get drvCarYearHelper;

  /// No description provided for @drvCarYearHint.
  ///
  /// In uz, this message translates to:
  /// **'Masalan: 2019'**
  String get drvCarYearHint;

  /// No description provided for @drvCarYearOptional.
  ///
  /// In uz, this message translates to:
  /// **'Ishlab chiqarilgan yili (ixtiyoriy)'**
  String get drvCarYearOptional;

  /// No description provided for @drvCarYearRange.
  ///
  /// In uz, this message translates to:
  /// **'1990 dan {max} gacha yil kiriting'**
  String drvCarYearRange(int max);

  /// No description provided for @drvCardOrPhone.
  ///
  /// In uz, this message translates to:
  /// **'Karta yoki telefon raqami'**
  String get drvCardOrPhone;

  /// No description provided for @drvCargo.
  ///
  /// In uz, this message translates to:
  /// **'Yuk'**
  String get drvCargo;

  /// No description provided for @drvCargoDelivered.
  ///
  /// In uz, this message translates to:
  /// **'Yuk muvaffaqiyatli yetkazildi!'**
  String get drvCargoDelivered;

  /// No description provided for @drvCargoInProgress.
  ///
  /// In uz, this message translates to:
  /// **'Yuk yetkazilmoqda'**
  String get drvCargoInProgress;

  /// No description provided for @drvCargoNotGiven.
  ///
  /// In uz, this message translates to:
  /// **'Yuk berilmadi'**
  String get drvCargoNotGiven;

  /// No description provided for @drvCargoPickupPlace.
  ///
  /// In uz, this message translates to:
  /// **'Yukni olish joyi'**
  String get drvCargoPickupPlace;

  /// No description provided for @drvChatCustomer.
  ///
  /// In uz, this message translates to:
  /// **'Mijoz bilan yozishish'**
  String get drvChatCustomer;

  /// No description provided for @drvChatPassenger.
  ///
  /// In uz, this message translates to:
  /// **'Yo\'lovchi bilan yozishish'**
  String get drvChatPassenger;

  /// No description provided for @drvCheckStatus.
  ///
  /// In uz, this message translates to:
  /// **'Holatni tekshirish'**
  String get drvCheckStatus;

  /// No description provided for @drvCollectCash.
  ///
  /// In uz, this message translates to:
  /// **'Mijozdan naqd oling'**
  String get drvCollectCash;

  /// No description provided for @drvCompleteCargoConfirm.
  ///
  /// In uz, this message translates to:
  /// **'Yukni topshirganingizni tasdiqlaysizmi?'**
  String get drvCompleteCargoConfirm;

  /// No description provided for @drvCompleteDelivery.
  ///
  /// In uz, this message translates to:
  /// **'Yetkazishni yakunlash'**
  String get drvCompleteDelivery;

  /// No description provided for @drvCompleteFailed.
  ///
  /// In uz, this message translates to:
  /// **'Yakunlab bo\'lmadi'**
  String get drvCompleteFailed;

  /// No description provided for @drvCompleteOrderConfirm.
  ///
  /// In uz, this message translates to:
  /// **'Buyurtmani mijozga topshirganingizni tasdiqlaysizmi?'**
  String get drvCompleteOrderConfirm;

  /// No description provided for @drvCompleteParcelConfirm.
  ///
  /// In uz, this message translates to:
  /// **'Qabul qiluvchidan 4 xonali PIN kodni so\'rang va kiriting.'**
  String get drvCompleteParcelConfirm;

  /// No description provided for @drvCompleteTrip.
  ///
  /// In uz, this message translates to:
  /// **'Safarni yakunlash'**
  String get drvCompleteTrip;

  /// No description provided for @drvCompleteTripConfirm.
  ///
  /// In uz, this message translates to:
  /// **'Safarni yakunlashni tasdiqlaysizmi?'**
  String get drvCompleteTripConfirm;

  /// No description provided for @drvCompletedTrips.
  ///
  /// In uz, this message translates to:
  /// **'Yakunlangan safarlar'**
  String get drvCompletedTrips;

  /// No description provided for @drvContinue.
  ///
  /// In uz, this message translates to:
  /// **'Davom etish'**
  String get drvContinue;

  /// No description provided for @drvCurrentCar.
  ///
  /// In uz, this message translates to:
  /// **'Hozirgi mashina'**
  String get drvCurrentCar;

  /// No description provided for @drvCustomer.
  ///
  /// In uz, this message translates to:
  /// **'Mijoz'**
  String get drvCustomer;

  /// No description provided for @drvDataNotLoaded.
  ///
  /// In uz, this message translates to:
  /// **'Ma\'lumot yuklanmadi'**
  String get drvDataNotLoaded;

  /// No description provided for @drvDeadlineApproaching.
  ///
  /// In uz, this message translates to:
  /// **'Muddat yaqinlashmoqda'**
  String get drvDeadlineApproaching;

  /// No description provided for @drvDebt.
  ///
  /// In uz, this message translates to:
  /// **'Qarz'**
  String get drvDebt;

  /// No description provided for @drvDebtAmount.
  ///
  /// In uz, this message translates to:
  /// **'Qarz: {amount}'**
  String drvDebtAmount(String amount);

  /// No description provided for @drvDebtConsequence.
  ///
  /// In uz, this message translates to:
  /// **'Naqd safarlar komissiyasi. Qarz yopilmaguncha onlayn chiqib bo\'lmaydi.'**
  String get drvDebtConsequence;

  /// No description provided for @drvDecline.
  ///
  /// In uz, this message translates to:
  /// **'Rad etish'**
  String get drvDecline;

  /// No description provided for @drvDeliveryAddress.
  ///
  /// In uz, this message translates to:
  /// **'Yetkazish manzili'**
  String get drvDeliveryAddress;

  /// No description provided for @drvDemandEvenMessage.
  ///
  /// In uz, this message translates to:
  /// **'Zonalar orasida farq yo‘q — istalgan joyda kutishingiz mumkin. Maʼlumot har daqiqada yangilanadi.'**
  String get drvDemandEvenMessage;

  /// No description provided for @drvDemandEvenTitle.
  ///
  /// In uz, this message translates to:
  /// **'Hozir talab hamma joyda oddiy'**
  String get drvDemandEvenTitle;

  /// No description provided for @drvDemandHigh.
  ///
  /// In uz, this message translates to:
  /// **'Talab yuqori'**
  String get drvDemandHigh;

  /// No description provided for @drvDemandLoadFailed.
  ///
  /// In uz, this message translates to:
  /// **'Talab maʼlumoti olinmadi'**
  String get drvDemandLoadFailed;

  /// No description provided for @drvDemandMapLinkSem.
  ///
  /// In uz, this message translates to:
  /// **'Talab xaritasi, qayerda buyurtma ko\'pligini ko\'rish'**
  String get drvDemandMapLinkSem;

  /// No description provided for @drvDemandMapTitle.
  ///
  /// In uz, this message translates to:
  /// **'Talab xaritasi'**
  String get drvDemandMapTitle;

  /// No description provided for @drvDemandNormal.
  ///
  /// In uz, this message translates to:
  /// **'Talab oddiy'**
  String get drvDemandNormal;

  /// No description provided for @drvDemandPaintedMore.
  ///
  /// In uz, this message translates to:
  /// **'Bo‘yalgan joylarda buyurtma ko‘proq'**
  String get drvDemandPaintedMore;

  /// No description provided for @drvDemandRowSem.
  ///
  /// In uz, this message translates to:
  /// **'{title}, {count}'**
  String drvDemandRowSem(String title, String count);

  /// No description provided for @drvDemandRowSemNearest.
  ///
  /// In uz, this message translates to:
  /// **'{title}, {count}, eng yaqini {distance}'**
  String drvDemandRowSemNearest(String title, String count, String distance);

  /// No description provided for @drvDemandStayNear.
  ///
  /// In uz, this message translates to:
  /// **'Shu zonalarga yaqin turing — buyurtma tezroq keladi.'**
  String get drvDemandStayNear;

  /// No description provided for @drvDemandUnpaintedNormal.
  ///
  /// In uz, this message translates to:
  /// **'Bo‘yalmagan joylarda talab odatdagidek.'**
  String get drvDemandUnpaintedNormal;

  /// No description provided for @drvDemandVeryHigh.
  ///
  /// In uz, this message translates to:
  /// **'Talab juda yuqori'**
  String get drvDemandVeryHigh;

  /// No description provided for @drvDemandZone.
  ///
  /// In uz, this message translates to:
  /// **'Talab zonasi'**
  String get drvDemandZone;

  /// No description provided for @drvDestination.
  ///
  /// In uz, this message translates to:
  /// **'Manzil'**
  String get drvDestination;

  /// No description provided for @drvDispatchersNotified.
  ///
  /// In uz, this message translates to:
  /// **'Dispetcherlarga xabar yuborildi'**
  String get drvDispatchersNotified;

  /// No description provided for @drvDistanceToCargo.
  ///
  /// In uz, this message translates to:
  /// **'Yukkacha'**
  String get drvDistanceToCargo;

  /// No description provided for @drvDistanceToParcel.
  ///
  /// In uz, this message translates to:
  /// **'Posilkagacha'**
  String get drvDistanceToParcel;

  /// No description provided for @drvDistanceToPassenger.
  ///
  /// In uz, this message translates to:
  /// **'Yo\'lovchigacha'**
  String get drvDistanceToPassenger;

  /// No description provided for @drvDistanceToRestaurant.
  ///
  /// In uz, this message translates to:
  /// **'Restorangacha'**
  String get drvDistanceToRestaurant;

  /// No description provided for @drvDistanceToShop.
  ///
  /// In uz, this message translates to:
  /// **'Do\'kongacha'**
  String get drvDistanceToShop;

  /// No description provided for @drvDocApproved.
  ///
  /// In uz, this message translates to:
  /// **'Tasdiqlangan'**
  String get drvDocApproved;

  /// No description provided for @drvDocLicenseBack.
  ///
  /// In uz, this message translates to:
  /// **'Haydovchilik guvohnomasi (orqa tomoni)'**
  String get drvDocLicenseBack;

  /// No description provided for @drvDocLicenseFront.
  ///
  /// In uz, this message translates to:
  /// **'Haydovchilik guvohnomasi (old tomoni)'**
  String get drvDocLicenseFront;

  /// No description provided for @drvDocPassport.
  ///
  /// In uz, this message translates to:
  /// **'Pasport'**
  String get drvDocPassport;

  /// No description provided for @drvDocRejectedReupload.
  ///
  /// In uz, this message translates to:
  /// **'Rad etilgan — qayta yuklang'**
  String get drvDocRejectedReupload;

  /// No description provided for @drvDocUnderReview.
  ///
  /// In uz, this message translates to:
  /// **'Tekshirilmoqda'**
  String get drvDocUnderReview;

  /// No description provided for @drvDocVehicleRegistration.
  ///
  /// In uz, this message translates to:
  /// **'Texnik pasport'**
  String get drvDocVehicleRegistration;

  /// No description provided for @drvDocsExpiringSoon.
  ///
  /// In uz, this message translates to:
  /// **'Ba\'zi hujjatlarning muddati tugayapti. Ishingiz to\'xtab qolmasligi uchun oldindan yangilang.'**
  String get drvDocsExpiringSoon;

  /// No description provided for @drvDocsExpiringSoonShort.
  ///
  /// In uz, this message translates to:
  /// **'Ba\'zi hujjatlarning muddati tugayapti. Oldindan yangilab qo\'ying.'**
  String get drvDocsExpiringSoonShort;

  /// No description provided for @drvDriver.
  ///
  /// In uz, this message translates to:
  /// **'Haydovchi'**
  String get drvDriver;

  /// No description provided for @drvEarnings.
  ///
  /// In uz, this message translates to:
  /// **'Daromad'**
  String get drvEarnings;

  /// No description provided for @drvEditProfile.
  ///
  /// In uz, this message translates to:
  /// **'Ma\'lumotlarni tahrirlash'**
  String get drvEditProfile;

  /// No description provided for @drvEmergencyCall.
  ///
  /// In uz, this message translates to:
  /// **'Favqulodda chaqiruv (102/103)'**
  String get drvEmergencyCall;

  /// No description provided for @drvEmergencyHelp.
  ///
  /// In uz, this message translates to:
  /// **'Favqulodda yordam'**
  String get drvEmergencyHelp;

  /// No description provided for @drvEmergencySos.
  ///
  /// In uz, this message translates to:
  /// **'Favqulodda yordam (SOS)'**
  String get drvEmergencySos;

  /// No description provided for @drvEnable.
  ///
  /// In uz, this message translates to:
  /// **'Yoqish'**
  String get drvEnable;

  /// No description provided for @drvEnterCardOrPhone.
  ///
  /// In uz, this message translates to:
  /// **'Karta yoki telefon raqamini kiriting'**
  String get drvEnterCardOrPhone;

  /// No description provided for @drvEnterValidAmount.
  ///
  /// In uz, this message translates to:
  /// **'To\'g\'ri summa kiriting'**
  String get drvEnterValidAmount;

  /// No description provided for @drvErrorOccurred.
  ///
  /// In uz, this message translates to:
  /// **'Xatolik yuz berdi'**
  String get drvErrorOccurred;

  /// No description provided for @drvEstimatedEarnings.
  ///
  /// In uz, this message translates to:
  /// **'Taxminiy daromad'**
  String get drvEstimatedEarnings;

  /// No description provided for @drvEstimatedPrice.
  ///
  /// In uz, this message translates to:
  /// **'Taxminiy narx:'**
  String get drvEstimatedPrice;

  /// No description provided for @drvFindMyLocation.
  ///
  /// In uz, this message translates to:
  /// **'Joylashuvimni topish'**
  String get drvFindMyLocation;

  /// No description provided for @drvFitZones.
  ///
  /// In uz, this message translates to:
  /// **'Zonalarni ekranga sig\'dirish'**
  String get drvFitZones;

  /// No description provided for @drvForegroundChannel.
  ///
  /// In uz, this message translates to:
  /// **'Onlayn holat'**
  String get drvForegroundChannel;

  /// No description provided for @drvForegroundText.
  ///
  /// In uz, this message translates to:
  /// **'Buyurtma va safar uchun joylashuvingiz yuborilmoqda'**
  String get drvForegroundText;

  /// No description provided for @drvForegroundTitle.
  ///
  /// In uz, this message translates to:
  /// **'Angren Taxi — siz onlaynsiz'**
  String get drvForegroundTitle;

  /// No description provided for @drvFreeWait.
  ///
  /// In uz, this message translates to:
  /// **'Bepul kutish'**
  String get drvFreeWait;

  /// No description provided for @drvGallery.
  ///
  /// In uz, this message translates to:
  /// **'Galereya'**
  String get drvGallery;

  /// No description provided for @drvGoOffline.
  ///
  /// In uz, this message translates to:
  /// **'Offline bo\'lish'**
  String get drvGoOffline;

  /// No description provided for @drvGoOnline.
  ///
  /// In uz, this message translates to:
  /// **'Online bo\'lish'**
  String get drvGoOnline;

  /// No description provided for @drvGoOnlineBlocked.
  ///
  /// In uz, this message translates to:
  /// **'Onlayn bo\'lish yopiq'**
  String get drvGoOnlineBlocked;

  /// No description provided for @drvGoToNearestZone.
  ///
  /// In uz, this message translates to:
  /// **'Eng yaqin zonaga yo‘l olish'**
  String get drvGoToNearestZone;

  /// No description provided for @drvGoToNearestZoneSem.
  ///
  /// In uz, this message translates to:
  /// **'Eng yaqin talab zonasiga navigatsiyani ochish, {level}, {distance}'**
  String drvGoToNearestZoneSem(String level, String distance);

  /// No description provided for @drvGpsDisabled.
  ///
  /// In uz, this message translates to:
  /// **'Telefoningizda joylashuv (GPS) o\'chirilgan — xarita to\'g\'ri ishlashi uchun uni yoqing.'**
  String get drvGpsDisabled;

  /// No description provided for @drvHelp.
  ///
  /// In uz, this message translates to:
  /// **'Yordam'**
  String get drvHelp;

  /// No description provided for @drvHeroSemBonus.
  ///
  /// In uz, this message translates to:
  /// **'{name}: {threshold} tadan {count} ta bajarildi'**
  String drvHeroSemBonus(String name, int threshold, int count);

  /// No description provided for @drvHeroSemEarnings.
  ///
  /// In uz, this message translates to:
  /// **'Bugungi daromad {amount}'**
  String drvHeroSemEarnings(String amount);

  /// No description provided for @drvHeroSemOpenHistory.
  ///
  /// In uz, this message translates to:
  /// **'Daromad tarixini ochish'**
  String get drvHeroSemOpenHistory;

  /// No description provided for @drvItemsCount.
  ///
  /// In uz, this message translates to:
  /// **'{count} ta mahsulot'**
  String drvItemsCount(int count);

  /// No description provided for @drvLast30Days.
  ///
  /// In uz, this message translates to:
  /// **'So\'nggi 30 kun'**
  String get drvLast30Days;

  /// No description provided for @drvLast7Days.
  ///
  /// In uz, this message translates to:
  /// **'So\'nggi 7 kun'**
  String get drvLast7Days;

  /// No description provided for @drvLoading.
  ///
  /// In uz, this message translates to:
  /// **'Yuklanmoqda'**
  String get drvLoading;

  /// No description provided for @drvLocationDenied.
  ///
  /// In uz, this message translates to:
  /// **'Ilova joylashuvga ruxsat olmadi — xaritada aniq joyingizni ko\'rish uchun ruxsat bering.'**
  String get drvLocationDenied;

  /// No description provided for @drvLocationFailed.
  ///
  /// In uz, this message translates to:
  /// **'Joylashuvni aniqlab bo\'lmadi. Ochiq joyga o\'ting yoki qayta urinib ko\'ring.'**
  String get drvLocationFailed;

  /// No description provided for @drvLocationUnavailable.
  ///
  /// In uz, this message translates to:
  /// **'Joylashuvingiz aniqlanmadi. GPS yoqilganini va ilovaga ruxsat berilganini tekshiring.'**
  String get drvLocationUnavailable;

  /// No description provided for @drvLogout.
  ///
  /// In uz, this message translates to:
  /// **'Chiqish'**
  String get drvLogout;

  /// No description provided for @drvLogoutConfirmBody.
  ///
  /// In uz, this message translates to:
  /// **'Hisobdan chiqmoqchimisiz?'**
  String get drvLogoutConfirmBody;

  /// No description provided for @drvLogoutConfirmTitle.
  ///
  /// In uz, this message translates to:
  /// **'Chiqishni tasdiqlang'**
  String get drvLogoutConfirmTitle;

  /// No description provided for @drvLostItems.
  ///
  /// In uz, this message translates to:
  /// **'Yo\'qolgan buyumlar'**
  String get drvLostItems;

  /// No description provided for @drvMenu.
  ///
  /// In uz, this message translates to:
  /// **'Menyu'**
  String get drvMenu;

  /// No description provided for @drvMessage.
  ///
  /// In uz, this message translates to:
  /// **'Xabar'**
  String get drvMessage;

  /// No description provided for @drvMoreActions.
  ///
  /// In uz, this message translates to:
  /// **'Qo\'shimcha amallar'**
  String get drvMoreActions;

  /// No description provided for @drvNavAppNotFound.
  ///
  /// In uz, this message translates to:
  /// **'Navigatsiya ilovasi topilmadi'**
  String get drvNavAppNotFound;

  /// No description provided for @drvNeedsAttention.
  ///
  /// In uz, this message translates to:
  /// **'{count} ta e\'tibor talab qiladi'**
  String drvNeedsAttention(int count);

  /// No description provided for @drvNetEarnings.
  ///
  /// In uz, this message translates to:
  /// **'Sof daromad · {period}'**
  String drvNetEarnings(String period);

  /// No description provided for @drvNewCar.
  ///
  /// In uz, this message translates to:
  /// **'Yangi mashina'**
  String get drvNewCar;

  /// No description provided for @drvNewOrder.
  ///
  /// In uz, this message translates to:
  /// **'Yangi buyurtma!'**
  String get drvNewOrder;

  /// No description provided for @drvNoFundsToWithdraw.
  ///
  /// In uz, this message translates to:
  /// **'Yechish uchun mablag\' yo\'q'**
  String get drvNoFundsToWithdraw;

  /// No description provided for @drvNoKeepWaiting.
  ///
  /// In uz, this message translates to:
  /// **'Yo\'q, kutaman'**
  String get drvNoKeepWaiting;

  /// No description provided for @drvNoOrderHistory.
  ///
  /// In uz, this message translates to:
  /// **'Buyurtmalar tarixi yo\'q'**
  String get drvNoOrderHistory;

  /// No description provided for @drvNoRequestsYet.
  ///
  /// In uz, this message translates to:
  /// **'Hozircha so\'rovlar yo\'q'**
  String get drvNoRequestsYet;

  /// No description provided for @drvNoShowConfirm.
  ///
  /// In uz, this message translates to:
  /// **'Buyurtmani bekor qilmoqchimisiz?'**
  String get drvNoShowConfirm;

  /// No description provided for @drvNoShowConfirmWaited.
  ///
  /// In uz, this message translates to:
  /// **'{elapsed} kutdingiz. Buyurtmani bekor qilmoqchimisiz?'**
  String drvNoShowConfirmWaited(String elapsed);

  /// No description provided for @drvNoShowConfirmWaitedFee.
  ///
  /// In uz, this message translates to:
  /// **'{elapsed} kutdingiz, {fare} kutish haqi yig\'ildi. Buyurtmani bekor qilmoqchimisiz?'**
  String drvNoShowConfirmWaitedFee(String elapsed, String fare);

  /// No description provided for @drvNotUpdated.
  ///
  /// In uz, this message translates to:
  /// **'Yangilanmadi: {message}'**
  String drvNotUpdated(String message);

  /// No description provided for @drvNotUploaded.
  ///
  /// In uz, this message translates to:
  /// **'Yuklanmagan'**
  String get drvNotUploaded;

  /// No description provided for @drvNotifications.
  ///
  /// In uz, this message translates to:
  /// **'Bildirishnomalar'**
  String get drvNotifications;

  /// No description provided for @drvNotifyDispatchers.
  ///
  /// In uz, this message translates to:
  /// **'Dispetcherlarga xabar berish'**
  String get drvNotifyDispatchers;

  /// No description provided for @drvOfferNotificationChannel.
  ///
  /// In uz, this message translates to:
  /// **'Yangi buyurtmalar'**
  String get drvOfferNotificationChannel;

  /// No description provided for @drvOfferNotificationTitle.
  ///
  /// In uz, this message translates to:
  /// **'Yangi buyurtma'**
  String get drvOfferNotificationTitle;

  /// No description provided for @drvOffline.
  ///
  /// In uz, this message translates to:
  /// **'Offline'**
  String get drvOffline;

  /// No description provided for @drvOfflineLower.
  ///
  /// In uz, this message translates to:
  /// **'offline'**
  String get drvOfflineLower;

  /// No description provided for @drvOnline.
  ///
  /// In uz, this message translates to:
  /// **'Online'**
  String get drvOnline;

  /// No description provided for @drvOnlineLower.
  ///
  /// In uz, this message translates to:
  /// **'online'**
  String get drvOnlineLower;

  /// No description provided for @drvOpenNavigation.
  ///
  /// In uz, this message translates to:
  /// **'Navigatsiyani ochish'**
  String get drvOpenNavigation;

  /// No description provided for @drvOpenOrder.
  ///
  /// In uz, this message translates to:
  /// **'Buyurtmani ochish'**
  String get drvOpenOrder;

  /// No description provided for @drvOpenOrderSem.
  ///
  /// In uz, this message translates to:
  /// **'{type} buyurtmasini ochish'**
  String drvOpenOrderSem(String type);

  /// No description provided for @drvOpenVerification.
  ///
  /// In uz, this message translates to:
  /// **'Tekshiruvni ochish'**
  String get drvOpenVerification;

  /// No description provided for @drvOptional.
  ///
  /// In uz, this message translates to:
  /// **'Majburiy emas'**
  String get drvOptional;

  /// No description provided for @drvOrderDelivered.
  ///
  /// In uz, this message translates to:
  /// **'Buyurtma muvaffaqiyatli yetkazildi!'**
  String get drvOrderDelivered;

  /// No description provided for @drvOrderDetails.
  ///
  /// In uz, this message translates to:
  /// **'Buyurtma ma\'lumotlari'**
  String get drvOrderDetails;

  /// No description provided for @drvOrderHistory.
  ///
  /// In uz, this message translates to:
  /// **'Buyurtmalar tarixi'**
  String get drvOrderHistory;

  /// No description provided for @drvOrderInProgress.
  ///
  /// In uz, this message translates to:
  /// **'Buyurtma yetkazilmoqda'**
  String get drvOrderInProgress;

  /// No description provided for @drvOrderNotGiven.
  ///
  /// In uz, this message translates to:
  /// **'Buyurtma berilmadi'**
  String get drvOrderNotGiven;

  /// No description provided for @drvPaidOnline.
  ///
  /// In uz, this message translates to:
  /// **'Onlayn to\'langan — pul olmaysiz'**
  String get drvPaidOnline;

  /// No description provided for @drvParcel.
  ///
  /// In uz, this message translates to:
  /// **'Posilka'**
  String get drvParcel;

  /// No description provided for @drvParcelDelivered.
  ///
  /// In uz, this message translates to:
  /// **'Posilka topshirildi!'**
  String get drvParcelDelivered;

  /// No description provided for @drvParcelInProgress.
  ///
  /// In uz, this message translates to:
  /// **'Posilka yetkazilmoqda'**
  String get drvParcelInProgress;

  /// No description provided for @drvParcelNotGiven.
  ///
  /// In uz, this message translates to:
  /// **'Posilka berilmadi'**
  String get drvParcelNotGiven;

  /// No description provided for @drvParcelPickupPlace.
  ///
  /// In uz, this message translates to:
  /// **'Posilkani olish joyi'**
  String get drvParcelPickupPlace;

  /// No description provided for @drvParcelPinHint.
  ///
  /// In uz, this message translates to:
  /// **'4 xonali kod — yuboruvchi uni qabul qiluvchiga aytgan.'**
  String get drvParcelPinHint;

  /// No description provided for @drvParcelPinSubmit.
  ///
  /// In uz, this message translates to:
  /// **'Topshirish'**
  String get drvParcelPinSubmit;

  /// No description provided for @drvParcelPinTitle.
  ///
  /// In uz, this message translates to:
  /// **'Qabul qiluvchidan PIN kodni so\'rang'**
  String get drvParcelPinTitle;

  /// No description provided for @drvParcelRecipient.
  ///
  /// In uz, this message translates to:
  /// **'Qabul qiluvchi'**
  String get drvParcelRecipient;

  /// No description provided for @drvParcelSizeLarge.
  ///
  /// In uz, this message translates to:
  /// **'Katta'**
  String get drvParcelSizeLarge;

  /// No description provided for @drvParcelSizeMedium.
  ///
  /// In uz, this message translates to:
  /// **'O\'rta'**
  String get drvParcelSizeMedium;

  /// No description provided for @drvParcelSizeSmall.
  ///
  /// In uz, this message translates to:
  /// **'Kichik'**
  String get drvParcelSizeSmall;

  /// No description provided for @drvPassenger.
  ///
  /// In uz, this message translates to:
  /// **'Yo\'lovchi'**
  String get drvPassenger;

  /// No description provided for @drvPassengerNoShow.
  ///
  /// In uz, this message translates to:
  /// **'Yo\'lovchi kelmadi'**
  String get drvPassengerNoShow;

  /// No description provided for @drvPassengerRequested.
  ///
  /// In uz, this message translates to:
  /// **'Yo\'lovchi so\'ragan: {options}'**
  String drvPassengerRequested(String options);

  /// No description provided for @drvPayVendor.
  ///
  /// In uz, this message translates to:
  /// **'Do\'konga o\'zingiz to\'laysiz'**
  String get drvPayVendor;

  /// No description provided for @drvPayVendorHint.
  ///
  /// In uz, this message translates to:
  /// **'Tovarni olayotganda to\'lang — mijozdan yetkazish haqi bilan birga qaytarib olasiz.'**
  String get drvPayVendorHint;

  /// No description provided for @drvPayment.
  ///
  /// In uz, this message translates to:
  /// **'To\'lov'**
  String get drvPayment;

  /// No description provided for @drvPeriodEarningsSem.
  ///
  /// In uz, this message translates to:
  /// **'{period} daromadi'**
  String drvPeriodEarningsSem(String period);

  /// No description provided for @drvPeriodMonth.
  ///
  /// In uz, this message translates to:
  /// **'Oy'**
  String get drvPeriodMonth;

  /// No description provided for @drvPeriodWeek.
  ///
  /// In uz, this message translates to:
  /// **'Hafta'**
  String get drvPeriodWeek;

  /// No description provided for @drvPickupCargo.
  ///
  /// In uz, this message translates to:
  /// **'Yukni oling'**
  String get drvPickupCargo;

  /// No description provided for @drvPickupOrder.
  ///
  /// In uz, this message translates to:
  /// **'Buyurtmani oling'**
  String get drvPickupOrder;

  /// No description provided for @drvPickupParcel.
  ///
  /// In uz, this message translates to:
  /// **'Posilkani oling'**
  String get drvPickupParcel;

  /// No description provided for @drvPickupPassenger.
  ///
  /// In uz, this message translates to:
  /// **'Yo\'lovchini oling'**
  String get drvPickupPassenger;

  /// No description provided for @drvPickupPlace.
  ///
  /// In uz, this message translates to:
  /// **'Olish joyi'**
  String get drvPickupPlace;

  /// No description provided for @drvPlateHint.
  ///
  /// In uz, this message translates to:
  /// **'Masalan: 01 A 123 BC'**
  String get drvPlateHint;

  /// No description provided for @drvPlateNumber.
  ///
  /// In uz, this message translates to:
  /// **'Davlat raqami'**
  String get drvPlateNumber;

  /// No description provided for @drvPlateRequired.
  ///
  /// In uz, this message translates to:
  /// **'Davlat raqamini kiriting'**
  String get drvPlateRequired;

  /// No description provided for @drvPlatformCommission.
  ///
  /// In uz, this message translates to:
  /// **'Platforma komissiyasi'**
  String get drvPlatformCommission;

  /// No description provided for @drvPleaseRate.
  ///
  /// In uz, this message translates to:
  /// **'Iltimos, baho bering'**
  String get drvPleaseRate;

  /// No description provided for @drvProfileTitle.
  ///
  /// In uz, this message translates to:
  /// **'Profil'**
  String get drvProfileTitle;

  /// No description provided for @drvRateCommentHint.
  ///
  /// In uz, this message translates to:
  /// **'{client} haqida izoh...'**
  String drvRateCommentHint(String client);

  /// No description provided for @drvRateHowWas.
  ///
  /// In uz, this message translates to:
  /// **'{client} qanday edi?'**
  String drvRateHowWas(String client);

  /// No description provided for @drvRateStars.
  ///
  /// In uz, this message translates to:
  /// **'{count} yulduz'**
  String drvRateStars(int count);

  /// No description provided for @drvRating1.
  ///
  /// In uz, this message translates to:
  /// **'Juda yomon'**
  String get drvRating1;

  /// No description provided for @drvRating2.
  ///
  /// In uz, this message translates to:
  /// **'Yomon'**
  String get drvRating2;

  /// No description provided for @drvRating3.
  ///
  /// In uz, this message translates to:
  /// **'Oddiy'**
  String get drvRating3;

  /// No description provided for @drvRating4.
  ///
  /// In uz, this message translates to:
  /// **'Yaxshi'**
  String get drvRating4;

  /// No description provided for @drvRating5.
  ///
  /// In uz, this message translates to:
  /// **'Ajoyib!'**
  String get drvRating5;

  /// No description provided for @drvRatingPick.
  ///
  /// In uz, this message translates to:
  /// **'Yulduz tanlang'**
  String get drvRatingPick;

  /// No description provided for @drvRatingStarsSem.
  ///
  /// In uz, this message translates to:
  /// **'{rating} yulduz reyting'**
  String drvRatingStarsSem(String rating);

  /// No description provided for @drvRatingValue.
  ///
  /// In uz, this message translates to:
  /// **'{rating} reyting'**
  String drvRatingValue(String rating);

  /// No description provided for @drvRatingsCount.
  ///
  /// In uz, this message translates to:
  /// **'{count} ta baholash'**
  String drvRatingsCount(int count);

  /// No description provided for @drvReadyBattery.
  ///
  /// In uz, this message translates to:
  /// **'Batareya cheklovisiz'**
  String get drvReadyBattery;

  /// No description provided for @drvReadyBatteryWhy.
  ///
  /// In uz, this message translates to:
  /// **'Telefon ilovani fonda o\'chirib qo\'ymasligi uchun. Sozlamalarda: Batareya → Cheklovsiz.'**
  String get drvReadyBatteryWhy;

  /// No description provided for @drvReadyDone.
  ///
  /// In uz, this message translates to:
  /// **'Bajarildi'**
  String get drvReadyDone;

  /// No description provided for @drvReadyEnable.
  ///
  /// In uz, this message translates to:
  /// **'Yoqish'**
  String get drvReadyEnable;

  /// No description provided for @drvReadyGoOnline.
  ///
  /// In uz, this message translates to:
  /// **'Onlayn bo\'lish'**
  String get drvReadyGoOnline;

  /// No description provided for @drvReadyGps.
  ///
  /// In uz, this message translates to:
  /// **'GPS yoqilgan'**
  String get drvReadyGps;

  /// No description provided for @drvReadyGpsWhy.
  ///
  /// In uz, this message translates to:
  /// **'Telefon joylashuvingizni aniqlay olishi uchun.'**
  String get drvReadyGpsWhy;

  /// No description provided for @drvReadyGrant.
  ///
  /// In uz, this message translates to:
  /// **'Ruxsat berish'**
  String get drvReadyGrant;

  /// No description provided for @drvReadyLocation.
  ///
  /// In uz, this message translates to:
  /// **'Joylashuv ruxsati'**
  String get drvReadyLocation;

  /// No description provided for @drvReadyLocationWhy.
  ///
  /// In uz, this message translates to:
  /// **'Yaqin buyurtmalarni olish va yo\'lovchiga qayerdaligingizni ko\'rsatish uchun.'**
  String get drvReadyLocationWhy;

  /// No description provided for @drvReadyMissing.
  ///
  /// In uz, this message translates to:
  /// **'Bajarilmagan'**
  String get drvReadyMissing;

  /// No description provided for @drvReadyNotifications.
  ///
  /// In uz, this message translates to:
  /// **'Bildirishnomalar'**
  String get drvReadyNotifications;

  /// No description provided for @drvReadyNotificationsWhy.
  ///
  /// In uz, this message translates to:
  /// **'Ilova fonda ishlayotganini ko\'rsatish va yangi buyurtma haqida xabar berish uchun.'**
  String get drvReadyNotificationsWhy;

  /// No description provided for @drvReadyOpenSettings.
  ///
  /// In uz, this message translates to:
  /// **'Sozlamalar'**
  String get drvReadyOpenSettings;

  /// No description provided for @drvReadyOverlay.
  ///
  /// In uz, this message translates to:
  /// **'Boshqa ilovalar ustida ko\'rsatish'**
  String get drvReadyOverlay;

  /// No description provided for @drvReadyOverlayWhy.
  ///
  /// In uz, this message translates to:
  /// **'Ilovadan chiqib ketganingizda zakaz kelsa, ilova o\'zi ochiladi. Ekran chetida kichik tugma turadi — bosib qaytasiz.'**
  String get drvReadyOverlayWhy;

  /// No description provided for @drvReadyOverlayXiaomi.
  ///
  /// In uz, this message translates to:
  /// **'Xiaomi/Redmi: Sozlamalar → Ilovalar → Angren Taxi Driver → Boshqa ruxsatlar → «Fonda ishlayotganda qalqib chiquvchi oynalarni ko\'rsatish» ni ham yoqing.'**
  String get drvReadyOverlayXiaomi;

  /// No description provided for @drvReadyPrecise.
  ///
  /// In uz, this message translates to:
  /// **'Aniq joylashuv'**
  String get drvReadyPrecise;

  /// No description provided for @drvReadyPreciseWhy.
  ///
  /// In uz, this message translates to:
  /// **'Taksometr va «yetib keldim» tekshiruvi uchun. «Taxminiy» joylashuv taxminan 1 km xato beradi.'**
  String get drvReadyPreciseWhy;

  /// No description provided for @drvReadyRecommended.
  ///
  /// In uz, this message translates to:
  /// **'Tavsiya'**
  String get drvReadyRecommended;

  /// No description provided for @drvReadySubtitle.
  ///
  /// In uz, this message translates to:
  /// **'Buyurtma olish uchun quyidagilar kerak. Belgilanganlarsiz onlayn bo\'lib bo\'lmaydi.'**
  String get drvReadySubtitle;

  /// No description provided for @drvReadyTitle.
  ///
  /// In uz, this message translates to:
  /// **'Ishga tayyorlik'**
  String get drvReadyTitle;

  /// No description provided for @drvReason.
  ///
  /// In uz, this message translates to:
  /// **'Sabab: {reason}'**
  String drvReason(String reason);

  /// No description provided for @drvRefreshDemand.
  ///
  /// In uz, this message translates to:
  /// **'Talab maʼlumotini yangilash'**
  String get drvRefreshDemand;

  /// No description provided for @drvRefreshing.
  ///
  /// In uz, this message translates to:
  /// **'Yangilanmoqda…'**
  String get drvRefreshing;

  /// No description provided for @drvRequestApproved.
  ///
  /// In uz, this message translates to:
  /// **'Tasdiqlandi — profil yangilandi'**
  String get drvRequestApproved;

  /// No description provided for @drvRequestPending.
  ///
  /// In uz, this message translates to:
  /// **'So\'rov ko\'rib chiqilmoqda'**
  String get drvRequestPending;

  /// No description provided for @drvRequestRejected.
  ///
  /// In uz, this message translates to:
  /// **'Rad etildi'**
  String get drvRequestRejected;

  /// No description provided for @drvRequirementsNeeded.
  ///
  /// In uz, this message translates to:
  /// **'Kerak: {items}'**
  String drvRequirementsNeeded(String items);

  /// No description provided for @drvRestaurant.
  ///
  /// In uz, this message translates to:
  /// **'Restoran'**
  String get drvRestaurant;

  /// No description provided for @drvRetry.
  ///
  /// In uz, this message translates to:
  /// **'Qayta urinish'**
  String get drvRetry;

  /// No description provided for @drvReupload.
  ///
  /// In uz, this message translates to:
  /// **'Qayta yuklash'**
  String get drvReupload;

  /// No description provided for @drvRouteToCargo.
  ///
  /// In uz, this message translates to:
  /// **'Yukka yo\'l'**
  String get drvRouteToCargo;

  /// No description provided for @drvRouteToParcel.
  ///
  /// In uz, this message translates to:
  /// **'Posilkaga yo\'l'**
  String get drvRouteToParcel;

  /// No description provided for @drvRouteToPassenger.
  ///
  /// In uz, this message translates to:
  /// **'Yo\'lovchiga yo\'l'**
  String get drvRouteToPassenger;

  /// No description provided for @drvRouteToRestaurant.
  ///
  /// In uz, this message translates to:
  /// **'Restoranga yo\'l'**
  String get drvRouteToRestaurant;

  /// No description provided for @drvRouteToShop.
  ///
  /// In uz, this message translates to:
  /// **'Do\'konga yo\'l'**
  String get drvRouteToShop;

  /// No description provided for @drvSafetyNote.
  ///
  /// In uz, this message translates to:
  /// **'Xavfsizligingiz biz uchun muhim. Kerak bo\'lsa, quyidagi tugmalardan birini bosing.'**
  String get drvSafetyNote;

  /// No description provided for @drvSave.
  ///
  /// In uz, this message translates to:
  /// **'Saqlash'**
  String get drvSave;

  /// No description provided for @drvSaved.
  ///
  /// In uz, this message translates to:
  /// **'Saqlandi'**
  String get drvSaved;

  /// No description provided for @drvSecondsToAccept.
  ///
  /// In uz, this message translates to:
  /// **'Qabul qilish uchun {seconds} soniya qoldi'**
  String drvSecondsToAccept(int seconds);

  /// No description provided for @drvSeller.
  ///
  /// In uz, this message translates to:
  /// **'Sotuvchi'**
  String get drvSeller;

  /// No description provided for @drvSend.
  ///
  /// In uz, this message translates to:
  /// **'Yuborish'**
  String get drvSend;

  /// No description provided for @drvSendRequest.
  ///
  /// In uz, this message translates to:
  /// **'So\'rov yuborish'**
  String get drvSendRequest;

  /// No description provided for @drvServiceBlockedDefault.
  ///
  /// In uz, this message translates to:
  /// **'Bu turni yoqish uchun tekshiruv talablari bajarilishi kerak.'**
  String get drvServiceBlockedDefault;

  /// No description provided for @drvServiceChipOff.
  ///
  /// In uz, this message translates to:
  /// **'{label}, o\'chirilgan. Xizmat turlarini ochish'**
  String drvServiceChipOff(String label);

  /// No description provided for @drvServiceChipOn.
  ///
  /// In uz, this message translates to:
  /// **'{label}, yoqilgan. Xizmat turlarini ochish'**
  String drvServiceChipOn(String label);

  /// No description provided for @drvServiceChipUnavailable.
  ///
  /// In uz, this message translates to:
  /// **'{label}, mavjud emas. Xizmat turlarini ochish'**
  String drvServiceChipUnavailable(String label);

  /// No description provided for @drvServiceChipUnavailableReason.
  ///
  /// In uz, this message translates to:
  /// **'{label}, mavjud emas: {reason}. Xizmat turlarini ochish'**
  String drvServiceChipUnavailableReason(String label, String reason);

  /// No description provided for @drvServicesEmptyMessage.
  ///
  /// In uz, this message translates to:
  /// **'Hozircha sizga hech qanday xizmat turi taklif qilinmayapti. Yangisi paydo bo\'lsa shu yerda ko\'rinadi.'**
  String get drvServicesEmptyMessage;

  /// No description provided for @drvServicesEmptySelection.
  ///
  /// In uz, this message translates to:
  /// **'Kamida bitta xizmat turi yoqilgan bo\'lishi kerak — aks holda sizga buyurtma kelmaydi.'**
  String get drvServicesEmptySelection;

  /// No description provided for @drvServicesEmptyTitle.
  ///
  /// In uz, this message translates to:
  /// **'Xizmat turi yo\'q'**
  String get drvServicesEmptyTitle;

  /// No description provided for @drvServicesHeading.
  ///
  /// In uz, this message translates to:
  /// **'Qaysi buyurtmalarni olasiz'**
  String get drvServicesHeading;

  /// No description provided for @drvServicesSaved.
  ///
  /// In uz, this message translates to:
  /// **'Xizmat turlari saqlandi'**
  String get drvServicesSaved;

  /// No description provided for @drvServicesSubtitle.
  ///
  /// In uz, this message translates to:
  /// **'Faqat yoqilgan turlar bo\'yicha buyurtma keladi. Talablari bajarilmagan turni yoqib bo\'lmaydi.'**
  String get drvServicesSubtitle;

  /// No description provided for @drvServicesTitle.
  ///
  /// In uz, this message translates to:
  /// **'Xizmat turlari'**
  String get drvServicesTitle;

  /// No description provided for @drvSettings.
  ///
  /// In uz, this message translates to:
  /// **'Sozlamalar'**
  String get drvSettings;

  /// No description provided for @drvShop.
  ///
  /// In uz, this message translates to:
  /// **'Do\'kon'**
  String get drvShop;

  /// No description provided for @drvSkip.
  ///
  /// In uz, this message translates to:
  /// **'O\'tkazib yuborish'**
  String get drvSkip;

  /// No description provided for @drvSom.
  ///
  /// In uz, this message translates to:
  /// **'so\'m'**
  String get drvSom;

  /// No description provided for @drvSosSem.
  ///
  /// In uz, this message translates to:
  /// **'SOS — favqulodda yordam'**
  String get drvSosSem;

  /// No description provided for @drvStartDelivery.
  ///
  /// In uz, this message translates to:
  /// **'Yetkazishni boshlash'**
  String get drvStartDelivery;

  /// No description provided for @drvStartTrip.
  ///
  /// In uz, this message translates to:
  /// **'Safarni boshlash'**
  String get drvStartTrip;

  /// No description provided for @drvSubmitApplication.
  ///
  /// In uz, this message translates to:
  /// **'Arizani yuborish'**
  String get drvSubmitApplication;

  /// No description provided for @drvToday.
  ///
  /// In uz, this message translates to:
  /// **'Bugun'**
  String get drvToday;

  /// No description provided for @drvTodayEarnings.
  ///
  /// In uz, this message translates to:
  /// **'Bugungi daromad'**
  String get drvTodayEarnings;

  /// No description provided for @drvTotalTrips.
  ///
  /// In uz, this message translates to:
  /// **'Jami safarlar'**
  String get drvTotalTrips;

  /// No description provided for @drvTripCompleted.
  ///
  /// In uz, this message translates to:
  /// **'Safar muvaffaqiyatli yakunlandi!'**
  String get drvTripCompleted;

  /// No description provided for @drvTripInProgress.
  ///
  /// In uz, this message translates to:
  /// **'Safar davom etmoqda'**
  String get drvTripInProgress;

  /// No description provided for @drvTripsCount.
  ///
  /// In uz, this message translates to:
  /// **'{count} ta safar'**
  String drvTripsCount(int count);

  /// No description provided for @drvTripsGross.
  ///
  /// In uz, this message translates to:
  /// **'Safarlardan jami'**
  String get drvTripsGross;

  /// No description provided for @drvTypeCargo.
  ///
  /// In uz, this message translates to:
  /// **'Yuk tashish'**
  String get drvTypeCargo;

  /// No description provided for @drvTypeFood.
  ///
  /// In uz, this message translates to:
  /// **'Ovqat yetkazish'**
  String get drvTypeFood;

  /// No description provided for @drvTypeMarket.
  ///
  /// In uz, this message translates to:
  /// **'Market yetkazish'**
  String get drvTypeMarket;

  /// No description provided for @drvTypeParcel.
  ///
  /// In uz, this message translates to:
  /// **'Posilka'**
  String get drvTypeParcel;

  /// No description provided for @drvTypeTaxi.
  ///
  /// In uz, this message translates to:
  /// **'Taksi'**
  String get drvTypeTaxi;

  /// No description provided for @drvUpdatedAt.
  ///
  /// In uz, this message translates to:
  /// **'Yangilandi: {time}'**
  String drvUpdatedAt(String time);

  /// No description provided for @drvUpload.
  ///
  /// In uz, this message translates to:
  /// **'Yuklash'**
  String get drvUpload;

  /// No description provided for @drvUploadDocuments.
  ///
  /// In uz, this message translates to:
  /// **'Hujjatlarni yuklang'**
  String get drvUploadDocuments;

  /// No description provided for @drvUploadDocumentsHint.
  ///
  /// In uz, this message translates to:
  /// **'Tasdiqlash tezroq bo\'lishi uchun quyidagi hujjatlarning aniq suratlarini yuklang.'**
  String get drvUploadDocumentsHint;

  /// No description provided for @drvUploadError.
  ///
  /// In uz, this message translates to:
  /// **'Yuklashda xatolik'**
  String get drvUploadError;

  /// No description provided for @drvUploadNew.
  ///
  /// In uz, this message translates to:
  /// **'Yangisini yuklash'**
  String get drvUploadNew;

  /// No description provided for @drvUploadingPercent.
  ///
  /// In uz, this message translates to:
  /// **'Yuklanmoqda... {percent}%'**
  String drvUploadingPercent(String percent);

  /// No description provided for @drvUploadingPercentSem.
  ///
  /// In uz, this message translates to:
  /// **'Yuklanmoqda, {percent} foiz'**
  String drvUploadingPercentSem(String percent);

  /// No description provided for @drvVehicleChangeNote.
  ///
  /// In uz, this message translates to:
  /// **'Menejer tasdiqlaguncha profilingizda hozirgi mashina qoladi. Yangi mashina fotolarini tekshiruv bo\'limidan so\'rashlari mumkin.'**
  String get drvVehicleChangeNote;

  /// No description provided for @drvVehicleChangeTitle.
  ///
  /// In uz, this message translates to:
  /// **'Mashinani almashtirish'**
  String get drvVehicleChangeTitle;

  /// No description provided for @drvVehicleRequestSent.
  ///
  /// In uz, this message translates to:
  /// **'So\'rov yuborildi — menejer tekshiradi'**
  String get drvVehicleRequestSent;

  /// No description provided for @drvVendorPaidAction.
  ///
  /// In uz, this message translates to:
  /// **'Do\'konga {amount} to\'ladim'**
  String drvVendorPaidAction(String amount);

  /// No description provided for @drvVendorPaidDone.
  ///
  /// In uz, this message translates to:
  /// **'Do\'konga to\'landi'**
  String get drvVendorPaidDone;

  /// No description provided for @drvVendorPayFirst.
  ///
  /// In uz, this message translates to:
  /// **'Avval do\'konga to\'lang va tasdiqlang'**
  String get drvVendorPayFirst;

  /// No description provided for @drvVerificationEmptyMessage.
  ///
  /// In uz, this message translates to:
  /// **'Hozircha sizdan hech qanday hujjat yoki surat talab qilinmayapti. Yangi talab paydo bo\'lsa shu yerda ko\'rinadi.'**
  String get drvVerificationEmptyMessage;

  /// No description provided for @drvVerificationEmptyTitle.
  ///
  /// In uz, this message translates to:
  /// **'Talab yo\'q'**
  String get drvVerificationEmptyTitle;

  /// No description provided for @drvVerificationIncomplete.
  ///
  /// In uz, this message translates to:
  /// **'Tekshiruv to\'liq emas — quyidagi talablarni bajaring.'**
  String get drvVerificationIncomplete;

  /// No description provided for @drvVerificationIncompleteShort.
  ///
  /// In uz, this message translates to:
  /// **'Tekshiruv to\'liq emas — talablarni bajaring.'**
  String get drvVerificationIncompleteShort;

  /// No description provided for @drvVerificationTitle.
  ///
  /// In uz, this message translates to:
  /// **'Tekshiruv'**
  String get drvVerificationTitle;

  /// No description provided for @drvView.
  ///
  /// In uz, this message translates to:
  /// **'Ko\'rish'**
  String get drvView;

  /// No description provided for @drvWaitBillingCaption.
  ///
  /// In uz, this message translates to:
  /// **'Jami {elapsed} · {perMinute}/daqiqa'**
  String drvWaitBillingCaption(String elapsed, String perMinute);

  /// No description provided for @drvWaitBillingSem.
  ///
  /// In uz, this message translates to:
  /// **'Kutish haqi {fare}, jami {elapsed} kutildi'**
  String drvWaitBillingSem(String fare, String elapsed);

  /// No description provided for @drvWaitFee.
  ///
  /// In uz, this message translates to:
  /// **'Kutish haqi'**
  String get drvWaitFee;

  /// No description provided for @drvWaitFreeCaption.
  ///
  /// In uz, this message translates to:
  /// **'Keyin {perMinute}/daqiqa'**
  String drvWaitFreeCaption(String perMinute);

  /// No description provided for @drvWaitFreeSem.
  ///
  /// In uz, this message translates to:
  /// **'Bepul kutish tugashiga {remaining} qoldi, keyin {perMinute} har daqiqa uchun'**
  String drvWaitFreeSem(String remaining, String perMinute);

  /// No description provided for @drvWallet.
  ///
  /// In uz, this message translates to:
  /// **'Hamyon'**
  String get drvWallet;

  /// No description provided for @drvWalletAmount.
  ///
  /// In uz, this message translates to:
  /// **'Hamyon: {amount}'**
  String drvWalletAmount(String amount);

  /// No description provided for @drvWeekAmount.
  ///
  /// In uz, this message translates to:
  /// **'Hafta: {amount}'**
  String drvWeekAmount(String amount);

  /// No description provided for @drvWhereMoreOrders.
  ///
  /// In uz, this message translates to:
  /// **'Qayerda buyurtma ko\'p'**
  String get drvWhereMoreOrders;

  /// No description provided for @drvWithdraw.
  ///
  /// In uz, this message translates to:
  /// **'Pul yechish'**
  String get drvWithdraw;

  /// No description provided for @drvWithdrawApproved.
  ///
  /// In uz, this message translates to:
  /// **'Tasdiqlandi'**
  String get drvWithdrawApproved;

  /// No description provided for @drvWithdrawPaid.
  ///
  /// In uz, this message translates to:
  /// **'To\'landi'**
  String get drvWithdrawPaid;

  /// No description provided for @drvWithdrawPending.
  ///
  /// In uz, this message translates to:
  /// **'Kutilmoqda'**
  String get drvWithdrawPending;

  /// No description provided for @drvWithdrawRequests.
  ///
  /// In uz, this message translates to:
  /// **'Pul yechish so\'rovlari'**
  String get drvWithdrawRequests;

  /// No description provided for @drvYesCancel.
  ///
  /// In uz, this message translates to:
  /// **'Ha, bekor qilaman'**
  String get drvYesCancel;

  /// No description provided for @drvYouKeep.
  ///
  /// In uz, this message translates to:
  /// **'Qo\'lingizga qoladi'**
  String get drvYouKeep;

  /// No description provided for @drvZonesCount.
  ///
  /// In uz, this message translates to:
  /// **'{count} zona'**
  String drvZonesCount(int count);

  /// No description provided for @fmtCurrencySom.
  ///
  /// In uz, this message translates to:
  /// **'{amount} so\'m'**
  String fmtCurrencySom(String amount);

  /// No description provided for @fmtDaysAgo.
  ///
  /// In uz, this message translates to:
  /// **'{days} kun oldin'**
  String fmtDaysAgo(int days);

  /// No description provided for @fmtHours.
  ///
  /// In uz, this message translates to:
  /// **'{hours} soat'**
  String fmtHours(int hours);

  /// No description provided for @fmtHoursAgo.
  ///
  /// In uz, this message translates to:
  /// **'{hours} soat oldin'**
  String fmtHoursAgo(int hours);

  /// No description provided for @fmtHoursMinutes.
  ///
  /// In uz, this message translates to:
  /// **'{hours} soat {minutes} daqiqa'**
  String fmtHoursMinutes(int hours, int minutes);

  /// No description provided for @fmtJustNow.
  ///
  /// In uz, this message translates to:
  /// **'Hozirgina'**
  String get fmtJustNow;

  /// No description provided for @fmtMillionUzs.
  ///
  /// In uz, this message translates to:
  /// **'{value} mln UZS'**
  String fmtMillionUzs(String value);

  /// No description provided for @fmtMinutes.
  ///
  /// In uz, this message translates to:
  /// **'{minutes} daqiqa'**
  String fmtMinutes(int minutes);

  /// No description provided for @fmtMinutesAgo.
  ///
  /// In uz, this message translates to:
  /// **'{minutes} daqiqa oldin'**
  String fmtMinutesAgo(int minutes);

  /// No description provided for @fmtMonthsShort.
  ///
  /// In uz, this message translates to:
  /// **'yan,fev,mar,apr,may,iyn,iyl,avg,sen,okt,noy,dek'**
  String get fmtMonthsShort;

  /// No description provided for @fmtThousandUzs.
  ///
  /// In uz, this message translates to:
  /// **'{value} ming UZS'**
  String fmtThousandUzs(String value);

  /// No description provided for @fmtToday.
  ///
  /// In uz, this message translates to:
  /// **'Bugun'**
  String get fmtToday;

  /// No description provided for @fmtTodayAt.
  ///
  /// In uz, this message translates to:
  /// **'Bugun, {time}'**
  String fmtTodayAt(String time);

  /// No description provided for @fmtTomorrow.
  ///
  /// In uz, this message translates to:
  /// **'Ertaga'**
  String get fmtTomorrow;

  /// No description provided for @fmtYesterdayAt.
  ///
  /// In uz, this message translates to:
  /// **'Kecha, {time}'**
  String fmtYesterdayAt(String time);

  /// No description provided for @languageRussian.
  ///
  /// In uz, this message translates to:
  /// **'Русский'**
  String get languageRussian;

  /// No description provided for @languageUzbek.
  ///
  /// In uz, this message translates to:
  /// **'O\'zbekcha'**
  String get languageUzbek;

  /// No description provided for @paxAbout.
  ///
  /// In uz, this message translates to:
  /// **'Dastur haqida'**
  String get paxAbout;

  /// No description provided for @paxAddFavorite.
  ///
  /// In uz, this message translates to:
  /// **'Qo\'shish'**
  String get paxAddFavorite;

  /// No description provided for @paxAddStop.
  ///
  /// In uz, this message translates to:
  /// **'To\'xtash qo\'shish'**
  String get paxAddStop;

  /// No description provided for @paxAddressNotFound.
  ///
  /// In uz, this message translates to:
  /// **'Manzilni topib bo\'lmadi'**
  String get paxAddressNotFound;

  /// No description provided for @paxAddressResolveFailed.
  ///
  /// In uz, this message translates to:
  /// **'Manzilni aniqlab bo\'lmadi'**
  String get paxAddressResolveFailed;

  /// No description provided for @paxApproxDistance.
  ///
  /// In uz, this message translates to:
  /// **'taxminan {distance}'**
  String paxApproxDistance(String distance);

  /// No description provided for @paxBack.
  ///
  /// In uz, this message translates to:
  /// **'Orqaga'**
  String get paxBack;

  /// No description provided for @paxCall.
  ///
  /// In uz, this message translates to:
  /// **'Qo\'ng\'iroq'**
  String get paxCall;

  /// No description provided for @paxCallFailed.
  ///
  /// In uz, this message translates to:
  /// **'Qo\'ng\'iroq qilib bo\'lmadi'**
  String get paxCallFailed;

  /// No description provided for @paxCancel.
  ///
  /// In uz, this message translates to:
  /// **'Bekor qilish'**
  String get paxCancel;

  /// No description provided for @paxCancelConfirmYes.
  ///
  /// In uz, this message translates to:
  /// **'Ha, bekor qilish'**
  String get paxCancelConfirmYes;

  /// No description provided for @paxCancelFailed.
  ///
  /// In uz, this message translates to:
  /// **'Bekor qilib bo\'lmadi'**
  String get paxCancelFailed;

  /// No description provided for @paxCancelReasonChangedMind.
  ///
  /// In uz, this message translates to:
  /// **'Fikrimni o\'zgartirdim'**
  String get paxCancelReasonChangedMind;

  /// No description provided for @paxCancelReasonHint.
  ///
  /// In uz, this message translates to:
  /// **'Sababni yozing...'**
  String get paxCancelReasonHint;

  /// No description provided for @paxCancelReasonLongWait.
  ///
  /// In uz, this message translates to:
  /// **'Juda uzoq kutdim'**
  String get paxCancelReasonLongWait;

  /// No description provided for @paxCancelReasonOther.
  ///
  /// In uz, this message translates to:
  /// **'Boshqa sabab'**
  String get paxCancelReasonOther;

  /// No description provided for @paxCancelReasonPrompt.
  ///
  /// In uz, this message translates to:
  /// **'Buyurtmani bekor qilish sababini tanlang:'**
  String get paxCancelReasonPrompt;

  /// No description provided for @paxCancelReasonTitle.
  ///
  /// In uz, this message translates to:
  /// **'Bekor qilish sababi'**
  String get paxCancelReasonTitle;

  /// No description provided for @paxCancelReasonTooExpensive.
  ///
  /// In uz, this message translates to:
  /// **'Narx juda qimmat'**
  String get paxCancelReasonTooExpensive;

  /// No description provided for @paxCancelScheduleBody.
  ///
  /// In uz, this message translates to:
  /// **'{when} ga rejalashtirilgan safar bekor qilinsinmi?'**
  String paxCancelScheduleBody(String when);

  /// No description provided for @paxCancelScheduleTitle.
  ///
  /// In uz, this message translates to:
  /// **'Rejani bekor qilish'**
  String get paxCancelScheduleTitle;

  /// No description provided for @paxCardPaymentStartFailed.
  ///
  /// In uz, this message translates to:
  /// **'To\'lovni hozir boshlab bo\'lmadi: {error}. Buyurtma qabul qilindi, safar oxirida to\'lov amalga oshiriladi.'**
  String paxCardPaymentStartFailed(String error);

  /// No description provided for @paxClear.
  ///
  /// In uz, this message translates to:
  /// **'Tozalash'**
  String get paxClear;

  /// No description provided for @paxClose.
  ///
  /// In uz, this message translates to:
  /// **'Yopish'**
  String get paxClose;

  /// No description provided for @paxCoverageWarning.
  ///
  /// In uz, this message translates to:
  /// **'Bu hududda hozircha xizmat ko\'rsatilmaymiz. Eng yaqin xizmat hududi: {area}.'**
  String paxCoverageWarning(String area);

  /// No description provided for @paxCurrentLocation.
  ///
  /// In uz, this message translates to:
  /// **'Joriy joylashuv'**
  String get paxCurrentLocation;

  /// No description provided for @paxDestination.
  ///
  /// In uz, this message translates to:
  /// **'Manzil'**
  String get paxDestination;

  /// No description provided for @paxDetailCar.
  ///
  /// In uz, this message translates to:
  /// **'Mashina'**
  String get paxDetailCar;

  /// No description provided for @paxDetailDate.
  ///
  /// In uz, this message translates to:
  /// **'Sana'**
  String get paxDetailDate;

  /// No description provided for @paxDetailDistance.
  ///
  /// In uz, this message translates to:
  /// **'Masofa'**
  String get paxDetailDistance;

  /// No description provided for @paxDetailDriver.
  ///
  /// In uz, this message translates to:
  /// **'Haydovchi'**
  String get paxDetailDriver;

  /// No description provided for @paxDetailDuration.
  ///
  /// In uz, this message translates to:
  /// **'Vaqt'**
  String get paxDetailDuration;

  /// No description provided for @paxDetailFrom.
  ///
  /// In uz, this message translates to:
  /// **'Chiqish'**
  String get paxDetailFrom;

  /// No description provided for @paxDetailPrice.
  ///
  /// In uz, this message translates to:
  /// **'Narx'**
  String get paxDetailPrice;

  /// No description provided for @paxDetailStatus.
  ///
  /// In uz, this message translates to:
  /// **'Holat'**
  String get paxDetailStatus;

  /// No description provided for @paxDone.
  ///
  /// In uz, this message translates to:
  /// **'Tayyor'**
  String get paxDone;

  /// No description provided for @paxDriverAlmostThere.
  ///
  /// In uz, this message translates to:
  /// **'Haydovchi deyarli yetib keldi'**
  String get paxDriverAlmostThere;

  /// No description provided for @paxDriverEta.
  ///
  /// In uz, this message translates to:
  /// **'Haydovchi {minutes} daqiqada yetib keladi'**
  String paxDriverEta(int minutes);

  /// No description provided for @paxEditProfile.
  ///
  /// In uz, this message translates to:
  /// **'Ma\'lumotlarni tahrirlash'**
  String get paxEditProfile;

  /// No description provided for @paxEnterAddress.
  ///
  /// In uz, this message translates to:
  /// **'Manzilni kiriting'**
  String get paxEnterAddress;

  /// No description provided for @paxExtras.
  ///
  /// In uz, this message translates to:
  /// **'Qo\'shimcha'**
  String get paxExtras;

  /// No description provided for @paxExtrasCount.
  ///
  /// In uz, this message translates to:
  /// **'Qo\'shimcha · {count}'**
  String paxExtrasCount(int count);

  /// No description provided for @paxExtrasListSemantics.
  ///
  /// In uz, this message translates to:
  /// **'Qo\'shimcha talablar: {options}'**
  String paxExtrasListSemantics(String options);

  /// No description provided for @paxExtrasNoneSemantics.
  ///
  /// In uz, this message translates to:
  /// **'Qo\'shimcha talablar: yo\'q'**
  String get paxExtrasNoneSemantics;

  /// No description provided for @paxFavoriteHome.
  ///
  /// In uz, this message translates to:
  /// **'Uy'**
  String get paxFavoriteHome;

  /// No description provided for @paxFavoriteNameHint.
  ///
  /// In uz, this message translates to:
  /// **'Nomi (masalan, Bozor)'**
  String get paxFavoriteNameHint;

  /// No description provided for @paxFavoriteWork.
  ///
  /// In uz, this message translates to:
  /// **'Ish'**
  String get paxFavoriteWork;

  /// No description provided for @paxFirstName.
  ///
  /// In uz, this message translates to:
  /// **'Ism'**
  String get paxFirstName;

  /// No description provided for @paxFirstNameHint.
  ///
  /// In uz, this message translates to:
  /// **'Ismingiz'**
  String get paxFirstNameHint;

  /// No description provided for @paxFrom.
  ///
  /// In uz, this message translates to:
  /// **'Qayerdan'**
  String get paxFrom;

  /// No description provided for @paxFromChangeSemantics.
  ///
  /// In uz, this message translates to:
  /// **'Qayerdan: {address}. O\'zgartirish'**
  String paxFromChangeSemantics(String address);

  /// No description provided for @paxGenericError.
  ///
  /// In uz, this message translates to:
  /// **'Xatolik yuz berdi'**
  String get paxGenericError;

  /// No description provided for @paxHasScheduledTrip.
  ///
  /// In uz, this message translates to:
  /// **'Rejalashtirilgan safar bor'**
  String get paxHasScheduledTrip;

  /// No description provided for @paxHelp.
  ///
  /// In uz, this message translates to:
  /// **'Yordam'**
  String get paxHelp;

  /// No description provided for @paxHighDemand.
  ///
  /// In uz, this message translates to:
  /// **'Talab yuqori'**
  String get paxHighDemand;

  /// No description provided for @paxHistoryEmpty.
  ///
  /// In uz, this message translates to:
  /// **'Sayohat tarixi yo\'q'**
  String get paxHistoryEmpty;

  /// No description provided for @paxHistoryTitle.
  ///
  /// In uz, this message translates to:
  /// **'Sayohat tarixi'**
  String get paxHistoryTitle;

  /// No description provided for @paxLastName.
  ///
  /// In uz, this message translates to:
  /// **'Familiya'**
  String get paxLastName;

  /// No description provided for @paxLastNameHint.
  ///
  /// In uz, this message translates to:
  /// **'Familiyangiz'**
  String get paxLastNameHint;

  /// No description provided for @paxLocatingAddress.
  ///
  /// In uz, this message translates to:
  /// **'Joylashuv aniqlanmoqda...'**
  String get paxLocatingAddress;

  /// No description provided for @paxLocation.
  ///
  /// In uz, this message translates to:
  /// **'Joylashuv'**
  String get paxLocation;

  /// No description provided for @paxLogout.
  ///
  /// In uz, this message translates to:
  /// **'Chiqish'**
  String get paxLogout;

  /// No description provided for @paxLogoutConfirmBody.
  ///
  /// In uz, this message translates to:
  /// **'Hisobdan chiqmoqchimisiz?'**
  String get paxLogoutConfirmBody;

  /// No description provided for @paxLogoutConfirmTitle.
  ///
  /// In uz, this message translates to:
  /// **'Chiqishni tasdiqlang'**
  String get paxLogoutConfirmTitle;

  /// No description provided for @paxLostItemButton.
  ///
  /// In uz, this message translates to:
  /// **'Buyum qoldirdim'**
  String get paxLostItemButton;

  /// No description provided for @paxLostItemDialogHint.
  ///
  /// In uz, this message translates to:
  /// **'Masalan: qora hamyon, orqa o\'rindiqda'**
  String get paxLostItemDialogHint;

  /// No description provided for @paxLostItemDialogTitle.
  ///
  /// In uz, this message translates to:
  /// **'Nima qoldirdingiz?'**
  String get paxLostItemDialogTitle;

  /// No description provided for @paxLostItemSent.
  ///
  /// In uz, this message translates to:
  /// **'Haydovchiga xabar yuborildi — javobni «Yo\'qolgan buyumlar» bo\'limida ko\'rasiz'**
  String get paxLostItemSent;

  /// No description provided for @paxLostItems.
  ///
  /// In uz, this message translates to:
  /// **'Yo\'qolgan buyumlar'**
  String get paxLostItems;

  /// No description provided for @paxMenu.
  ///
  /// In uz, this message translates to:
  /// **'Menyu'**
  String get paxMenu;

  /// No description provided for @paxMessage.
  ///
  /// In uz, this message translates to:
  /// **'Xabar'**
  String get paxMessage;

  /// No description provided for @paxMeteredRates.
  ///
  /// In uz, this message translates to:
  /// **'Taksometr: {base} + {perKm}/km + {perMin}/daq, kamida {min}. Yakuniy narx bosib o\'tilgan yo\'l va vaqtga qarab safar oxirida hisoblanadi.'**
  String paxMeteredRates(String base, String perKm, String perMin, String min);

  /// No description provided for @paxMeteredTo.
  ///
  /// In uz, this message translates to:
  /// **'Manzilsiz — taksometr bo\'yicha'**
  String get paxMeteredTo;

  /// No description provided for @paxNo.
  ///
  /// In uz, this message translates to:
  /// **'Yo\'q'**
  String get paxNo;

  /// No description provided for @paxNoDestination.
  ///
  /// In uz, this message translates to:
  /// **'Manzilsiz'**
  String get paxNoDestination;

  /// No description provided for @paxNoDriversNearby.
  ///
  /// In uz, this message translates to:
  /// **'Yaqin atrofda haydovchi topilmadi'**
  String get paxNoDriversNearby;

  /// No description provided for @paxNoDriversNearbyRetry.
  ///
  /// In uz, this message translates to:
  /// **'Yaqin atrofda haydovchi topilmadi. Birozdan so\'ng qayta urinib ko\'ring.'**
  String get paxNoDriversNearbyRetry;

  /// No description provided for @paxNoResults.
  ///
  /// In uz, this message translates to:
  /// **'Natija topilmadi'**
  String get paxNoResults;

  /// No description provided for @paxNoTariffs.
  ///
  /// In uz, this message translates to:
  /// **'Tariflar mavjud emas'**
  String get paxNoTariffs;

  /// No description provided for @paxNotifications.
  ///
  /// In uz, this message translates to:
  /// **'Bildirishnomalar'**
  String get paxNotifications;

  /// No description provided for @paxNow.
  ///
  /// In uz, this message translates to:
  /// **'Hozir'**
  String get paxNow;

  /// No description provided for @paxOrderCta.
  ///
  /// In uz, this message translates to:
  /// **'Buyurtma'**
  String get paxOrderCta;

  /// No description provided for @paxOrderDetails.
  ///
  /// In uz, this message translates to:
  /// **'Buyurtma tafsilotlari'**
  String get paxOrderDetails;

  /// No description provided for @paxOrderMissingRouteOrTariff.
  ///
  /// In uz, this message translates to:
  /// **'Manzil va tarif tanlanmagan'**
  String get paxOrderMissingRouteOrTariff;

  /// No description provided for @paxOutsideServiceArea.
  ///
  /// In uz, this message translates to:
  /// **'Xizmat hududidan tashqarida'**
  String get paxOutsideServiceArea;

  /// No description provided for @paxParcelPinHint.
  ///
  /// In uz, this message translates to:
  /// **'Qabul qiluvchiga ayting. Haydovchi posilkani shu kodsiz topshira olmaydi.'**
  String get paxParcelPinHint;

  /// No description provided for @paxParcelPinTitle.
  ///
  /// In uz, this message translates to:
  /// **'Topshirish kodi'**
  String get paxParcelPinTitle;

  /// No description provided for @paxPaymentCard.
  ///
  /// In uz, this message translates to:
  /// **'Karta'**
  String get paxPaymentCard;

  /// No description provided for @paxPaymentCash.
  ///
  /// In uz, this message translates to:
  /// **'Naqd'**
  String get paxPaymentCash;

  /// No description provided for @paxPaymentMethods.
  ///
  /// In uz, this message translates to:
  /// **'To\'lov usullari'**
  String get paxPaymentMethods;

  /// No description provided for @paxPickOnMap.
  ///
  /// In uz, this message translates to:
  /// **'Xaritadan tanlash'**
  String get paxPickOnMap;

  /// No description provided for @paxPickThisPlace.
  ///
  /// In uz, this message translates to:
  /// **'Shu joyni tanlash'**
  String get paxPickThisPlace;

  /// No description provided for @paxPickupPoint.
  ///
  /// In uz, this message translates to:
  /// **'Olish nuqtasi'**
  String get paxPickupPoint;

  /// No description provided for @paxPriceLocked.
  ///
  /// In uz, this message translates to:
  /// **'Narx qotirilgan — safar paytida o\'zgarmaydi.'**
  String get paxPriceLocked;

  /// No description provided for @paxProfileSaved.
  ///
  /// In uz, this message translates to:
  /// **'Ma\'lumotlar saqlandi'**
  String get paxProfileSaved;

  /// No description provided for @paxProfileTitle.
  ///
  /// In uz, this message translates to:
  /// **'Profil'**
  String get paxProfileTitle;

  /// No description provided for @paxRateCloseWithoutTip.
  ///
  /// In uz, this message translates to:
  /// **'Chaqimsiz yopish'**
  String get paxRateCloseWithoutTip;

  /// No description provided for @paxRateCommentHint.
  ///
  /// In uz, this message translates to:
  /// **'Haydovchi haqida izoh...'**
  String get paxRateCommentHint;

  /// No description provided for @paxRateHowWasTrip.
  ///
  /// In uz, this message translates to:
  /// **'Sayohat qanday kechdi?'**
  String get paxRateHowWasTrip;

  /// No description provided for @paxRatePleaseRate.
  ///
  /// In uz, this message translates to:
  /// **'Iltimos, baho bering'**
  String get paxRatePleaseRate;

  /// No description provided for @paxRatePrimaryNoTipSemantics.
  ///
  /// In uz, this message translates to:
  /// **'{action}, chaqimsiz'**
  String paxRatePrimaryNoTipSemantics(String action);

  /// No description provided for @paxRatePrimaryWithTipSemantics.
  ///
  /// In uz, this message translates to:
  /// **'{action}, {amount} chaqim bilan'**
  String paxRatePrimaryWithTipSemantics(String action, String amount);

  /// No description provided for @paxRateSkip.
  ///
  /// In uz, this message translates to:
  /// **'O\'tkazib yuborish'**
  String get paxRateSkip;

  /// No description provided for @paxRateStarSemantics.
  ///
  /// In uz, this message translates to:
  /// **'{count} yulduz'**
  String paxRateStarSemantics(int count);

  /// No description provided for @paxRateThanks.
  ///
  /// In uz, this message translates to:
  /// **'Bahoyingiz uchun rahmat!'**
  String get paxRateThanks;

  /// No description provided for @paxRateTipSent.
  ///
  /// In uz, this message translates to:
  /// **'{amount} chaqim haydovchiga yuborildi. Rahmat!'**
  String paxRateTipSent(String amount);

  /// No description provided for @paxRatingBad.
  ///
  /// In uz, this message translates to:
  /// **'Yomon'**
  String get paxRatingBad;

  /// No description provided for @paxRatingExcellent.
  ///
  /// In uz, this message translates to:
  /// **'Ajoyib!'**
  String get paxRatingExcellent;

  /// No description provided for @paxRatingGood.
  ///
  /// In uz, this message translates to:
  /// **'Yaxshi'**
  String get paxRatingGood;

  /// No description provided for @paxRatingOk.
  ///
  /// In uz, this message translates to:
  /// **'Oddiy'**
  String get paxRatingOk;

  /// No description provided for @paxRatingPickStars.
  ///
  /// In uz, this message translates to:
  /// **'Yulduz tanlang'**
  String get paxRatingPickStars;

  /// No description provided for @paxRatingValue.
  ///
  /// In uz, this message translates to:
  /// **'{rating} reyting'**
  String paxRatingValue(String rating);

  /// No description provided for @paxRatingVeryBad.
  ///
  /// In uz, this message translates to:
  /// **'Juda yomon'**
  String get paxRatingVeryBad;

  /// No description provided for @paxReceiptAddressMissing.
  ///
  /// In uz, this message translates to:
  /// **'Manzil saqlanmagan'**
  String get paxReceiptAddressMissing;

  /// No description provided for @paxReceiptCopySemantics.
  ///
  /// In uz, this message translates to:
  /// **'Chek matnini nusxalash'**
  String get paxReceiptCopySemantics;

  /// No description provided for @paxReceiptDiscount.
  ///
  /// In uz, this message translates to:
  /// **'Chegirma'**
  String get paxReceiptDiscount;

  /// No description provided for @paxReceiptDiscountWithCode.
  ///
  /// In uz, this message translates to:
  /// **'Chegirma ({code})'**
  String paxReceiptDiscountWithCode(String code);

  /// No description provided for @paxReceiptDropoff.
  ///
  /// In uz, this message translates to:
  /// **'Tushish'**
  String get paxReceiptDropoff;

  /// No description provided for @paxReceiptDuration.
  ///
  /// In uz, this message translates to:
  /// **'Davomiyligi'**
  String get paxReceiptDuration;

  /// No description provided for @paxReceiptFareBreakdown.
  ///
  /// In uz, this message translates to:
  /// **'Narx tarkibi'**
  String get paxReceiptFareBreakdown;

  /// No description provided for @paxReceiptForbiddenBody.
  ///
  /// In uz, this message translates to:
  /// **'Chekni faqat safar yo\'lovchisi, tayinlangan haydovchi yoki menejer ko\'ra oladi.'**
  String get paxReceiptForbiddenBody;

  /// No description provided for @paxReceiptForbiddenTitle.
  ///
  /// In uz, this message translates to:
  /// **'Bu chek sizga tegishli emas'**
  String get paxReceiptForbiddenTitle;

  /// No description provided for @paxReceiptGrandTotal.
  ///
  /// In uz, this message translates to:
  /// **'Yakuniy'**
  String get paxReceiptGrandTotal;

  /// No description provided for @paxReceiptLoading.
  ///
  /// In uz, this message translates to:
  /// **'Chek yuklanmoqda'**
  String get paxReceiptLoading;

  /// No description provided for @paxReceiptNoBreakdown.
  ///
  /// In uz, this message translates to:
  /// **'Bu safar uchun narx tarkibi saqlanmagan. Quyida faqat yakuniy hisob ko\'rsatilgan.'**
  String get paxReceiptNoBreakdown;

  /// No description provided for @paxReceiptNoPaymentInfo.
  ///
  /// In uz, this message translates to:
  /// **'To\'lov ma\'lumoti saqlanmagan.'**
  String get paxReceiptNoPaymentInfo;

  /// No description provided for @paxReceiptOrderNumber.
  ///
  /// In uz, this message translates to:
  /// **'Buyurtma № {number}'**
  String paxReceiptOrderNumber(String number);

  /// No description provided for @paxReceiptOrderNumberLabel.
  ///
  /// In uz, this message translates to:
  /// **'Buyurtma raqami'**
  String get paxReceiptOrderNumberLabel;

  /// No description provided for @paxReceiptParseError.
  ///
  /// In uz, this message translates to:
  /// **'Chek ma\'lumotlari o\'qilmadi'**
  String get paxReceiptParseError;

  /// No description provided for @paxReceiptPayment.
  ///
  /// In uz, this message translates to:
  /// **'To\'lov'**
  String get paxReceiptPayment;

  /// No description provided for @paxReceiptPaymentMethod.
  ///
  /// In uz, this message translates to:
  /// **'Usul'**
  String get paxReceiptPaymentMethod;

  /// No description provided for @paxReceiptPaymentStatus.
  ///
  /// In uz, this message translates to:
  /// **'Holati'**
  String get paxReceiptPaymentStatus;

  /// No description provided for @paxReceiptPickup.
  ///
  /// In uz, this message translates to:
  /// **'Olib ketish'**
  String get paxReceiptPickup;

  /// No description provided for @paxReceiptService.
  ///
  /// In uz, this message translates to:
  /// **'Xizmat'**
  String get paxReceiptService;

  /// No description provided for @paxReceiptStop.
  ///
  /// In uz, this message translates to:
  /// **'To\'xtash {index}'**
  String paxReceiptStop(int index);

  /// No description provided for @paxReceiptSubtotal.
  ///
  /// In uz, this message translates to:
  /// **'Jami'**
  String get paxReceiptSubtotal;

  /// No description provided for @paxReceiptTariff.
  ///
  /// In uz, this message translates to:
  /// **'Tarif'**
  String get paxReceiptTariff;

  /// No description provided for @paxReceiptTextCopied.
  ///
  /// In uz, this message translates to:
  /// **'Chek matni nusxalandi'**
  String get paxReceiptTextCopied;

  /// No description provided for @paxReceiptTip.
  ///
  /// In uz, this message translates to:
  /// **'Chaqim'**
  String get paxReceiptTip;

  /// No description provided for @paxReceiptTipHint.
  ///
  /// In uz, this message translates to:
  /// **'Komissiyasiz — to\'liq haydovchiga'**
  String get paxReceiptTipHint;

  /// No description provided for @paxReceiptTitle.
  ///
  /// In uz, this message translates to:
  /// **'Safar cheki'**
  String get paxReceiptTitle;

  /// No description provided for @paxReceiptUnpaid.
  ///
  /// In uz, this message translates to:
  /// **'To\'lanmagan qoldiq: {amount}. Hamyonni to\'ldiring — qarz yangi buyurtma berishni to\'sib qo\'yadi.'**
  String paxReceiptUnpaid(String amount);

  /// No description provided for @paxReceiptWaitingNote.
  ///
  /// In uz, this message translates to:
  /// **'Kutish haqi belgilangan narxga kirmaydi: bepul daqiqalardan keyin har boshlangan daqiqa alohida qo\'shiladi.'**
  String get paxReceiptWaitingNote;

  /// No description provided for @paxReferralApplied.
  ///
  /// In uz, this message translates to:
  /// **'Referral kodi qo\'llandi!'**
  String get paxReferralApplied;

  /// No description provided for @paxReferralAppliedBanner.
  ///
  /// In uz, this message translates to:
  /// **'Referral kodi muvaffaqiyatli qo\'llandi'**
  String get paxReferralAppliedBanner;

  /// No description provided for @paxReferralApply.
  ///
  /// In uz, this message translates to:
  /// **'Qo\'llash'**
  String get paxReferralApply;

  /// No description provided for @paxReferralCardHint.
  ///
  /// In uz, this message translates to:
  /// **'Do\'stingiz ilovaga birinchi safarida ushbu kodni kiritsa, ikkovingiz ham bonus olasiz'**
  String get paxReferralCardHint;

  /// No description provided for @paxReferralCodeCopied.
  ///
  /// In uz, this message translates to:
  /// **'Kod nusxalandi'**
  String get paxReferralCodeCopied;

  /// No description provided for @paxReferralCopy.
  ///
  /// In uz, this message translates to:
  /// **'Nusxalash'**
  String get paxReferralCopy;

  /// No description provided for @paxReferralEnterCode.
  ///
  /// In uz, this message translates to:
  /// **'Kodni kiriting'**
  String get paxReferralEnterCode;

  /// No description provided for @paxReferralEnterFriendCode.
  ///
  /// In uz, this message translates to:
  /// **'Do\'stingizning kodini kiriting'**
  String get paxReferralEnterFriendCode;

  /// No description provided for @paxReferralErrAlreadyApplied.
  ///
  /// In uz, this message translates to:
  /// **'Sizda allaqachon referral kodi qo\'llangan'**
  String get paxReferralErrAlreadyApplied;

  /// No description provided for @paxReferralErrInvalid.
  ///
  /// In uz, this message translates to:
  /// **'Bunday referral kod topilmadi'**
  String get paxReferralErrInvalid;

  /// No description provided for @paxReferralErrOwnCode.
  ///
  /// In uz, this message translates to:
  /// **'O\'zingizning kodingizni qo\'llay olmaysiz'**
  String get paxReferralErrOwnCode;

  /// No description provided for @paxReferralInvitedCount.
  ///
  /// In uz, this message translates to:
  /// **'Taklif qilinganlar'**
  String get paxReferralInvitedCount;

  /// No description provided for @paxReferralShare.
  ///
  /// In uz, this message translates to:
  /// **'Ulashish'**
  String get paxReferralShare;

  /// No description provided for @paxReferralShareCopied.
  ///
  /// In uz, this message translates to:
  /// **'Taklif matni nusxalandi — do\'stingizga yuboring'**
  String get paxReferralShareCopied;

  /// No description provided for @paxReferralShareMessage.
  ///
  /// In uz, this message translates to:
  /// **'Angren Taxi\'ga taklif qilaman! Ro\'yxatdan o\'tishda mening kodimni kiriting: {code}'**
  String paxReferralShareMessage(String code);

  /// No description provided for @paxReferralTitle.
  ///
  /// In uz, this message translates to:
  /// **'Do\'stlarni taklif qilish'**
  String get paxReferralTitle;

  /// No description provided for @paxReferralTotalBonus.
  ///
  /// In uz, this message translates to:
  /// **'Jami bonus'**
  String get paxReferralTotalBonus;

  /// No description provided for @paxReferralYourCode.
  ///
  /// In uz, this message translates to:
  /// **'SIZNING REFERRAL KODINGIZ'**
  String get paxReferralYourCode;

  /// No description provided for @paxRemoveStop.
  ///
  /// In uz, this message translates to:
  /// **'To\'xtashni olib tashlash'**
  String get paxRemoveStop;

  /// No description provided for @paxRepeatRide.
  ///
  /// In uz, this message translates to:
  /// **'Safarni takrorlash'**
  String get paxRepeatRide;

  /// No description provided for @paxResolvingAddress.
  ///
  /// In uz, this message translates to:
  /// **'Manzil aniqlanmoqda...'**
  String get paxResolvingAddress;

  /// No description provided for @paxRouteLoading.
  ///
  /// In uz, this message translates to:
  /// **'Yo\'nalish yuklanmoqda...'**
  String get paxRouteLoading;

  /// No description provided for @paxSave.
  ///
  /// In uz, this message translates to:
  /// **'Saqlash'**
  String get paxSave;

  /// No description provided for @paxSaveAddress.
  ///
  /// In uz, this message translates to:
  /// **'Manzilni saqlash'**
  String get paxSaveAddress;

  /// No description provided for @paxSaveAddressFailed.
  ///
  /// In uz, this message translates to:
  /// **'Manzilni saqlab bo\'lmadi'**
  String get paxSaveAddressFailed;

  /// No description provided for @paxSavedAddresses.
  ///
  /// In uz, this message translates to:
  /// **'Saqlangan manzillar'**
  String get paxSavedAddresses;

  /// No description provided for @paxSavedPlaces.
  ///
  /// In uz, this message translates to:
  /// **'Saqlangan joylar'**
  String get paxSavedPlaces;

  /// No description provided for @paxScheduleCancelled.
  ///
  /// In uz, this message translates to:
  /// **'Reja bekor qilindi'**
  String get paxScheduleCancelled;

  /// No description provided for @paxScheduleCta.
  ///
  /// In uz, this message translates to:
  /// **'Rejalashtirish'**
  String get paxScheduleCta;

  /// No description provided for @paxScheduleHint.
  ///
  /// In uz, this message translates to:
  /// **'Haydovchi belgilangan vaqtdan 10 daqiqa oldin qidiriladi. Narx hozir qotiriladi va o\'zgarmaydi.'**
  String get paxScheduleHint;

  /// No description provided for @paxScheduleNoSlots.
  ///
  /// In uz, this message translates to:
  /// **'Bu kun uchun vaqt qolmadi — keyingi kunni tanlang.'**
  String get paxScheduleNoSlots;

  /// No description provided for @paxScheduleOrderNow.
  ///
  /// In uz, this message translates to:
  /// **'Hozir buyurtma qilaman'**
  String get paxScheduleOrderNow;

  /// No description provided for @paxSchedulePickTime.
  ///
  /// In uz, this message translates to:
  /// **'Vaqtni tanlang'**
  String get paxSchedulePickTime;

  /// No description provided for @paxScheduleTitle.
  ///
  /// In uz, this message translates to:
  /// **'Safarni rejalashtirish'**
  String get paxScheduleTitle;

  /// No description provided for @paxScheduledEmptyBody.
  ///
  /// In uz, this message translates to:
  /// **'Tarif ekranida vaqtni belgilab, safarni oldindan buyurtma qilishingiz mumkin.'**
  String get paxScheduledEmptyBody;

  /// No description provided for @paxScheduledEmptyTitle.
  ///
  /// In uz, this message translates to:
  /// **'Rejalashtirilgan safarlar yo\'q'**
  String get paxScheduledEmptyTitle;

  /// No description provided for @paxScheduledPriceNote.
  ///
  /// In uz, this message translates to:
  /// **'Narx hozir qotiriladi va safar kunida o\'zgarmaydi — kutish haqi bundan tashqari. Haydovchi belgilangan vaqtdan 10 daqiqa oldin qidiriladi.'**
  String get paxScheduledPriceNote;

  /// No description provided for @paxScheduledTripsTitle.
  ///
  /// In uz, this message translates to:
  /// **'Rejalashtirilgan safarlar'**
  String get paxScheduledTripsTitle;

  /// No description provided for @paxSearchAddressHint.
  ///
  /// In uz, this message translates to:
  /// **'Manzilni qidiring...'**
  String get paxSearchAddressHint;

  /// No description provided for @paxSearchAddressSemantics.
  ///
  /// In uz, this message translates to:
  /// **'Manzilni qidiring'**
  String get paxSearchAddressSemantics;

  /// No description provided for @paxSearchPlaceHint.
  ///
  /// In uz, this message translates to:
  /// **'Ko\'cha, mahalla, joy nomi...'**
  String get paxSearchPlaceHint;

  /// No description provided for @paxSeats.
  ///
  /// In uz, this message translates to:
  /// **'{count} o\'rin'**
  String paxSeats(int count);

  /// No description provided for @paxSend.
  ///
  /// In uz, this message translates to:
  /// **'Yuborish'**
  String get paxSend;

  /// No description provided for @paxShareTripCopied.
  ///
  /// In uz, this message translates to:
  /// **'Safar ma\'lumoti nusxalandi'**
  String get paxShareTripCopied;

  /// No description provided for @paxShareTripDriver.
  ///
  /// In uz, this message translates to:
  /// **'Haydovchi: {name}, {car}'**
  String paxShareTripDriver(String name, String car);

  /// No description provided for @paxShareTripFrom.
  ///
  /// In uz, this message translates to:
  /// **'Qayerdan: {address}'**
  String paxShareTripFrom(String address);

  /// No description provided for @paxShareTripHeader.
  ///
  /// In uz, this message translates to:
  /// **'Angren Taxi — safarim'**
  String get paxShareTripHeader;

  /// No description provided for @paxShareTripStatus.
  ///
  /// In uz, this message translates to:
  /// **'Holat: {status}'**
  String paxShareTripStatus(String status);

  /// No description provided for @paxShareTripTo.
  ///
  /// In uz, this message translates to:
  /// **'Qayerga: {address}'**
  String paxShareTripTo(String address);

  /// No description provided for @paxSomSuffix.
  ///
  /// In uz, this message translates to:
  /// **'so\'m'**
  String get paxSomSuffix;

  /// No description provided for @paxSosAlertDispatchers.
  ///
  /// In uz, this message translates to:
  /// **'Dispetcherlarga xabar berish'**
  String get paxSosAlertDispatchers;

  /// No description provided for @paxSosBody.
  ///
  /// In uz, this message translates to:
  /// **'Xavfsizligingiz biz uchun muhim. Kerak bo\'lsa, quyidagi tugmalardan birini bosing.'**
  String get paxSosBody;

  /// No description provided for @paxSosDispatchersAlerted.
  ///
  /// In uz, this message translates to:
  /// **'Dispetcherlarga xabar yuborildi'**
  String get paxSosDispatchersAlerted;

  /// No description provided for @paxSosEmergencyCall.
  ///
  /// In uz, this message translates to:
  /// **'Favqulodda chaqiruv (102/103)'**
  String get paxSosEmergencyCall;

  /// No description provided for @paxSosSemantics.
  ///
  /// In uz, this message translates to:
  /// **'SOS — favqulodda yordam'**
  String get paxSosSemantics;

  /// No description provided for @paxSosTitle.
  ///
  /// In uz, this message translates to:
  /// **'Favqulodda yordam'**
  String get paxSosTitle;

  /// No description provided for @paxStop.
  ///
  /// In uz, this message translates to:
  /// **'To\'xtash'**
  String get paxStop;

  /// No description provided for @paxStopPoint.
  ///
  /// In uz, this message translates to:
  /// **'To\'xtash nuqtasi'**
  String get paxStopPoint;

  /// No description provided for @paxSurgeNotice.
  ///
  /// In uz, this message translates to:
  /// **'Hozir talab yuqori — narx {multiplier}x. Bir necha daqiqadan keyin arzonlashishi mumkin.'**
  String paxSurgeNotice(String multiplier);

  /// No description provided for @paxTariffWaitingNote.
  ///
  /// In uz, this message translates to:
  /// **'Haydovchi kelgach {freeMinutes} daqiqa kutish bepul, keyin har boshlangan daqiqa uchun {perMinute}. Bu haq ko\'rsatilgan narxdan alohida qo\'shiladi.'**
  String paxTariffWaitingNote(int freeMinutes, String perMinute);

  /// No description provided for @paxTipAlreadyGiven.
  ///
  /// In uz, this message translates to:
  /// **'Bu safar uchun chaqim allaqachon berilgan.'**
  String get paxTipAlreadyGiven;

  /// No description provided for @paxTipExplainer.
  ///
  /// In uz, this message translates to:
  /// **'Summa to\'liq haydovchiga o\'tadi — komissiya ushlanmaydi. Hamyoningizdan yechiladi.'**
  String get paxTipExplainer;

  /// No description provided for @paxTipInsufficientFunds.
  ///
  /// In uz, this message translates to:
  /// **'Hamyonda mablag\' yetarli emas. Hamyonni to\'ldiring yoki kichikroq summa tanlang.'**
  String get paxTipInsufficientFunds;

  /// No description provided for @paxTipNotYourTrip.
  ///
  /// In uz, this message translates to:
  /// **'Bu safar sizga tegishli emas.'**
  String get paxTipNotYourTrip;

  /// No description provided for @paxTipOptional.
  ///
  /// In uz, this message translates to:
  /// **'Ixtiyoriy'**
  String get paxTipOptional;

  /// No description provided for @paxTipOther.
  ///
  /// In uz, this message translates to:
  /// **'Boshqa'**
  String get paxTipOther;

  /// No description provided for @paxTipRangeError.
  ///
  /// In uz, this message translates to:
  /// **'Chaqim {min} dan {max}gacha bo\'lishi kerak'**
  String paxTipRangeError(String min, String max);

  /// No description provided for @paxTipTitle.
  ///
  /// In uz, this message translates to:
  /// **'Haydovchiga chaqim'**
  String get paxTipTitle;

  /// No description provided for @paxTo.
  ///
  /// In uz, this message translates to:
  /// **'Qayerga'**
  String get paxTo;

  /// No description provided for @paxTripOptionsHint.
  ///
  /// In uz, this message translates to:
  /// **'Faqat shu talablarni bajara oladigan haydovchi qidiriladi — bu biroz ko\'proq vaqt olishi mumkin.'**
  String get paxTripOptionsHint;

  /// No description provided for @paxTripOptionsTitle.
  ///
  /// In uz, this message translates to:
  /// **'Qo\'shimcha talablar'**
  String get paxTripOptionsTitle;

  /// No description provided for @paxTripScheduled.
  ///
  /// In uz, this message translates to:
  /// **'Safar rejalashtirildi'**
  String get paxTripScheduled;

  /// No description provided for @paxTripTimeSemantics.
  ///
  /// In uz, this message translates to:
  /// **'Safar vaqti: {time}'**
  String paxTripTimeSemantics(String time);

  /// No description provided for @paxTripsStat.
  ///
  /// In uz, this message translates to:
  /// **'Sayohatlar'**
  String get paxTripsStat;

  /// No description provided for @paxUnknownAddress.
  ///
  /// In uz, this message translates to:
  /// **'Noma\'lum manzil'**
  String get paxUnknownAddress;

  /// No description provided for @paxUpcomingTrip.
  ///
  /// In uz, this message translates to:
  /// **'Kelgusi safar: {when}'**
  String paxUpcomingTrip(String when);

  /// No description provided for @paxUserFallback.
  ///
  /// In uz, this message translates to:
  /// **'Foydalanuvchi'**
  String get paxUserFallback;

  /// No description provided for @paxWaitingFree.
  ///
  /// In uz, this message translates to:
  /// **'Bepul kutish'**
  String get paxWaitingFree;

  /// No description provided for @paxWaitingFreeCaption.
  ///
  /// In uz, this message translates to:
  /// **'Keyin {perMinute}/daqiqa, safar narxiga qo\'shiladi'**
  String paxWaitingFreeCaption(String perMinute);

  /// No description provided for @paxWaitingFreeSemantics.
  ///
  /// In uz, this message translates to:
  /// **'Bepul kutish tugashiga {remaining} qoldi, keyin har daqiqa uchun {perMinute} safar narxiga qo\'shiladi'**
  String paxWaitingFreeSemantics(String remaining, String perMinute);

  /// No description provided for @paxWaitingPaid.
  ///
  /// In uz, this message translates to:
  /// **'Kutish haqi'**
  String get paxWaitingPaid;

  /// No description provided for @paxWaitingPaidCaption.
  ///
  /// In uz, this message translates to:
  /// **'Jami {elapsed} · safar narxiga qo\'shiladi'**
  String paxWaitingPaidCaption(String elapsed);

  /// No description provided for @paxWaitingPaidSemantics.
  ///
  /// In uz, this message translates to:
  /// **'Kutish haqi {amount}, jami {elapsed} kutildi. Safar narxiga qo\'shiladi.'**
  String paxWaitingPaidSemantics(String amount, String elapsed);

  /// No description provided for @paxWhereTo.
  ///
  /// In uz, this message translates to:
  /// **'Qayoqqa boramiz?'**
  String get paxWhereTo;

  /// No description provided for @saActiveOrderLabel.
  ///
  /// In uz, this message translates to:
  /// **'Faol buyurtma: {service}. {title}. {stage}'**
  String saActiveOrderLabel(String service, String title, String stage);

  /// No description provided for @saAdBadge.
  ///
  /// In uz, this message translates to:
  /// **'Reklama'**
  String get saAdBadge;

  /// No description provided for @saAdOpenFailed.
  ///
  /// In uz, this message translates to:
  /// **'Havolani ochib bo\'lmadi'**
  String get saAdOpenFailed;

  /// No description provided for @saAddItemToCartLabel.
  ///
  /// In uz, this message translates to:
  /// **'{name} — savatga qo\'shish'**
  String saAddItemToCartLabel(String name);

  /// No description provided for @saAddToCartWithPrice.
  ///
  /// In uz, this message translates to:
  /// **'Savatga · {price}'**
  String saAddToCartWithPrice(String price);

  /// No description provided for @saAddressResolving.
  ///
  /// In uz, this message translates to:
  /// **'Manzil aniqlanmoqda…'**
  String get saAddressResolving;

  /// No description provided for @saAngrenCity.
  ///
  /// In uz, this message translates to:
  /// **'Angren shahri'**
  String get saAngrenCity;

  /// No description provided for @saBack.
  ///
  /// In uz, this message translates to:
  /// **'Orqaga'**
  String get saBack;

  /// No description provided for @saBackToHome.
  ///
  /// In uz, this message translates to:
  /// **'Bosh sahifaga'**
  String get saBackToHome;

  /// No description provided for @saBadgeCount.
  ///
  /// In uz, this message translates to:
  /// **'{count} ta'**
  String saBadgeCount(String count);

  /// No description provided for @saCallDriver.
  ///
  /// In uz, this message translates to:
  /// **'Haydovchiga qo\'ng\'iroq qilish'**
  String get saCallDriver;

  /// No description provided for @saCallFailed.
  ///
  /// In uz, this message translates to:
  /// **'Qo\'ng\'iroq qilib bo\'lmadi'**
  String get saCallFailed;

  /// No description provided for @saCallFailedDialManually.
  ///
  /// In uz, this message translates to:
  /// **'Qo\'ng\'iroq qilib bo\'lmadi — {phone} raqamiga o\'zingiz qo\'ng\'iroq qiling'**
  String saCallFailedDialManually(String phone);

  /// No description provided for @saCancel.
  ///
  /// In uz, this message translates to:
  /// **'Bekor qilish'**
  String get saCancel;

  /// No description provided for @saCargoAddressHint.
  ///
  /// In uz, this message translates to:
  /// **'Manzillarni keyingi qadamda xaritadan tanlaysiz — aniq narx masofaga qarab o\'sha yerda hisoblanadi.'**
  String get saCargoAddressHint;

  /// No description provided for @saCargoCallCourier.
  ///
  /// In uz, this message translates to:
  /// **'Kuryer chaqirish'**
  String get saCargoCallCourier;

  /// No description provided for @saCargoCourier.
  ///
  /// In uz, this message translates to:
  /// **'Kuryer'**
  String get saCargoCourier;

  /// No description provided for @saCargoLight.
  ///
  /// In uz, this message translates to:
  /// **'Yengil'**
  String get saCargoLight;

  /// No description provided for @saCargoSubtitle.
  ///
  /// In uz, this message translates to:
  /// **'Shahar ichida tez yetkazib berish'**
  String get saCargoSubtitle;

  /// No description provided for @saCargoTitle.
  ///
  /// In uz, this message translates to:
  /// **'Cargo · Yuk yetkazish'**
  String get saCargoTitle;

  /// No description provided for @saCargoTruck.
  ///
  /// In uz, this message translates to:
  /// **'Yuk'**
  String get saCargoTruck;

  /// No description provided for @saCargoUpTo1t.
  ///
  /// In uz, this message translates to:
  /// **'1 t gacha'**
  String get saCargoUpTo1t;

  /// No description provided for @saCargoUpTo300kg.
  ///
  /// In uz, this message translates to:
  /// **'300 kg gacha'**
  String get saCargoUpTo300kg;

  /// No description provided for @saCargoUpTo5kg.
  ///
  /// In uz, this message translates to:
  /// **'5 kg gacha'**
  String get saCargoUpTo5kg;

  /// No description provided for @saCargoVehicleType.
  ///
  /// In uz, this message translates to:
  /// **'Transport turi'**
  String get saCargoVehicleType;

  /// No description provided for @saCart.
  ///
  /// In uz, this message translates to:
  /// **'Savat'**
  String get saCart;

  /// No description provided for @saCartBarLabel.
  ///
  /// In uz, this message translates to:
  /// **'Savatga buyurtma'**
  String get saCartBarLabel;

  /// No description provided for @saCartBarSemantics.
  ///
  /// In uz, this message translates to:
  /// **'Savat: {count} ta mahsulot, {total}. {action}'**
  String saCartBarSemantics(int count, String total, String action);

  /// No description provided for @saCartEmptyMessage.
  ///
  /// In uz, this message translates to:
  /// **'Ovqat yoki market mahsulotlarini qo\'shing va bu yerda ko\'rinadi.'**
  String get saCartEmptyMessage;

  /// No description provided for @saCartEmptyTitle.
  ///
  /// In uz, this message translates to:
  /// **'Savat bo\'sh'**
  String get saCartEmptyTitle;

  /// No description provided for @saCartNoExtraFees.
  ///
  /// In uz, this message translates to:
  /// **'Rasmiylashtirishda qo\'shimcha haq qo\'shilmaydi.'**
  String get saCartNoExtraFees;

  /// No description provided for @saCartWithCount.
  ///
  /// In uz, this message translates to:
  /// **'Savat, {count} ta mahsulot'**
  String saCartWithCount(int count);

  /// No description provided for @saCashLimitNote.
  ///
  /// In uz, this message translates to:
  /// **'Naqd to\'lov {limit} so\'mgacha — bu buyurtma karta bilan to\'lanadi'**
  String saCashLimitNote(String limit);

  /// No description provided for @saCheckoutTitle.
  ///
  /// In uz, this message translates to:
  /// **'Rasmiylashtirish'**
  String get saCheckoutTitle;

  /// No description provided for @saCheckoutWithTotal.
  ///
  /// In uz, this message translates to:
  /// **'Rasmiylashtirish · {total}'**
  String saCheckoutWithTotal(String total);

  /// No description provided for @saCheckoutWithTotalLabel.
  ///
  /// In uz, this message translates to:
  /// **'Rasmiylashtirish, jami {total}'**
  String saCheckoutWithTotalLabel(String total);

  /// No description provided for @saChooseAddress.
  ///
  /// In uz, this message translates to:
  /// **'Manzilni tanlang'**
  String get saChooseAddress;

  /// No description provided for @saChooseDeliveryAddress.
  ///
  /// In uz, this message translates to:
  /// **'Yetkazib berish manzilini tanlang'**
  String get saChooseDeliveryAddress;

  /// No description provided for @saChoosePaymentMethod.
  ///
  /// In uz, this message translates to:
  /// **'To\'lov usulini tanlang'**
  String get saChoosePaymentMethod;

  /// No description provided for @saClose.
  ///
  /// In uz, this message translates to:
  /// **'Yopish'**
  String get saClose;

  /// No description provided for @saClosed.
  ///
  /// In uz, this message translates to:
  /// **'Yopiq'**
  String get saClosed;

  /// No description provided for @saCompletedAt.
  ///
  /// In uz, this message translates to:
  /// **'Yakunlandi'**
  String get saCompletedAt;

  /// No description provided for @saConfirmOrder.
  ///
  /// In uz, this message translates to:
  /// **'Buyurtmani tasdiqlash'**
  String get saConfirmOrder;

  /// No description provided for @saContactOperator.
  ///
  /// In uz, this message translates to:
  /// **'Operator bilan bog\'lanish'**
  String get saContactOperator;

  /// No description provided for @saCurrentAddress.
  ///
  /// In uz, this message translates to:
  /// **'Joriy manzil'**
  String get saCurrentAddress;

  /// No description provided for @saCurrentLocation.
  ///
  /// In uz, this message translates to:
  /// **'Joriy joylashuv'**
  String get saCurrentLocation;

  /// No description provided for @saDefaultUserName.
  ///
  /// In uz, this message translates to:
  /// **'Foydalanuvchi'**
  String get saDefaultUserName;

  /// No description provided for @saDelivery.
  ///
  /// In uz, this message translates to:
  /// **'Yetkazib berish'**
  String get saDelivery;

  /// No description provided for @saDeliveryAddress.
  ///
  /// In uz, this message translates to:
  /// **'Yetkazib berish manzili'**
  String get saDeliveryAddress;

  /// No description provided for @saDestination.
  ///
  /// In uz, this message translates to:
  /// **'Manzil'**
  String get saDestination;

  /// No description provided for @saDishesCount.
  ///
  /// In uz, this message translates to:
  /// **'{count} ta taom'**
  String saDishesCount(int count);

  /// No description provided for @saDistance.
  ///
  /// In uz, this message translates to:
  /// **'Masofa'**
  String get saDistance;

  /// No description provided for @saDuration.
  ///
  /// In uz, this message translates to:
  /// **'Davomiyligi'**
  String get saDuration;

  /// No description provided for @saEditProfile.
  ///
  /// In uz, this message translates to:
  /// **'Profilni tahrirlash'**
  String get saEditProfile;

  /// No description provided for @saErrorOccurred.
  ///
  /// In uz, this message translates to:
  /// **'Xatolik yuz berdi'**
  String get saErrorOccurred;

  /// No description provided for @saFaqCancelA.
  ///
  /// In uz, this message translates to:
  /// **'Faol buyurtma ekranida \"Bekor qilish\" tugmasini bosing va sababni tanlang. Haydovchi yetib kelgunga qadar bekor qilish bepul.'**
  String get saFaqCancelA;

  /// No description provided for @saFaqCancelQ.
  ///
  /// In uz, this message translates to:
  /// **'Buyurtmani qanday bekor qilaman?'**
  String get saFaqCancelQ;

  /// No description provided for @saFaqComplaintA.
  ///
  /// In uz, this message translates to:
  /// **'Safar tugagach baho qo\'yish ekranida izoh qoldiring yoki operator bilan chatga safar raqamini yuboring. Har bir shikoyat ko\'rib chiqiladi.'**
  String get saFaqComplaintA;

  /// No description provided for @saFaqComplaintQ.
  ///
  /// In uz, this message translates to:
  /// **'Haydovchi ustidan shikoyat'**
  String get saFaqComplaintQ;

  /// No description provided for @saFaqLostItemA.
  ///
  /// In uz, this message translates to:
  /// **'Buyurtmalar tarixidan safarni oching va haydovchiga qo\'ng\'iroq qiling. Javob bo\'lmasa, operator bilan chatga yozing — biz haydovchi bilan bog\'lanamiz.'**
  String get saFaqLostItemA;

  /// No description provided for @saFaqLostItemQ.
  ///
  /// In uz, this message translates to:
  /// **'Mashinada narsa qoldirdim'**
  String get saFaqLostItemQ;

  /// No description provided for @saFaqPaymentA.
  ///
  /// In uz, this message translates to:
  /// **'Hamyon balansingizni tekshiring. Balans yetmasa safar qarz sifatida qayd etiladi va uni to\'lamaguningizcha yangi buyurtma bera olmaysiz. Naqd to\'lovni tanlab ham davom etishingiz mumkin.'**
  String get saFaqPaymentA;

  /// No description provided for @saFaqPaymentQ.
  ///
  /// In uz, this message translates to:
  /// **'To\'lov o\'tmadi, nima qilaman?'**
  String get saFaqPaymentQ;

  /// No description provided for @saFaqTitle.
  ///
  /// In uz, this message translates to:
  /// **'Tez-tez beriladigan savollar'**
  String get saFaqTitle;

  /// No description provided for @saFoodNoRestaurantsMessage.
  ///
  /// In uz, this message translates to:
  /// **'Hozircha ochiq restoran yo\'q. Birozdan keyin qayta urinib ko\'ring.'**
  String get saFoodNoRestaurantsMessage;

  /// No description provided for @saFoodNoRestaurantsTitle.
  ///
  /// In uz, this message translates to:
  /// **'Restoran topilmadi'**
  String get saFoodNoRestaurantsTitle;

  /// No description provided for @saFoodSubtitle.
  ///
  /// In uz, this message translates to:
  /// **'Angren · 20–40 daqiqa'**
  String get saFoodSubtitle;

  /// No description provided for @saFoodTitle.
  ///
  /// In uz, this message translates to:
  /// **'Ovqat yetkazish'**
  String get saFoodTitle;

  /// No description provided for @saGoToCart.
  ///
  /// In uz, this message translates to:
  /// **'Savatga o\'tish'**
  String get saGoToCart;

  /// No description provided for @saGoToHome.
  ///
  /// In uz, this message translates to:
  /// **'Bosh sahifaga o\'tish'**
  String get saGoToHome;

  /// No description provided for @saHelpCenter.
  ///
  /// In uz, this message translates to:
  /// **'Yordam markazi'**
  String get saHelpCenter;

  /// No description provided for @saInviteFriends.
  ///
  /// In uz, this message translates to:
  /// **'Do\'stlarni taklif qilish'**
  String get saInviteFriends;

  /// No description provided for @saLoading.
  ///
  /// In uz, this message translates to:
  /// **'Yuklanmoqda'**
  String get saLoading;

  /// No description provided for @saLogout.
  ///
  /// In uz, this message translates to:
  /// **'Chiqish'**
  String get saLogout;

  /// No description provided for @saLostItemDriverNote.
  ///
  /// In uz, this message translates to:
  /// **'Haydovchi: {note}'**
  String saLostItemDriverNote(String note);

  /// No description provided for @saLostItemFound.
  ///
  /// In uz, this message translates to:
  /// **'Topdim'**
  String get saLostItemFound;

  /// No description provided for @saLostItemFoundTitle.
  ///
  /// In uz, this message translates to:
  /// **'Buyum topildi'**
  String get saLostItemFoundTitle;

  /// No description provided for @saLostItemNotFound.
  ///
  /// In uz, this message translates to:
  /// **'Topmadim'**
  String get saLostItemNotFound;

  /// No description provided for @saLostItemOperatorNote.
  ///
  /// In uz, this message translates to:
  /// **'Operator: {note}'**
  String saLostItemOperatorNote(String note);

  /// No description provided for @saLostItemWhereHint.
  ///
  /// In uz, this message translates to:
  /// **'Qayerda turibdi? (ixtiyoriy)'**
  String get saLostItemWhereHint;

  /// No description provided for @saLostItemsEmptyDriver.
  ///
  /// In uz, this message translates to:
  /// **'Yo\'lovchi safaringizda buyum qoldirsa, shu yerda ko\'rasiz.'**
  String get saLostItemsEmptyDriver;

  /// No description provided for @saLostItemsEmptyPassenger.
  ///
  /// In uz, this message translates to:
  /// **'Safarda biror narsa qoldirsangiz, chek sahifasidan xabar bering.'**
  String get saLostItemsEmptyPassenger;

  /// No description provided for @saLostItemsEmptyTitle.
  ///
  /// In uz, this message translates to:
  /// **'Xabarlar yo\'q'**
  String get saLostItemsEmptyTitle;

  /// No description provided for @saLostItemsTitle.
  ///
  /// In uz, this message translates to:
  /// **'Yo\'qolgan buyumlar'**
  String get saLostItemsTitle;

  /// No description provided for @saMarket.
  ///
  /// In uz, this message translates to:
  /// **'Market'**
  String get saMarket;

  /// No description provided for @saMarketNoProductsMessage.
  ///
  /// In uz, this message translates to:
  /// **'Bu do\'konda hozircha mahsulot yo\'q.'**
  String get saMarketNoProductsMessage;

  /// No description provided for @saMarketNoProductsTitle.
  ///
  /// In uz, this message translates to:
  /// **'Mahsulot topilmadi'**
  String get saMarketNoProductsTitle;

  /// No description provided for @saMarketProducts.
  ///
  /// In uz, this message translates to:
  /// **'Mahsulotlar'**
  String get saMarketProducts;

  /// No description provided for @saMarketSearchHint.
  ///
  /// In uz, this message translates to:
  /// **'Mahsulot qidirish…'**
  String get saMarketSearchHint;

  /// No description provided for @saMarketSubtitle.
  ///
  /// In uz, this message translates to:
  /// **'15–25 daqiqa · Yaqin do\'kon'**
  String get saMarketSubtitle;

  /// No description provided for @saMenu.
  ///
  /// In uz, this message translates to:
  /// **'Menyu'**
  String get saMenu;

  /// No description provided for @saMenuEmptyMessage.
  ///
  /// In uz, this message translates to:
  /// **'Bu restoran hozircha taom qo\'shmagan.'**
  String get saMenuEmptyMessage;

  /// No description provided for @saMenuEmptyTitle.
  ///
  /// In uz, this message translates to:
  /// **'Menyu bo\'sh'**
  String get saMenuEmptyTitle;

  /// No description provided for @saNoStoreYet.
  ///
  /// In uz, this message translates to:
  /// **'Hozircha do\'kon yo\'q'**
  String get saNoStoreYet;

  /// No description provided for @saNotificationUnreadLabel.
  ///
  /// In uz, this message translates to:
  /// **'O\'qilmagan: {title}'**
  String saNotificationUnreadLabel(String title);

  /// No description provided for @saNotificationsEmpty.
  ///
  /// In uz, this message translates to:
  /// **'Hozircha bildirishnomalar yo\'q'**
  String get saNotificationsEmpty;

  /// No description provided for @saNotificationsMarkAllRead.
  ///
  /// In uz, this message translates to:
  /// **'Barchasini o\'qilgan deb belgilash'**
  String get saNotificationsMarkAllRead;

  /// No description provided for @saNotificationsReadAction.
  ///
  /// In uz, this message translates to:
  /// **'O\'qildi'**
  String get saNotificationsReadAction;

  /// No description provided for @saNotificationsTitle.
  ///
  /// In uz, this message translates to:
  /// **'Bildirishnomalar'**
  String get saNotificationsTitle;

  /// No description provided for @saOpen.
  ///
  /// In uz, this message translates to:
  /// **'Ochiq'**
  String get saOpen;

  /// No description provided for @saOpenTripReceipt.
  ///
  /// In uz, this message translates to:
  /// **'Safar chekini ochish'**
  String get saOpenTripReceipt;

  /// No description provided for @saOrderAccepted.
  ///
  /// In uz, this message translates to:
  /// **'Buyurtma qabul qilindi'**
  String get saOrderAccepted;

  /// No description provided for @saOrderHistory.
  ///
  /// In uz, this message translates to:
  /// **'Buyurtmalar tarixi'**
  String get saOrderHistory;

  /// No description provided for @saOrderNotSent.
  ///
  /// In uz, this message translates to:
  /// **'Buyurtma yuborilmadi'**
  String get saOrderNotSent;

  /// No description provided for @saOrderNumber.
  ///
  /// In uz, this message translates to:
  /// **'Buyurtma raqami: {number}'**
  String saOrderNumber(String number);

  /// No description provided for @saOrderNumberLabel.
  ///
  /// In uz, this message translates to:
  /// **'Buyurtma raqami'**
  String get saOrderNumberLabel;

  /// No description provided for @saOrderPaidOnlineHint.
  ///
  /// In uz, this message translates to:
  /// **'To\'lov qabul qilindi. Holatni «Buyurtmalar» bo\'limida kuzating.'**
  String get saOrderPaidOnlineHint;

  /// No description provided for @saOrderPayOnDeliveryHint.
  ///
  /// In uz, this message translates to:
  /// **'Yetkazib berishda to\'laysiz. Holatni «Buyurtmalar» bo\'limida kuzating.'**
  String get saOrderPayOnDeliveryHint;

  /// No description provided for @saOrdersActive.
  ///
  /// In uz, this message translates to:
  /// **'Faol'**
  String get saOrdersActive;

  /// No description provided for @saOrdersHistory.
  ///
  /// In uz, this message translates to:
  /// **'Tarix'**
  String get saOrdersHistory;

  /// No description provided for @saOrdersNoActiveMessage.
  ///
  /// In uz, this message translates to:
  /// **'Taksi chaqiring yoki ovqat buyurtma qiling — jonli buyurtma shu yerda kuzatiladi.'**
  String get saOrdersNoActiveMessage;

  /// No description provided for @saOrdersNoActiveTitle.
  ///
  /// In uz, this message translates to:
  /// **'Faol buyurtma yo\'q'**
  String get saOrdersNoActiveTitle;

  /// No description provided for @saOrdersNoHistoryMessage.
  ///
  /// In uz, this message translates to:
  /// **'Yakunlangan buyurtmalar shu yerda saqlanadi.'**
  String get saOrdersNoHistoryMessage;

  /// No description provided for @saOrdersNoHistoryTitle.
  ///
  /// In uz, this message translates to:
  /// **'Buyurtmalar tarixi yo\'q'**
  String get saOrdersNoHistoryTitle;

  /// No description provided for @saOrdersTitle.
  ///
  /// In uz, this message translates to:
  /// **'Buyurtmalar'**
  String get saOrdersTitle;

  /// No description provided for @saParcelContinue.
  ///
  /// In uz, this message translates to:
  /// **'Manzilni tanlash'**
  String get saParcelContinue;

  /// No description provided for @saParcelPinInfo.
  ///
  /// In uz, this message translates to:
  /// **'Haydovchi posilkani faqat PIN kod bilan topshiradi. Kodni buyurtma berganingizdan keyin ko\'rasiz — uni qabul qiluvchiga ayting.'**
  String get saParcelPinInfo;

  /// No description provided for @saParcelRecipientName.
  ///
  /// In uz, this message translates to:
  /// **'Qabul qiluvchi ismi (ixtiyoriy)'**
  String get saParcelRecipientName;

  /// No description provided for @saParcelRecipientPhone.
  ///
  /// In uz, this message translates to:
  /// **'Qabul qiluvchi telefoni'**
  String get saParcelRecipientPhone;

  /// No description provided for @saParcelSize.
  ///
  /// In uz, this message translates to:
  /// **'O\'lchami'**
  String get saParcelSize;

  /// No description provided for @saParcelSizeLarge.
  ///
  /// In uz, this message translates to:
  /// **'Katta'**
  String get saParcelSizeLarge;

  /// No description provided for @saParcelSizeLargeHint.
  ///
  /// In uz, this message translates to:
  /// **'Bagajga sig\'adi'**
  String get saParcelSizeLargeHint;

  /// No description provided for @saParcelSizeMedium.
  ///
  /// In uz, this message translates to:
  /// **'O\'rta'**
  String get saParcelSizeMedium;

  /// No description provided for @saParcelSizeMediumHint.
  ///
  /// In uz, this message translates to:
  /// **'Sumka, quti'**
  String get saParcelSizeMediumHint;

  /// No description provided for @saParcelSizeSmall.
  ///
  /// In uz, this message translates to:
  /// **'Kichik'**
  String get saParcelSizeSmall;

  /// No description provided for @saParcelSizeSmallHint.
  ///
  /// In uz, this message translates to:
  /// **'Kalit, hujjat'**
  String get saParcelSizeSmallHint;

  /// No description provided for @saParcelSubtitle.
  ///
  /// In uz, this message translates to:
  /// **'Kalit, hujjat yoki buyumni shahar ichida yetkazamiz'**
  String get saParcelSubtitle;

  /// No description provided for @saParcelTitle.
  ///
  /// In uz, this message translates to:
  /// **'Posilka yuborish'**
  String get saParcelTitle;

  /// No description provided for @saParcelWhat.
  ///
  /// In uz, this message translates to:
  /// **'Nima yuboryapsiz?'**
  String get saParcelWhat;

  /// No description provided for @saParcelWhatHint.
  ///
  /// In uz, this message translates to:
  /// **'Masalan: kalitlar, hujjatlar'**
  String get saParcelWhatHint;

  /// No description provided for @saParcelWhatRequired.
  ///
  /// In uz, this message translates to:
  /// **'Nima yuborilayotganini yozing'**
  String get saParcelWhatRequired;

  /// No description provided for @saPaymentCard.
  ///
  /// In uz, this message translates to:
  /// **'Karta (Payme / Click)'**
  String get saPaymentCard;

  /// No description provided for @saPaymentCash.
  ///
  /// In uz, this message translates to:
  /// **'Naqd pul'**
  String get saPaymentCash;

  /// No description provided for @saPaymentIPaid.
  ///
  /// In uz, this message translates to:
  /// **'To\'ladim'**
  String get saPaymentIPaid;

  /// No description provided for @saPaymentMethod.
  ///
  /// In uz, this message translates to:
  /// **'To\'lov usuli'**
  String get saPaymentMethod;

  /// No description provided for @saPaymentNotCompleted.
  ///
  /// In uz, this message translates to:
  /// **'To\'lov yakunlanmadi — buyurtma qabul qilindi, to\'lovni keyinroq amalga oshirishingiz mumkin'**
  String get saPaymentNotCompleted;

  /// No description provided for @saPaymentPageLoadFailed.
  ///
  /// In uz, this message translates to:
  /// **'To\'lov sahifasini yuklab bo\'lmadi: {message}'**
  String saPaymentPageLoadFailed(String message);

  /// No description provided for @saPaymentStartFailed.
  ///
  /// In uz, this message translates to:
  /// **'To\'lovni boshlab bo\'lmadi: {message}'**
  String saPaymentStartFailed(String message);

  /// No description provided for @saPaymentTitle.
  ///
  /// In uz, this message translates to:
  /// **'To\'lov — {provider}'**
  String saPaymentTitle(String provider);

  /// No description provided for @saPickup.
  ///
  /// In uz, this message translates to:
  /// **'Olib ketish'**
  String get saPickup;

  /// No description provided for @saPopularRestaurants.
  ///
  /// In uz, this message translates to:
  /// **'Mashhur restoranlar'**
  String get saPopularRestaurants;

  /// No description provided for @saProductDeliveryLabel.
  ///
  /// In uz, this message translates to:
  /// **'YETKAZISH'**
  String get saProductDeliveryLabel;

  /// No description provided for @saProductDeliveryValue.
  ///
  /// In uz, this message translates to:
  /// **'15–25 daq'**
  String get saProductDeliveryValue;

  /// No description provided for @saProductDescription.
  ///
  /// In uz, this message translates to:
  /// **'Yangi va sifatli mahsulot, yaqin do\'kondan tez yetkazib beriladi.'**
  String get saProductDescription;

  /// No description provided for @saProductInStock.
  ///
  /// In uz, this message translates to:
  /// **'Mavjud'**
  String get saProductInStock;

  /// No description provided for @saProductOutOfStock.
  ///
  /// In uz, this message translates to:
  /// **'Tugagan'**
  String get saProductOutOfStock;

  /// No description provided for @saProductRatingLabel.
  ///
  /// In uz, this message translates to:
  /// **'REYTING'**
  String get saProductRatingLabel;

  /// No description provided for @saProductStockLabel.
  ///
  /// In uz, this message translates to:
  /// **'OMBOR'**
  String get saProductStockLabel;

  /// No description provided for @saProductStoreUnit.
  ///
  /// In uz, this message translates to:
  /// **'Do\'kon · {unit}'**
  String saProductStoreUnit(String unit);

  /// No description provided for @saProductsCount.
  ///
  /// In uz, this message translates to:
  /// **'{count} ta mahsulot'**
  String saProductsCount(int count);

  /// No description provided for @saProfileHelpBannerLabel.
  ///
  /// In uz, this message translates to:
  /// **'Yordam kerakmi? 24/7 qo\'llab-quvvatlash xizmati'**
  String get saProfileHelpBannerLabel;

  /// No description provided for @saProfileNeedHelp.
  ///
  /// In uz, this message translates to:
  /// **'Yordam kerakmi?'**
  String get saProfileNeedHelp;

  /// No description provided for @saProfileRating.
  ///
  /// In uz, this message translates to:
  /// **'Reyting'**
  String get saProfileRating;

  /// No description provided for @saProfileSupport247.
  ///
  /// In uz, this message translates to:
  /// **'24/7 qo\'llab-quvvatlash xizmati'**
  String get saProfileSupport247;

  /// No description provided for @saProfileTrips.
  ///
  /// In uz, this message translates to:
  /// **'Safarlar'**
  String get saProfileTrips;

  /// No description provided for @saPromoActive.
  ///
  /// In uz, this message translates to:
  /// **'FAOL'**
  String get saPromoActive;

  /// No description provided for @saPromoCodeCopied.
  ///
  /// In uz, this message translates to:
  /// **'Kod nusxalandi'**
  String get saPromoCodeCopied;

  /// No description provided for @saPromoCopyLabel.
  ///
  /// In uz, this message translates to:
  /// **'Promokodni nusxalash: {code}'**
  String saPromoCopyLabel(String code);

  /// No description provided for @saPromoMinOrder.
  ///
  /// In uz, this message translates to:
  /// **'Min. buyurtma: {amount}'**
  String saPromoMinOrder(String amount);

  /// No description provided for @saPromoUntil.
  ///
  /// In uz, this message translates to:
  /// **'{date}gacha'**
  String saPromoUntil(String date);

  /// No description provided for @saPromosEmpty.
  ///
  /// In uz, this message translates to:
  /// **'Hozircha faol promokodlar yo\'q'**
  String get saPromosEmpty;

  /// No description provided for @saPromosTitle.
  ///
  /// In uz, this message translates to:
  /// **'Aksiyalar va promokodlar'**
  String get saPromosTitle;

  /// No description provided for @saQtyDecrease.
  ///
  /// In uz, this message translates to:
  /// **'Miqdorni kamaytirish'**
  String get saQtyDecrease;

  /// No description provided for @saQtyIncrease.
  ///
  /// In uz, this message translates to:
  /// **'Miqdorni oshirish'**
  String get saQtyIncrease;

  /// No description provided for @saRefresh.
  ///
  /// In uz, this message translates to:
  /// **'Yangilash'**
  String get saRefresh;

  /// No description provided for @saRestaurantNotFound.
  ///
  /// In uz, this message translates to:
  /// **'Restoran topilmadi'**
  String get saRestaurantNotFound;

  /// No description provided for @saRestaurantsNotFound.
  ///
  /// In uz, this message translates to:
  /// **'Restoranlar topilmadi'**
  String get saRestaurantsNotFound;

  /// No description provided for @saSavedAddresses.
  ///
  /// In uz, this message translates to:
  /// **'Saqlangan manzillar'**
  String get saSavedAddresses;

  /// No description provided for @saSearch.
  ///
  /// In uz, this message translates to:
  /// **'Qidiruv'**
  String get saSearch;

  /// No description provided for @saSearchClear.
  ///
  /// In uz, this message translates to:
  /// **'Qidiruvni tozalash'**
  String get saSearchClear;

  /// No description provided for @saSearchEmptyMessage.
  ///
  /// In uz, this message translates to:
  /// **'Boshqa nom bilan qidirib ko\'ring.'**
  String get saSearchEmptyMessage;

  /// No description provided for @saSearchEmptyTitle.
  ///
  /// In uz, this message translates to:
  /// **'Hech narsa topilmadi'**
  String get saSearchEmptyTitle;

  /// No description provided for @saSearchHint.
  ///
  /// In uz, this message translates to:
  /// **'taom, doʻkon, mahsulot…'**
  String get saSearchHint;

  /// No description provided for @saSearchMarketUnit.
  ///
  /// In uz, this message translates to:
  /// **'Market · {unit}'**
  String saSearchMarketUnit(String unit);

  /// No description provided for @saSearchSectionProducts.
  ///
  /// In uz, this message translates to:
  /// **'MAHSULOTLAR'**
  String get saSearchSectionProducts;

  /// No description provided for @saSearchSectionRestaurants.
  ///
  /// In uz, this message translates to:
  /// **'RESTORANLAR'**
  String get saSearchSectionRestaurants;

  /// No description provided for @saSearchingDriver.
  ///
  /// In uz, this message translates to:
  /// **'Haydovchi qidirilmoqda'**
  String get saSearchingDriver;

  /// No description provided for @saSeeAll.
  ///
  /// In uz, this message translates to:
  /// **'Barchasi'**
  String get saSeeAll;

  /// No description provided for @saSegChipLabel.
  ///
  /// In uz, this message translates to:
  /// **'{label}, {count} ta'**
  String saSegChipLabel(String label, int count);

  /// No description provided for @saSegChipLabelSelected.
  ///
  /// In uz, this message translates to:
  /// **'{label}, {count} ta, tanlangan'**
  String saSegChipLabelSelected(String label, int count);

  /// No description provided for @saSend.
  ///
  /// In uz, this message translates to:
  /// **'Yuborish'**
  String get saSend;

  /// No description provided for @saSettingsPush.
  ///
  /// In uz, this message translates to:
  /// **'Push bildirishnomalar'**
  String get saSettingsPush;

  /// No description provided for @saSettingsPushSyncFailed.
  ///
  /// In uz, this message translates to:
  /// **'Sozlama saqlandi, lekin serverga yuborilmadi'**
  String get saSettingsPushSyncFailed;

  /// No description provided for @saSettingsSectionGeneral.
  ///
  /// In uz, this message translates to:
  /// **'UMUMIY'**
  String get saSettingsSectionGeneral;

  /// No description provided for @saSettingsSectionHelp.
  ///
  /// In uz, this message translates to:
  /// **'YORDAM'**
  String get saSettingsSectionHelp;

  /// No description provided for @saSettingsTitle.
  ///
  /// In uz, this message translates to:
  /// **'Sozlamalar'**
  String get saSettingsTitle;

  /// No description provided for @saSettingsVersion.
  ///
  /// In uz, this message translates to:
  /// **'Angren Go · versiya {version}'**
  String saSettingsVersion(String version);

  /// No description provided for @saSom.
  ///
  /// In uz, this message translates to:
  /// **'so\'m'**
  String get saSom;

  /// No description provided for @saStageAccepted.
  ///
  /// In uz, this message translates to:
  /// **'Qabul qilindi'**
  String get saStageAccepted;

  /// No description provided for @saStageDelivered.
  ///
  /// In uz, this message translates to:
  /// **'Yetkazildi'**
  String get saStageDelivered;

  /// No description provided for @saStageDriverEnRoute.
  ///
  /// In uz, this message translates to:
  /// **'Haydovchi yo\'lda'**
  String get saStageDriverEnRoute;

  /// No description provided for @saStageInTrip.
  ///
  /// In uz, this message translates to:
  /// **'Safarda'**
  String get saStageInTrip;

  /// No description provided for @saStageOnTheWay.
  ///
  /// In uz, this message translates to:
  /// **'Yo\'lda'**
  String get saStageOnTheWay;

  /// No description provided for @saStagePacking.
  ///
  /// In uz, this message translates to:
  /// **'Yig\'ilmoqda'**
  String get saStagePacking;

  /// No description provided for @saStagePreparing.
  ///
  /// In uz, this message translates to:
  /// **'Tayyorlanmoqda'**
  String get saStagePreparing;

  /// No description provided for @saStageProgress.
  ///
  /// In uz, this message translates to:
  /// **'{total} bosqichdan {step}: {stage}'**
  String saStageProgress(int total, int step, String stage);

  /// No description provided for @saStageSearching.
  ///
  /// In uz, this message translates to:
  /// **'Qidirilmoqda'**
  String get saStageSearching;

  /// No description provided for @saSubmitting.
  ///
  /// In uz, this message translates to:
  /// **'Yuborilmoqda...'**
  String get saSubmitting;

  /// No description provided for @saSupportCall.
  ///
  /// In uz, this message translates to:
  /// **'Qo\'ng\'iroq'**
  String get saSupportCall;

  /// No description provided for @saSupportCallSub.
  ///
  /// In uz, this message translates to:
  /// **'{phone} · bepul'**
  String saSupportCallSub(String phone);

  /// No description provided for @saSupportOperatorChat.
  ///
  /// In uz, this message translates to:
  /// **'Operator bilan chat'**
  String get saSupportOperatorChat;

  /// No description provided for @saSupportOperatorChatSub.
  ///
  /// In uz, this message translates to:
  /// **'Savolingizni yozing — operator javob beradi'**
  String get saSupportOperatorChatSub;

  /// No description provided for @saTabHome.
  ///
  /// In uz, this message translates to:
  /// **'Asosiy'**
  String get saTabHome;

  /// No description provided for @saTabOrders.
  ///
  /// In uz, this message translates to:
  /// **'Buyurtma'**
  String get saTabOrders;

  /// No description provided for @saTabProfile.
  ///
  /// In uz, this message translates to:
  /// **'Profil'**
  String get saTabProfile;

  /// No description provided for @saTaxiWhereToLabel.
  ///
  /// In uz, this message translates to:
  /// **'Taksi. Qayerga borasiz?'**
  String get saTaxiWhereToLabel;

  /// No description provided for @saTelegramOpenFailed.
  ///
  /// In uz, this message translates to:
  /// **'Telegramni ochib bo\'lmadi'**
  String get saTelegramOpenFailed;

  /// No description provided for @saTopUpAmountLabel.
  ///
  /// In uz, this message translates to:
  /// **'To\'ldirish summasi'**
  String get saTopUpAmountLabel;

  /// No description provided for @saTopUpOnlineUnavailable.
  ///
  /// In uz, this message translates to:
  /// **'Onlayn to\'ldirish hali ishga tushmagan'**
  String get saTopUpOnlineUnavailable;

  /// No description provided for @saTopUpTitle.
  ///
  /// In uz, this message translates to:
  /// **'Hisobni to\'ldirish'**
  String get saTopUpTitle;

  /// No description provided for @saTopUpViaOperatorHint.
  ///
  /// In uz, this message translates to:
  /// **'Hozircha hamyonni operator orqali to\'ldirasiz: 1056 raqamiga qo\'ng\'iroq qiling yoki chatda yozing. Safarlarni naqd pul bilan ham to\'lash mumkin.'**
  String get saTopUpViaOperatorHint;

  /// No description provided for @saTotal.
  ///
  /// In uz, this message translates to:
  /// **'Jami'**
  String get saTotal;

  /// No description provided for @saTrackCallCourier.
  ///
  /// In uz, this message translates to:
  /// **'Kuryerga qo\'ng\'iroq qilish'**
  String get saTrackCallCourier;

  /// No description provided for @saTrackCancelled.
  ///
  /// In uz, this message translates to:
  /// **'Buyurtma bekor qilindi'**
  String get saTrackCancelled;

  /// No description provided for @saTrackDelivered.
  ///
  /// In uz, this message translates to:
  /// **'Buyurtma yetkazildi'**
  String get saTrackDelivered;

  /// No description provided for @saTrackOnTheWay.
  ///
  /// In uz, this message translates to:
  /// **'Kuryer yo\'lda'**
  String get saTrackOnTheWay;

  /// No description provided for @saTrackOpenMap.
  ///
  /// In uz, this message translates to:
  /// **'Kuryerni xaritada ko\'rish'**
  String get saTrackOpenMap;

  /// No description provided for @saTrackSearching.
  ///
  /// In uz, this message translates to:
  /// **'Kuryer qidirilmoqda'**
  String get saTrackSearching;

  /// No description provided for @saTrackTitle.
  ///
  /// In uz, this message translates to:
  /// **'Kuryer xaritada'**
  String get saTrackTitle;

  /// No description provided for @saTrackWaitingLocation.
  ///
  /// In uz, this message translates to:
  /// **'Kuryer joylashuvi kutilmoqda…'**
  String get saTrackWaitingLocation;

  /// No description provided for @saTxnBonus.
  ///
  /// In uz, this message translates to:
  /// **'Bonus'**
  String get saTxnBonus;

  /// No description provided for @saTxnCommission.
  ///
  /// In uz, this message translates to:
  /// **'Platforma komissiyasi'**
  String get saTxnCommission;

  /// No description provided for @saTxnCredit.
  ///
  /// In uz, this message translates to:
  /// **'kirim'**
  String get saTxnCredit;

  /// No description provided for @saTxnDebit.
  ///
  /// In uz, this message translates to:
  /// **'Yechim'**
  String get saTxnDebit;

  /// No description provided for @saTxnDebitWord.
  ///
  /// In uz, this message translates to:
  /// **'chiqim'**
  String get saTxnDebitWord;

  /// No description provided for @saTxnPending.
  ///
  /// In uz, this message translates to:
  /// **'{when} · kutilmoqda'**
  String saTxnPending(String when);

  /// No description provided for @saTxnReferralBonus.
  ///
  /// In uz, this message translates to:
  /// **'Referal bonus'**
  String get saTxnReferralBonus;

  /// No description provided for @saTxnSemantics.
  ///
  /// In uz, this message translates to:
  /// **'{title}, {amount} so\'m {direction}, {subtitle}'**
  String saTxnSemantics(
      String title, String amount, String direction, String subtitle);

  /// No description provided for @saTxnTopUp.
  ///
  /// In uz, this message translates to:
  /// **'Hisob to\'ldirildi'**
  String get saTxnTopUp;

  /// No description provided for @saTxnTripEarning.
  ///
  /// In uz, this message translates to:
  /// **'Safar daromadi'**
  String get saTxnTripEarning;

  /// No description provided for @saTxnTripPayment.
  ///
  /// In uz, this message translates to:
  /// **'Safar to\'lovi'**
  String get saTxnTripPayment;

  /// No description provided for @saTxnWithdrawal.
  ///
  /// In uz, this message translates to:
  /// **'Pul yechish'**
  String get saTxnWithdrawal;

  /// No description provided for @saViewOrders.
  ///
  /// In uz, this message translates to:
  /// **'Buyurtmalarni koʻrish'**
  String get saViewOrders;

  /// No description provided for @saViewReceipt.
  ///
  /// In uz, this message translates to:
  /// **'Chekni ko\'rish'**
  String get saViewReceipt;

  /// No description provided for @saWalletAllServices.
  ///
  /// In uz, this message translates to:
  /// **'Barcha xizmatlar'**
  String get saWalletAllServices;

  /// No description provided for @saWalletAndCards.
  ///
  /// In uz, this message translates to:
  /// **'Hamyon va kartalar'**
  String get saWalletAndCards;

  /// No description provided for @saWalletBalanceLabel.
  ///
  /// In uz, this message translates to:
  /// **'Hamyon balansi {amount} so\'m'**
  String saWalletBalanceLabel(String amount);

  /// No description provided for @saWalletBalanceNotLoaded.
  ///
  /// In uz, this message translates to:
  /// **'Hamyon balansi hali yuklanmadi'**
  String get saWalletBalanceNotLoaded;

  /// No description provided for @saWalletBalanceTitle.
  ///
  /// In uz, this message translates to:
  /// **'Angren Go balans'**
  String get saWalletBalanceTitle;

  /// No description provided for @saWalletCards.
  ///
  /// In uz, this message translates to:
  /// **'Kartalar'**
  String get saWalletCards;

  /// No description provided for @saWalletCardsUnavailableMessage.
  ///
  /// In uz, this message translates to:
  /// **'Hozircha safarlarni naqd pul yoki hamyon balansi bilan to\'lang.'**
  String get saWalletCardsUnavailableMessage;

  /// No description provided for @saWalletCardsUnavailableTitle.
  ///
  /// In uz, this message translates to:
  /// **'Karta bog\'lash hali mavjud emas'**
  String get saWalletCardsUnavailableTitle;

  /// No description provided for @saWalletNoTxnsMessage.
  ///
  /// In uz, this message translates to:
  /// **'Birinchi safar yoki to\'ldirishdan keyin bu yerda ko\'rinadi.'**
  String get saWalletNoTxnsMessage;

  /// No description provided for @saWalletNoTxnsTitle.
  ///
  /// In uz, this message translates to:
  /// **'Hozircha amallar yo\'q'**
  String get saWalletNoTxnsTitle;

  /// No description provided for @saWalletOneWalletNote.
  ///
  /// In uz, this message translates to:
  /// **'Taksi, yuk, ovqat va market — bitta hamyon, bitta daftar.'**
  String get saWalletOneWalletNote;

  /// No description provided for @saWalletRecentActivity.
  ///
  /// In uz, this message translates to:
  /// **'So\'nggi amallar'**
  String get saWalletRecentActivity;

  /// No description provided for @saWalletTitle.
  ///
  /// In uz, this message translates to:
  /// **'Hamyon'**
  String get saWalletTitle;

  /// No description provided for @saWalletTopUp.
  ///
  /// In uz, this message translates to:
  /// **'To\'ldirish'**
  String get saWalletTopUp;

  /// No description provided for @saWalletTransfer.
  ///
  /// In uz, this message translates to:
  /// **'O\'tkazish'**
  String get saWalletTransfer;

  /// No description provided for @saWhereTo.
  ///
  /// In uz, this message translates to:
  /// **'Qayerga borasiz?'**
  String get saWhereTo;

  /// No description provided for @shAuthContinue.
  ///
  /// In uz, this message translates to:
  /// **'Davom etish'**
  String get shAuthContinue;

  /// No description provided for @shAuthEnterPhone.
  ///
  /// In uz, this message translates to:
  /// **'Telefon raqamingizni kiriting'**
  String get shAuthEnterPhone;

  /// No description provided for @shAuthPhoneLabel.
  ///
  /// In uz, this message translates to:
  /// **'Telefon raqam'**
  String get shAuthPhoneLabel;

  /// No description provided for @shAuthTerms.
  ///
  /// In uz, this message translates to:
  /// **'Davom etish orqali siz foydalanish shartlari va maxfiylik siyosatiga rozilik bildirasiz.'**
  String get shAuthTerms;

  /// No description provided for @shBack.
  ///
  /// In uz, this message translates to:
  /// **'Orqaga'**
  String get shBack;

  /// No description provided for @shCancel.
  ///
  /// In uz, this message translates to:
  /// **'Bekor qilish'**
  String get shCancel;

  /// No description provided for @shChatHint.
  ///
  /// In uz, this message translates to:
  /// **'Xabar yozing...'**
  String get shChatHint;

  /// No description provided for @shConfirm.
  ///
  /// In uz, this message translates to:
  /// **'Tasdiqlash'**
  String get shConfirm;

  /// No description provided for @shDeliveryAccepted.
  ///
  /// In uz, this message translates to:
  /// **'Qabul qilindi'**
  String get shDeliveryAccepted;

  /// No description provided for @shDeliveryDelivered.
  ///
  /// In uz, this message translates to:
  /// **'Yetkazildi'**
  String get shDeliveryDelivered;

  /// No description provided for @shDeliveryOnTheWay.
  ///
  /// In uz, this message translates to:
  /// **'Yo\'lda'**
  String get shDeliveryOnTheWay;

  /// No description provided for @shDeliveryPreparing.
  ///
  /// In uz, this message translates to:
  /// **'Tayyorlanmoqda'**
  String get shDeliveryPreparing;

  /// No description provided for @shDriverFallbackName.
  ///
  /// In uz, this message translates to:
  /// **'Haydovchi'**
  String get shDriverFallbackName;

  /// No description provided for @shErrorGeneric.
  ///
  /// In uz, this message translates to:
  /// **'Xatolik yuz berdi'**
  String get shErrorGeneric;

  /// No description provided for @shErrorNoInternet.
  ///
  /// In uz, this message translates to:
  /// **'Internet bilan muammo bor'**
  String get shErrorNoInternet;

  /// No description provided for @shErrorSemantics.
  ///
  /// In uz, this message translates to:
  /// **'Xatolik: {message}'**
  String shErrorSemantics(String message);

  /// No description provided for @shErrorTimeout.
  ///
  /// In uz, this message translates to:
  /// **'Ulanish vaqti tugadi. Internetni tekshiring'**
  String get shErrorTimeout;

  /// No description provided for @shErrorUnknown.
  ///
  /// In uz, this message translates to:
  /// **'Noma\'lum xatolik yuz berdi'**
  String get shErrorUnknown;

  /// No description provided for @shFareBase.
  ///
  /// In uz, this message translates to:
  /// **'Asos'**
  String get shFareBase;

  /// No description provided for @shFareDistance.
  ///
  /// In uz, this message translates to:
  /// **'Masofa ({km} km × {price})'**
  String shFareDistance(String km, String price);

  /// No description provided for @shFareMaxCap.
  ///
  /// In uz, this message translates to:
  /// **'Yuqori narx chegarasi'**
  String get shFareMaxCap;

  /// No description provided for @shFareMinAdjustment.
  ///
  /// In uz, this message translates to:
  /// **'Eng kam haq tuzatmasi'**
  String get shFareMinAdjustment;

  /// No description provided for @shFareRounding.
  ///
  /// In uz, this message translates to:
  /// **'Yaxlitlash'**
  String get shFareRounding;

  /// No description provided for @shFareSurge.
  ///
  /// In uz, this message translates to:
  /// **'Talab koeffitsienti (×{multiplier})'**
  String shFareSurge(String multiplier);

  /// No description provided for @shFareTime.
  ///
  /// In uz, this message translates to:
  /// **'Vaqt ({minutes} daq × {price})'**
  String shFareTime(int minutes, String price);

  /// No description provided for @shFareWaiting.
  ///
  /// In uz, this message translates to:
  /// **'Kutish ({minutes} daq)'**
  String shFareWaiting(int minutes);

  /// No description provided for @shFareWaitingFree.
  ///
  /// In uz, this message translates to:
  /// **'Kutish (0 daq — bepul vaqtdan oshmadi)'**
  String get shFareWaitingFree;

  /// No description provided for @shFareWaitingRate.
  ///
  /// In uz, this message translates to:
  /// **'Kutish ({minutes} daq × {price})'**
  String shFareWaitingRate(int minutes, String price);

  /// No description provided for @shLoading.
  ///
  /// In uz, this message translates to:
  /// **'Yuklanmoqda'**
  String get shLoading;

  /// No description provided for @shLostItemClosed.
  ///
  /// In uz, this message translates to:
  /// **'Yopildi'**
  String get shLostItemClosed;

  /// No description provided for @shLostItemFound.
  ///
  /// In uz, this message translates to:
  /// **'Topildi — operator bog\'lanadi'**
  String get shLostItemFound;

  /// No description provided for @shLostItemNotFound.
  ///
  /// In uz, this message translates to:
  /// **'Mashinadan topilmadi'**
  String get shLostItemNotFound;

  /// No description provided for @shLostItemOpen.
  ///
  /// In uz, this message translates to:
  /// **'Haydovchi tekshirmoqda'**
  String get shLostItemOpen;

  /// No description provided for @shLostItemReturned.
  ///
  /// In uz, this message translates to:
  /// **'Qaytarildi'**
  String get shLostItemReturned;

  /// No description provided for @shManeuverArrive.
  ///
  /// In uz, this message translates to:
  /// **'Manzilga yetib keldingiz'**
  String get shManeuverArrive;

  /// No description provided for @shManeuverArriveIn.
  ///
  /// In uz, this message translates to:
  /// **'{meters} metrdan keyin manzilga yetib borasiz'**
  String shManeuverArriveIn(int meters);

  /// No description provided for @shManeuverContinue.
  ///
  /// In uz, this message translates to:
  /// **'Yo\'lda davom eting'**
  String get shManeuverContinue;

  /// No description provided for @shManeuverDepart.
  ///
  /// In uz, this message translates to:
  /// **'Yo\'lni boshlang'**
  String get shManeuverDepart;

  /// No description provided for @shManeuverInDistance.
  ///
  /// In uz, this message translates to:
  /// **'{meters} metrdan keyin {instruction}'**
  String shManeuverInDistance(int meters, String instruction);

  /// No description provided for @shManeuverLeft.
  ///
  /// In uz, this message translates to:
  /// **'Chapga buriling'**
  String get shManeuverLeft;

  /// No description provided for @shManeuverRerouting.
  ///
  /// In uz, this message translates to:
  /// **'Marshrutdan chiqdingiz. Yo\'l qayta hisoblanmoqda.'**
  String get shManeuverRerouting;

  /// No description provided for @shManeuverRight.
  ///
  /// In uz, this message translates to:
  /// **'O\'ngga buriling'**
  String get shManeuverRight;

  /// No description provided for @shManeuverSharpLeft.
  ///
  /// In uz, this message translates to:
  /// **'Keskin chapga buriling'**
  String get shManeuverSharpLeft;

  /// No description provided for @shManeuverSharpRight.
  ///
  /// In uz, this message translates to:
  /// **'Keskin o\'ngga buriling'**
  String get shManeuverSharpRight;

  /// No description provided for @shManeuverStraight.
  ///
  /// In uz, this message translates to:
  /// **'To\'g\'ri davom eting'**
  String get shManeuverStraight;

  /// No description provided for @shManeuverUturn.
  ///
  /// In uz, this message translates to:
  /// **'Orqaga qayting'**
  String get shManeuverUturn;

  /// No description provided for @shMarketPacking.
  ///
  /// In uz, this message translates to:
  /// **'Do\'kon yig\'moqda'**
  String get shMarketPacking;

  /// No description provided for @shMeterAtLeast.
  ///
  /// In uz, this message translates to:
  /// **'kamida {price}'**
  String shMeterAtLeast(String price);

  /// No description provided for @shMeterDistanceTime.
  ///
  /// In uz, this message translates to:
  /// **'{distance} · {minutes} daq'**
  String shMeterDistanceTime(String distance, int minutes);

  /// No description provided for @shMeterFinalNote.
  ///
  /// In uz, this message translates to:
  /// **'Yakuniy narx safar tugaganda yo\'l bo\'yicha aniqlanadi'**
  String get shMeterFinalNote;

  /// No description provided for @shMeterNoDestination.
  ///
  /// In uz, this message translates to:
  /// **'Manzil yo\'q — taksometr'**
  String get shMeterNoDestination;

  /// No description provided for @shMeterTitle.
  ///
  /// In uz, this message translates to:
  /// **'Taksometr'**
  String get shMeterTitle;

  /// No description provided for @shNeedsAttentionSemantics.
  ///
  /// In uz, this message translates to:
  /// **'{label}, e\'tibor talab qiladi'**
  String shNeedsAttentionSemantics(String label);

  /// No description provided for @shOrderStatusCompleted.
  ///
  /// In uz, this message translates to:
  /// **'Yakunlandi'**
  String get shOrderStatusCompleted;

  /// No description provided for @shOrderStatusDriverArrived.
  ///
  /// In uz, this message translates to:
  /// **'Haydovchi yetib keldi'**
  String get shOrderStatusDriverArrived;

  /// No description provided for @shOrderStatusDriverAssigned.
  ///
  /// In uz, this message translates to:
  /// **'Haydovchi tayinlandi'**
  String get shOrderStatusDriverAssigned;

  /// No description provided for @shOrderStatusDriverEnRoute.
  ///
  /// In uz, this message translates to:
  /// **'Haydovchi kelmoqda'**
  String get shOrderStatusDriverEnRoute;

  /// No description provided for @shOrderStatusInProgress.
  ///
  /// In uz, this message translates to:
  /// **'Sayohat davom etmoqda'**
  String get shOrderStatusInProgress;

  /// No description provided for @shOrderStatusScheduled.
  ///
  /// In uz, this message translates to:
  /// **'Rejalashtirilgan'**
  String get shOrderStatusScheduled;

  /// No description provided for @shOrderStatusSearching.
  ///
  /// In uz, this message translates to:
  /// **'Haydovchi izlanmoqda'**
  String get shOrderStatusSearching;

  /// No description provided for @shOtpEnterSixDigits.
  ///
  /// In uz, this message translates to:
  /// **'6 ta raqamli kodni kiriting'**
  String get shOtpEnterSixDigits;

  /// No description provided for @shOtpHeading.
  ///
  /// In uz, this message translates to:
  /// **'SMS kod kiriting'**
  String get shOtpHeading;

  /// No description provided for @shOtpResend.
  ///
  /// In uz, this message translates to:
  /// **'Kodni qayta yuborish'**
  String get shOtpResend;

  /// No description provided for @shOtpResendIn.
  ///
  /// In uz, this message translates to:
  /// **'Qayta yuborish: {seconds} s'**
  String shOtpResendIn(int seconds);

  /// No description provided for @shOtpSentPrefix.
  ///
  /// In uz, this message translates to:
  /// **'Kod '**
  String get shOtpSentPrefix;

  /// No description provided for @shOtpSentSuffix.
  ///
  /// In uz, this message translates to:
  /// **' raqamiga yuborildi'**
  String get shOtpSentSuffix;

  /// No description provided for @shOtpTitle.
  ///
  /// In uz, this message translates to:
  /// **'Tasdiqlash'**
  String get shOtpTitle;

  /// No description provided for @shPayMethodCard.
  ///
  /// In uz, this message translates to:
  /// **'Karta'**
  String get shPayMethodCard;

  /// No description provided for @shPayMethodCash.
  ///
  /// In uz, this message translates to:
  /// **'Naqd pul'**
  String get shPayMethodCash;

  /// No description provided for @shPayMethodWallet.
  ///
  /// In uz, this message translates to:
  /// **'Hamyon'**
  String get shPayMethodWallet;

  /// No description provided for @shPayStatusFailed.
  ///
  /// In uz, this message translates to:
  /// **'Amalga oshmadi'**
  String get shPayStatusFailed;

  /// No description provided for @shPayStatusPaid.
  ///
  /// In uz, this message translates to:
  /// **'To\'landi'**
  String get shPayStatusPaid;

  /// No description provided for @shPayStatusRefunded.
  ///
  /// In uz, this message translates to:
  /// **'Qaytarildi'**
  String get shPayStatusRefunded;

  /// No description provided for @shReceiptDate.
  ///
  /// In uz, this message translates to:
  /// **'Sana: {date}'**
  String shReceiptDate(String date);

  /// No description provided for @shReceiptDiscount.
  ///
  /// In uz, this message translates to:
  /// **'Chegirma{promo}: −{amount}'**
  String shReceiptDiscount(String promo, String amount);

  /// No description provided for @shReceiptDistance.
  ///
  /// In uz, this message translates to:
  /// **'Masofa: {distance}'**
  String shReceiptDistance(String distance);

  /// No description provided for @shReceiptDriver.
  ///
  /// In uz, this message translates to:
  /// **'Haydovchi: {driver}'**
  String shReceiptDriver(String driver);

  /// No description provided for @shReceiptDropoff.
  ///
  /// In uz, this message translates to:
  /// **'Tushish: {address}'**
  String shReceiptDropoff(String address);

  /// No description provided for @shReceiptDuration.
  ///
  /// In uz, this message translates to:
  /// **'Davomiyligi: {duration}'**
  String shReceiptDuration(String duration);

  /// No description provided for @shReceiptGrandTotal.
  ///
  /// In uz, this message translates to:
  /// **'Yakuniy: {amount}'**
  String shReceiptGrandTotal(String amount);

  /// No description provided for @shReceiptHeader.
  ///
  /// In uz, this message translates to:
  /// **'Angren Go — safar cheki'**
  String get shReceiptHeader;

  /// No description provided for @shReceiptMeteredDropoff.
  ///
  /// In uz, this message translates to:
  /// **'Taksometr bo\'yicha (manzilsiz)'**
  String get shReceiptMeteredDropoff;

  /// No description provided for @shReceiptNoFareBreakdown.
  ///
  /// In uz, this message translates to:
  /// **'Narx tarkibi saqlanmagan.'**
  String get shReceiptNoFareBreakdown;

  /// No description provided for @shReceiptNotSaved.
  ///
  /// In uz, this message translates to:
  /// **'saqlanmagan'**
  String get shReceiptNotSaved;

  /// No description provided for @shReceiptOrder.
  ///
  /// In uz, this message translates to:
  /// **'Buyurtma: {number}'**
  String shReceiptOrder(String number);

  /// No description provided for @shReceiptPayment.
  ///
  /// In uz, this message translates to:
  /// **'To\'lov: {payment}'**
  String shReceiptPayment(String payment);

  /// No description provided for @shReceiptPickup.
  ///
  /// In uz, this message translates to:
  /// **'Olib ketish: {address}'**
  String shReceiptPickup(String address);

  /// No description provided for @shReceiptService.
  ///
  /// In uz, this message translates to:
  /// **'Xizmat: {service}'**
  String shReceiptService(String service);

  /// No description provided for @shReceiptStop.
  ///
  /// In uz, this message translates to:
  /// **'To\'xtash {index}: {address}'**
  String shReceiptStop(int index, String address);

  /// No description provided for @shReceiptTariff.
  ///
  /// In uz, this message translates to:
  /// **'Tarif: {tariff}'**
  String shReceiptTariff(String tariff);

  /// No description provided for @shReceiptTip.
  ///
  /// In uz, this message translates to:
  /// **'Chaqim: +{amount}'**
  String shReceiptTip(String amount);

  /// No description provided for @shReceiptTotal.
  ///
  /// In uz, this message translates to:
  /// **'Jami: {amount}'**
  String shReceiptTotal(String amount);

  /// No description provided for @shReceiptUnpaid.
  ///
  /// In uz, this message translates to:
  /// **'To\'lanmagan qoldiq: {amount}'**
  String shReceiptUnpaid(String amount);

  /// No description provided for @shRetry.
  ///
  /// In uz, this message translates to:
  /// **'Qayta urinish'**
  String get shRetry;

  /// No description provided for @shRouteFromSemantics.
  ///
  /// In uz, this message translates to:
  /// **'Qayerdan: {address}'**
  String shRouteFromSemantics(String address);

  /// No description provided for @shRouteSwap.
  ///
  /// In uz, this message translates to:
  /// **'Manzillarni almashtirish'**
  String get shRouteSwap;

  /// No description provided for @shRouteToSemantics.
  ///
  /// In uz, this message translates to:
  /// **'Qayerga: {address}'**
  String shRouteToSemantics(String address);

  /// No description provided for @shRouteToWithDistanceSemantics.
  ///
  /// In uz, this message translates to:
  /// **'Qayerga: {address}, {distance}'**
  String shRouteToWithDistanceSemantics(String address, String distance);

  /// No description provided for @shSend.
  ///
  /// In uz, this message translates to:
  /// **'Yuborish'**
  String get shSend;

  /// No description provided for @shServiceCargo.
  ///
  /// In uz, this message translates to:
  /// **'Yuk tashish'**
  String get shServiceCargo;

  /// No description provided for @shServiceCargoShort.
  ///
  /// In uz, this message translates to:
  /// **'Yuk'**
  String get shServiceCargoShort;

  /// No description provided for @shServiceFood.
  ///
  /// In uz, this message translates to:
  /// **'Ovqat yetkazish'**
  String get shServiceFood;

  /// No description provided for @shServiceFoodShort.
  ///
  /// In uz, this message translates to:
  /// **'Ovqat'**
  String get shServiceFoodShort;

  /// No description provided for @shServiceMarket.
  ///
  /// In uz, this message translates to:
  /// **'Do\'kon yetkazish'**
  String get shServiceMarket;

  /// No description provided for @shServiceMarketShort.
  ///
  /// In uz, this message translates to:
  /// **'Market'**
  String get shServiceMarketShort;

  /// No description provided for @shServiceParcelShort.
  ///
  /// In uz, this message translates to:
  /// **'Posilka'**
  String get shServiceParcelShort;

  /// No description provided for @shServiceTaxi.
  ///
  /// In uz, this message translates to:
  /// **'Taksi'**
  String get shServiceTaxi;

  /// No description provided for @shStatusCancelled.
  ///
  /// In uz, this message translates to:
  /// **'Bekor qilindi'**
  String get shStatusCancelled;

  /// No description provided for @shStatusPending.
  ///
  /// In uz, this message translates to:
  /// **'Kutilmoqda'**
  String get shStatusPending;

  /// No description provided for @shStatusSemantics.
  ///
  /// In uz, this message translates to:
  /// **'Holat: {status}'**
  String shStatusSemantics(String status);

  /// No description provided for @shSupportChatEmpty.
  ///
  /// In uz, this message translates to:
  /// **'Xabar yozing — operatorlarimiz 24/7 yordam berishga tayyor'**
  String get shSupportChatEmpty;

  /// No description provided for @shSupportChatTitle.
  ///
  /// In uz, this message translates to:
  /// **'Operator bilan chat'**
  String get shSupportChatTitle;

  /// No description provided for @shTripChatEmpty.
  ///
  /// In uz, this message translates to:
  /// **'Hali xabar yo\'q. Birinchi bo\'lib yozing!'**
  String get shTripChatEmpty;

  /// No description provided for @shTripChatTitle.
  ///
  /// In uz, this message translates to:
  /// **'Suhbat'**
  String get shTripChatTitle;

  /// No description provided for @shTripOptionAirConditioner.
  ///
  /// In uz, this message translates to:
  /// **'Konditsioner'**
  String get shTripOptionAirConditioner;

  /// No description provided for @shTripOptionBigLuggage.
  ///
  /// In uz, this message translates to:
  /// **'Katta bagaj'**
  String get shTripOptionBigLuggage;

  /// No description provided for @shTripOptionChildSeat.
  ///
  /// In uz, this message translates to:
  /// **'Bola o\'rindig\'i'**
  String get shTripOptionChildSeat;

  /// No description provided for @shTripOptionPet.
  ///
  /// In uz, this message translates to:
  /// **'Hayvon bilan'**
  String get shTripOptionPet;

  /// No description provided for @shTxBonus.
  ///
  /// In uz, this message translates to:
  /// **'Bonus'**
  String get shTxBonus;

  /// No description provided for @shTxTopUp.
  ///
  /// In uz, this message translates to:
  /// **'Hisobni to\'ldirish'**
  String get shTxTopUp;

  /// No description provided for @shTxTrip.
  ///
  /// In uz, this message translates to:
  /// **'Sayohat'**
  String get shTxTrip;

  /// No description provided for @shTxWithdrawal.
  ///
  /// In uz, this message translates to:
  /// **'Pul yechish'**
  String get shTxWithdrawal;

  /// No description provided for @shValDigitsOnly.
  ///
  /// In uz, this message translates to:
  /// **'Faqat raqamlar kiriting'**
  String get shValDigitsOnly;

  /// No description provided for @shValFieldRequired.
  ///
  /// In uz, this message translates to:
  /// **'{field} bo\'sh bo\'lmasligi kerak'**
  String shValFieldRequired(String field);

  /// No description provided for @shValNameRequired.
  ///
  /// In uz, this message translates to:
  /// **'Ismni kiriting'**
  String get shValNameRequired;

  /// No description provided for @shValNameTooShort.
  ///
  /// In uz, this message translates to:
  /// **'Ism kamida 2 ta harfdan iborat bo\'lishi kerak'**
  String get shValNameTooShort;

  /// No description provided for @shValOtpLength.
  ///
  /// In uz, this message translates to:
  /// **'Kod 6 raqamdan iborat bo\'lishi kerak'**
  String get shValOtpLength;

  /// No description provided for @shValOtpRequired.
  ///
  /// In uz, this message translates to:
  /// **'Kodni kiriting'**
  String get shValOtpRequired;

  /// No description provided for @shValPhoneInvalid.
  ///
  /// In uz, this message translates to:
  /// **'Telefon raqami noto\'g\'ri (+998XXXXXXXXX)'**
  String get shValPhoneInvalid;

  /// No description provided for @shValPhoneRequired.
  ///
  /// In uz, this message translates to:
  /// **'Telefon raqamini kiriting'**
  String get shValPhoneRequired;

  /// No description provided for @shValThisFieldRequired.
  ///
  /// In uz, this message translates to:
  /// **'Bu maydon bo\'sh bo\'lmasligi kerak'**
  String get shValThisFieldRequired;

  /// No description provided for @shVerifDaysLeft.
  ///
  /// In uz, this message translates to:
  /// **'{days} kun qoldi'**
  String shVerifDaysLeft(int days);

  /// No description provided for @shVerifDaysOverdue.
  ///
  /// In uz, this message translates to:
  /// **'{days} kun kechikkan'**
  String shVerifDaysOverdue(int days);

  /// No description provided for @shVerifDueSoon.
  ///
  /// In uz, this message translates to:
  /// **'Muddati tugayapti'**
  String get shVerifDueSoon;

  /// No description provided for @shVerifExpiresToday.
  ///
  /// In uz, this message translates to:
  /// **'Bugun tugaydi'**
  String get shVerifExpiresToday;

  /// No description provided for @shVerifMissing.
  ///
  /// In uz, this message translates to:
  /// **'Yuklanmagan'**
  String get shVerifMissing;

  /// No description provided for @shVerifOk.
  ///
  /// In uz, this message translates to:
  /// **'Yaroqli'**
  String get shVerifOk;

  /// No description provided for @shVerifOverdue.
  ///
  /// In uz, this message translates to:
  /// **'Muddati o\'tgan'**
  String get shVerifOverdue;

  /// No description provided for @shVerifPendingReview.
  ///
  /// In uz, this message translates to:
  /// **'Tekshirilmoqda'**
  String get shVerifPendingReview;

  /// No description provided for @shVerifRejected.
  ///
  /// In uz, this message translates to:
  /// **'Rad etilgan'**
  String get shVerifRejected;

  /// No description provided for @shVerifUnknown.
  ///
  /// In uz, this message translates to:
  /// **'E\'tibor talab qiladi'**
  String get shVerifUnknown;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['ru', 'uz'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'ru':
      return AppLocalizationsRu();
    case 'uz':
      return AppLocalizationsUz();
  }

  throw FlutterError(
      'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
      'an issue with the localizations generation tool. Please file an issue '
      'on GitHub with a reproducible sample app and the gen-l10n configuration '
      'that was used.');
}
