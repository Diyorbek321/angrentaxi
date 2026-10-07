// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Russian (`ru`).
class AppLocalizationsRu extends AppLocalizations {
  AppLocalizationsRu([String locale = 'ru']) : super(locale);

  @override
  String get appLanguage => 'Язык приложения';

  @override
  String get authWrongAppDriver =>
      'Этот номер зарегистрирован как водитель. Используйте приложение для водителей или войдите как пассажир с другим номером.';

  @override
  String get authWrongAppStaff =>
      'С этим номером в это приложение не войти. Аккаунт администратора работает только в панели управления; сотрудники и продавцы вызывают такси через приложение пассажира.';

  @override
  String get commonCancel => 'Отмена';

  @override
  String get commonDone => 'Готово';

  @override
  String get commonErrorTitle => 'Произошла ошибка';

  @override
  String get commonRetry => 'Повторить';

  @override
  String get commonSave => 'Сохранить';

  @override
  String get commonSend => 'Отправить';

  @override
  String get drvAbout => 'О приложении';

  @override
  String get drvAccept => 'Принять';

  @override
  String get drvAcceptFailed => 'Не удалось принять заказ';

  @override
  String get drvAcceptedOrders => 'Принимаемые заказы';

  @override
  String get drvAmenitiesIntro =>
      'Отметьте, что есть в вашей машине, — если пассажир попросит это, заказ придёт вам.';

  @override
  String get drvAmenitiesTitle => 'Дополнительные опции';

  @override
  String get drvAmenitiesWarning =>
      'Не отмечайте то, чего нет в машине: пассажир будет ждать детское кресло и отменит поездку.';

  @override
  String get drvAmount => 'Сумма';

  @override
  String drvAmountExceedsWallet(String balance) {
    return 'Сумма больше баланса. Кошелёк: $balance';
  }

  @override
  String get drvAmountHint => 'Например: 60000';

  @override
  String get drvAppName => 'Angren Taxi — Водитель';

  @override
  String drvApplicationIntro(String phone) {
    return 'Номер $phone ещё не зарегистрирован как водитель. Укажите данные автомобиля — после одобрения администратором вы сможете выйти на линию.';
  }

  @override
  String get drvApplicationPending => 'Заявка на рассмотрении';

  @override
  String get drvApplicationPendingBody =>
      'Ваша заявка ждёт одобрения администратором. После одобрения вы автоматически продолжите отсюда.';

  @override
  String get drvApplicationRoleWarning =>
      'Внимание: после отправки заявки этот номер станет аккаунтом водителя, и с ним нельзя будет заказывать такси, еду или товары в приложении для пассажиров. Для поездок как пассажир понадобится другой номер.';

  @override
  String get drvApplicationTitle => 'Заявка на работу водителем';

  @override
  String get drvArrivedCargo => 'Вы на месте загрузки!';

  @override
  String get drvArrivedParcel => 'Вы на месте получения посылки!';

  @override
  String get drvArrivedRestaurant => 'Вы в ресторане!';

  @override
  String get drvArrivedShop => 'Вы в магазине!';

  @override
  String get drvArrivedTaxi => 'Вы на месте посадки!';

  @override
  String get drvArrivedTitle => 'Я на месте';

  @override
  String get drvBack => 'Назад';

  @override
  String drvBalanceNegative(String balance) {
    return 'Баланс отрицательный ($balance). Сначала погасите долг.';
  }

  @override
  String get drvBankAndWithdraw => 'Банковский счёт и вывод';

  @override
  String drvBonusDone(String amount) {
    return 'Выполнено — $amount';
  }

  @override
  String get drvBonusProgram => 'Бонусная программа';

  @override
  String drvBonusRemaining(int count, String amount) {
    return 'Ещё $count поездок — $amount';
  }

  @override
  String drvBonusTrips(int current, int threshold) {
    return '$current/$threshold поездок';
  }

  @override
  String get drvCall => 'Позвонить';

  @override
  String get drvCallCustomer => 'Позвонить клиенту';

  @override
  String get drvCallFailed => 'Не удалось позвонить';

  @override
  String get drvCallRecipient => 'Позвонить получателю';

  @override
  String get drvCallSeller => 'Позвонить продавцу';

  @override
  String get drvCamera => 'Камера';

  @override
  String get drvCancel => 'Отмена';

  @override
  String get drvCancelFailed => 'Не удалось отменить';

  @override
  String get drvCarColor => 'Цвет';

  @override
  String get drvCarDetails => 'Данные автомобиля';

  @override
  String get drvCarModel => 'Марка и модель';

  @override
  String get drvCarModelField => 'Модель автомобиля';

  @override
  String get drvCarModelHint => 'Например: Chevrolet Cobalt';

  @override
  String get drvCarModelRequired => 'Введите марку автомобиля';

  @override
  String get drvCarYear => 'Год выпуска';

  @override
  String get drvCarYearField => 'Год выпуска автомобиля';

  @override
  String get drvCarYearHelper =>
      'По этим данным определят, в каком тарифе вы сможете работать';

  @override
  String get drvCarYearHint => 'Например: 2019';

  @override
  String get drvCarYearOptional => 'Год выпуска (необязательно)';

  @override
  String drvCarYearRange(int max) {
    return 'Введите год от 1990 до $max';
  }

  @override
  String get drvCardOrPhone => 'Номер карты или телефона';

  @override
  String get drvCargo => 'Груз';

  @override
  String get drvCargoDelivered => 'Груз успешно доставлен!';

  @override
  String get drvCargoInProgress => 'Груз в пути';

  @override
  String get drvCargoNotGiven => 'Груз не выдали';

  @override
  String get drvCargoPickupPlace => 'Место загрузки';

  @override
  String get drvChatCustomer => 'Чат с клиентом';

  @override
  String get drvChatPassenger => 'Чат с пассажиром';

  @override
  String get drvCheckStatus => 'Проверить статус';

  @override
  String get drvCollectCash => 'Получите наличные у клиента';

  @override
  String get drvCompleteCargoConfirm => 'Подтвердите, что груз передан';

  @override
  String get drvCompleteDelivery => 'Завершить доставку';

  @override
  String get drvCompleteFailed => 'Не удалось завершить';

  @override
  String get drvCompleteOrderConfirm =>
      'Подтвердите, что заказ передан клиенту';

  @override
  String get drvCompleteParcelConfirm =>
      'Попросите у получателя 4-значный PIN-код и введите его.';

  @override
  String get drvCompleteTrip => 'Завершить поездку';

  @override
  String get drvCompleteTripConfirm => 'Завершить поездку?';

  @override
  String get drvCompletedTrips => 'Завершённые поездки';

  @override
  String get drvContinue => 'Продолжить';

  @override
  String get drvCurrentCar => 'Текущий автомобиль';

  @override
  String get drvCustomer => 'Клиент';

  @override
  String get drvDataNotLoaded => 'Данные не загрузились';

  @override
  String get drvDeadlineApproaching => 'Срок подходит к концу';

  @override
  String get drvDebt => 'Долг';

  @override
  String drvDebtAmount(String amount) {
    return 'Долг: $amount';
  }

  @override
  String get drvDebtConsequence =>
      'Комиссия за поездки за наличные. Пока долг не погашен, выйти на линию нельзя.';

  @override
  String get drvDecline => 'Отклонить';

  @override
  String get drvDeliveryAddress => 'Адрес доставки';

  @override
  String get drvDemandEvenMessage =>
      'Разницы между зонами нет — ждать можно где угодно. Данные обновляются каждую минуту.';

  @override
  String get drvDemandEvenTitle => 'Сейчас спрос везде обычный';

  @override
  String get drvDemandHigh => 'Спрос высокий';

  @override
  String get drvDemandLoadFailed => 'Не удалось получить данные о спросе';

  @override
  String get drvDemandMapLinkSem => 'Карта спроса: где больше заказов';

  @override
  String get drvDemandMapTitle => 'Карта спроса';

  @override
  String get drvDemandNormal => 'Спрос обычный';

  @override
  String get drvDemandPaintedMore => 'В закрашенных зонах заказов больше';

  @override
  String drvDemandRowSem(String title, String count) {
    return '$title, $count';
  }

  @override
  String drvDemandRowSemNearest(String title, String count, String distance) {
    return '$title, $count, ближайшая — $distance';
  }

  @override
  String get drvDemandStayNear =>
      'Держитесь ближе к этим зонам — заказ придёт быстрее.';

  @override
  String get drvDemandUnpaintedNormal =>
      'В незакрашенных местах спрос обычный.';

  @override
  String get drvDemandVeryHigh => 'Спрос очень высокий';

  @override
  String get drvDemandZone => 'Зона спроса';

  @override
  String get drvDestination => 'Адрес';

  @override
  String get drvDispatchersNotified => 'Диспетчеры оповещены';

  @override
  String get drvDistanceToCargo => 'До груза';

  @override
  String get drvDistanceToParcel => 'До посылки';

  @override
  String get drvDistanceToPassenger => 'До пассажира';

  @override
  String get drvDistanceToRestaurant => 'До ресторана';

  @override
  String get drvDistanceToShop => 'До магазина';

  @override
  String get drvDocApproved => 'Одобрено';

  @override
  String get drvDocLicenseBack =>
      'Водительское удостоверение (оборотная сторона)';

  @override
  String get drvDocLicenseFront =>
      'Водительское удостоверение (лицевая сторона)';

  @override
  String get drvDocPassport => 'Паспорт';

  @override
  String get drvDocRejectedReupload => 'Отклонено — загрузите заново';

  @override
  String get drvDocUnderReview => 'На проверке';

  @override
  String get drvDocVehicleRegistration => 'Техпаспорт';

  @override
  String get drvDocsExpiringSoon =>
      'У некоторых документов истекает срок. Обновите их заранее, чтобы работа не остановилась.';

  @override
  String get drvDocsExpiringSoonShort =>
      'У некоторых документов истекает срок. Обновите их заранее.';

