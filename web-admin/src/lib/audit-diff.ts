/**
 * Audit yozuvidagi o'zgarishni "oldin → keyin" ko'rinishiga keltiradi
 * (manager-panel-design, rbac-and-audit). Backend `metadata` ni ikki shaklda
 * yozadi: ruxsatlar uchun `added`/`removed`, qolganlar uchun
 * `before`/`after` obyektlari.
 */
export interface AuditFieldChange {
  field: string;
  before: string;
  after: string;
}

export type AuditChanges =
  | { kind: 'permissions'; added: string[]; removed: string[] }
  | { kind: 'fields'; fields: AuditFieldChange[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.map(String).join(', ');
  if (isRecord(value)) return JSON.stringify(value);
  return String(value);
}

export function auditChanges(action: string, metadata: Record<string, unknown> | null): AuditChanges | null {
  if (!metadata) return null;

  if (action === 'staff.permissions_update') {
    const added = asStrings(metadata.added);
    const removed = asStrings(metadata.removed);
    return added.length || removed.length ? { kind: 'permissions', added, removed } : null;
  }

  const { before, after } = metadata;
  if (!isRecord(before) || !isRecord(after)) return null;
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
  const fields = keys
    .map((field) => ({ field, before: display(before[field]), after: display(after[field]) }))
    .filter((c) => c.before !== c.after);
  return fields.length ? { kind: 'fields', fields } : null;
}

/** Sana filtri (yyyy-MM-dd) → API `from`/`to`; kun chegaralari Toshkent vaqtida (UTC+5). */
export function auditRangeParams(from: string | null, to: string | null): { from?: string; to?: string } {
  return {
    ...(from ? { from: `${from}T00:00:00+05:00` } : {}),
    ...(to ? { to: `${to}T23:59:59.999+05:00` } : {}),
  };
}

interface DatedEntry {
  id: string;
  createdAt: string;
}

/**
 * Bitta obyektning tarixi bir necha manbadan keladi (haydovchi: profil
 * yozuvlari `driver/<id>` + akkaunt yozuvlari `user/<userId>`). Takrorsiz,
 * yangisi birinchi, eng ko'pi `limit` ta.
 */
export function mergeHistory<T extends DatedEntry>(lists: readonly (readonly T[])[], limit: number): T[] {
  const byId = new Map<string, T>();
  for (const list of lists) for (const entry of list) byId.set(entry.id, entry);
  return Array.from(byId.values())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}
