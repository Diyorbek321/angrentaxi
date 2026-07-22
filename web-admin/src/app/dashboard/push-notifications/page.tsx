'use client';

import { useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
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

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const res = await broadcastApi.getHistory();
      setHistory(res.data.data?.broadcasts ?? []);
    } catch {
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
      toast({ title: "Yuborildi", variant: 'success' });
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
    <div>
      <Header title="Push xabarnomalar" subtitle="Foydalanuvchilarga push-xabar yuborish" />
      <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Yangi xabar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input label="Sarlavha" value={title} onChange={(e) => setTitle(e.target.value)} />
            <div>
              <label className="text-sm font-medium text-gray-400 block mb-1.5">Matn</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                className="w-full bg-white/5 border border-white/10 rounded-md text-gray-100 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-400 block mb-1.5">Auditoriya</label>
              <div className="flex gap-2">
                {AUDIENCES.map((a) => (
                  <button
                    key={a.value}
                    onClick={() => setAudience(a.value)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold border ${
                      audience === a.value
                        ? 'border-yellow-400/50 text-yellow-400 bg-yellow-400/10'
                        : 'border-white/10 text-gray-400'
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={handleSend} isLoading={sending}>
              <Send className="h-4 w-4 mr-2" />
              Yuborish
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Yuborish tarixi</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : history.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-500">Hali xabar yuborilmagan</p>
            ) : (
              <div className="divide-y divide-white/5">
                {history.map((h) => (
                  <div key={h.id} className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-100">{h.title}</p>
                      <Badge variant="secondary">{h.audience}</Badge>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{h.body}</p>
                    <p className="text-xs text-gray-600 mt-1.5">
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