  @override
  String get drvDriver => 'Водитель';

  @override
  String get drvEarnings => 'Заработок';

  @override
  String get drvEditProfile => 'Редактировать данные';

  @override
  String get drvEmergencyCall => 'Экстренный вызов (102/103)';

  @override
  String get drvEmergencyHelp => 'Экстренная помощь';

  @override
  String get drvEmergencySos => 'Экстренная помощь (SOS)';

  @override
  String get drvEnable => 'Включить';

  @override
  String get drvEnterCardOrPhone => 'Введите номер карты или телефона';

  @override
  String get drvEnterValidAmount => 'Введите корректную сумму';

  @override
  String get drvErrorOccurred => 'Произошла ошибка';

  @override
  String get drvEstimatedEarnings => 'Примерный заработок';

  @override
  String get drvEstimatedPrice => 'Примерная цена:';

  @override
  String get drvFindMyLocation => 'Моё местоположение';

  @override
  String get drvFitZones => 'Показать все зоны';

  @override
  String get drvForegroundChannel => 'Статус на линии';

  @override
  String get drvForegroundText =>
      'Ваше местоположение передаётся для заказов и поездок';

  @override
  String get drvForegroundTitle => 'Angren Taxi — вы на линии';

  @override
  String get drvFreeWait => 'Бесплатное ожидание';

  @override
  String get drvGallery => 'Галерея';

  @override
  String get drvGoOffline => 'Уйти с линии';

  @override
  String get drvGoOnline => 'Выйти на линию';

  @override
  String get drvGoOnlineBlocked => 'Выход на линию закрыт';

  @override
  String get drvGoToNearestZone => 'Ехать к ближайшей зоне';

  @override
  String drvGoToNearestZoneSem(String level, String distance) {
    return 'Открыть навигацию к ближайшей зоне спроса, $level, $distance';
  }

  @override
  String get drvGpsDisabled =>
      'Геолокация (GPS) на телефоне выключена — включите её, чтобы карта работала правильно.';

  @override
  String get drvHelp => 'Помощь';

  @override
  String drvHeroSemBonus(String name, int threshold, int count) {
    return '$name: выполнено $count из $threshold';
  }

  @override
  String drvHeroSemEarnings(String amount) {
    return 'Заработок сегодня $amount';
  }

  @override
  String get drvHeroSemOpenHistory => 'Открыть историю заработка';

  @override
  String drvItemsCount(int count) {
    return 'Товаров: $count';
  }

  @override
  String get drvLast30Days => 'Последние 30 дней';

  @override
  String get drvLast7Days => 'Последние 7 дней';

  @override
  String get drvLoading => 'Загрузка';

  @override
  String get drvLocationDenied =>
      'У приложения нет доступа к геолокации — разрешите его, чтобы видеть своё точное место на карте.';

  @override
  String get drvLocationFailed =>
      'Не удалось определить местоположение. Выйдите на открытое место или попробуйте ещё раз.';

  @override
  String get drvLocationUnavailable =>
      'Не удалось определить местоположение. Проверьте, что GPS включён и у приложения есть доступ.';

  @override
  String get drvLogout => 'Выйти';

  @override
  String get drvLogoutConfirmBody => 'Выйти из аккаунта?';

  @override
  String get drvLogoutConfirmTitle => 'Подтвердите выход';

  @override
  String get drvLostItems => 'Забытые вещи';

  @override
  String get drvMenu => 'Меню';

  @override
  String get drvMessage => 'Сообщение';

  @override
  String get drvMoreActions => 'Дополнительно';

  @override
  String get drvNavAppNotFound => 'Навигатор не найден';

  @override
  String drvNeedsAttention(int count) {
    return 'Требуют внимания: $count';
  }

  @override
  String drvNetEarnings(String period) {
    return 'Чистый заработок · $period';
  }

  @override
  String get drvNewCar => 'Новый автомобиль';

  @override
  String get drvNewOrder => 'Новый заказ!';

  @override
  String get drvNoFundsToWithdraw => 'Нет средств для вывода';

  @override
  String get drvNoKeepWaiting => 'Нет, подожду';

  @override
  String get drvNoOrderHistory => 'История заказов пуста';

  @override
  String get drvNoRequestsYet => 'Заявок пока нет';

  @override
  String get drvNoShowConfirm => 'Отменить заказ?';

  @override
  String drvNoShowConfirmWaited(String elapsed) {
    return 'Вы ждали $elapsed. Отменить заказ?';
  }

  @override
  String drvNoShowConfirmWaitedFee(String elapsed, String fare) {
    return 'Вы ждали $elapsed, начислено $fare за ожидание. Отменить заказ?';
  }

  @override
  String drvNotUpdated(String message) {
    return 'Не обновилось: $message';
  }

  @override
  String get drvNotUploaded => 'Не загружено';

  @override
  String get drvNotifications => 'Уведомления';

  @override
  String get drvNotifyDispatchers => 'Сообщить диспетчерам';

  @override
  String get drvOfferNotificationChannel => 'Новые заказы';

  @override
  String get drvOfferNotificationTitle => 'Новый заказ';

  @override
  String get drvOffline => 'Офлайн';

  @override
  String get drvOfflineLower => 'офлайн';

  @override
  String get drvOnline => 'Онлайн';

  @override
  String get drvOnlineLower => 'онлайн';

  @override
  String get drvOpenNavigation => 'Открыть навигатор';

  @override
  String get drvOpenOrder => 'Открыть заказ';

  @override
  String drvOpenOrderSem(String type) {
    return 'Открыть заказ: $type';
  }

  @override
  String get drvOpenVerification => 'Открыть проверку';

  @override
  String get drvOptional => 'Необязательно';

  @override
  String get drvOrderDelivered => 'Заказ успешно доставлен!';

  @override
  String get drvOrderDetails => 'Детали заказа';

  @override
  String get drvOrderHistory => 'История заказов';

  @override
  String get drvOrderInProgress => 'Заказ в пути';

  @override
  String get drvOrderNotGiven => 'Заказ не выдали';

  @override
  String get drvPaidOnline => 'Оплачено онлайн — деньги не берите';

  @override
  String get drvParcel => 'Посылка';

  @override
  String get drvParcelDelivered => 'Посылка вручена!';

  @override
  String get drvParcelInProgress => 'Посылка в пути';

  @override
  String get drvParcelNotGiven => 'Посылку не передали';

  @override
  String get drvParcelPickupPlace => 'Где забрать посылку';

  @override
  String get drvParcelPinHint =>
      '4-значный код — отправитель сообщил его получателю.';

  @override
  String get drvParcelPinSubmit => 'Вручить';

  @override
  String get drvParcelPinTitle => 'Спросите PIN-код у получателя';

  @override
  String get drvParcelRecipient => 'Получатель';

  @override
  String get drvParcelSizeLarge => 'Большая';

  @override
  String get drvParcelSizeMedium => 'Средняя';

  @override
  String get drvParcelSizeSmall => 'Маленькая';

  @override
  String get drvPassenger => 'Пассажир';

  @override
  String get drvPassengerNoShow => 'Пассажир не пришёл';

  @override
  String drvPassengerRequested(String options) {
    return 'Пассажир просит: $options';
  }

  @override
  String get drvPayVendor => 'Оплатите магазину сами';

  @override
  String get drvPayVendorHint =>
      'Заплатите при получении товара — клиент вернёт вам эту сумму вместе с доставкой.';

  @override
  String get drvPayment => 'Оплата';

  @override
  String drvPeriodEarningsSem(String period) {
    return 'Заработок: $period';
  }

  @override
  String get drvPeriodMonth => 'Месяц';

  @override
  String get drvPeriodWeek => 'Неделя';

  @override
  String get drvPickupCargo => 'Заберите груз';

  @override
  String get drvPickupOrder => 'Заберите заказ';

  @override
  String get drvPickupParcel => 'Заберите посылку';

  @override
  String get drvPickupPassenger => 'Заберите пассажира';

  @override
  String get drvPickupPlace => 'Место посадки';

  @override
  String get drvPlateHint => 'Например: 01 A 123 BC';

  @override
  String get drvPlateNumber => 'Госномер';

  @override
  String get drvPlateRequired => 'Введите госномер';

  @override
  String get drvPlatformCommission => 'Комиссия платформы';

  @override
  String get drvPleaseRate => 'Пожалуйста, поставьте оценку';

  @override
  String get drvProfileTitle => 'Профиль';

  @override
  String drvRateCommentHint(String client) {
    return '$client: ваш комментарий...';
  }

  @override
  String drvRateHowWas(String client) {
    return 'Оцените: $client';
  }

  @override
  String drvRateStars(int count) {
    return '$count из 5';
  }

  @override
  String get drvRating1 => 'Очень плохо';

  @override
  String get drvRating2 => 'Плохо';

  @override
  String get drvRating3 => 'Нормально';

  @override
  String get drvRating4 => 'Хорошо';

  @override
  String get drvRating5 => 'Отлично!';

  @override
  String get drvRatingPick => 'Выберите оценку';

  @override
  String drvRatingStarsSem(String rating) {
    return 'Рейтинг $rating звезды';
  }

  @override
  String drvRatingValue(String rating) {
    return 'Рейтинг $rating';
  }

  @override
  String drvRatingsCount(int count) {
    return 'Оценок: $count';
  }

  @override
  String get drvReadyBattery => 'Без ограничений батареи';

  @override
  String get drvReadyBatteryWhy =>
      'Чтобы телефон не выключал приложение в фоне. В настройках: Батарея → Без ограничений.';

  @override
  String get drvReadyDone => 'Готово';

  @override
  String get drvReadyEnable => 'Включить';

  @override
  String get drvReadyGoOnline => 'Выйти на линию';

  @override
  String get drvReadyGps => 'GPS включён';

  @override
  String get drvReadyGpsWhy =>
      'Чтобы телефон мог определить ваше местоположение.';

  @override
  String get drvReadyGrant => 'Разрешить';

