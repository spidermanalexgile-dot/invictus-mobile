import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { Empty, ErrorState, Loading } from "@/components/States";
import { METRIC_LABELS, fetchDailyMetrics, type DailyMetric } from "@/lib/metrics";
import { color, radius, space, type } from "@/theme/tokens";

/**
 * Phase 1's proof screen: what actually landed in the database, unprettified.
 *
 * It exists to answer "did the round trip work?" — device to Terra to our
 * webhook to Postgres and back — and it is deliberately not a summary. The
 * real metric cards come in Phase 2 and are computed on the server. This
 * screen goes away when they arrive.
 */
type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; rows: DailyMetric[] };

export default function Debug() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setState({ kind: "ready", rows: await fetchDailyMetrics() });
    } catch (err) {
      setState({ kind: "error", message: err instanceof Error ? err.message : "Could not load." });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.kind === "loading") return <Loading label="Loading imported data" />;
  if (state.kind === "error") {
    return (
      <ErrorState
        title="Could not load"
        body={state.message}
        onRetry={() => {
          setState({ kind: "loading" });
          void load();
        }}
      />
    );
  }

  const byDate = new Map<string, DailyMetric[]>();
  for (const row of state.rows) {
    const list = byDate.get(row.date);
    if (list) list.push(row);
    else byDate.set(row.date, [row]);
  }

  return (
    <ScrollView
      contentContainerStyle={styles.body}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
    >
      {byDate.size === 0 ? (
        <Empty
          title="Nothing imported yet"
          body="Connect Apple Health, then pull down here. A 90-day import can take a few minutes to start arriving."
        />
      ) : (
        <>
          <Text style={styles.count}>
            {state.rows.length} measurements across {byDate.size} days
          </Text>
          {[...byDate.entries()].map(([date, rows]) => (
            <View key={date} style={styles.card}>
              <Text style={styles.date} accessibilityRole="header">
                {date}
              </Text>
              {rows.map((row) => (
                <View key={`${row.provider}-${row.metric}`} style={styles.row}>
                  <Text
                    style={styles.label}
                    accessibilityLabel={`${METRIC_LABELS[row.metric]}, ${row.value} ${row.unit}`}
                  >
                    {METRIC_LABELS[row.metric]}
                  </Text>
                  <Text style={styles.value}>
                    {row.value} {row.unit}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, gap: space.md },
  count: { ...type.label, color: color.text2 },
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    padding: space.lg,
    gap: space.xs,
  },
  date: { ...type.heading, color: color.ink900, marginBottom: space.xs },
  row: { flexDirection: "row", justifyContent: "space-between", gap: space.md },
  label: { ...type.body, color: color.text2, flexShrink: 1 },
  value: { ...type.body, color: color.text, fontVariant: ["tabular-nums"] },
});
