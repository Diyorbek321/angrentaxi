import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { DriverDocumentReviewStatus } from '../../../database/entities/driver-document.entity';

export class ReviewDriverDocumentDto {
  // Validated against the full DriverDocumentReviewStatus enum here (so
  // anything that isn't a real review status is rejected at the DTO layer),
  // but 'pending' is not a valid *target* of a review action — that's an
  // invalid-transition check enforced in DriverDocumentsService.review(),
  // alongside the "reason required when rejecting" rule below.
  @ApiProperty({
    enum: DriverDocumentReviewStatus,
    description:
      'Review decision. Must be "approved" or "rejected" — "pending" is rejected as an invalid target status.',
    example: DriverDocumentReviewStatus.APPROVED,
  })
  @IsEnum(DriverDocumentReviewStatus)
  status: DriverDocumentReviewStatus;

  // Required in practice when status is 'rejected', but that's enforced in
  // DriverDocumentsService.review() (not here) since class-validator doesn't
  // have a clean way to express "required only if another field has X value".
  @ApiProperty({
    description: 'Reason for rejection. Required when status is "rejected".',
    required: false,
    maxLength: 500,
    example: 'Photo is blurry, license number not legible',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
