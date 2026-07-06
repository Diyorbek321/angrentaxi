import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsObject, IsUUID, ValidateIf } from 'class-validator';
import { TariffChangeAction } from '../../../database/entities/tariff-change-request.entity';

export class ProposeTariffChangeDto {
  @ApiProperty({ enum: TariffChangeAction, example: TariffChangeAction.UPDATE })
  @IsEnum(TariffChangeAction)
  action: TariffChangeAction;

  @ApiProperty({
    example: 'uuid',
    description: 'Existing tariff ID — required when action is "update"',
    required: false,
  })
  @ValidateIf((dto: ProposeTariffChangeDto) => dto.action === TariffChangeAction.UPDATE)
  @IsUUID()
  tariffId?: string;

  @ApiProperty({
    description: 'Proposed tariff field values, shaped like CreateTariffDto/UpdateTariffDto',
    example: { basePrice: 4000, minPrice: 6000, maxPrice: 50000 },
  })
  @IsObject()
  proposedChanges: Record<string, unknown>;
}
