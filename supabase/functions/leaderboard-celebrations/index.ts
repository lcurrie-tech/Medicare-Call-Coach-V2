// Public TV feed. Never return contact IDs, form payloads, or client details.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "no-store",
  "Content-Type": "application/json",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "GET") return reply({ error: "GET required" }, 405);
  // This is the existing public TV application key, not a privileged credential.
  const publicKey = "sb_publishable_RYzGylmP61WORQ6aGouVWQ_PEvRJtBu";
  if (req.headers.get("apikey") !== publicKey) return reply({ error: "Invalid application key" }, 401);
  const after = new URL(req.url).searchParams.get("after");
  if (after !== null && (!/^\d{1,15}$/.test(after) || !Number.isSafeInteger(Number(after)))) {
    return reply({ error: "Invalid cursor" }, 400);
  }
  const base = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!base || !serviceKey) return reply({ error: "Feed unavailable" }, 503);
  async function read(table: string, params: Record<string, string>) {
    const res = await fetch(`${base}/rest/v1/${table}?${new URLSearchParams(params)}`, {
      headers: { apikey: serviceKey!, Authorization: `Bearer ${serviceKey}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error("Database read failed");
    return await res.json();
  }
  try {
    // A fresh TV session establishes a watermark without replaying historical sales.
    if (after === null) {
      const latest = await read("application_events", { select: "id", order: "id.desc", limit: "1" });
      return reply({ cursor: Number(latest[0]?.id || 0), events: [], hasMore: false });
    }
    const [events, agents] = await Promise.all([
      read("application_events", {
        select: "id,agent_id", id: `gt.${after}`, order: "id.asc", limit: "51",
      }),
      read("agents", { select: "id,full_name", active: "eq.true" }),
    ]);
    const names = new Map(agents.map((a: { id: number; full_name: string }) => [a.id, a.full_name]));
    const page = events.slice(0, 50);
    return reply({
      cursor: Number(page.at(-1)?.id || after),
      events: page.filter((e: { agent_id: number }) => names.has(e.agent_id))
        .map((e: { id: number; agent_id: number }) => ({ id: Number(e.id), agentName: names.get(e.agent_id) })),
      hasMore: events.length > 50,
    });
  } catch {
    return reply({ error: "Feed temporarily unavailable" }, 503);
  }
});
