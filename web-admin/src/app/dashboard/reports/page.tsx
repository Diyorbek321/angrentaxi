'use client';

import { useCallback, useEffect, useState } from 'react';
import { format, subDays } from 'date-fns';
import { Download, TrendingUp, ShoppingCart, DollarSign, Users, Star } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { Input } from '@/components/ui/Input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import { RevenueChart } from '@/components/charts/RevenueChart';
import { OrdersChart } from '@/components/charts/OrdersChart';
import { reportsApi, ReportData } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { formatCurrency, formatRating, getFullName } from '@/lib/utils';
import { DATE_RANGES } from '@/lib/constants';

const DATE_FMT = 'yyyy-MM-dd';

function todayStr() {
  return format(new Date(), DATE_FMT);
}

function daysAgoStr(days: number) {
  return format(subDays(new Date(), days), DATE_FMT);
}

export default function ReportsPage() {
  const { toast } = useToast();
  const [data, setData] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [range, setRange] = useState<string>(DATE_RANGES.LAST_7_DAYS);
  const [fromDate, setFromDate] = useState(daysAgoStr(7));
  const [toDate, setToDate] = useState(todayStr());
  const [exporting, setExporting] = useState(false);

  const resolvedFrom =
    range === DATE_RANGES.LAST_7_DAYS
      ? daysAgoStr(7)
      : range === DATE_RANGES.LAST_30_DAYS
      ? daysAgoStr(30)
      : fromDate;

  const resolvedTo = range === DATE_RANGES.CUSTOM ? toDate : todayStr();

  const fetchReport = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await reportsApi.getData({ from: resolvedFrom, to: resolvedTo });
      setData(res.data.data);
    } catch {
      toast({ title: 'Xatolik', description: 'Hisobotni yuklashda xatolik', variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedFrom, resolvedTo]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await reportsApi.exportCsv({ from: resolvedFrom, to: resolvedTo });
      const url = URL.createObjectURL(res.data as Blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `report-${resolvedFrom}-${resolvedTo}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Eksport muvaffaqiyatli', variant: 'success' });
    } catch {
      toast({ title: 'Xatolik', description: 'Eksportda xatolik', variant: 'error' });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <Header title="Hisobotlar" subtitle="Moliyaviy tahlil va statistika" />
      <div className="p-6 space-y-6">
        {/* Controls */}
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <p className="mb-1.5 text-sm font-medium text-gray-700">Davr</p>
            <Select value={range} onValueChange={setRange}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={DATE_RANGES.LAST_7_DAYS}>Oxirgi 7 kun</SelectItem>
                <SelectItem value={DATE_RANGES.LAST_30_DAYS}>Oxirgi 30 kun</SelectItem>
                <SelectItem value={DATE_RANGES.CUSTOM}>Maxsus davr</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {range === DATE_RANGES.CUSTOM && (
            <>
              <Input
                label="Dan"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
              <Input
                label="Gacha"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </>
          )}

          <div className="flex gap-2 ml-auto">
            <Button variant="outline" isLoading={exporting} onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              CSV eksport
            </Button>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatCard
            title="Jami daromad"
            value={data ? formatCurrency(data.stats.totalRevenue) : '—'}
            icon={<DollarSign className="h-5 w-5 text-brand-yellow" />}
            iconBg="bg-yellow-100"
            isLoading={isLoading}
          />
          <StatCard
            title="Jami buyurtmalar"
            value={data?.stats.totalOrders.toLocaleString() ?? '—'}
            icon={<ShoppingCart className="h-5 w-5 text-blue-600" />}
            iconBg="bg-blue-100"
            isLoading={isLoading}
          />
          <StatCard
            title="O'rtacha buyurtma"
            value={data ? formatCurrency(data.stats.avgOrderValue) : '—'}
            icon={<TrendingUp className="h-5 w-5 text-green-600" />}
            iconBg="bg-green-100"
            isLoading={isLoading}
          />
          <StatCard
            title="Yangi foydalanuvchilar"
            value={data?.stats.newUsers.toLocaleString() ?? '—'}
            icon={<Users className="h-5 w-5 text-purple-600" />}
            iconBg="bg-purple-100"
            isLoading={isLoading}
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <RevenueChart data={data?.revenueChart ?? []} isLoading={isLoading} />
          <OrdersChart data={data?.revenueChart ?? []} isLoading={isLoading} />
        </div>

        {/* Top drivers */}
        <Card>
          <CardHeader>
            <CardTitle>Top haydovchilar</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-10 animate-pulse rounded-lg bg-gray-100" />
                ))}
              </div>
            ) : !data || data.topDrivers.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">Ma&apos;lumot yo&apos;q</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Haydovchi</TableHead>
                    <TableHead>Telefon</TableHead>
                    <TableHead>Safarlar</TableHead>
                    <TableHead>Daromad</TableHead>
                    <TableHead>Reyting</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.topDrivers.map((driver, index) => (
                    <TableRow key={driver.id}>
                      <TableCell>
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                            index === 0
                              ? 'bg-brand-yellow text-brand-black'
                              : index === 1
                              ? 'bg-gray-300 text-gray-800'
                              : index === 2
                              ? 'bg-amber-600 text-white'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {index + 1}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-yellow text-xs font-bold text-brand-black">
                            {driver.firstName?.charAt(0)}
                          </div>
                          <span className="font-medium text-gray-900">
                            {getFullName(driver.firstName, driver.lastName)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-600">{driver.phone}</TableCell>
                      <TableCell className="font-medium">{driver.totalTrips}</TableCell>
                      <TableCell className="font-semibold text-gray-900">
                        {formatCurrency(driver.totalRevenue)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 fill-brand-yellow text-brand-yellow" />
                          <span className="font-medium">{formatRating(driver.rating)}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