  @override
  String get drvReadyLocation => 'Доступ к геолокации';

  @override
  String get drvReadyLocationWhy =>
      'Чтобы получать заказы рядом и показывать пассажиру, где вы.';

  @override
  String get drvReadyMissing => 'Не выполнено';

  @override
  String get drvReadyNotifications => 'Уведомления';

  @override
  String get drvReadyNotificationsWhy =>
      'Чтобы показывать, что приложение работает в фоне, и сообщать о новых заказах.';

  @override
  String get drvReadyOpenSettings => 'Настройки';

  @override
  String get drvReadyOverlay => 'Поверх других приложений';

  @override
  String get drvReadyOverlayWhy =>
      'Если вы вышли из приложения и пришёл заказ, приложение откроется само. У края экрана будет маленькая кнопка — нажмите, чтобы вернуться.';

  @override
  String get drvReadyOverlayXiaomi =>
      'Xiaomi/Redmi: Настройки → Приложения → Angren Taxi Driver → Другие разрешения → включите также «Отображать всплывающие окна, когда приложение работает в фоне».';

  @override
  String get drvReadyPrecise => 'Точная геолокация';

  @override
  String get drvReadyPreciseWhy =>
      'Для таксометра и проверки «я на месте». «Приблизительная» геолокация ошибается примерно на 1 км.';

  @override
  String get drvReadyRecommended => 'Рекомендуется';

  @override
  String get drvReadySubtitle =>
      'Чтобы получать заказы, нужно следующее. Без отмеченных пунктов выйти на линию нельзя.';

  @override
  String get drvReadyTitle => 'Готовность к работе';

  @override
  String drvReason(String reason) {
    return 'Причина: $reason';
  }

  @override
  String get drvRefreshDemand => 'Обновить данные о спросе';

  @override
  String get drvRefreshing => 'Обновление…';

  @override
  String get drvRequestApproved => 'Одобрено — профиль обновлён';

  @override
  String get drvRequestPending => 'Заявка на рассмотрении';

  @override
  String get drvRequestRejected => 'Отклонено';

  @override
  String drvRequirementsNeeded(String items) {
    return 'Нужно: $items';
  }

  @override
  String get drvRestaurant => 'Ресторан';

  @override
  String get drvRetry => 'Повторить';

  @override
  String get drvReupload => 'Загрузить заново';

  @override
  String get drvRouteToCargo => 'Путь к грузу';

  @override
  String get drvRouteToParcel => 'Путь к посылке';

  @override
  String get drvRouteToPassenger => 'Путь к пассажиру';

  @override
  String get drvRouteToRestaurant => 'Путь к ресторану';

  @override
  String get drvRouteToShop => 'Путь к магазину';

  @override
  String get drvSafetyNote =>
      'Ваша безопасность важна для нас. Если нужно, нажмите одну из кнопок ниже.';

  @override
  String get drvSave => 'Сохранить';

  @override
  String get drvSaved => 'Сохранено';

  @override
  String drvSecondsToAccept(int seconds) {
    return 'На принятие осталось $seconds сек';
  }

  @override
  String get drvSeller => 'Продавец';

  @override
  String get drvSend => 'Отправить';

  @override
  String get drvSendRequest => 'Отправить заявку';

  @override
  String get drvServiceBlockedDefault =>
      'Чтобы включить эту услугу, выполните требования проверки.';

  @override
  String drvServiceChipOff(String label) {
    return '$label, выключено. Открыть услуги';
  }

  @override
  String drvServiceChipOn(String label) {
    return '$label, включено. Открыть услуги';
  }

  @override
  String drvServiceChipUnavailable(String label) {
    return '$label, недоступно. Открыть услуги';
  }

  @override
  String drvServiceChipUnavailableReason(String label, String reason) {
    return '$label, недоступно: $reason. Открыть услуги';
  }

  @override
  String get drvServicesEmptyMessage =>
      'Пока для вас нет доступных услуг. Новые появятся здесь.';

  @override
  String get drvServicesEmptySelection =>
      'Включите хотя бы одну услугу — иначе заказы не будут приходить.';

  @override
  String get drvServicesEmptyTitle => 'Нет доступных услуг';

  @override
  String get drvServicesHeading => 'Какие заказы вы принимаете';

  @override
  String get drvServicesSaved => 'Услуги сохранены';

  @override
  String get drvServicesSubtitle =>
      'Заказы приходят только по включённым услугам. Услугу с невыполненными требованиями включить нельзя.';

  @override
  String get drvServicesTitle => 'Услуги';

  @override
  String get drvSettings => 'Настройки';

  @override
  String get drvShop => 'Магазин';

  @override
  String get drvSkip => 'Пропустить';

  @override
  String get drvSom => 'сум';

  @override
  String get drvSosSem => 'SOS — экстренная помощь';

  @override
  String get drvStartDelivery => 'Начать доставку';

  @override
  String get drvStartTrip => 'Начать поездку';

  @override
  String get drvSubmitApplication => 'Отправить заявку';

  @override
  String get drvToday => 'Сегодня';

  @override
  String get drvTodayEarnings => 'Заработок сегодня';

  @override
  String get drvTotalTrips => 'Всего поездок';

  @override
  String get drvTripCompleted => 'Поездка успешно завершена!';

  @override
  String get drvTripInProgress => 'Поездка идёт';

  @override
  String drvTripsCount(int count) {
    return 'Поездок: $count';
  }

  @override
  String get drvTripsGross => 'Всего за поездки';

  @override
  String get drvTypeCargo => 'Грузоперевозка';

  @override
  String get drvTypeFood => 'Доставка еды';

  @override
  String get drvTypeMarket => 'Доставка из магазина';

  @override
  String get drvTypeParcel => 'Посылка';

  @override
  String get drvTypeTaxi => 'Такси';

  @override
  String drvUpdatedAt(String time) {
    return 'Обновлено: $time';
  }

  @override
  String get drvUpload => 'Загрузить';

  @override
  String get drvUploadDocuments => 'Загрузите документы';

  @override
  String get drvUploadDocumentsHint =>
      'Чтобы проверка прошла быстрее, загрузите чёткие фото документов ниже.';

  @override
  String get drvUploadError => 'Ошибка загрузки';

  @override
  String get drvUploadNew => 'Загрузить новый';

  @override
  String drvUploadingPercent(String percent) {
    return 'Загрузка... $percent%';
  }

  @override
  String drvUploadingPercentSem(String percent) {
    return 'Загрузка, $percent процентов';
  }

  @override
  String get drvVehicleChangeNote =>
      'Пока менеджер не подтвердит, в профиле останется текущий автомобиль. Фото новой машины могут запросить в разделе проверки.';

  @override
  String get drvVehicleChangeTitle => 'Смена автомобиля';

  @override
  String get drvVehicleRequestSent => 'Заявка отправлена — менеджер проверит';

  @override
  String drvVendorPaidAction(String amount) {
    return 'Я заплатил магазину $amount';
  }

  @override
  String get drvVendorPaidDone => 'Магазину оплачено';

  @override
  String get drvVendorPayFirst => 'Сначала оплатите магазину и подтвердите';

  @override
  String get drvVerificationEmptyMessage =>
      'Пока от вас не требуется ни документов, ни фото. Новые требования появятся здесь.';

  @override
  String get drvVerificationEmptyTitle => 'Требований нет';

  @override
  String get drvVerificationIncomplete =>
      'Проверка не завершена — выполните требования ниже.';

  @override
  String get drvVerificationIncompleteShort =>
      'Проверка не завершена — выполните требования.';

  @override
  String get drvVerificationTitle => 'Проверка';

  @override
  String get drvView => 'Посмотреть';

  @override
  String drvWaitBillingCaption(String elapsed, String perMinute) {
    return 'Всего $elapsed · $perMinute/мин';
  }

  @override
  String drvWaitBillingSem(String fare, String elapsed) {
    return 'Плата за ожидание $fare, всего ожидание $elapsed';
  }

  @override
  String get drvWaitFee => 'Платное ожидание';

  @override
  String drvWaitFreeCaption(String perMinute) {
    return 'Далее $perMinute/мин';
  }

  @override
  String drvWaitFreeSem(String remaining, String perMinute) {
    return 'До конца бесплатного ожидания $remaining, далее $perMinute за каждую минуту';
  }

  @override
  String get drvWallet => 'Кошелёк';

  @override
  String drvWalletAmount(String amount) {
    return 'Кошелёк: $amount';
  }

  @override
  String drvWeekAmount(String amount) {
    return 'Неделя: $amount';
  }

  @override
  String get drvWhereMoreOrders => 'Где больше заказов';

  @override
  String get drvWithdraw => 'Вывести деньги';

  @override
  String get drvWithdrawApproved => 'Одобрено';

  @override
  String get drvWithdrawPaid => 'Выплачено';

  @override
  String get drvWithdrawPending => 'Ожидает';

  @override
  String get drvWithdrawRequests => 'Заявки на вывод';

  @override
  String get drvYesCancel => 'Да, отменить';

  @override
  String get drvYouKeep => 'Вам остаётся';

  @override
  String drvZonesCount(int count) {
    return 'Зон: $count';
  }

  @override
  String fmtCurrencySom(String amount) {
    return '$amount сум';
  }

  @override
  String fmtDaysAgo(int days) {
    return '$days дн. назад';
  }

  @override
  String fmtHours(int hours) {
    return '$hours ч';
  }

  @override
  String fmtHoursAgo(int hours) {
    return '$hours ч. назад';
  }

  @override
  String fmtHoursMinutes(int hours, int minutes) {
    return '$hours ч $minutes мин';
  }

  @override
  String get fmtJustNow => 'Только что';

  @override
  String fmtMillionUzs(String value) {
    return '$value млн UZS';
  }

  @override
  String fmtMinutes(int minutes) {
    return '$minutes мин';
  }

  @override
  String fmtMinutesAgo(int minutes) {
    return '$minutes мин. назад';
  }

