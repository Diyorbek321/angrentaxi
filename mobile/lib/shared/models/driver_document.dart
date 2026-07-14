import 'package:equatable/equatable.dart';

// Mirrors backend `DriverDocumentType` (backend/src/database/entities/
// driver-document.entity.ts). Keep in sync with the four values the API
// accepts on POST /drivers/documents.
enum DriverDocumentType {
  licenseFront,
  licenseBack,
  passport,
  vehicleRegistration,
}

// Mirrors backend `DriverDocumentReviewStatus`.
enum DriverDocumentReviewStatus { pending, approved, rejected }

String driverDocumentTypeToApi(DriverDocumentType type) {
  switch (type) {
    case DriverDocumentType.licenseFront:
      return 'license_front';
    case DriverDocumentType.licenseBack:
      return 'license_back';
    case DriverDocumentType.passport:
      return 'passport';
    case DriverDocumentType.vehicleRegistration:
      return 'vehicle_registration';
  }
}

DriverDocumentType driverDocumentTypeFromApi(String value) {
  switch (value) {
    case 'license_front':
      return DriverDocumentType.licenseFront;
    case 'license_back':
      return DriverDocumentType.licenseBack;
    case 'passport':
      return DriverDocumentType.passport;
    case 'vehicle_registration':
      return DriverDocumentType.vehicleRegistration;
    default:
      throw ArgumentError('Unknown driver document type: $value');
  }
}

DriverDocumentReviewStatus driverDocumentReviewStatusFromApi(String value) {
  switch (value) {
    case 'approved':
      return DriverDocumentReviewStatus.approved;
    case 'rejected':
      return DriverDocumentReviewStatus.rejected;
    case 'pending':
    default:
      return DriverDocumentReviewStatus.pending;
  }
}

// A document record as returned by GET/POST /drivers/documents.
class DriverDocument extends Equatable {
  const DriverDocument({
    required this.id,
    required this.driverId,
    required this.documentType,
    required this.fileUrl,
    required this.reviewStatus,
    required this.uploadedAt,
    this.rejectionReason,
  });

  final String id;
  final String driverId;
  final DriverDocumentType documentType;
  final String fileUrl;
  final DriverDocumentReviewStatus reviewStatus;
  final DateTime uploadedAt;
  // Admin-provided reason when `reviewStatus == rejected`; null otherwise
  // (backend clears it on approve, and it's never set while pending).
  final String? rejectionReason;

  factory DriverDocument.fromJson(Map<String, dynamic> json) {
    return DriverDocument(
      id: json['id'] as String,
      driverId: json['driverId'] as String,
      documentType: driverDocumentTypeFromApi(json['documentType'] as String),
      fileUrl: json['fileUrl'] as String,
      reviewStatus:
          driverDocumentReviewStatusFromApi(json['reviewStatus'] as String),
      uploadedAt: DateTime.parse(json['uploadedAt'] as String),
      rejectionReason: json['rejectionReason'] as String?,
    );
  }

  @override
  List<Object?> get props => [
        id,
        driverId,
        documentType,
        fileUrl,
        reviewStatus,
        uploadedAt,
        rejectionReason,
      ];
}
