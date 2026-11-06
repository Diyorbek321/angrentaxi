import type { TransformFnParams } from 'class-transformer';

/**
 * Forma/multipart'dan kelgan `"true"`/`"false"` satrini boolean qiladi.
 *
 * ⚠️ `value` EMAS, `obj[key]` o'qiladi: global ValidationPipe'dagi
 * `enableImplicitConversion` @Transform'dan OLDIN ishlaydi va
 * `Boolean("false") === true` qilib yuboradi — `value` ga yetib kelganda
 * "false" allaqachon `true`. Xom qiymat faqat manba obyektda qoladi.
 */
export function formBoolean({ obj, key }: TransformFnParams): unknown {
  const raw: unknown = (obj as Record<string, unknown>)[key];
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return raw;
}