  @override
  String get fmtMonthsShort =>
      'янв,фев,мар,апр,мая,июн,июл,авг,сен,окт,ноя,дек';

  @override
  String fmtThousandUzs(String value) {
    return '$value тыс. UZS';
  }

  @override
  String get fmtToday => 'Сегодня';

  @override
  String fmtTodayAt(String time) {
    return 'Сегодня, $time';
  }

  @override
  String get fmtTomorrow => 'Завтра';

  @override
  String fmtYesterdayAt(String time) {
    return 'Вчера, $time';
  }

  @override
  String get languageRussian => 'Русский';

  @override
  String get languageUzbek => 'O\'zbekcha';

  @override
  String get paxAbout => 'О приложении';

  @override
  String get paxAddFavorite => 'Добавить';

  @override
  String get paxAddStop => 'Добавить остановку';

  @override
  String get paxAddressNotFound => 'Не удалось найти адрес';

  @override
  String get paxAddressResolveFailed => 'Не удалось определить адрес';

  @override
  String paxApproxDistance(String distance) {
    return 'примерно $distance';
  }

  @override
  String get paxBack => 'Назад';

  @override
  String get paxCall => 'Позвонить';

  @override
  String get paxCallFailed => 'Не удалось позвонить';

  @override
  String get paxCancel => 'Отмена';

  @override
  String get paxCancelConfirmYes => 'Да, отменить';

  @override
  String get paxCancelFailed => 'Не удалось отменить';

  @override
  String get paxCancelReasonChangedMind => 'Передумал(а)';

  @override
  String get paxCancelReasonHint => 'Опишите причину...';

  @override
  String get paxCancelReasonLongWait => 'Слишком долгое ожидание';

  @override
  String get paxCancelReasonOther => 'Другая причина';

  @override
  String get paxCancelReasonPrompt => 'Выберите причину отмены заказа:';

  @override
  String get paxCancelReasonTitle => 'Причина отмены';

  @override
  String get paxCancelReasonTooExpensive => 'Слишком дорого';

  @override
  String paxCancelScheduleBody(String when) {
    return 'Отменить поездку, запланированную на $when?';
  }

  @override
  String get paxCancelScheduleTitle => 'Отменить поездку';

  @override
  String paxCardPaymentStartFailed(String error) {
    return 'Не удалось начать оплату: $error. Заказ принят, оплата пройдёт в конце поездки.';
  }

  @override
  String get paxClear => 'Очистить';

  @override
  String get paxClose => 'Закрыть';

  @override
  String paxCoverageWarning(String area) {
    return 'Здесь мы пока не работаем. Ближайшая зона обслуживания: $area.';
  }

  @override
  String get paxCurrentLocation => 'Текущее местоположение';

  @override
  String get paxDestination => 'Куда';

  @override
  String get paxDetailCar => 'Автомобиль';

  @override
  String get paxDetailDate => 'Дата';

  @override
  String get paxDetailDistance => 'Расстояние';

  @override
  String get paxDetailDriver => 'Водитель';

  @override
  String get paxDetailDuration => 'Время';

  @override
  String get paxDetailFrom => 'Откуда';

  @override
  String get paxDetailPrice => 'Стоимость';

  @override
  String get paxDetailStatus => 'Статус';

  @override
  String get paxDone => 'Готово';

  @override
  String get paxDriverAlmostThere => 'Водитель почти на месте';

  @override
  String paxDriverEta(int minutes) {
    return 'Водитель приедет через $minutes мин';
  }

  @override
  String get paxEditProfile => 'Редактировать данные';

  @override
  String get paxEnterAddress => 'Введите адрес';

  @override
  String get paxExtras => 'Пожелания';

  @override
  String paxExtrasCount(int count) {
    return 'Пожелания · $count';
  }

  @override
  String paxExtrasListSemantics(String options) {
    return 'Дополнительные пожелания: $options';
  }

  @override
  String get paxExtrasNoneSemantics => 'Дополнительные пожелания: нет';

  @override
  String get paxFavoriteHome => 'Дом';

  @override
  String get paxFavoriteNameHint => 'Название (например, Рынок)';

  @override
  String get paxFavoriteWork => 'Работа';

  @override
  String get paxFirstName => 'Имя';

  @override
  String get paxFirstNameHint => 'Ваше имя';

  @override
  String get paxFrom => 'Откуда';

  @override
  String paxFromChangeSemantics(String address) {
    return 'Откуда: $address. Изменить';
  }

  @override
  String get paxGenericError => 'Произошла ошибка';

  @override
  String get paxHasScheduledTrip => 'Есть запланированная поездка';

  @override
  String get paxHelp => 'Помощь';

  @override
  String get paxHighDemand => 'Высокий спрос';

  @override
  String get paxHistoryEmpty => 'Поездок пока нет';

  @override
  String get paxHistoryTitle => 'История поездок';

  @override
  String get paxLastName => 'Фамилия';

  @override
  String get paxLastNameHint => 'Ваша фамилия';

  @override
  String get paxLocatingAddress => 'Определяем местоположение...';

  @override
  String get paxLocation => 'Местоположение';

  @override
  String get paxLogout => 'Выйти';

  @override
  String get paxLogoutConfirmBody => 'Выйти из аккаунта?';

  @override
  String get paxLogoutConfirmTitle => 'Подтвердите выход';

  @override
  String get paxLostItemButton => 'Я забыл вещь';

  @override
  String get paxLostItemDialogHint =>
      'Например: чёрный кошелёк, на заднем сиденье';

  @override
  String get paxLostItemDialogTitle => 'Что вы забыли?';

  @override
  String get paxLostItemSent =>
      'Сообщение отправлено водителю — ответ появится в разделе «Забытые вещи»';

  @override
  String get paxLostItems => 'Забытые вещи';

  @override
  String get paxMenu => 'Меню';

  @override
  String get paxMessage => 'Чат';

  @override
  String paxMeteredRates(String base, String perKm, String perMin, String min) {
    return 'Таксометр: $base + $perKm/км + $perMin/мин, минимум $min. Итоговая цена считается в конце поездки по пройденному пути и времени.';
  }

  @override
  String get paxMeteredTo => 'Без адреса — по таксометру';

  @override
  String get paxNo => 'Нет';

  @override
  String get paxNoDestination => 'Без адреса';

  @override
  String get paxNoDriversNearby => 'Поблизости нет свободных водителей';

  @override
  String get paxNoDriversNearbyRetry =>
      'Поблизости нет свободных водителей. Попробуйте чуть позже.';

  @override
  String get paxNoResults => 'Ничего не найдено';

  @override
  String get paxNoTariffs => 'Нет доступных тарифов';

  @override
  String get paxNotifications => 'Уведомления';

  @override
  String get paxNow => 'Сейчас';

  @override
  String get paxOrderCta => 'Заказать';

  @override
  String get paxOrderDetails => 'Детали заказа';

  @override
  String get paxOrderMissingRouteOrTariff => 'Не выбраны адрес и тариф';

  @override
  String get paxOutsideServiceArea => 'Вне зоны обслуживания';

  @override
  String get paxParcelPinHint =>
      'Сообщите получателю. Без этого кода водитель не сможет вручить посылку.';

  @override
  String get paxParcelPinTitle => 'Код вручения';

  @override
  String get paxPaymentCard => 'Карта';

  @override
  String get paxPaymentCash => 'Наличные';

  @override
  String get paxPaymentMethods => 'Способы оплаты';

  @override
  String get paxPickOnMap => 'Выбрать на карте';

  @override
  String get paxPickThisPlace => 'Выбрать это место';

  @override
  String get paxPickupPoint => 'Точка посадки';

  @override
  String get paxPriceLocked => 'Цена зафиксирована — в пути не изменится.';

  @override
  String get paxProfileSaved => 'Данные сохранены';

  @override
  String get paxProfileTitle => 'Профиль';

  @override
  String get paxRateCloseWithoutTip => 'Закрыть без чаевых';

  @override
  String get paxRateCommentHint => 'Комментарий о водителе...';

  @override
  String get paxRateHowWasTrip => 'Как прошла поездка?';

  @override
  String get paxRatePleaseRate => 'Пожалуйста, поставьте оценку';

  @override
  String paxRatePrimaryNoTipSemantics(String action) {
    return '$action, без чаевых';
  }

  @override
  String paxRatePrimaryWithTipSemantics(String action, String amount) {
    return '$action, с чаевыми $amount';
  }

  @override
  String get paxRateSkip => 'Пропустить';

  @override
  String paxRateStarSemantics(int count) {
    return '$count из 5 звёзд';
  }

  @override
  String get paxRateThanks => 'Спасибо за оценку!';

  @override
  String paxRateTipSent(String amount) {
    return 'Чаевые $amount отправлены водителю. Спасибо!';
  }

  @override
  String get paxRatingBad => 'Плохо';

  @override
  String get paxRatingExcellent => 'Отлично!';

  @override
  String get paxRatingGood => 'Хорошо';

  @override
  String get paxRatingOk => 'Нормально';

  @override
  String get paxRatingPickStars => 'Поставьте оценку';

  @override
  String paxRatingValue(String rating) {
    return 'Рейтинг $rating';
  }

  @override
  String get paxRatingVeryBad => 'Очень плохо';

  @override
  String get paxReceiptAddressMissing => 'Адрес не сохранён';

  @override
  String get paxReceiptCopySemantics => 'Скопировать текст чека';

  @override
  String get paxReceiptDiscount => 'Скидка';

  @override
  String paxReceiptDiscountWithCode(String code) {
    return 'Скидка ($code)';
  }

  @override
  String get paxReceiptDropoff => 'Высадка';

  @override
  String get paxReceiptDuration => 'Длительность';

  @override
  String get paxReceiptFareBreakdown => 'Детализация стоимости';

  @override
  String get paxReceiptForbiddenBody =>
      'Чек могут видеть только пассажир, назначенный водитель или менеджер.';

