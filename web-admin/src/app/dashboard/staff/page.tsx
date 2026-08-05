'use client';

import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
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
  const [error, setError] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [draftPermissions, setDraftPermissions] = useState<Permission[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchManagers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await usersApi.getAll({ role: 'manager', limit: 100 });
      setManagers(res.data.data?.users ?? []);
      setError(null);
    } catch {
      setError("Xodimlarni yuklab bo'lmadi.");
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
    <div className="p-4 sm:p-6">
      <PageHeader
        title="Xodimlar va ruxsatlar"
        description="Har bir menejer aynan qaysi bo'limlarga kira olishini belgilang — masalan, faqat dispetcherlik yoki to'liq boshqaruv"
        icon={<Users className="h-4 w-4" />}
      />
      <div className="space-y-4">
        <Card>
          <CardContent className="p-0">
            {error ? (
              <ErrorState message={error} onRetry={fetchManagers} />
            ) : isLoading ? (
              <div className="p-4">
                <SkeletonTable rows={4} cols={3} />
              </div>
            ) : managers.length === 0 ? (
              <EmptyState
                icon={<Users className="h-6 w-6" />}
                title="Manager rolidagi hisoblar topilmadi"
                description="Manager roli bilan hisob yaratilgach, u shu yerda ko'rinadi."
              />
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
                          <p className="font-medium text-ink">
                            {getFullName(user.firstName, user.lastName)}
                          </p>
                          <p className="text-caption text-subtle">{formatPhone(user.phone)}</p>
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
                            <ShieldCheck className="mr-2 h-4 w-4" aria-hidden="true" />
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

          <div className="mb-2 flex gap-2">
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

          <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {ALL_PERMISSIONS.map((perm) => (
              <label
                key={perm}
                className="flex cursor-pointer items-center gap-3 rounded-ds-md bg-surface-2 px-3 py-2.5 text-body transition-colors duration-fast hover:bg-surface-3"
              >
                <input
                  type="checkbox"
                  checked={draftPermissions.includes(perm)}
                  onChange={() => togglePermission(perm)}
                  className="h-4 w-4 rounded border-line-strong bg-transparent accent-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                />
                <span className="text-ink">{PERMISSION_LABELS[perm]}</span>
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
