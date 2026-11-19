import Flutter
import UIKit

/// iOS = faqat yo'lovchi ilovasi (`lib/main_passenger.dart`).
///
/// Android'dagi native kanallardan bu yerda faqat yo'lovchiga keraklisi bor:
/// - `uz.angren.taxi/share` — tizim "Ulashish" oynasi (safarni ulashish).
///
/// Qolganlari (`push`, `secure`, `device`, `voice`, `driver_overlay`) iOS'da
/// e'lon qilinmaydi: Dart tomoni ularni Android bilan cheklaydi yoki
/// `MissingPluginException` ni jim ushlaydi. Push'ni iOS'da FCM/APNs o'zi
/// ko'rsatadi (`setForegroundNotificationPresentationOptions`).
@main
@objc class AppDelegate: FlutterAppDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    GeneratedPluginRegistrant.register(with: self)

    if let controller = window?.rootViewController as? FlutterViewController {
      registerShareChannel(controller)
    }

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  /// Backend har push'da `badge: 1` yuboradi — ilova ochilganda nishon tozalanadi.
  override func applicationDidBecomeActive(_ application: UIApplication) {
    super.applicationDidBecomeActive(application)
    application.applicationIconBadgeNumber = 0
  }

  /// `lib/core/platform/system_share.dart` bilan bir xil shartnoma:
  /// `shareText(text, title?, subject?)` → oyna ochilsa `true`.
  private func registerShareChannel(_ controller: FlutterViewController) {
    let channel = FlutterMethodChannel(
      name: "uz.angren.taxi/share",
      binaryMessenger: controller.binaryMessenger
    )
    channel.setMethodCallHandler { [weak controller] call, result in
      guard call.method == "shareText" else {
        result(FlutterMethodNotImplemented)
        return
      }
      guard
        let args = call.arguments as? [String: Any],
        let text = args["text"] as? String,
        !text.isEmpty,
        let presenter = controller
      else {
        result(false)
        return
      }

      let sheet = UIActivityViewController(activityItems: [text], applicationActivities: nil)
      if let subject = args["subject"] as? String {
        sheet.setValue(subject, forKey: "subject")
      }
      // iPhone'da shart emas, lekin iPad'da popover langarsiz yiqiladi.
      if let popover = sheet.popoverPresentationController {
        popover.sourceView = presenter.view
        popover.sourceRect = CGRect(
          x: presenter.view.bounds.midX, y: presenter.view.bounds.midY, width: 0, height: 0)
        popover.permittedArrowDirections = []
      }
      presenter.present(sheet, animated: true)
      result(true)
    }
  }
}