  @override
  String get paxReceiptForbiddenTitle => 'Этот чек вам недоступен';

  @override
  String get paxReceiptGrandTotal => 'К оплате';

  @override
  String get paxReceiptLoading => 'Загружаем чек';

  @override
  String get paxReceiptNoBreakdown =>
      'Детализация для этой поездки не сохранилась. Ниже — только итоговая сумма.';

  @override
  String get paxReceiptNoPaymentInfo => 'Данные об оплате не сохранились.';

  @override
  String paxReceiptOrderNumber(String number) {
    return 'Заказ № $number';
  }

  @override
  String get paxReceiptOrderNumberLabel => 'Номер заказа';

  @override
  String get paxReceiptParseError => 'Не удалось прочитать данные чека';

  @override
  String get paxReceiptPayment => 'Оплата';

  @override
  String get paxReceiptPaymentMethod => 'Способ';

  @override
  String get paxReceiptPaymentStatus => 'Статус';

  @override
  String get paxReceiptPickup => 'Посадка';

  @override
  String get paxReceiptService => 'Услуга';

  @override
  String paxReceiptStop(int index) {
    return 'Остановка $index';
  }

  @override
  String get paxReceiptSubtotal => 'Итого';

  @override
  String get paxReceiptTariff => 'Тариф';

  @override
  String get paxReceiptTextCopied => 'Текст чека скопирован';

  @override
  String get paxReceiptTip => 'Чаевые';

  @override
  String get paxReceiptTipHint => 'Без комиссии — полностью водителю';

  @override
  String get paxReceiptTitle => 'Чек поездки';

  @override
  String paxReceiptUnpaid(String amount) {
    return 'Неоплаченный остаток: $amount. Пополните кошелёк — долг блокирует новые заказы.';
  }

  @override
  String get paxReceiptWaitingNote =>
      'Платное ожидание не входит в фиксированную цену: после бесплатных минут каждая начатая минута оплачивается отдельно.';

  @override
  String get paxReferralApplied => 'Промокод применён!';

  @override
  String get paxReferralAppliedBanner => 'Код успешно применён';

  @override
  String get paxReferralApply => 'Применить';

  @override
  String get paxReferralCardHint =>
      'Если друг введёт этот код при первой поездке, вы оба получите бонус';

  @override
  String get paxReferralCodeCopied => 'Код скопирован';

  @override
  String get paxReferralCopy => 'Копировать';

  @override
  String get paxReferralEnterCode => 'Введите код';

  @override
  String get paxReferralEnterFriendCode => 'Введите код друга';

  @override
  String get paxReferralErrAlreadyApplied => 'Вы уже применили промокод';

  @override
  String get paxReferralErrInvalid => 'Такой код не найден';

  @override
  String get paxReferralErrOwnCode => 'Нельзя применить собственный код';

  @override
  String get paxReferralInvitedCount => 'Приглашено';

  @override
  String get paxReferralShare => 'Поделиться';

  @override
  String get paxReferralShareCopied =>
      'Текст приглашения скопирован — отправьте его другу';

  @override
  String paxReferralShareMessage(String code) {
    return 'Приглашаю в Angren Taxi! При регистрации введите мой код: $code';
  }

  @override
  String get paxReferralTitle => 'Пригласить друзей';

  @override
  String get paxReferralTotalBonus => 'Всего бонусов';

  @override
  String get paxReferralYourCode => 'ВАШ ПРИГЛАСИТЕЛЬНЫЙ КОД';

  @override
  String get paxRemoveStop => 'Удалить остановку';

  @override
  String get paxRepeatRide => 'Повторить поездку';

  @override
  String get paxResolvingAddress => 'Определяем адрес...';

  @override
  String get paxRouteLoading => 'Загружаем маршрут...';

  @override
  String get paxSave => 'Сохранить';

  @override
  String get paxSaveAddress => 'Сохранить адрес';

  @override
  String get paxSaveAddressFailed => 'Не удалось сохранить адрес';

  @override
  String get paxSavedAddresses => 'Сохранённые адреса';

  @override
  String get paxSavedPlaces => 'Сохранённые места';

  @override
  String get paxScheduleCancelled => 'Поездка отменена';

  @override
  String get paxScheduleCta => 'Запланировать';

  @override
  String get paxScheduleHint =>
      'Водителя начнём искать за 10 минут до указанного времени. Цена фиксируется сейчас и не изменится.';

  @override
  String get paxScheduleNoSlots =>
      'На этот день времени не осталось — выберите следующий.';

  @override
  String get paxScheduleOrderNow => 'Заказать сейчас';

  @override
  String get paxSchedulePickTime => 'Выберите время';

  @override
  String get paxScheduleTitle => 'Запланировать поездку';

  @override
  String get paxScheduledEmptyBody =>
      'Укажите время на экране тарифа, чтобы заказать поездку заранее.';

  @override
  String get paxScheduledEmptyTitle => 'Нет запланированных поездок';

  @override
  String get paxScheduledPriceNote =>
      'Цена фиксируется сейчас и не изменится в день поездки — плата за ожидание оплачивается отдельно. Водителя начнём искать за 10 минут до указанного времени.';

  @override
  String get paxScheduledTripsTitle => 'Запланированные поездки';

  @override
  String get paxSearchAddressHint => 'Поиск адреса...';

  @override
  String get paxSearchAddressSemantics => 'Поиск адреса';

  @override
  String get paxSearchPlaceHint => 'Улица, махалля, название места...';

  @override
  String paxSeats(int count) {
    return 'Мест: $count';
  }

  @override
  String get paxSend => 'Отправить';

  @override
  String get paxShareTripCopied => 'Данные о поездке скопированы';

  @override
  String paxShareTripDriver(String name, String car) {
    return 'Водитель: $name, $car';
  }

  @override
  String paxShareTripFrom(String address) {
    return 'Откуда: $address';
  }

  @override
  String get paxShareTripHeader => 'Angren Taxi — моя поездка';

  @override
  String paxShareTripStatus(String status) {
    return 'Статус: $status';
  }

  @override
  String paxShareTripTo(String address) {
    return 'Куда: $address';
  }

  @override
  String get paxSomSuffix => 'сум';

  @override
  String get paxSosAlertDispatchers => 'Сообщить диспетчерам';

  @override
  String get paxSosBody =>
      'Ваша безопасность важна для нас. При необходимости нажмите одну из кнопок ниже.';

  @override
  String get paxSosDispatchersAlerted => 'Диспетчеры оповещены';

  @override
  String get paxSosEmergencyCall => 'Экстренный вызов (102/103)';

  @override
  String get paxSosSemantics => 'SOS — экстренная помощь';

  @override
  String get paxSosTitle => 'Экстренная помощь';

  @override
  String get paxStop => 'Остановка';

  @override
  String get paxStopPoint => 'Точка остановки';

  @override
  String paxSurgeNotice(String multiplier) {
    return 'Сейчас высокий спрос — цена ×$multiplier. Через несколько минут может стать дешевле.';
  }

  @override
  String paxTariffWaitingNote(int freeMinutes, String perMinute) {
    return 'После приезда водителя $freeMinutes мин ожидания бесплатно, далее $perMinute за каждую начатую минуту. Эта плата добавляется к указанной цене отдельно.';
  }

  @override
  String get paxTipAlreadyGiven => 'Чаевые за эту поездку уже отправлены.';

  @override
  String get paxTipExplainer =>
      'Вся сумма уходит водителю — без комиссии. Спишем с вашего кошелька.';

  @override
  String get paxTipInsufficientFunds =>
      'В кошельке недостаточно средств. Пополните его или выберите сумму поменьше.';

  @override
  String get paxTipNotYourTrip => 'Это не ваша поездка.';

  @override
  String get paxTipOptional => 'Необязательно';

  @override
  String get paxTipOther => 'Другая';

  @override
  String paxTipRangeError(String min, String max) {
    return 'Чаевые — от $min до $max';
  }

  @override
  String get paxTipTitle => 'Чаевые водителю';

  @override
  String get paxTo => 'Куда';

  @override
  String get paxTripOptionsHint =>
      'Ищем только водителей, которые могут выполнить эти пожелания — это может занять немного больше времени.';

  @override
  String get paxTripOptionsTitle => 'Дополнительные пожелания';

  @override
  String get paxTripScheduled => 'Поездка запланирована';

  @override
  String paxTripTimeSemantics(String time) {
    return 'Время поездки: $time';
  }

  @override
  String get paxTripsStat => 'Поездки';

  @override
  String get paxUnknownAddress => 'Неизвестный адрес';

  @override
  String paxUpcomingTrip(String when) {
    return 'Ближайшая поездка: $when';
  }

  @override
  String get paxUserFallback => 'Пользователь';

  @override
  String get paxWaitingFree => 'Бесплатное ожидание';

  @override
  String paxWaitingFreeCaption(String perMinute) {
    return 'Далее $perMinute/мин, добавится к стоимости поездки';
  }

  @override
  String paxWaitingFreeSemantics(String remaining, String perMinute) {
    return 'До конца бесплатного ожидания $remaining, затем за каждую минуту к стоимости поездки добавится $perMinute';
  }

  @override
  String get paxWaitingPaid => 'Платное ожидание';

  @override
  String paxWaitingPaidCaption(String elapsed) {
    return 'Всего $elapsed · добавится к стоимости поездки';
  }

  @override
  String paxWaitingPaidSemantics(String amount, String elapsed) {
    return 'Плата за ожидание $amount, всего ожидание $elapsed. Добавится к стоимости поездки.';
  }

  @override
  String get paxWhereTo => 'Куда едем?';

  @override
  String saActiveOrderLabel(String service, String title, String stage) {
    return 'Активный заказ: $service. $title. $stage';
  }

  @override
  String get saAdBadge => 'Реклама';

  @override
  String get saAdOpenFailed => 'Не удалось открыть ссылку';

  @override
  String saAddItemToCartLabel(String name) {
    return '$name — добавить в корзину';
  }

