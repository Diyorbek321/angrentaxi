import { IncidentSettings } from '../settings/incident-settings';
import { StrikeSuggestion, strikeSuggestion } from './incident-policy';

type RawQuery = (sql: string, params: unknown[]) => Promise<unknown>;

/** Oynadagi tasdiqlangan shikoyatlar (subyektga qarshi), `excludeId` dan tashqari. */
export async function countConfirmedStrikes(
  query: RawQuery,
  subjectUserId: string,
  windowDays: number,
  now: Date,
  excludeId: string | null = null,
): Promise<number> {
  const rows = (await query(
    `SELECT COUNT(*)::int AS strikes FROM incidents
      WHERE subject_user_id = $1 AND confirmed_against_subject = true AND resolved_at >= $2
        AND ($3::uuid IS NULL OR id <> $3::uuid)`,
    [subjectUserId, new Date(now.getTime() - windowDays * 86_400_000), excludeId],
  )) as Array<{ strikes: number | string }> | undefined;
  return Number(rows?.[0]?.strikes ?? 0);
}

export interface StrikeInfo {
  /** Oldingi tasdiqlanganlar (shu hodisasiz). */
  confirmed: number;
  windowDays: number;
  /** Shu hodisa ham tasdiqlansa — tizim taklifi. */
  suggestion: StrikeSuggestion;
  thresholds: { warningAt: number; suspensionAt: number; blockAt: number };
}

export function strikeInfo(confirmed: number, settings: IncidentSettings): StrikeInfo {
  return {
    confirmed,
    windowDays: settings.strikeWindowDays,
    suggestion: strikeSuggestion(confirmed + 1, settings),
    thresholds: {
      warningAt: settings.strikeWarningAt,
      suspensionAt: settings.strikeSuspensionAt,
      blockAt: settings.strikeBlockAt,
    },
  };
}
