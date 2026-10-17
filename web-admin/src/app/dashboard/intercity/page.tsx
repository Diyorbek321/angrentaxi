'use client';

import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import {
  Badge,
  Button,
  DataTable,
  IconButton,
  MoneyText,
  PageHeader,
  Switch,
  Tabs,
  useToast,
  type DataTableColumn,
} from '@/components/ui';
import { PointFormModal } from '@/components/intercity/PointFormModal';
import { RouteFormModal } from '@/components/intercity/RouteFormModal';
import { apiErrorMessage, apiErrorTitle } from '@/lib/api-error';
import { intercityApi } from '@/lib/intercity-api';
import { formatPointExtension, routeLabel, type IntercityPoint, type IntercityRoute } from '@/lib/intercity';

type Tab = 'routes' | 'points';

const TABS = [
  { value: 'routes', label: 'Yoʻnalishlar' },
  { value: 'points', label: 'Nuqtalar' },
] as const;

/**
 * Shaharlararo yo'nalishlar va nuqtalar. O'chirish yo'q — faqat faolsizlantirish:
 * eski qatnov va bandlar tarixi yo'nalishga bog'langan.
 */
export default function IntercityPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('routes');
  const [points, setPoints] = useState<IntercityPoint[]>([]);
  const [routes, setRoutes] = useState<IntercityRoute[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [routeForm, setRouteForm] = useState<{ open: boolean; route: IntercityRoute | null }>({
    open: false,
    route: null,
  });
  const [pointForm, setPointForm] = useState<{ open: boolean; point: IntercityPoint | null }>({
    open: false,
    point: null,
  });

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [pointsRes, routesRes] = await Promise.all([intercityApi.getPoints(), intercityApi.getRoutes()]);
      setPoints(pointsRes.data.data);
      setRoutes(routesRes.data.data);
      setLoadError(null);
    } catch {
      setLoadError('Shaharlararo maʼlumotlarini yuklab boʻlmadi');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const toggleRoute = async (route: IntercityRoute) => {
    setTogglingId(route.id);
    try {
      const res = await intercityApi.updateRoute(route.id, { isActive: !route.isActive });
      // PATCH javobida nuqtalar yuklanmagan bo'lishi mumkin — nomlarni eskisidan saqlaymiz.
      const next = { ...route, ...res.data.data, originPoint: route.originPoint, destinationPoint: route.destinationPoint };
      setRoutes((prev) => prev.map((r) => (r.id === route.id ? next : r)));
      toast({ title: next.isActive ? 'Yoʻnalish yoqildi' : 'Yoʻnalish oʻchirildi', variant: 'success' });
    } catch (err) {
      toast({
        title: apiErrorTitle(err, 'Xatolik'),
        description: apiErrorMessage(err, 'Holatni oʻzgartirib boʻlmadi'),
        variant: 'error',
      });
    } finally {
      setTogglingId(null);
    }
  };

  const togglePoint = async (point: IntercityPoint) => {
    setTogglingId(point.id);
    try {
      const res = await intercityApi.updatePoint(point.id, { isActive: !point.isActive });
      setPoints((prev) => prev.map((p) => (p.id === point.id ? res.data.data : p)));
      toast({ title: res.data.data.isActive ? 'Nuqta yoqildi' : 'Nuqta oʻchirildi', variant: 'success' });
    } catch (err) {
      toast({
        title: apiErrorTitle(err, 'Xatolik'),
        description: apiErrorMessage(err, 'Holatni oʻzgartirib boʻlmadi'),
        variant: 'error',
      });
    } finally {
      setTogglingId(null);
    }
  };

  const activeSwitch = (id: string, label: string, isActive: boolean, onToggle: () => void) => (
    <div className="flex items-center gap-2">
      <Switch
        size="sm"
        checked={isActive}
        disabled={togglingId === id}
        onCheckedChange={onToggle}
        aria-label={`${label}: ${isActive ? 'faolsizlantirish' : 'faollashtirish'}`}
      />
      <Badge variant={isActive ? 'success' : 'neutral'}>{isActive ? 'Faol' : 'Nofaol'}</Badge>
    </div>
  );

  const routeColumns: DataTableColumn<IntercityRoute>[] = [
    {
      key: 'route',
      header: 'Yoʻnalish',
      cell: (r) => (
        <span className={r.isActive ? 'font-medium text-ink' : 'font-medium text-muted'}>{routeLabel(r)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Holati',
      cell: (r) => activeSwitch(r.id, routeLabel(r), r.isActive, () => void toggleRoute(r)),
    },
    { key: 'seat', header: 'Start · oʻrindiq', numeric: true, cell: (r) => <MoneyText value={r.seatPrice} /> },
    { key: 'whole', header: 'Start · butun mashina', numeric: true, cell: (r) => <MoneyText value={r.wholeCarPrice} /> },
    {
      key: 'comfortSeat',
      header: 'Comfort · oʻrindiq',
      numeric: true,
      hideBelow: 'lg',
      cell: (r) =>
        r.comfortSeatPrice === null ? (
          <span className="text-muted">—</span>
        ) : (
          <MoneyText value={r.comfortSeatPrice} />
        ),
    },
    {
      key: 'comfortWhole',
      header: 'Comfort · butun mashina',
      numeric: true,
      hideBelow: 'lg',
      cell: (r) =>
        r.comfortWholeCarPrice === null ? (
          <span className="text-muted">—</span>
        ) : (
          <MoneyText value={r.comfortWholeCarPrice} />
        ),
    },
    { key: 'seats', header: 'Oʻrindiq', numeric: true, hideBelow: 'md', cell: (r) => r.seatsDefault },
    {
      key: 'actions',
      header: <span className="sr-only">Amallar</span>,
      align: 'right',
      width: 'w-12',
      cell: (r) => (
        <IconButton
          size="sm"
          aria-label={`${routeLabel(r)} yoʻnalishini tahrirlash`}
          onClick={() => setRouteForm({ open: true, route: r })}
        >
          <Pencil aria-hidden />
        </IconButton>
      ),
    },
  ];

  const pointColumns: DataTableColumn<IntercityPoint>[] = [
    {
      key: 'name',
      header: 'Nuqta',
      cell: (p) => <span className={p.isActive ? 'font-medium text-ink' : 'font-medium text-muted'}>{p.name}</span>,
    },
    {
      key: 'status',
      header: 'Holati',
      cell: (p) => activeSwitch(p.id, p.name, p.isActive, () => void togglePoint(p)),
    },
    {
      key: 'coords',
      header: 'Markaz',
      className: 'num whitespace-nowrap text-muted',
      cell: (p) => `${p.centerLat.toFixed(5)}, ${p.centerLng.toFixed(5)}`,
    },
    { key: 'radius', header: 'Radius', numeric: true, cell: (p) => `${p.radiusKm} km` },
    {
      key: 'extension',
      header: 'Shahar ichiga davom',
      hideBelow: 'md',
      cell: (p) => <span className="num">{formatPointExtension(p)}</span>,
    },
    {
      key: 'actions',
      header: <span className="sr-only">Amallar</span>,
      align: 'right',
      width: 'w-12',
      cell: (p) => (
        <IconButton
          size="sm"
          aria-label={`${p.name} nuqtasini tahrirlash`}
          onClick={() => setPointForm({ open: true, point: p })}
        >
          <Pencil aria-hidden />
        </IconButton>
      ),
    },
  ];

  const activeRoutes = routes.filter((r) => r.isActive).length;
  const canCreateRoute = points.filter((p) => p.isActive).length >= 2;

  return (
    <div className="px-4 sm:px-6 py-5">
      <PageHeader
        title="Shaharlararo"
        description={
          routes.length > 0
            ? `${routes.length} ta yoʻnalish · ${activeRoutes} tasi faol · ${points.length} ta nuqta`
            : 'Yoʻnalishlar, qatʼiy narxlar va olish/tushirish nuqtalari'
        }
        actions={
          tab === 'routes' ? (
            <Button
              leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
              disabled={!canCreateRoute}
              title={canCreateRoute ? undefined : 'Avval kamida 2 ta faol nuqta qoʻshing'}
              onClick={() => setRouteForm({ open: true, route: null })}
            >
              Yangi yoʻnalish
            </Button>
          ) : (
            <Button
              leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
              onClick={() => setPointForm({ open: true, point: null })}
            >
              Yangi nuqta
            </Button>
          )
        }
      />

      <div className="space-y-4">
        <Tabs items={TABS} value={tab} onChange={setTab} ariaLabel="Shaharlararo boʻlimlari" />

        {tab === 'routes' ? (
          <DataTable
            ariaLabel="Shaharlararo yoʻnalishlar"
            columns={routeColumns}
            rows={routes}
            rowKey={(r) => r.id}
            loading={isLoading}
            error={loadError}
            onRetry={fetchAll}
            rowClassName={(r) => (r.isActive ? undefined : 'bg-surface-2/40')}
            empty={{
              variant: 'first-use',
              title: 'Yoʻnalishlar yoʻq',
              description: canCreateRoute
                ? 'Birinchi yoʻnalishni qoʻshing, masalan Angren → Rohat krugi.'
                : 'Avval “Nuqtalar” boʻlimida kamida ikkita nuqta qoʻshing.',
              action: canCreateRoute ? (
                <Button size="sm" onClick={() => setRouteForm({ open: true, route: null })}>
                  Yoʻnalish qoʻshish
                </Button>
              ) : (
                <Button size="sm" onClick={() => setTab('points')}>
                  Nuqtalarga oʻtish
                </Button>
              ),
            }}
          />
        ) : (
          <DataTable
            ariaLabel="Shaharlararo nuqtalar"
            columns={pointColumns}
            rows={points}
            rowKey={(p) => p.id}
            loading={isLoading}
            error={loadError}
            onRetry={fetchAll}
            rowClassName={(p) => (p.isActive ? undefined : 'bg-surface-2/40')}
            empty={{
              variant: 'first-use',
              title: 'Nuqtalar yoʻq',
              description: 'Angren, Rohat krugi (Toshkent), Olmaliq… — har biri markaz va radius bilan.',
              action: (
                <Button size="sm" onClick={() => setPointForm({ open: true, point: null })}>
                  Nuqta qoʻshish
                </Button>
              ),
            }}
          />
        )}
      </div>

      <RouteFormModal
        open={routeForm.open}
        route={routeForm.route}
        points={points}
        onClose={() => setRouteForm((prev) => ({ ...prev, open: false }))}
        onSaved={fetchAll}
      />
      <PointFormModal
        open={pointForm.open}
        point={pointForm.point}
        onClose={() => setPointForm((prev) => ({ ...prev, open: false }))}
        onSaved={fetchAll}
      />
    </div>
  );
}
