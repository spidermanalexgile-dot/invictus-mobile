import { supabase } from "./supabase";

/** The fixed metric vocabulary. Mirrors the CHECK on health_daily_metrics. */
export const METRICS = [
  "sleep_duration_min",
  "sleep_onset_min",
  "resting_hr_bpm",
  "hrv_rmssd_ms",
  "steps",
  "active_minutes",
  "workouts_count",
] as const;

export type MetricKey = (typeof METRICS)[number];

export type DailyMetric = {
  provider: string;
  date: string;
  metric: MetricKey;
  value: number;
  unit: string;
  sourceUpdatedAt: string;
};

export const METRIC_LABELS: Record<MetricKey, string> = {
  sleep_duration_min: "Sleep",
  sleep_onset_min: "Sleep onset",
  resting_hr_bpm: "Resting heart rate",
  hrv_rmssd_ms: "HRV (RMSSD)",
  steps: "Steps",
  active_minutes: "Active minutes",
  workouts_count: "Workouts",
};

function isMetricKey(v: unknown): v is MetricKey {
  return typeof v === "string" && (METRICS as readonly string[]).includes(v);
}

/**
 * Reads the member's own stored metrics.
 *
 * This goes straight to PostgREST with the member's token, so Row Level
 * Security is what decides the result — not a filter in this file. A bug here
 * cannot show somebody else's health data.
 */
export async function fetchDailyMetrics(limit = 300): Promise<DailyMetric[]> {
  const { data, error } = await supabase
    .from("health_daily_metrics")
    .select("provider,metric_date,metric,value,unit,source_updated_at")
    .order("metric_date", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  if (!data) return [];

  const rows: DailyMetric[] = [];
  for (const row of data) {
    // Narrow rather than cast: the database is a boundary like any other.
    const metric = (row as Record<string, unknown>).metric;
    const value = (row as Record<string, unknown>).value;
    const date = (row as Record<string, unknown>).metric_date;
    if (!isMetricKey(metric) || typeof date !== "string") continue;

    const numeric = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(numeric)) continue;

    rows.push({
      provider: String((row as Record<string, unknown>).provider ?? ""),
      date,
      metric,
      value: numeric,
      unit: String((row as Record<string, unknown>).unit ?? ""),
      sourceUpdatedAt: String((row as Record<string, unknown>).source_updated_at ?? ""),
    });
  }
  return rows;
}
