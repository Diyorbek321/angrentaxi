import 'package:angren_taxi/core/config/app_config.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/observability/crash_reporting.dart';
import 'package:package_info_plus/package_info_plus.dart';

enum UpdateRequirement {
  /// Joriy build yetarli.
  none,

  /// Yangi versiya bor — taklif qilinadi, yopsa bo'ladi.
  optional,

  /// Bu build endi ishlamaydi — ilova "yangilang" ekranida to'xtaydi.
  required,
}

/// `GET /app/version?flavor=…` javobi (backend `AppVersionService`).
class AppVersionPolicy {
  const AppVersionPolicy({
    required this.minBuild,
    required this.latestBuild,
    this.updateUrl,
  });

  factory AppVersionPolicy.fromJson(Map<String, dynamic> json) {
    int read(String key) => (json[key] as num?)?.toInt() ?? 0;
    final url = json['updateUrl'];
    return AppVersionPolicy(
      minBuild: read('minBuild'),
      latestBuild: read('latestBuild'),
      updateUrl: url is String && url.isNotEmpty ? url : null,
    );
  }

  final int minBuild;
  final int latestBuild;
  final String? updateUrl;
}

/// Build raqami noma'lum (0) bo'lsa hech qachon bloklanmaydi.
UpdateRequirement decideUpdate(int currentBuild, AppVersionPolicy policy) {
  if (currentBuild <= 0) return UpdateRequirement.none;
  if (currentBuild < policy.minBuild) return UpdateRequirement.required;
  if (currentBuild < policy.latestBuild) return UpdateRequirement.optional;
  return UpdateRequirement.none;
}

class UpdateCheckResult {
  const UpdateCheckResult(this.requirement, this.policy);

  final UpdateRequirement requirement;
  final AppVersionPolicy policy;
}

/// Majburiy / ixtiyoriy yangilanishni serverdan tekshiradi.
///
/// Tarmoq yoki server xatosida `null` — ilova odatdagidek ishlaydi
/// (tekshiruv yiqilgani uchun foydalanuvchini bloklash noto'g'ri).
class AppUpdateService {
  AppUpdateService(
    this._api, {
    required this.flavor,
    Future<int> Function()? currentBuild,
  }) : _currentBuild = currentBuild ?? _platformBuild;

  final ApiClient _api;
  final AppFlavor flavor;
  final Future<int> Function() _currentBuild;

  static Future<int> _platformBuild() async =>
      int.tryParse((await PackageInfo.fromPlatform()).buildNumber) ?? 0;

  Future<UpdateCheckResult?> check() async {
    try {
      final response = await _api
          .get(ApiEndpoints.appVersion, params: {'flavor': flavor.name});
      final body = response.data;
      final data = body is Map<String, dynamic> && body['data'] is Map
          ? body['data'] as Map<String, dynamic>
          : body;
      if (data is! Map<String, dynamic>) return null;
      final policy = AppVersionPolicy.fromJson(data);
      return UpdateCheckResult(
        decideUpdate(await _currentBuild(), policy),
        policy,
      );
    } catch (e, st) {
      CrashReporting.reportHandled(e, st, 'AppUpdateService.check');
      return null;
    }
  }
}
