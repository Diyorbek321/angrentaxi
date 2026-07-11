const META: Record<string, { label: string; bg: string; color: string }> = {
  new: { label: 'Yangi', bg: 'bg-brand-yellow/[0.15]', color: 'text-brand-yellow' },
  packing: { label: "Yig'ilmoqda", bg: 'bg-blue-500/[0.15]', color: 'text-blue-400' },
  shipped: { label: 'Yuborildi', bg: 'bg-purple-500/[0.15]', color: 'text-purple-400' },
  delivered: { label: 'Yetkazildi', bg: 'bg-green-500/[0.15]', color: 'text-green-400' },
  cancelled: { label: 'Bekor qilindi', bg: 'bg-red-500/[0.14]', color: 'text-red-400' },
};

export function StatusBadge({ status }: { status: string }) {
  const m = META[status] ?? META.new;
  return <span className={`text-[11px] font-bold px-[10px] py-1 rounded-lg ${m.bg} ${m.color}`}>{m.label}</span>;
}
