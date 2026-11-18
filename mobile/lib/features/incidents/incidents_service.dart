import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/shared/models/incident.dart';
import 'package:dio/dio.dart' show FormData, MultipartFile;

/// Shikoyat va hodisa API'si (docs/INCIDENT-POLICY.md §3). Yo'lovchi, mijoz
/// va haydovchi/kuryer bir xil endpointlarni ishlatadi — server rolni
/// buyurtma ishtirokchisidan aniqlaydi.
class IncidentsService {
  IncidentsService(this._api);

  final ApiClient _api;

  static Map<String, dynamic> _data(dynamic body) =>
      (body as Map<String, dynamic>)['data'] as Map<String, dynamic>;

  /// Yangi shikoyat — yaratilgan murojaat `id` si (foto yuklash uchun).
  Future<String> report({
    required String vertical,
    required String orderId,
    required String category,
    required String description,
    String? subject,
  }) async {
    final response = await _api.post(
      ApiEndpoints.incidents,
      data: {
        'vertical': vertical,
        'orderId': orderId,
        'category': category,
        'description': description.trim(),
        if (subject != null) 'subject': subject,
      },
    );
    return _data(response.data)['id'].toString();
  }

  Future<void> uploadPhoto(String incidentId, String path) async {
    final form = FormData.fromMap({
      'file': await MultipartFile.fromFile(path, filename: path.split('/').last),
    });
    await _api.post(ApiEndpoints.incidentPhotos(incidentId), data: form);
  }

  Future<List<ReporterIncident>> mine() async {
    final response = await _api.get(ApiEndpoints.myIncidents);
    final list = (response.data as Map<String, dynamic>)['data'] as List<dynamic>;
    return list
        .whereType<Map<String, dynamic>>()
        .map(ReporterIncident.fromJson)
        .toList(growable: false);
  }

  Future<IncidentAboutMe> aboutMe() async {
    final response = await _api.get(ApiEndpoints.incidentsAboutMe);
    return IncidentAboutMe.fromJson(_data(response.data));
  }

  Future<void> appeal(String incidentId, String note) async {
    await _api.post(ApiEndpoints.incidentAppeal(incidentId), data: {'note': note.trim()});
  }
}