  @override
  String saAddToCartWithPrice(String price) {
    return 'В корзину · $price';
  }

  @override
  String get saAddressResolving => 'Определяем адрес…';

  @override
  String get saAngrenCity => 'г. Ангрен';

  @override
  String get saBack => 'Назад';

  @override
  String get saBackToHome => 'На главную';

  @override
  String saBadgeCount(String count) {
    return '$count шт.';
  }

  @override
  String get saCallDriver => 'Позвонить водителю';

  @override
  String get saCallFailed => 'Не удалось позвонить';

  @override
  String saCallFailedDialManually(String phone) {
    return 'Не удалось позвонить — наберите $phone вручную';
  }

  @override
  String get saCancel => 'Отмена';

  @override
  String get saCargoAddressHint =>
      'Адреса выберете на карте на следующем шаге — там же рассчитаем точную цену по расстоянию.';

  @override
  String get saCargoCallCourier => 'Вызвать курьера';

  @override
  String get saCargoCourier => 'Курьер';

  @override
  String get saCargoLight => 'Лёгкий';

  @override
  String get saCargoSubtitle => 'Быстрая доставка по городу';

  @override
  String get saCargoTitle => 'Cargo · Доставка грузов';

  @override
  String get saCargoTruck => 'Грузовой';

  @override
  String get saCargoUpTo1t => 'до 1 т';

  @override
  String get saCargoUpTo300kg => 'до 300 кг';

  @override
  String get saCargoUpTo5kg => 'до 5 кг';

  @override
  String get saCargoVehicleType => 'Тип транспорта';

  @override
  String get saCart => 'Корзина';

  @override
  String get saCartBarLabel => 'Заказ в корзине';

  @override
  String saCartBarSemantics(int count, String total, String action) {
    return 'Корзина: товаров $count, $total. $action';
  }

  @override
  String get saCartEmptyMessage =>
      'Добавьте еду или товары из маркета — они появятся здесь.';

  @override
  String get saCartEmptyTitle => 'Корзина пуста';

  @override
  String get saCartNoExtraFees =>
      'При оформлении дополнительных сборов не будет.';

  @override
  String saCartWithCount(int count) {
    return 'Корзина, товаров: $count';
  }

  @override
  String saCashLimitNote(String limit) {
    return 'Наличными — до $limit сум, этот заказ оплачивается картой';
  }

  @override
  String get saCheckoutTitle => 'Оформление';

  @override
  String saCheckoutWithTotal(String total) {
    return 'Оформить · $total';
  }

  @override
  String saCheckoutWithTotalLabel(String total) {
    return 'Оформить, итого $total';
  }

  @override
  String get saChooseAddress => 'Выберите адрес';

  @override
  String get saChooseDeliveryAddress => 'Выберите адрес доставки';

  @override
  String get saChoosePaymentMethod => 'Выберите способ оплаты';

  @override
  String get saClose => 'Закрыть';

  @override
  String get saClosed => 'Закрыто';

  @override
  String get saCompletedAt => 'Завершён';

  @override
  String get saConfirmOrder => 'Подтвердить заказ';

  @override
  String get saContactOperator => 'Связаться с оператором';

  @override
  String get saCurrentAddress => 'Текущий адрес';

  @override
  String get saCurrentLocation => 'Текущее местоположение';

  @override
  String get saDefaultUserName => 'Пользователь';

  @override
  String get saDelivery => 'Доставка';

  @override
  String get saDeliveryAddress => 'Адрес доставки';

  @override
  String get saDestination => 'Куда';

  @override
  String saDishesCount(int count) {
    return 'Блюд: $count';
  }

  @override
  String get saDistance => 'Расстояние';

  @override
  String get saDuration => 'Длительность';

  @override
  String get saEditProfile => 'Редактировать профиль';

  @override
  String get saErrorOccurred => 'Произошла ошибка';

  @override
  String get saFaqCancelA =>
      'На экране активного заказа нажмите «Отменить» и выберите причину. Пока водитель не приехал, отмена бесплатная.';

  @override
  String get saFaqCancelQ => 'Как отменить заказ?';

  @override
  String get saFaqComplaintA =>
      'После поездки оставьте комментарий на экране оценки или отправьте номер поездки оператору в чат. Мы рассматриваем каждую жалобу.';

  @override
  String get saFaqComplaintQ => 'Жалоба на водителя';

  @override
  String get saFaqLostItemA =>
      'Откройте поездку в истории заказов и позвоните водителю. Если он не отвечает, напишите оператору в чат — мы свяжемся с водителем.';

  @override
  String get saFaqLostItemQ => 'Забыл вещь в машине';

  @override
  String get saFaqPaymentA =>
      'Проверьте баланс кошелька. Если средств не хватит, поездка запишется в долг, и пока вы его не погасите, новый заказ оформить не получится. Можно также выбрать оплату наличными.';

  @override
  String get saFaqPaymentQ => 'Оплата не прошла — что делать?';

  @override
  String get saFaqTitle => 'Частые вопросы';

  @override
  String get saFoodNoRestaurantsMessage =>
      'Сейчас нет открытых ресторанов. Попробуйте чуть позже.';

  @override
  String get saFoodNoRestaurantsTitle => 'Рестораны не найдены';

  @override
  String get saFoodSubtitle => 'Ангрен · 20–40 минут';

  @override
  String get saFoodTitle => 'Доставка еды';

  @override
  String get saGoToCart => 'Перейти в корзину';

  @override
  String get saGoToHome => 'На главную';

  @override
  String get saHelpCenter => 'Центр помощи';

  @override
  String get saInviteFriends => 'Пригласить друзей';

  @override
  String get saLoading => 'Загрузка';

  @override
  String get saLogout => 'Выйти';

  @override
  String saLostItemDriverNote(String note) {
    return 'Водитель: $note';
  }

  @override
  String get saLostItemFound => 'Нашёл';

  @override
  String get saLostItemFoundTitle => 'Вещь найдена';

  @override
  String get saLostItemNotFound => 'Не нашёл';

  @override
  String saLostItemOperatorNote(String note) {
    return 'Оператор: $note';
  }

  @override
  String get saLostItemWhereHint => 'Где она сейчас? (необязательно)';

  @override
  String get saLostItemsEmptyDriver =>
      'Если пассажир забудет вещь в вашей поездке, заявка появится здесь.';

  @override
  String get saLostItemsEmptyPassenger =>
      'Если что-то забыли в поездке, сообщите об этом со страницы чека.';

  @override
  String get saLostItemsEmptyTitle => 'Заявок нет';

  @override
  String get saLostItemsTitle => 'Забытые вещи';

  @override
  String get saMarket => 'Маркет';

  @override
  String get saMarketNoProductsMessage => 'В этом магазине пока нет товаров.';

  @override
  String get saMarketNoProductsTitle => 'Товары не найдены';

  @override
  String get saMarketProducts => 'Товары';

  @override
  String get saMarketSearchHint => 'Поиск товаров…';

  @override
  String get saMarketSubtitle => '15–25 минут · Ближайший магазин';

  @override
  String get saMenu => 'Меню';

  @override
  String get saMenuEmptyMessage => 'Ресторан пока не добавил блюда.';

  @override
  String get saMenuEmptyTitle => 'Меню пустое';

  @override
  String get saNoStoreYet => 'Магазинов пока нет';

  @override
  String saNotificationUnreadLabel(String title) {
    return 'Непрочитанное: $title';
  }

  @override
  String get saNotificationsEmpty => 'Уведомлений пока нет';

  @override
  String get saNotificationsMarkAllRead => 'Отметить все как прочитанные';

  @override
  String get saNotificationsReadAction => 'Прочитано';

  @override
  String get saNotificationsTitle => 'Уведомления';

  @override
  String get saOpen => 'Открыто';

  @override
  String get saOpenTripReceipt => 'Открыть чек поездки';

  @override
  String get saOrderAccepted => 'Заказ принят';

  @override
  String get saOrderHistory => 'История заказов';

  @override
  String get saOrderNotSent => 'Не удалось отправить заказ';

  @override
  String saOrderNumber(String number) {
    return 'Номер заказа: $number';
  }

  @override
  String get saOrderNumberLabel => 'Номер заказа';

  @override
  String get saOrderPaidOnlineHint =>
      'Оплата получена. Следите за статусом в разделе «Заказы».';

  @override
  String get saOrderPayOnDeliveryHint =>
      'Оплата при получении. Следите за статусом в разделе «Заказы».';

  @override
  String get saOrdersActive => 'Активные';

  @override
  String get saOrdersHistory => 'История';

  @override
  String get saOrdersNoActiveMessage =>
      'Вызовите такси или закажите еду — здесь можно будет следить за заказом.';

  @override
  String get saOrdersNoActiveTitle => 'Активных заказов нет';

  @override
  String get saOrdersNoHistoryMessage =>
      'Здесь будут храниться завершённые заказы.';

  @override
  String get saOrdersNoHistoryTitle => 'История заказов пуста';

  @override
  String get saOrdersTitle => 'Заказы';

  @override
  String get saParcelContinue => 'Выбрать адрес';

  @override
  String get saParcelPinInfo =>
      'Водитель вручит посылку только по PIN-коду. Вы увидите код после заказа — сообщите его получателю.';

  @override
  String get saParcelRecipientName => 'Имя получателя (необязательно)';

  @override
  String get saParcelRecipientPhone => 'Телефон получателя';

  @override
  String get saParcelSize => 'Размер';

  @override
  String get saParcelSizeLarge => 'Большая';

  @override
  String get saParcelSizeLargeHint => 'Помещается в багажник';

  @override
  String get saParcelSizeMedium => 'Средняя';

  @override
  String get saParcelSizeMediumHint => 'Сумка, коробка';

  @override
  String get saParcelSizeSmall => 'Маленькая';

  @override
  String get saParcelSizeSmallHint => 'Ключи, документы';

