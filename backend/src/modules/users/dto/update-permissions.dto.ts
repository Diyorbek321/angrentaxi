import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEnum } from 'class-validator';
import { Permission } from '../../../database/entities/user.entity';

export class UpdatePermissionsDto {
  @ApiProperty({
    enum: Permission,
    isArray: true,
    description: "The manager's full new permission set (replaces the existing list, not a merge)",
  })
  @IsArray()
  @IsEnum(Permission, { each: true })
  permissions: Permission[];
}
