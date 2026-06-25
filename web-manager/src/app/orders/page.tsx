'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Filter, RefreshCw } from 'lucide-react';
import { getOrders, PaginatedResponse, Order } from '@/lib/api';
import { OrderStatus, ORDER_STATUS } from '@/lib/constants';
import { OrdersTable } from '@/components/orders/OrdersTable';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';

const statusOptions = [
  { value: '', label: 'All statuses' },
  { value: ORDER_STATUS.CREATED, label: 'Created' },
  { value: ORDER_STATUS.SEARCHING, label: 'Searching' },
  { value: ORDER_STATUS.ACCEPTED, label: 'Accepted' },
  { value: ORDER_STATUS.ARRIVED, label: 'Arrived' },
  { value: ORDER_STATUS.IN_PROGRESS, label: 'In Progress' },
  { value: ORDER_STATUS.COMPLETED, label: 'Completed' },
  { value: ORDER_STATUS.CANCELLED, label: 'Cancelled' },
];

const PAGE_LIMIT = 20;

export default function OrdersPage() {
  const [data, setData] = useState<PaginatedResponse<Order> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getOrders({
        page: currentPage,
        limit: PAGE_LIMIT,
        status: statusFilter ? (statusFilter as OrderStatus) : undefined,
        search: debouncedSearch || undefined,
      });
      setData(result);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
      setError('Failed to load orders. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, statusFilter, debouncedSearch]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, debouncedSearch]);

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-700 bg-gray-800/50 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-semibold text-gray-100">Orders</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {data ? `${data.total.toLocaleString()} total orders` : 'Loading...'}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchOrders}
            leftIcon={<RefreshCw size={13} />}
          >
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <Input
            placeholder="Search by passenger, phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftElement={<Search size={14} />}
            className="w-64"
          />
          <Select
            options={statusOptions}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-44"
          />
          {(statusFilter || searchQuery) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStatusFilter('');
                setSearchQuery('');
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {error ? (
          <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <p className="text-red-400">{error}</p>
            <Button variant="secondary" onClick={fetchOrders} leftIcon={<RefreshCw size={14} />}>
              Retry
            </Button>
          </div>
        ) : (
          <OrdersTable
            data={
              data ?? {
                data: [],
                total: 0,
                page: 1,
                limit: PAGE_LIMIT,
                totalPages: 0,
              }
            }
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            isLoading={isLoading}
          />
        )}
      </div>
    </div>
  );
}
