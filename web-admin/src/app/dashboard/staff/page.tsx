'use client';

import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Modal';
import { usersApi, User, Permission, ALL_PERMISSIONS, PERMISSION_LABELS } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { formatPhone, getFullName } from '@/lib/utils';

export default function StaffRolesPage() {
  const { toast } = useToast();
  const [managers, setManagers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [draftPermissions, setDraftPermissions] = useState<Permission[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchManagers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await usersApi.getAll({ role: 'manager', limit: 100 });
      setManagers(res.data.data?.users ?? []);
    } catch {
      toast({ title: 'Xatolik', description: "Xodimlarni yuklashda xatolik", variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchManagers();
  }, [fetchManagers]);

  const openEdit = (user: User) => {
    setEditTarget(user);
    setDraftPermissions(user.permissions ?? []);
  };

  const closeEdit = () => {
    setEditTarget(null);
    setDraftPermissions([]);
  };

  const togglePermission = (perm: Permission) => {
    setDraftPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const applyPreset = (preset: 'all' | 'dispatch-only' | 'none') => {
    if (preset === 'all') setDraftPermissions(ALL_PERMISSIONS);
    else if (preset === 'none') setDraftPermissions([]);
    else setDraftPermissions(['dispatch', 'drivers_view']);
  };

  const handleSave = async () => {
    if (!editTarget) return;
    setSaving(true);
    try {
      await usersApi.updatePermissions(editTarget.id, draftPermissions);
      setManagers((prev) =>
        prev.map((m) => (m.id === editTarget.id ? { ...m, permissions: draftPermissions } : m))
      );
      toast({ title: 'Ruxsatlar yangilandi', variant: 'success' });
      closeEdit();
    } catch {
      toast({ title: 'Xatolik', description: 'Ruxsatlarni saqlashda xatolik', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Header
        title="Xodimlar va ruxsatlar"
        subtitle="Har bir menejer aynan qaysi bo'limlarga kira olishini belgilang — masalan, faqat dispetcherlik yoki to'liq boshqaruv"
      />
      <div className="p-6 space-y-4">
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : managers.length === 0 ? (
              <p className="py-12 text-center text-sm text-gray-500">
                Manager rolidagi hisoblar topilmadi
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Xodim</TableHead>
                    <TableHead>Ruxsatlar</TableHead>
                    <TableHead>Amallar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {managers.map((user) => {
                    const perms = user.permissions ?? [];
                    return (
                      <TableRow key={user.id}>
                        <TableCell>
                          <p className="font-medium text-gray-100">
                            {getFullName(user.firstName, user.lastName)}
                          </p>
                          <p className="text-xs text-gray-500">{formatPhone(user.phone)}</p>
                        </TableCell>
                        <TableCell>
                          {perms.length === 0 ? (
                            <Badge variant="destructive">Hech qanday ruxsat yo&apos;q</Badge>
                          ) : perms.length === ALL_PERMISSIONS.length ? (
                            <Badge variant="success">To&apos;liq (barcha bo&apos;limlar)</Badge>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {perms.slice(0, 3).map((p) => (
                                <Badge key={p} variant="secondary">{p}</Badge>
                              ))}
                              {perms.length > 3 && (
                                <Badge variant="outline">+{perms.length - 3}</Badge>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" onClick={() => openEdit(user)}>
                            <ShieldCheck className="mr-2 h-4 w-4" />
                            Ruxsatlarni tahrirlash
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!editTarget} onOpenChange={closeEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editTarget && getFullName(editTarget.firstName, editTarget.lastName)} — ruxsatlar
            </DialogTitle>
            <DialogDescription>
              Belgilangan bo&apos;limlarga kira oladi. ADMIN har doim hammasiga kira oladi —
              bu ro&apos;yxat faqat MANAGER hisoblari uchun.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-2 mb-2">
            <Button size="sm" variant="secondary" onClick={() => applyPreset('all')}>
              Barchasi (To&apos;liq menejer)
            </Button>
            <Button size="sm" variant="secondary" onClick={() => applyPreset('dispatch-only')}>
              Faqat dispetcherlik
            </Button>
            <Button size="sm" variant="secondary" onClick={() => applyPreset('none')}>
              Tozalash
            </Button>
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {ALL_PERMISSIONS.map((perm) => (
              <label
                key={perm}
                className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2.5 text-sm cursor-pointer hover:bg-white/10 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={draftPermissions.includes(perm)}
                  onChange={() => togglePermission(perm)}
                  className="h-4 w-4 rounded border-white/20 bg-transparent accent-yellow-400"
                />
                <span className="text-gray-200">{PERMISSION_LABELS[perm]}</span>
              </label>
            ))}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeEdit}>
              Bekor qilish
            </Button>
            <Button variant="success" isLoading={saving} onClick={handleSave}>
              Saqlash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
