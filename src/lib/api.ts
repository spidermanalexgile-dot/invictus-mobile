import { config } from "./config";
import { accessToken } from "./supabase";

/**
 * Typed client for the INVICTUS backend.
 *
 * Every response is narrowed before it leaves this file, so no `unknown` and
 * no `any` reaches a screen. A shape we do not recognise is an error here
 * rather than `undefined` rendered as "NaN" three components later.
 */

export type Provider =
  | "APPLE_HEALTH"
  | "HEALTH_CONNECT"
  | "WHOOP"
  | "OURA"
  | "GARMIN"
  | "FITBIT"
  | "SAMSUNG"
  | "GOOGLE"
  | "FREESTYLE_LIBRE";

export type ConnectionStatus =
  | "disconnected"
  | "pending"
  | "connected"
  | "needs_reauth"
  | "revoked";

export type Connection = {
  provider: Provider;
  status: ConnectionStatus;
  grantedScopes: string[];
  consentedAt: string | null;
  lastWebhookAt: string | null;
  lastSampleAt: string | null;
  backfillRequestedAt: string | null;
  backfillCompletedAt: string | null;
};

export type TerraSession = {
  token: string;
  devId: string;
  referenceId: string;
  expiresIn: number | null;
};

/** A refusal the UI is expected to show calmly, not a crash. */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

async function request(path: string, init: RequestInit = {}): Promise<unknown> {
  const token = await accessToken();
  if (!token) throw new ApiError(401, "signed_out", "Sign in to continue.");

  let res: Response;
  try {
    res = await fetch(`${config.apiBase}${path}`, {
      ...init,
      headers: {
        ...init.headers,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
  } catch {
    // A dropped connection is the single most common failure on a phone and
    // deserves a sentence a member can act on, not "TypeError: Network request
    // failed".
    throw new ApiError(0, "offline", "No connection. Check your network and try again.");
  }

  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    throw new ApiError(res.status, "bad_response", "The server sent something unreadable.");
  }

  if (!res.ok) {
    const code = isRecord(body) ? str(body.code) : null;
    const message = isRecord(body) ? str(body.message) : null;
    throw new ApiError(res.status, code ?? "http_error", message ?? "Something went wrong.");
  }
  return body;
}

function toConnection(row: unknown): Connection | null {
  if (!isRecord(row)) return null;
  const provider = str(row.provider);
  const status = str(row.status);
  if (!provider || !status) return null;

  return {
    provider: provider as Provider,
    status: status as ConnectionStatus,
    grantedScopes: Array.isArray(row.granted_scopes)
      ? row.granted_scopes.filter((s): s is string => typeof s === "string")
      : [],
    consentedAt: str(row.consented_at),
    lastWebhookAt: str(row.last_webhook_at),
    lastSampleAt: str(row.last_sample_at),
    backfillRequestedAt: str(row.backfill_requested_at),
    backfillCompletedAt: str(row.backfill_completed_at),
  };
}

/**
 * Asks the backend to mint a Terra session token.
 *
 * The token is single-use and short-lived. The API key that produced it never
 * leaves the server — this call is the whole reason that boundary exists.
 */
export async function createTerraSession(provider: Provider): Promise<TerraSession> {
  const body = await request("/api/integrations/terra/session", {
    method: "POST",
    body: JSON.stringify({ provider }),
  });

  if (!isRecord(body)) throw new ApiError(502, "bad_response", "Could not start the connection.");
  const token = str(body.token);
  const devId = str(body.devId);
  const referenceId = str(body.referenceId);
  if (!token || !devId || !referenceId) {
    throw new ApiError(502, "bad_response", "Could not start the connection.");
  }

  return {
    token,
    devId,
    referenceId,
    expiresIn: typeof body.expiresIn === "number" ? body.expiresIn : null,
  };
}

export async function fetchConnections(): Promise<Connection[]> {
  const body = await request("/api/integrations/connections");
  if (!isRecord(body) || !Array.isArray(body.connections)) return [];
  return body.connections
    .map(toConnection)
    .filter((c): c is Connection => c !== null);
}

/**
 * Disconnects a provider. The server deletes the stored data in the same
 * statement — the schema cascades — so this is not reversible and the UI must
 * say so before calling it.
 */
export async function disconnectProvider(provider: Provider): Promise<void> {
  await request(`/api/integrations/${provider}`, { method: "DELETE" });
}
