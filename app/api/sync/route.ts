import { getAuthenticatedUserFromRequest } from "../../chatgpt-auth";

type StoredRow = {
  payload: string;
  revision: number;
  updated_at: string;
  device_id: string | null;
};

const MAX_PAYLOAD_BYTES = 1_500_000;

function unauthorized() {
  return Response.json({ error: "Sign in is required for cloud sync." }, { status: 401 });
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUserFromRequest(request);
  const email = user?.email;
  if (!email) return unauthorized();
  try {
    const { env } = await import("cloudflare:workers");
    const row = await env.DB.prepare("SELECT payload, revision, updated_at, device_id FROM user_states WHERE user_email = ?")
      .bind(email).first<StoredRow>();
    if (!row) return Response.json({ state: null, revision: 0, updatedAt: null });
    return Response.json({ state: JSON.parse(row.payload), revision: row.revision, updatedAt: row.updated_at, deviceId: row.device_id });
  } catch {
    return Response.json({ error: "Cloud data could not be loaded." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const user = await getAuthenticatedUserFromRequest(request);
  const email = user?.email;
  if (!email) return unauthorized();
  try {
    const { env } = await import("cloudflare:workers");
    const body = await request.json() as { state?: unknown; updatedAt?: string; baseRevision?: number; deviceId?: string };
    if (!body.state || !body.updatedAt || typeof body.baseRevision !== "number") {
      return Response.json({ error: "Incomplete sync request." }, { status: 400 });
    }
    const payload = JSON.stringify(body.state);
    if (new TextEncoder().encode(payload).byteLength > MAX_PAYLOAD_BYTES) {
      return Response.json({ error: "The tracker data is too large to sync." }, { status: 413 });
    }
    const existing = await env.DB.prepare("SELECT revision, updated_at FROM user_states WHERE user_email = ?")
      .bind(email).first<{ revision: number; updated_at: string }>();
    if (existing && existing.revision !== body.baseRevision) {
      return Response.json({ conflict: true, revision: existing.revision, updatedAt: existing.updated_at }, { status: 409 });
    }
    const nextRevision = (existing?.revision || 0) + 1;
    await env.DB.prepare(`INSERT INTO user_states (user_email, payload, revision, updated_at, device_id)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_email) DO UPDATE SET payload = excluded.payload, revision = excluded.revision,
      updated_at = excluded.updated_at, device_id = excluded.device_id`)
      .bind(email, payload, nextRevision, body.updatedAt, body.deviceId || null).run();
    return Response.json({ synced: true, revision: nextRevision, updatedAt: body.updatedAt });
  } catch {
    return Response.json({ error: "Cloud data could not be saved." }, { status: 500 });
  }
}
