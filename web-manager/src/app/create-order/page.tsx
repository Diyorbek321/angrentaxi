'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, PlusCircle } from 'lucide-react';
import { CreateOrderForm } from '@/components/dispatch/CreateOrderForm';
import { Button } from '@/components/ui/Button';

export default function CreateOrderPage() {
  const router = useRouter();

  const handleSuccess = () => {
    // Stay on page after success (form resets itself)
    // Optionally redirect after brief delay
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          leftIcon={<ArrowLeft size={14} />}
        >
          Back
        </Button>
        <div>
          <h1 className="text-lg font-semibold text-gray-100 flex items-center gap-2">
            <PlusCircle size={18} className="text-accent-500" />
            Create Order
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manually create a new order for a passenger
          </p>
        </div>
      </div>

      {/* Form card */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <CreateOrderForm onSuccess={handleSuccess} />
      </div>
    </div>
  );
}
