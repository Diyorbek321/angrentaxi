import { catalogDiscount, type CatalogDiscountSource } from '@/lib/promotions';
import { Badge } from '@/components/ui/Badge';
import { MoneyText } from '@/components/ui/MoneyText';

/**
 * Katalog jadvalida: pozitsiya faol aksiyaga tushsa — chegirma badge'i va
 * yakuniy narx. API `finalPrice`/`discount` bermasa hech narsa chizilmaydi.
 */
export function DiscountTag({ item }: { item: CatalogDiscountSource }) {
  const view = catalogDiscount(item);
  if (!view) return null;
  return (
    <span className="mt-0.5 flex items-center justify-end gap-1.5" title={view.title || undefined}>
      <Badge variant="success" size="sm">
        {view.label}
      </Badge>
      <MoneyText value={view.final} className="text-xs font-medium text-primary-text" />
    </span>
  );
}
