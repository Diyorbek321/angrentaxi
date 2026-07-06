'use client';

import { useEffect, useState } from 'react';
import { Tag } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import { promoCodesApi, PromoCode } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function PromoCodesPage() {
  const { toast } = useToast();
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deactivateTarget, setDeactivateTarget] = useState<PromoCode | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  const fetchPromoCodes = async () => {
    setIsLoading(true);
    try {
      const res = await promoCodesApi.getAll();
      setPromoCodes(res.data.data);
    } catch {
      toast({ title: 'Xatolik', description: 'Promo kodlarni yuklashda xatolik', variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPromoCodes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    setDeactivating(true);
    try {
      await promoCodesApi.deactivate(deactivateTarget.id);
      toast({ title: 'Promo kod faolsizlantirildi', variant: 'success' });
      setDeactivateTarget(null);
      await fetchPromoCodes();
    } catch {
      toast({ title: 'Xatolik', variant: 'error' });
    } finally {
      setDeactivating(false);
    }
  };

  return (
    <div>
      <Header title="Promo kodlar" subtitle="Chegirma kodlarini kuzatib boring" />
      <div className="p-6">
        {isLoading ? (
          <Skeleton className="h-64" />
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kod</TableHead>
                    <TableHead>Chegirma</TableHead>
                    <TableHead>Ishlatilgan</TableHead>
                    <TableHead>Min. summa</TableHead>
                    <TableHead>Muddati</TableHead>
                    <TableHead>Holati</TableHead>
                    <TableHead className="text-right">Amal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {promoCodes.map((promo) => (
                    <TableRow key={promo.id}>
                      <TableCell className="font-mono flex items-center gap-1.5">
                        <Tag className="h-3.5 w-3.5 text-gray-400" />
                        {promo.code}
                      </TableCell>
                      <TableCell>
                        {promo.discountPercent != null
                          ? `${promo.discountPercent}%`
                          : formatCurrency(promo.discountFixed ?? 0)}
                      </TableCell>
                      <TableCell>
                        {promo.usedCount}
                        {promo.maxUses != null ? ` / ${promo.maxUses}` : ''}
                      </TableCell>
                      <TableCell>{formatCurrency(promo.minOrderAmount)}</TableCell>
                      <TableCell>
                        {promo.expiresAt ? formatDate(promo.expiresAt, 'dd.MM.yyyy') : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={promo.isActive ? 'success' : 'secondary'}>
                          {promo.isActive ? 'Faol' : 'Faol emas'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {promo.isActive && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setDeactivateTarget(promo)}
                          >
                            Faolsizlantirish
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {promoCodes.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-16">Promo kodlar yo&apos;q</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={!!deactivateTarget} onOpenChange={() => setDeactivateTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Promo kodni faolsizlantirish</DialogTitle>
            <DialogDescription>
              <strong>{deactivateTarget?.code}</strong> kodini faolsizlantirmoqchimisiz? Bundan buyon
              yangi buyurtmalarga qo&apos;llanilmaydi.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeactivateTarget(null)}>
              Bekor qilish
            </Button>
            <Button variant="destructive" isLoading={deactivating} onClick={handleDeactivate}>
              Faolsizlantirish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
