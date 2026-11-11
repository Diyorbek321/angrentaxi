'use client';

import { useState } from 'react';
import { Flag } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { canReportOrder, type IncidentVertical } from '@/lib/incidents';
import { ReportIncidentModal } from './ReportIncidentModal';
import { t } from '@/locales';

/** Buyurtma oynasidagi "Muammo haqida xabar berish" — faqat tugagan buyurtmada. */
export function ReportIncidentButton({
  order,
  vertical,
}: {
  order: { id: string; status: string; updatedAt?: string | null };
  vertical: IncidentVertical;
}) {
  const [open, setOpen] = useState(false);
  if (!canReportOrder(order, new Date())) return null;
  return (
    <>
      <Button variant="secondary" size="sm" leftIcon={<Flag size={13} aria-hidden />} onClick={() => setOpen(true)}>
        {t().incidents.report}
      </Button>
      <ReportIncidentModal isOpen={open} onClose={() => setOpen(false)} vertical={vertical} orderId={order.id} />
    </>
  );
}
