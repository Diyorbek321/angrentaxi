'use client';

import { useEffect, useState } from 'react';
import { Send, BellRing } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { SkeletonCards } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { broadcastApi, BroadcastAudience, PushBroadcast } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { formatDate } from '@/lib/utils';

const AUDIENCES: { value: BroadcastAudience; label: string }[] = [
  { value: 'all', label: 'All users' },
  { value: 'customers', label: 'Customers only' },
  { value: 'drivers', label: 'Drivers only' },
];

export default function PushNotificationsPage() {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<BroadcastAudience>('all');
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<PushBroadcast[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const res = await broadcastApi.getHistory();
      setHistory(res.data.data?.broadcasts ?? []);
      setError(null);
    } catch {
      setError("Tarixni yuklab bo'lmadi.");
      toast({ title: 'Xatolik', description: 'Tarixni yuklashda xatolik', variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) {
      toast({ title: 'Xatolik', description: 'Sarlavha va matnni kiriting', variant: 'error' });
      return;
    }
    setSending(true);
    try {
      await broadcastApi.send(title.trim(), body.trim(), audience);
      toast({ title: 'Yuborildi', variant: 'success' });
      setTitle('');
      setBody('');
      await loadHistory();
    } catch {
      toast({ title: 'Xatolik', description: "Yuborishda xatolik", variant: 'error' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title="Push xabarnomalar"
        description="Foydalanuvchilarga push-xabar yuborish"
        icon={<BellRing className="h-4 w-4" />}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Yangi xabar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input label="Sarlavha" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Textarea
              label="Matn"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
            />
            <div>
              <label className="mb-1.5 block text-caption font-medium text-muted">
                Auditoriya
              </label>
              <Tabs
                items={AUDIENCES}
                value={audience}
                onChange={setAudience}
                ariaLabel="Auditoriyani tanlash"
              />
            </div>
            <Button onClick={handleSend} isLoading={sending} leftIcon={<Send className="h-4 w-4" />}>
              Yuborish
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Yuborish tarixi</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {error ? (
              <div className="p-4">
                <ErrorState message={error} onRetry={loadHistory} />
              </div>
            ) : isLoading ? (
              <div className="p-4">
                <SkeletonCards count={3} height="h-14" />
              </div>
            ) : history.length === 0 ? (
              <EmptyState
                icon={<BellRing className="h-6 w-6" />}
                title="Hali xabar yuborilmagan"
                description="Birinchi push-xabarni yuborganingizda, u shu yerda ko'rinadi."
              />
            ) : (
              <div className="divide-y divide-divider">
                {history.map((h) => (
                  <div key={h.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-body font-medium text-ink">{h.title}</p>
                      <Badge variant="secondary">{h.audience}</Badge>
                    </div>
                    <p className="mt-1 text-caption text-muted">{h.body}</p>
                    <p className="mt-1.5 text-caption text-subtle">
                      {formatDate(h.createdAt)} · {h.sentCount} ta yetkazildi
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