  @override
  String get saParcelSubtitle => 'Доставим ключи, документы или вещи по городу';

  @override
  String get saParcelTitle => 'Отправить посылку';

  @override
  String get saParcelWhat => 'Что отправляете?';

  @override
  String get saParcelWhatHint => 'Например: ключи, документы';

  @override
  String get saParcelWhatRequired => 'Укажите, что отправляете';

  @override
  String get saPaymentCard => 'Карта (Payme / Click)';

  @override
  String get saPaymentCash => 'Наличные';

  @override
  String get saPaymentIPaid => 'Я оплатил';

  @override
  String get saPaymentMethod => 'Способ оплаты';

  @override
  String get saPaymentNotCompleted =>
      'Оплата не завершена — заказ принят, оплатить можно позже';

  @override
  String saPaymentPageLoadFailed(String message) {
    return 'Не удалось загрузить страницу оплаты: $message';
  }

  @override
  String saPaymentStartFailed(String message) {
    return 'Не удалось начать оплату: $message';
  }

  @override
  String saPaymentTitle(String provider) {
    return 'Оплата — $provider';
  }

  @override
  String get saPickup => 'Откуда';

  @override
  String get saPopularRestaurants => 'Популярные рестораны';

  @override
  String get saProductDeliveryLabel => 'ДОСТАВКА';

  @override
  String get saProductDeliveryValue => '15–25 мин';

  @override
  String get saProductDescription =>
      'Свежий и качественный товар — быстро привезём из ближайшего магазина.';

  @override
  String get saProductInStock => 'В наличии';

  @override
  String get saProductOutOfStock => 'Нет в наличии';

  @override
  String get saProductRatingLabel => 'РЕЙТИНГ';

  @override
  String get saProductStockLabel => 'НАЛИЧИЕ';

  @override
  String saProductStoreUnit(String unit) {
    return 'Магазин · $unit';
  }

  @override
  String saProductsCount(int count) {
    return 'Товаров: $count';
  }

  @override
  String get saProfileHelpBannerLabel => 'Нужна помощь? Поддержка 24/7';

  @override
  String get saProfileNeedHelp => 'Нужна помощь?';

  @override
  String get saProfileRating => 'Рейтинг';

  @override
  String get saProfileSupport247 => 'Служба поддержки 24/7';

  @override
  String get saProfileTrips => 'Поездки';

  @override
  String get saPromoActive => 'АКТИВЕН';

  @override
  String get saPromoCodeCopied => 'Код скопирован';

  @override
  String saPromoCopyLabel(String code) {
    return 'Скопировать промокод: $code';
  }

  @override
  String saPromoMinOrder(String amount) {
    return 'Мин. заказ: $amount';
  }

  @override
  String saPromoUntil(String date) {
    return 'до $date';
  }

  @override
  String get saPromosEmpty => 'Активных промокодов пока нет';

  @override
  String get saPromosTitle => 'Акции и промокоды';

  @override
  String get saQtyDecrease => 'Уменьшить количество';

  @override
  String get saQtyIncrease => 'Увеличить количество';

  @override
  String get saRefresh => 'Обновить';

  @override
  String get saRestaurantNotFound => 'Ресторан не найден';

  @override
  String get saRestaurantsNotFound => 'Рестораны не найдены';

  @override
  String get saSavedAddresses => 'Сохранённые адреса';

  @override
  String get saSearch => 'Поиск';

  @override
  String get saSearchClear => 'Очистить поиск';

  @override
  String get saSearchEmptyMessage => 'Попробуйте другой запрос.';

  @override
  String get saSearchEmptyTitle => 'Ничего не найдено';

  @override
  String get saSearchHint => 'блюдо, магазин, товар…';

  @override
  String saSearchMarketUnit(String unit) {
    return 'Маркет · $unit';
  }

  @override
  String get saSearchSectionProducts => 'ТОВАРЫ';

  @override
  String get saSearchSectionRestaurants => 'РЕСТОРАНЫ';

  @override
  String get saSearchingDriver => 'Ищем водителя';

  @override
  String get saSeeAll => 'Все';

  @override
  String saSegChipLabel(String label, int count) {
    return '$label, $count шт.';
  }

  @override
  String saSegChipLabelSelected(String label, int count) {
    return '$label, $count шт., выбрано';
  }

  @override
  String get saSend => 'Отправить';

  @override
  String get saSettingsPush => 'Push-уведомления';

  @override
  String get saSettingsPushSyncFailed =>
      'Настройка сохранена, но не отправлена на сервер';

  @override
  String get saSettingsSectionGeneral => 'ОБЩИЕ';

  @override
  String get saSettingsSectionHelp => 'ПОМОЩЬ';

  @override
  String get saSettingsTitle => 'Настройки';

  @override
  String saSettingsVersion(String version) {
    return 'Angren Go · версия $version';
  }

  @override
  String get saSom => 'сум';

  @override
  String get saStageAccepted => 'Принят';

  @override
  String get saStageDelivered => 'Доставлен';

  @override
  String get saStageDriverEnRoute => 'Водитель в пути';

  @override
  String get saStageInTrip => 'В поездке';

  @override
  String get saStageOnTheWay => 'В пути';

  @override
  String get saStagePacking => 'Собирается';

  @override
  String get saStagePreparing => 'Готовится';

  @override
  String saStageProgress(int total, int step, String stage) {
    return 'Этап $step из $total: $stage';
  }

  @override
  String get saStageSearching => 'Поиск';

  @override
  String get saSubmitting => 'Отправляем...';

  @override
  String get saSupportCall => 'Позвонить';

  @override
  String saSupportCallSub(String phone) {
    return '$phone · бесплатно';
  }

  @override
  String get saSupportOperatorChat => 'Чат с оператором';

  @override
  String get saSupportOperatorChatSub => 'Напишите вопрос — оператор ответит';

  @override
  String get saTabHome => 'Главная';

  @override
  String get saTabOrders => 'Заказы';

  @override
  String get saTabProfile => 'Профиль';

  @override
  String get saTaxiWhereToLabel => 'Такси. Куда едем?';

  @override
  String get saTelegramOpenFailed => 'Не удалось открыть Telegram';

  @override
  String get saTopUpAmountLabel => 'Сумма пополнения';

  @override
  String get saTopUpOnlineUnavailable => 'Онлайн-пополнение пока недоступно';

  @override
  String get saTopUpTitle => 'Пополнение счёта';

  @override
  String get saTopUpViaOperatorHint =>
      'Пока кошелёк пополняется через оператора: позвоните по номеру 1056 или напишите в чат. Поездки можно оплачивать и наличными.';

  @override
  String get saTotal => 'Итого';

  @override
  String get saTxnBonus => 'Бонус';

  @override
  String get saTxnCommission => 'Комиссия платформы';

  @override
  String get saTxnCredit => 'зачисление';

  @override
  String get saTxnDebit => 'Списание';

  @override
  String get saTxnDebitWord => 'списание';

  @override
  String saTxnPending(String when) {
    return '$when · в обработке';
  }

  @override
  String get saTxnReferralBonus => 'Реферальный бонус';

  @override
  String saTxnSemantics(
      String title, String amount, String direction, String subtitle) {
    return '$title, $amount сум, $direction, $subtitle';
  }

  @override
  String get saTxnTopUp => 'Пополнение счёта';

  @override
  String get saTxnTripEarning => 'Доход за поездку';

  @override
  String get saTxnTripPayment => 'Оплата поездки';

  @override
  String get saTxnWithdrawal => 'Вывод средств';

  @override
  String get saViewOrders => 'Посмотреть заказы';

  @override
  String get saViewReceipt => 'Посмотреть чек';

  @override
  String get saWalletAllServices => 'Все сервисы';

  @override
  String get saWalletAndCards => 'Кошелёк и карты';

  @override
  String saWalletBalanceLabel(String amount) {
    return 'Баланс кошелька $amount сум';
  }

  @override
  String get saWalletBalanceNotLoaded => 'Баланс кошелька ещё не загружен';

  @override
  String get saWalletBalanceTitle => 'Баланс Angren Go';

  @override
  String get saWalletCards => 'Карты';

  @override
  String get saWalletCardsUnavailableMessage =>
      'Пока оплачивайте поездки наличными или с баланса кошелька.';

  @override
  String get saWalletCardsUnavailableTitle => 'Привязка карты пока недоступна';

  @override
  String get saWalletNoTxnsMessage =>
      'Появятся здесь после первой поездки или пополнения.';

  @override
  String get saWalletNoTxnsTitle => 'Операций пока нет';

  @override
  String get saWalletOneWalletNote =>
      'Такси, грузы, еда и маркет — один кошелёк, одна история.';

  @override
  String get saWalletRecentActivity => 'Последние операции';

  @override
  String get saWalletTitle => 'Кошелёк';

  @override
  String get saWalletTopUp => 'Пополнить';

  @override
  String get saWalletTransfer => 'Перевести';

  @override
  String get saWhereTo => 'Куда едем?';

  @override
  String get shAuthContinue => 'Продолжить';

  @override
  String get shAuthEnterPhone => 'Введите номер телефона';

  @override
  String get shAuthPhoneLabel => 'Номер телефона';

  @override
  String get shAuthTerms =>
      'Продолжая, вы соглашаетесь с условиями использования и политикой конфиденциальности.';

  @override
  String get shBack => 'Назад';

  @override
  String get shCancel => 'Отмена';

  @override
  String get shChatHint => 'Напишите сообщение...';

  @override
  String get shConfirm => 'Подтвердить';

  @override
  String get shDeliveryAccepted => 'Принят';

  @override
  String get shDeliveryDelivered => 'Доставлен';

  @override
  String get shDeliveryOnTheWay => 'В пути';

  @override
  String get shDeliveryPreparing => 'Готовится';

  @override
  String get shDriverFallbackName => 'Водитель';

  @override
  String get shErrorGeneric => 'Произошла ошибка';

  @override
  String get shErrorNoInternet => 'Проблема с интернетом';

