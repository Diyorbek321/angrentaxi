import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { DriverDocumentType } from '../../../database/entities/driver-document.entity';

export class UploadDriverDocumentDto {
  @ApiProperty({
    enum: DriverDocumentType,
    description: 'Type of KYC document being uploaded',
    example: DriverDocumentType.LICENSE_FRONT,
  })
  @IsEnum(DriverDocumentType)
  documentType: DriverDocumentType;
}
