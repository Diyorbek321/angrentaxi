const META: Record<string, { label: string; color: string }> = {
  new: { label: 'Yangi', color: '#60A5FA' },
  preparing: { label: 'Tayyorlanmoqda', color: '#FB923C' },
  ready: { label: 'Tayyor', color: '#10B981' },
  delivered: { label: 'Yetkazildi', color: '#64748B' },
  cancelled: { label: 'Bekor qilindi', color: '#F87171' },
};

export function StatusBadge({ status }: { status: string }) {
  const m = META[status] ?? META.new;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
      style={{ color: m.color, background: `${m.color}22` }}
    >
      <span className="w-[7px] h-[7px] rounded-full" style={{ background: m.color }} />
      {m.label}
    </span>
  );
}

export const STATUS_META = META;
