'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Search, SearchX, ShieldCheck, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
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
import { usersApi, User, Permission, ALL_PERMISSIONS } from '@/lib/api';
import {
  PERMISSION_GROUPS,
  PERMISSION_LABELS_UZ,
  PERMISSION_SHORT_LABELS_UZ,
} from '@/lib/permission-labels';
import { useToast } from '@/components/ui/Toast';
import { cn, formatPhone, getFullName } from '@/lib/utils';

export default function StaffRolesPage() {
  const { toast } = useToast();
  const [managers, setManagers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [search, setSearch] = useState('');
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [draftPermissions, setDraftPermissions] = useState<Permission[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchManagers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await usersApi.getAll({ role: 'manager', limit: 100 });
      setManagers(res.data.data?.users ?? []);
      setError(null);
      setHasLoadedOnce(true);
    } catch {
      // Oxirgi muvaffaqiyatli qatorlar ekranda qoladi; banner + retry chiqadi.
      setError("Xodimlarni yuklab bo'lmadi");
      toast({ title: 'Xatolik', description: 'Xodimlarni yuklashda xatolik', variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchManagers();
  }, [fetchManagers]);

  const filteredManagers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return managers;
    return managers.filter((m) =>
      [getFullName(m.firstName, m.lastName), m.phone].join(' ').toLowerCase().includes(q)
    );
  }, [managers, search]);

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

  // "Saqlash" tugmasi faqat haqiqiy o'zgarish bo'lganda faollashadi (dirty).
  const originalPermissions = editTarget?.permissions ?? [];
  const isDirty =
    draftPermissions.length !== originalPermissions.length ||
    draftPermissions.some((p) => !originalPermissions.includes(p));

  const handleSave = async () => {
    if (!editTarget) return;
    setSaving(true);
    try {
      await usersApi.updatePermissions(editTarget.id, draftPermissions);
      setManagers((prev) =>
        prev.map((m) => (m.id === editTarget.id ? { ...m, permissions: draftPermissions } : m))
      );
      toast({
        title: 'Ruxsatlar yangilandi',
        description: `${getFullName(editTarget.firstName, editTarget.lastName)} — ${
          draftPermissions.length
        } ta bo'limga kira oladi.`,
        variant: 'success',
      });
      closeEdit();
    } catch {
      toast({ title: 'Xatolik', description: 'Ruxsatlarni saqlashda xatolik', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const showFullError = error && !isLoading && !hasLoadedOnce;
  const showErrorBanner = error && !isLoading && hasLoadedOnce;

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title="Xodimlar va ruxsatlar"
        description="Har bir menejer aynan qaysi bo'limlarga kira olishini belgilang — masalan, faqat dispetcherlik yoki to'liq boshqaruv"
        icon={<Users className="h-4 w-4" aria-hidden="true" />}
      />
      <div className="space-y-4">
        <div className="max-w-md">
          <Input
            placeholder="Ism yoki telefon bo'yicha qidirish..."
            leftIcon={<Search className="h-4 w-4" aria-hidden="true" />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Xodimlarni qidirish"
          />
        </div>

        {showErrorBanner && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-ds-sm border border-danger/30 bg-danger-tint px-4 py-3"
          >
            <p className="flex items-center gap-2 text-body text-danger-deep dark:text-danger-light">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {error} — oxirgi muvaffaqiyatli yuklangan ma&apos;lumot ko&apos;rsatilmoqda.
            </p>
            <Button variant="secondary" size="sm" onClick={fetchManagers}>
              Qayta urinish
            </Button>
          </div>
        )}

        {showFullError ? (
          <Card>
            <CardContent className="p-0">
              <ErrorState message={error} onRetry={fetchManagers} />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              {isLoading && !hasLoadedOnce ? (
                <SkeletonTable rows={5} cols={3} className="border-0" />
              ) : filteredManagers.length === 0 ? (
                search.trim() ? (
                  <EmptyState
                    icon={<SearchX className="h-6 w-6" />}
                    title="Hech narsa mos kelmadi"
                    description={`"${search.trim()}" bo'yicha xodim topilmadi.`}
                    action={
                      <Button variant="secondary" size="sm" onClick={() => setSearch('')}>
                        Qidiruvni tozalash
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    icon={<Users className="h-6 w-6" />}
                    title="Manager rolidagi hisoblar topilmadi"
                    description="Manager roli bilan hisob yaratilgach, u shu yerda ko'rinadi va ruxsatlarini shu yerdan belgilaysiz."
                  />
                )
              ) : (
                <Table stickyHeader containerClassName="max-h-[65vh]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Xodim</TableHead>
                      <TableHead>Ruxsatlar</TableHead>
                      <TableHead className="text-right">Amal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredManagers.map((user) => {
                      const perms = user.permissions ?? [];
                      return (
                        <TableRow key={user.id}>
                          <TableCell>
                            <p className="font-medium text-ink">
                              {getFullName(user.firstName, user.lastName)}
                            </p>
                            <p className="font-mono text-caption text-subtle">
                              {formatPhone(user.phone)}
                            </p>
                          </TableCell>
                          <TableCell>
                            {perms.length === 0 ? (
                              <Badge variant="destructive">Hech qanday ruxsat yo&apos;q</Badge>
                            ) : perms.length === ALL_PERMISSIONS.length ? (
                              <Badge variant="success">To&apos;liq (barcha bo&apos;limlar)</Badge>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {perms.slice(0, 3).map((p) => (
                                  <Badge key={p} variant="secondary">
                                    {PERMISSION_SHORT_LABELS_UZ[p] ?? p}
                                  </Badge>
                                ))}
                                {perms.length > 3 && (
                                  <Badge
                                    variant="outline"
                                    title={perms
                                      .slice(3)
                                      .map((p) => PERMISSION_SHORT_LABELS_UZ[p] ?? p)
                                      .join(', ')}
                                  >
                                    +{perms.length - 3}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEdit(user)}
                              leftIcon={<ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />}
                            >
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
        )}
      </div>

      <Dialog open={!!editTarget} onOpenChange={(open) => !open && closeEdit()}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editTarget && getFullName(editTarget.firstName, editTarget.lastName)} — ruxsatlar
            </DialogTitle>
            <DialogDescription>
              Belgilangan bo&apos;limlarga kira oladi. ADMIN har doim hammasiga kira oladi —
              bu ro&apos;yxat faqat MANAGER hisoblari uchun.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => applyPreset('all')}>
              Barchasi (to&apos;liq menejer)
            </Button>
            <Button size="sm" variant="secondary" onClick={() => applyPreset('dispatch-only')}>
              Faqat dispetcherlik
            </Button>
            <Button size="sm" variant="secondary" onClick={() => applyPreset('none')}>
              Tozalash
            </Button>
          </div>

          {/* Ruxsatlar DOMEN bo'yicha guruhlanadi — 10 ta yassi checkbox
              o'rniga operator "qaysi bo'limga kira oladi" deb o'ylaydi. */}
          <div className="max-h-[45vh] space-y-4 overflow-y-auto pr-1">
            {PERMISSION_GROUPS.map((group) => (
              <fieldset key={group.title}>
                <legend className="mb-1.5 text-micro uppercase text-muted">{group.title}</legend>
                <div className="space-y-1.5">
                  {group.permissions.map((perm) => {
                    const checked = draftPermissions.includes(perm);
                    return (
                      <label
                        key={perm}
                        className={cn(
                          'flex cursor-pointer items-start gap-3 rounded-ds-md border px-3 py-2.5 text-body transition-colors duration-fast',
                          'focus-within:ring-2 focus-within:ring-focus focus-within:ring-offset-2 focus-within:ring-offset-surface',
                          checked
                            ? 'border-primary bg-mint-tint'
                            : 'border-line bg-surface-2 hover:bg-surface-3'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePermission(perm)}
                          className="mt-0.5 h-4 w-4 shrink-0 rounded border-line-strong bg-transparent accent-primary focus:outline-none"
                        />
                        <span className={cn(checked ? 'text-ink' : 'text-muted')}>
                          {PERMISSION_LABELS_UZ[perm]}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </div>

          <DialogFooter className="items-center gap-2 sm:justify-between">
            <p className="text-caption tabular-nums text-muted">
              Tanlangan: {draftPermissions.length} / {ALL_PERMISSIONS.length}
              {isDirty && <span className="ml-2 text-override-dark dark:text-override-light">• saqlanmagan</span>}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={closeEdit}>
                Bekor qilish
              </Button>
              <Button isLoading={saving} disabled={!isDirty} onClick={handleSave}>
                Saqlash
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
