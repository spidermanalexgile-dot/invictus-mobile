import { Link, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Empty, ErrorState, Loading, StaleNotice } from "@/components/States";
import { daysSince } from "@/lib/staleness";
import { ApiError, disconnectProvider, fetchConnections, type Connection } from "@/lib/api";
import { useSession } from "@/lib/session";
import {
  PERMISSION_LABELS,
  READ_PERMISSIONS,
  backfill,
  connectAppleHealth,
  describeGrant,
  requestMissingPermissions,
} from "@/lib/terra";
import { CustomPermissions } from "terra-react";
import { color, radius, space, type } from "@/theme/tokens";

/**
 * Phase 1 surface: connect Apple Health for real, and prove the data arrives.
 *
 * This grows into the Connections screen in Phase 2. It already carries the
 * states that matter — loading, empty, error, stale — because retrofitting
 * those is how they end up missing.
 */

type Status =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; connection: Connection | null };

const APPLE = "APPLE_HEALTH" as const;

export default function Home() {
  const router = useRouter();
  const { session, loading: sessionLoading } = useSession();

  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [connecting, setConnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const connections = await fetchConnections();
      setStatus({ kind: "ready", connection: connections.find((c) => c.provider === APPLE) ?? null });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not load your connections.";
      setStatus({ kind: "error", message });
    }
  }, []);

  useEffect(() => {
    if (sessionLoading) return;
    if (!session) {
      router.replace("/sign-in");
      return;
    }
    void load();
  }, [session, sessionLoading, load, router]);

  async function onConnect() {
    setConnecting(true);
    setNotice(null);

    const outcome = await connectAppleHealth();

    if (outcome.kind === "failed") {
      setConnecting(false);
      setNotice(outcome.message);
      return;
    }

    if (outcome.kind === "denied") {
      setConnecting(false);
      // iOS never tells an app which reads were refused, so this cannot claim
      // to know. It says what we observe and where the member can change it.
      setNotice(
        "No health data is being shared yet. If you meant to share it, open Settings › Health › Data Access & Devices › Invictus.",
      );
      await load();
      return;
    }

    // The connection exists; history is a separate, slower step.
    const result = await backfill(90);
    setConnecting(false);

    if (result.requested.length === 0) {
      setNotice("Connected, but the last 90 days could not be requested. Pull down to retry.");
    } else if (outcome.missing.length > 0) {
      const names = outcome.missing.map((m) => PERMISSION_LABELS[m] ?? m).join(", ");
      setNotice(`Connected. Importing 90 days. Not shared: ${names}.`);
    } else {
      setNotice("Connected. Importing the last 90 days — this can take a few minutes.");
    }
    await load();
  }

  async function onFixPermissions() {
    try {
      const granted = await requestMissingPermissions();
      const { full, missing } = describeGrant(granted);
      setNotice(
        full
          ? "All set — everything is shared now."
          : missing.length === READ_PERMISSIONS.length
            ? "Nothing changed. iOS only re-asks once, so change it in Settings › Health › Data Access & Devices › Invictus."
            : `Still not shared: ${missing.map((m) => PERMISSION_LABELS[m] ?? m).join(", ")}.`,
      );
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not update permissions.");
    }
  }

  function onDisconnect() {
    Alert.alert(
      "Disconnect Apple Health?",
      "This deletes every measurement we have imported from Apple Health. It cannot be undone, and your Health app is not affected.",
      [
        { text: "Keep connected", style: "cancel" },
        {
          text: "Disconnect and delete",
          style: "destructive",
          onPress: async () => {
            try {
              await disconnectProvider(APPLE);
              setNotice("Disconnected. Imported data has been deleted.");
              await load();
            } catch (err) {
              setNotice(err instanceof ApiError ? err.message : "Could not disconnect.");
            }
          },
        },
      ],
    );
  }

  if (sessionLoading || status.kind === "loading") {
    return <Loading label="Loading your connections" />;
  }

  if (status.kind === "error") {
    return (
      <ErrorState
        title="Could not load"
        body={status.message}
        onRetry={() => {
          setStatus({ kind: "loading" });
          void load();
        }}
      />
    );
  }

  const { connection } = status;
  const stale = daysSince(connection?.lastSampleAt ?? null);
  const importing =
    connection?.backfillRequestedAt != null && connection.backfillCompletedAt == null;

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
      <Text style={styles.heading} accessibilityRole="header">
        Apple Health
      </Text>

      {Platform.OS !== "ios" ? (
        <Empty
          title="iPhone only"
          body="Apple Health lives on iOS. Android support arrives through Health Connect."
        />
      ) : (
        <>
          <StatusCard connection={connection} importing={importing} />

          {connection?.status === "connected" && stale !== null && stale >= 2 ? (
            <StaleNotice days={stale} source="Apple Health" />
          ) : null}

          {notice ? (
            <Text style={styles.notice} accessibilityRole="alert">
              {notice}
            </Text>
          ) : null}

          <Disclosure />

          {connection?.status === "connected" ? (
            <View style={styles.actions}>
              <Button
                label="Update what's shared"
                onPress={onFixPermissions}
                variant="secondary"
                hint="Asks iOS again for any health data you have not shared"
              />
              <Button label="Disconnect and delete data" onPress={onDisconnect} variant="danger" />
            </View>
          ) : (
            <Button
              label="Connect Apple Health"
              onPress={onConnect}
              busy={connecting}
              hint="Opens the iOS permission sheet"
            />
          )}

          <Link href="/debug" style={styles.link} accessibilityRole="link">
            View raw imported data
          </Link>
        </>
      )}
    </ScrollView>
  );
}

