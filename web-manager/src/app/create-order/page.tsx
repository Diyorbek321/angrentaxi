'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Info, PlusCircle } from 'lucide-react';
import { CreateOrderForm } from '@/components/dispatch/CreateOrderForm';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';

export default function CreateOrderPage() {
  const router = useRouter();

  const handleSuccess = () => {
    // Stay on page after success (form resets itself)
    // Optionally redirect after brief delay
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-5 py-5">
        <PageHeader
          title="Buyurtma yaratish"
          description="Call-markaz uchun qoʻlda buyurtma ochish"
          icon={<PlusCircle size={17} />}
          actions={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              leftIcon={<ArrowLeft size={14} />}
            >
              Orqaga
            </Button>
          }
        />

        <div className="flex items-start gap-2.5 rounded-lg border border-line bg-surface-2/60 px-3 py-2.5 mb-5">
          <Info size={14} className="text-muted shrink-0 mt-0.5" />
          <p className="text-xs text-muted leading-relaxed">
            Buyurtma yaratilgach, haydovchi <strong>avtomatik</strong> qidiriladi — bu yerda
            haydovchi tanlanmaydi.
          </p>
        </div>

        <Card padding="lg">
          <CreateOrderForm onSuccess={handleSuccess} />
        </Card>
      </div>
    </div>
  );
}