  @override
  String shErrorSemantics(String message) {
    return 'Ошибка: $message';
  }

  @override
  String get shErrorTimeout => 'Время ожидания истекло. Проверьте интернет';

  @override
  String get shErrorUnknown => 'Произошла неизвестная ошибка';

  @override
  String get shFareBase => 'Базовый тариф';

  @override
  String shFareDistance(String km, String price) {
    return 'Расстояние ($km км × $price)';
  }

  @override
  String get shFareMaxCap => 'Ограничение максимальной цены';

  @override
  String get shFareMinAdjustment => 'Доплата до минимальной стоимости';

  @override
  String get shFareRounding => 'Округление';

  @override
  String shFareSurge(String multiplier) {
    return 'Повышенный спрос (×$multiplier)';
  }

  @override
  String shFareTime(int minutes, String price) {
    return 'Время ($minutes мин × $price)';
  }

  @override
  String shFareWaiting(int minutes) {
    return 'Ожидание ($minutes мин)';
  }

  @override
  String get shFareWaitingFree =>
      'Ожидание (0 мин — в пределах бесплатного времени)';

  @override
  String shFareWaitingRate(int minutes, String price) {
    return 'Ожидание ($minutes мин × $price)';
  }

  @override
  String get shLoading => 'Загрузка';

  @override
  String get shLostItemClosed => 'Закрыто';

  @override
  String get shLostItemFound => 'Найдено — оператор свяжется с вами';

  @override
  String get shLostItemNotFound => 'В машине не найдено';

  @override
  String get shLostItemOpen => 'Водитель проверяет';

  @override
  String get shLostItemReturned => 'Возвращено';

  @override
  String get shManeuverArrive => 'Вы прибыли на место';

  @override
  String shManeuverArriveIn(int meters) {
    return 'Через $meters метров вы прибудете на место';
  }

  @override
  String get shManeuverContinue => 'Продолжайте движение';

  @override
  String get shManeuverDepart => 'Начните движение';

  @override
  String shManeuverInDistance(int meters, String instruction) {
    return 'Через $meters метров $instruction';
  }

  @override
  String get shManeuverLeft => 'Поверните налево';

  @override
  String get shManeuverRerouting =>
      'Вы отклонились от маршрута. Маршрут перестраивается.';

  @override
  String get shManeuverRight => 'Поверните направо';

  @override
  String get shManeuverSharpLeft => 'Резко поверните налево';

  @override
  String get shManeuverSharpRight => 'Резко поверните направо';

  @override
  String get shManeuverStraight => 'Продолжайте прямо';

  @override
  String get shManeuverUturn => 'Развернитесь';

  @override
  String get shMarketPacking => 'Магазин собирает заказ';

  @override
  String shMeterAtLeast(String price) {
    return 'от $price';
  }

  @override
  String shMeterDistanceTime(String distance, int minutes) {
    return '$distance · $minutes мин';
  }

  @override
  String get shMeterFinalNote =>
      'Итоговая цена уточняется по маршруту в конце поездки';

  @override
  String get shMeterNoDestination => 'Без адреса — таксометр';

  @override
  String get shMeterTitle => 'Таксометр';

  @override
  String shNeedsAttentionSemantics(String label) {
    return '$label, требует внимания';
  }

  @override
  String get shOrderStatusCompleted => 'Завершён';

  @override
  String get shOrderStatusDriverArrived => 'Водитель на месте';

  @override
  String get shOrderStatusDriverAssigned => 'Водитель назначен';

  @override
  String get shOrderStatusDriverEnRoute => 'Водитель в пути';

  @override
  String get shOrderStatusInProgress => 'В пути';

  @override
  String get shOrderStatusScheduled => 'Запланирован';

  @override
  String get shOrderStatusSearching => 'Ищем водителя';

  @override
  String get shOtpEnterSixDigits => 'Введите 6-значный код';

  @override
  String get shOtpHeading => 'Введите код из SMS';

  @override
  String get shOtpResend => 'Отправить код повторно';

  @override
  String shOtpResendIn(int seconds) {
    return 'Повторная отправка: $seconds с';
  }

  @override
  String get shOtpSentPrefix => 'Код отправлен на номер ';

  @override
  String get shOtpSentSuffix => ' ';

  @override
  String get shOtpTitle => 'Подтверждение';

  @override
  String get shPayMethodCard => 'Карта';

  @override
  String get shPayMethodCash => 'Наличные';

  @override
  String get shPayMethodWallet => 'Кошелёк';

  @override
  String get shPayStatusFailed => 'Не выполнено';

  @override
  String get shPayStatusPaid => 'Оплачено';

  @override
  String get shPayStatusRefunded => 'Возвращено';

  @override
  String shReceiptDate(String date) {
    return 'Дата: $date';
  }

  @override
  String shReceiptDiscount(String promo, String amount) {
    return 'Скидка$promo: −$amount';
  }

  @override
  String shReceiptDistance(String distance) {
    return 'Расстояние: $distance';
  }

  @override
  String shReceiptDriver(String driver) {
    return 'Водитель: $driver';
  }

  @override
  String shReceiptDropoff(String address) {
    return 'Куда: $address';
  }

  @override
  String shReceiptDuration(String duration) {
    return 'Длительность: $duration';
  }

  @override
  String shReceiptGrandTotal(String amount) {
    return 'Итоговая сумма: $amount';
  }

  @override
  String get shReceiptHeader => 'Angren Go — чек поездки';

  @override
  String get shReceiptMeteredDropoff => 'По таксометру (без адреса)';

  @override
  String get shReceiptNoFareBreakdown => 'Детализация стоимости не сохранена.';

  @override
  String get shReceiptNotSaved => 'не сохранён';

  @override
  String shReceiptOrder(String number) {
    return 'Заказ: $number';
  }

  @override
  String shReceiptPayment(String payment) {
    return 'Оплата: $payment';
  }

  @override
  String shReceiptPickup(String address) {
    return 'Откуда: $address';
  }

  @override
  String shReceiptService(String service) {
    return 'Услуга: $service';
  }

  @override
  String shReceiptStop(int index, String address) {
    return 'Остановка $index: $address';
  }

  @override
  String shReceiptTariff(String tariff) {
    return 'Тариф: $tariff';
  }

  @override
  String shReceiptTip(String amount) {
    return 'Чаевые: +$amount';
  }

  @override
  String shReceiptTotal(String amount) {
    return 'Итого: $amount';
  }

  @override
  String shReceiptUnpaid(String amount) {
    return 'Неоплаченный остаток: $amount';
  }

  @override
  String get shRetry => 'Повторить';

  @override
  String shRouteFromSemantics(String address) {
    return 'Откуда: $address';
  }

  @override
  String get shRouteSwap => 'Поменять адреса местами';

  @override
  String shRouteToSemantics(String address) {
    return 'Куда: $address';
  }

  @override
  String shRouteToWithDistanceSemantics(String address, String distance) {
    return 'Куда: $address, $distance';
  }

  @override
  String get shSend => 'Отправить';

  @override
  String get shServiceCargo => 'Грузоперевозка';

  @override
  String get shServiceCargoShort => 'Грузы';

  @override
  String get shServiceFood => 'Доставка еды';

  @override
  String get shServiceFoodShort => 'Еда';

  @override
  String get shServiceMarket => 'Доставка из магазина';

  @override
  String get shServiceMarketShort => 'Маркет';

  @override
  String get shServiceParcelShort => 'Посылка';

  @override
  String get shServiceTaxi => 'Такси';

  @override
  String get shStatusCancelled => 'Отменён';

  @override
  String get shStatusPending => 'Ожидание';

  @override
  String shStatusSemantics(String status) {
    return 'Статус: $status';
  }

  @override
  String get shSupportChatEmpty => 'Напишите нам — операторы на связи 24/7';

  @override
  String get shSupportChatTitle => 'Чат с оператором';

  @override
  String get shTripChatEmpty => 'Сообщений пока нет. Напишите первым!';

  @override
  String get shTripChatTitle => 'Чат';

  @override
  String get shTripOptionAirConditioner => 'Кондиционер';

  @override
  String get shTripOptionBigLuggage => 'Большой багаж';

  @override
  String get shTripOptionChildSeat => 'Детское кресло';

  @override
  String get shTripOptionPet => 'С животным';

  @override
  String get shTxBonus => 'Бонус';

  @override
  String get shTxTopUp => 'Пополнение';

  @override
  String get shTxTrip => 'Поездка';

  @override
  String get shTxWithdrawal => 'Вывод средств';

  @override
  String get shValDigitsOnly => 'Введите только цифры';

  @override
  String shValFieldRequired(String field) {
    return 'Поле «$field» не может быть пустым';
  }

  @override
  String get shValNameRequired => 'Введите имя';

  @override
  String get shValNameTooShort => 'Имя должно содержать не менее 2 букв';

  @override
  String get shValOtpLength => 'Код должен состоять из 6 цифр';

  @override
  String get shValOtpRequired => 'Введите код';

  @override
  String get shValPhoneInvalid => 'Неверный номер телефона (+998XXXXXXXXX)';

  @override
  String get shValPhoneRequired => 'Введите номер телефона';

  @override
  String get shValThisFieldRequired => 'Это поле не может быть пустым';

  @override
  String shVerifDaysLeft(int days) {
    return 'Осталось $days дн.';
  }

  @override
  String shVerifDaysOverdue(int days) {
    return 'Просрочено на $days дн.';
  }

  @override
  String get shVerifDueSoon => 'Скоро истекает';

  @override
  String get shVerifExpiresToday => 'Истекает сегодня';

  @override
  String get shVerifMissing => 'Не загружен';

  @override
  String get shVerifOk => 'Действителен';

  @override
  String get shVerifOverdue => 'Просрочен';

  @override
  String get shVerifPendingReview => 'На проверке';

  @override
  String get shVerifRejected => 'Отклонён';

  @override
  String get shVerifUnknown => 'Требует внимания';
}
