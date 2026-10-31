import { Phone } from 'lucide-react';
import { formatPhone } from '@/lib/format';

/** "Yoʻlovchi / Haydovchi" contact: role label, name, tap-to-call phone. */
export function ContactBlock({
  label,
  name,
  phone,
}: {
  label: string;
  name: string | null;
  phone: string | null;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-subtle">{label}</p>
      <p className="text-[13px] text-ink truncate">{name || '—'}</p>
      {phone && (
        <a
          href={`tel:${phone}`}
          className="num inline-flex items-center gap-1 text-xs text-primary-text hover:underline"
        >
          <Phone size={11} aria-hidden />
          {formatPhone(phone)}
        </a>
      )}
    </div>
  );
}
