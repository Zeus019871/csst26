// Thin client for the /api/kv serverless function. Mirrors the shape of the
// window.storage API this app was originally built against (get/set/delete),
// so the rest of the app didn't need to change — only this file talks to the
// network.
const BASE = "/api/kv";

export const storage = {
  async get(key) {
    try {
      const res = await fetch(`${BASE}?key=${encodeURIComponent(key)}`);
      if (!res.ok) return null;
      const data = await res.json();
      if (data.value === null || data.value === undefined) return null;
      return { key, value: data.value };
    } catch (e) {
      console.error("storage.get failed", key, e);
      return null;
    }
  },

  async set(key, value) {
    try {
      const res = await fetch(`${BASE}?key=${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      if (!res.ok) return null;
      return { key, value };
    } catch (e) {
      console.error("storage.set failed", key, e);
      return null;
    }
  },

  async delete(key) {
    try {
      await fetch(`${BASE}?key=${encodeURIComponent(key)}`, { method: "DELETE" });
      return { key, deleted: true };
    } catch (e) {
      console.error("storage.delete failed", key, e);
      return null;
    }
  },
};
