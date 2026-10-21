'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Info } from 'lucide-react';
import { CreateOrderForm } from '@/components/dispatch/CreateOrderForm';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageBody } from '@/components/ui/PageBody';
import { t } from '@/locales';

export default function CreateOrderPage() {
  const m = t();
  const router = useRouter();

  const handleSuccess = () => {
    // Stay on page after success (form resets itself)
    // Optionally redirect after brief delay
  };

  return (
    <PageBody width="narrow" className="max-w-3xl">
        <PageHeader
          title={m.orders.create.title}
          description={m.orders.create.description}
          actions={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              leftIcon={<ArrowLeft size={14} aria-hidden />}
            >
              {m.common.back}
            </Button>
          }
        />

        <div className="flex items-start gap-2.5 rounded-ds-sm border border-line bg-surface-2/60 px-3 py-2.5 mb-4">
          <Info size={14} className="text-muted shrink-0 mt-0.5" aria-hidden />
          <p className="text-[13px] text-muted leading-relaxed">
            {m.orders.create.autoHintBefore}<strong>{m.orders.create.autoHintStrong}</strong>
            {m.orders.create.autoHintAfter}
          </p>
        </div>

        <Card padding="lg">
          <CreateOrderForm onSuccess={handleSuccess} />
        </Card>
    </PageBody>
  );
}
