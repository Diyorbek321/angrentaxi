import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateIntercityRouteDto } from './create-intercity-route.dto';

/**
 * Uchlar (`originPointId`/`destinationPointId`) o'zgartirilmaydi: boshqa
 * yo'nalish — boshqa qator. Aks holda Angren→Toshkent qatnovlari tarixi
 * jimgina Angren→Olmaliq bo'lib qolardi.
 */
export class UpdateIntercityRouteDto extends PartialType(
  OmitType(CreateIntercityRouteDto, ['originPointId', 'destinationPointId'] as const),
) {}