function StatusCard({
  connection,
  importing,
}: {
  connection: Connection | null;
  importing: boolean;
}) {
  if (!connection || connection.status === "disconnected") {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Not connected</Text>
        <Text style={styles.muted}>
          Connect Apple Health to see your sleep, heart rate and movement alongside your blood
          panel.
        </Text>
      </View>
    );
  }

  const line: Record<Connection["status"], string> = {
    connected: importing
      ? "Connected. Importing the last 90 days."
      : connection.lastSampleAt
        ? `Connected. Last data ${new Date(connection.lastSampleAt).toLocaleDateString()}.`
        : "Connected. Waiting for the first data to arrive.",
    pending: "Waiting for Apple Health to confirm. Pull down to refresh.",
    needs_reauth: "Apple Health needs reconnecting. Tap Connect to fix it.",
    revoked: "Access was turned off in iOS Settings. Reconnect to resume.",
    disconnected: "Not connected.",
  };

  const tone: Record<Connection["status"], string> = {
    connected: color.teal100,
    pending: color.amber100,
    needs_reauth: color.amber100,
    revoked: color.rose100,
    disconnected: color.surface2,
  };

  return (
    <View style={[styles.card, { backgroundColor: tone[connection.status] }]}>
      <Text style={styles.cardTitle}>{line[connection.status]}</Text>
      {connection.grantedScopes.length > 0 ? (
        <Text style={styles.muted}>Sharing {connection.grantedScopes.length} data types.</Text>
      ) : null}
    </View>
  );
}

/**
 * What we read, stated on the screen rather than buried in a policy. This list
 * is generated from the same constant the SDK requests, so the two cannot
 * drift apart.
 */
function Disclosure() {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>What we read</Text>
      {READ_PERMISSIONS.map((permission) => {
        const key = CustomPermissions[permission];
        return (
          <Text key={key} style={styles.muted}>
            • {PERMISSION_LABELS[key] ?? key}
          </Text>
        );
      })}
      <Text style={[styles.muted, styles.footnote]}>
        Nothing is written back to your Health app. This data is never used for advertising and is
        never sold. Disconnecting deletes it.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.xl, gap: space.lg },
  heading: { ...type.display, color: color.ink900 },
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    padding: space.lg,
    gap: space.xs,
  },
  cardTitle: { ...type.heading, color: color.ink900 },
  muted: { ...type.body, color: color.text2 },
  footnote: { marginTop: space.sm },
  notice: { ...type.body, color: color.ink900 },
  actions: { gap: space.md },
  link: { ...type.label, color: color.blue600, paddingVertical: space.md },
});
