import { Controller, Get, Inject, NotFoundException, Param, Res } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CATALOG_PREFIX, catalogImageMimeType } from './catalog-images';
import { OBJECT_STORAGE, ObjectStorage } from './object-storage';

@ApiTags('Media')
@Controller('media')
export class MediaController {
  constructor(@Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage) {}

  /**
   * OCHIQ: katalog rasmi maxfiy emas. Kalit har yangi rasmda yangi UUID —
   * fayl hech qachon joyida o'zgarmaydi, shuning uchun `immutable` kesh.
   */
  @Get('catalog/:file')
  @ApiOperation({ summary: 'Katalog rasmi (ochiq, keshlanadi)' })
  @ApiParam({ name: 'file', description: '<uuid>.jpg | .png | .webp' })
  async catalogImage(@Param('file') file: string, @Res() res: Response): Promise<void> {
    const key = `${CATALOG_PREFIX}${file}`;
    const mimeType = catalogImageMimeType(key);
    if (!mimeType) throw new NotFoundException('Rasm topilmadi');
    const object = await this.storage.get(key);
    if (!object) throw new NotFoundException('Rasm topilmadi');
    // `@Res()` orqali oqim: aks holda global ResponseInterceptor binar
    // javobni JSON konvertiga o'rab qo'yardi.
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    object.stream.pipe(res);
  }
}
