import { PartialType } from '@nestjs/swagger';
import { CreateCityDto } from './create-city.dto';

// Barcha maydonlar ixtiyoriy — menejer bitta radiusni ham o'zgartira oladi.
export class UpdateCityDto extends PartialType(CreateCityDto) {}
