import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AppFlavor, AppVersionPolicy, AppVersionService } from './app-version.service';

const FLAVORS: readonly AppFlavor[] = ['passenger', 'driver'];

// Ochiq (JWT'siz): ilova kirishdan OLDIN ham tekshiradi — eski build
// login oqimining o'zida buzilgan bo'lishi mumkin.
@ApiTags('App')
@Controller('app')
export class AppVersionController {
  constructor(private readonly appVersion: AppVersionService) {}

  @Get('version')
  @ApiOperation({ summary: 'Minimal / eng yangi ilova build raqami (force update)' })
  @ApiQuery({ name: 'flavor', enum: FLAVORS })
  version(@Query('flavor') flavor: string): AppVersionPolicy {
    if (!FLAVORS.includes(flavor as AppFlavor)) {
      throw new BadRequestException('flavor must be passenger or driver');
    }
    return this.appVersion.policyFor(flavor as AppFlavor);
  }
}
