'use client';

import { useCallback, useEffect, useState } from 'react';
import { MapPinned, Pencil, Plus } from 'lucide-react';
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
import { PointZonesModal } from '@/components/intercity/PointZonesModal';
import { RouteFormModal } from '@/components/intercity/RouteFormModal';
import { apiErrorMessage, apiErrorTitle } from '@/lib/api-error';
import { intercityApi } from '@/lib/intercity-api';
import {
  formatPointExtension,
  hasExtension,
  routeLabel,
  type IntercityPoint,
  type IntercityRoute,
} from '@/lib/intercity';
import { t } from '@/locales';

type Tab = 'routes' | 'points';

const tabs = () => {
  const m = t().intercity.page;
  return [
    { value: 'routes', label: m.tabRoutes },
    { value: 'points', label: m.tabPoints },
  ] as const;
};

/**
 * Shaharlararo yo'nalishlar va nuqtalar. O'chirish yo'q — faqat faolsizlantirish:
 * eski qatnov va bandlar tarixi yo'nalishga bog'langan.
 */
export default function IntercityPage() {
  const m = t();
  const pm = m.intercity.page;
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
  const [zonesFor, setZonesFor] = useState<IntercityPoint | null>(null);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [pointsRes, routesRes] = await Promise.all([intercityApi.getPoints(), intercityApi.getRoutes()]);
      setPoints(pointsRes.data.data);
      setRoutes(routesRes.data.data);
      setLoadError(null);
    } catch {
      setLoadError(t().intercity.page.loadError);
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
      toast({ title: next.isActive ? pm.routeOn : pm.routeOff, variant: 'success' });
    } catch (err) {
      toast({
        title: apiErrorTitle(err, m.common.error),
        description: apiErrorMessage(err, m.common.statusChangeFailedAlt),
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
      toast({ title: res.data.data.isActive ? pm.pointOn : pm.pointOff, variant: 'success' });
    } catch (err) {
      toast({
        title: apiErrorTitle(err, m.common.error),
        description: apiErrorMessage(err, m.common.statusChangeFailedAlt),
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
        aria-label={`${label}: ${isActive ? pm.deactivate : pm.activate}`}
      />
      <Badge variant={isActive ? 'success' : 'neutral'}>{isActive ? m.common.active : m.common.inactive}</Badge>
    </div>
  );

  const routeColumns: DataTableColumn<IntercityRoute>[] = [
    {
      key: 'route',
      header: pm.colRoute,
      cell: (r) => (
        <span className={r.isActive ? 'font-medium text-ink' : 'font-medium text-muted'}>{routeLabel(r)}</span>
      ),
    },
    {
      key: 'status',
      header: m.common.statusAlt,
      cell: (r) => activeSwitch(r.id, routeLabel(r), r.isActive, () => void toggleRoute(r)),
    },
    { key: 'seat', header: pm.colStartSeat, numeric: true, cell: (r) => <MoneyText value={r.seatPrice} /> },
    { key: 'whole', header: pm.colStartWhole, numeric: true, cell: (r) => <MoneyText value={r.wholeCarPrice} /> },
    {
      key: 'comfortSeat',
      header: pm.colComfortSeat,
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
      header: pm.colComfortWhole,
      numeric: true,
      hideBelow: 'lg',
      cell: (r) =>
        r.comfortWholeCarPrice === null ? (
          <span className="text-muted">—</span>
        ) : (
          <MoneyText value={r.comfortWholeCarPrice} />
        ),
    },
    { key: 'seats', header: pm.colSeats, numeric: true, hideBelow: 'md', cell: (r) => r.seatsDefault },
    {
      key: 'actions',
      header: <span className="sr-only">{m.common.actions}</span>,
      align: 'right',
      width: 'w-12',
      cell: (r) => (
        <IconButton
          size="sm"
          aria-label={pm.editRoute(routeLabel(r))}
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
      header: pm.colPoint,
      cell: (p) => <span className={p.isActive ? 'font-medium text-ink' : 'font-medium text-muted'}>{p.name}</span>,
    },
    {
      key: 'status',
      header: m.common.statusAlt,
      cell: (p) => activeSwitch(p.id, p.name, p.isActive, () => void togglePoint(p)),
    },
    {
      key: 'coords',
      header: pm.colCenter,
      className: 'num whitespace-nowrap text-muted',
      cell: (p) => `${p.centerLat.toFixed(5)}, ${p.centerLng.toFixed(5)}`,
    },
    { key: 'radius', header: pm.colRadius, numeric: true, cell: (p) => `${p.radiusKm} km` },
    {
      key: 'extension',
      header: pm.colExtension,
      hideBelow: 'md',
      cell: (p) => <span className="num">{formatPointExtension(p)}</span>,
    },
    {
      key: 'actions',
      header: <span className="sr-only">{m.common.actions}</span>,
      align: 'right',
      width: 'w-24',
      cell: (p) => (
        <div className="flex justify-end gap-1">
          {hasExtension(p) ? (
            <IconButton size="sm" aria-label={pm.pointZones(p.name)} onClick={() => setZonesFor(p)}>
              <MapPinned aria-hidden />
            </IconButton>
          ) : null}
          <IconButton
            size="sm"
            aria-label={pm.editPoint(p.name)}
            onClick={() => setPointForm({ open: true, point: p })}
          >
            <Pencil aria-hidden />
          </IconButton>
        </div>
      ),
    },
  ];

  const activeRoutes = routes.filter((r) => r.isActive).length;
  const canCreateRoute = points.filter((p) => p.isActive).length >= 2;

  return (
    <div className="px-4 sm:px-6 py-5">
      <PageHeader
        title={pm.title}
        description={
          routes.length > 0
            ? pm.summary(routes.length, activeRoutes, points.length)
            : pm.descriptionEmpty
        }
        actions={
          tab === 'routes' ? (
            <Button
              leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
              disabled={!canCreateRoute}
              title={canCreateRoute ? undefined : pm.needPoints}
              onClick={() => setRouteForm({ open: true, route: null })}
            >
              {pm.newRoute}
            </Button>
          ) : (
            <Button
              leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
              onClick={() => setPointForm({ open: true, point: null })}
            >
              {pm.newPoint}
            </Button>
          )
        }
      />

      <div className="space-y-4">
        <Tabs items={tabs()} value={tab} onChange={setTab} ariaLabel={pm.sectionsAria} />

        {tab === 'routes' ? (
          <DataTable
            ariaLabel={pm.routesAria}
            columns={routeColumns}
            rows={routes}
            rowKey={(r) => r.id}
            loading={isLoading}
            error={loadError}
            onRetry={fetchAll}
            rowClassName={(r) => (r.isActive ? undefined : 'bg-surface-2/40')}
            empty={{
              variant: 'first-use',
              title: pm.noRoutes,
              description: canCreateRoute
                ? pm.noRoutesHint
                : pm.noRoutesNeedPoints,
              action: canCreateRoute ? (
                <Button size="sm" onClick={() => setRouteForm({ open: true, route: null })}>
                  {pm.addRoute}
                </Button>
              ) : (
                <Button size="sm" onClick={() => setTab('points')}>
                  {pm.goToPoints}
                </Button>
              ),
            }}
          />
        ) : (
          <DataTable
            ariaLabel={pm.pointsAria}
            columns={pointColumns}
            rows={points}
            rowKey={(p) => p.id}
            loading={isLoading}
            error={loadError}
            onRetry={fetchAll}
            rowClassName={(p) => (p.isActive ? undefined : 'bg-surface-2/40')}
            empty={{
              variant: 'first-use',
              title: pm.noPoints,
              description: pm.noPointsHint,
              action: (
                <Button size="sm" onClick={() => setPointForm({ open: true, point: null })}>
                  {pm.addPoint}
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
      <PointZonesModal open={zonesFor !== null} point={zonesFor} onClose={() => setZonesFor(null)} />
    </div>
  );
}
