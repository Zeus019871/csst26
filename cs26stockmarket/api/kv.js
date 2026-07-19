// Simple key-value API backed by Upstash Redis (installed via the Vercel
// Marketplace "Redis" storage integration, which auto-populates the
// KV_REST_API_URL / KV_REST_API_TOKEN env vars used below).
//
// GET    /api/kv?key=foo        -> { value }
// POST   /api/kv?key=foo  body: { value } -> { ok: true }
// DELETE /api/kv?key=foo        -> { ok: true }
//
// See README.md for the one-time setup step in the Vercel dashboard.
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  const key = req.query.key;
  if (!key || typeof key !== "string") {
    return res.status(400).json({ error: "Missing ?key=" });
  }

  try {
    if (req.method === "GET") {
      const value = await redis.get(key);
      return res.status(200).json({ value: value ?? null });
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      await redis.set(key, body?.value ?? null);
      return res.status(200).json({ ok: true });
    }

    if (req.method === "DELETE") {
      await redis.del(key);
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error("kv handler error", e);
    return res.status(500).json({ error: "Storage error", detail: String(e?.message || e) });
  }
}
