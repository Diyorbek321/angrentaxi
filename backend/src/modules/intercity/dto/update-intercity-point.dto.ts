import { PartialType } from '@nestjs/swagger';
import { CreateIntercityPointDto } from './create-intercity-point.dto';

export class UpdateIntercityPointDto extends PartialType(CreateIntercityPointDto) {}
