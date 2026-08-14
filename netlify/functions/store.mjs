/* Rho Mainframe — shared board store.
   A tiny relay in front of Netlify Blobs so every device shares one board
   (chat + state) without any client-side credentials. The Netlify API token
   lives ONLY in the function environment (RHO_NETLIFY_TOKEN). */

const SITE_ID = "b0031f98-706a-40e3-8004-45eef9ad3cb3";
const STORE = "rho-store";

export default async (req) => {
  const url = new URL(req.url);
  const key = url.searchParams.get("key") || "";
  const origin = req.headers.get("origin") || "";
  const okOrigin = /^(https:\/\/kresentapp2\.netlify\.app|https:\/\/tylllerbeck23\.github\.io|http:\/\/localhost:\d+)$/.test(origin);
  const cors = {
    "Access-Control-Allow-Origin": okOrigin ? origin : "https://kresentapp2.netlify.app",
    "Access-Control-Allow-Methods": "GET,PUT,POST,OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
  };
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  /* keys are namespaced with an unguessable board id — capability-URL model */
  if (!/^rho-[A-Za-z0-9:_.-]{3,120}$/.test(key)) return new Response("bad key", { status: 400, headers: cors });

  const token = process.env.RHO_NETLIFY_TOKEN || (globalThis.Netlify && Netlify.env.get("RHO_NETLIFY_TOKEN"));
  if (!token) return new Response("store not configured", { status: 500, headers: cors });
  const api = `https://api.netlify.com/api/v1/blobs/${SITE_ID}/${STORE}/${encodeURIComponent(key)}`;
  const apiRead = api + "?consistency=strong"; /* chat needs read-your-writes across regions */

  if (req.method === "GET") {
    const r = await fetch(apiRead, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return new Response(null, { status: 204, headers: cors }); /* absent key = empty */
    const t = await r.text();
    return new Response(t, { status: 200, headers: { ...cors, "content-type": "application/json", "cache-control": "no-store" } });
  }
  if (req.method === "PUT" || req.method === "POST") {
    const body = await req.text();
    if (body.length > 4_500_000) return new Response("too big", { status: 413, headers: cors });
    const r = await fetch(api, { method: "PUT", headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" }, body });
    return new Response(r.ok ? "ok" : "store error", { status: r.ok ? 200 : 502, headers: cors });
  }
  return new Response("method not allowed", { status: 405, headers: cors });
};

export const config = { path: "/api/store" };
