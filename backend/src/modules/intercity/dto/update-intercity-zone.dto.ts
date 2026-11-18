import { PartialType } from '@nestjs/swagger';
import { CreateIntercityZoneDto } from './create-intercity-zone.dto';

// Tuman boshqa nuqtaga ko'chirilmaydi — `point_id` DTO'da yo'q.
export class UpdateIntercityZoneDto extends PartialType(CreateIntercityZoneDto) {}
