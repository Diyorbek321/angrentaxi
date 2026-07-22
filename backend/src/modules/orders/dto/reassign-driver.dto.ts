import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class ReassignDriverDto {
  @ApiProperty({ description: 'Driver profile UUID to assign to this order' })
  @IsUUID()
  driverId: string;

  // Required — under the automated-dispatch model this endpoint is an
  // exception path (no drivers found, SOS, a driver's car breaking down
  // mid-trip), not the default way orders get a driver, so every use must be
  // justified and is recorded in dispatch_overrides (see DispatchOverride).
  @ApiProperty({
    example: 'No drivers found automatically — nearest driver called in manually',
    description: 'Why this order needed a manual driver assignment',
  })
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason: string;
}
