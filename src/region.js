// Region search: turn a typed place into coordinates, find nearby FM towers
// from the FCC's FM Query (LMS data), and check what they're playing.

import { UA, SONG, checkStation, songGenre, streamsFor } from "./nowplaying.js";

const memo = new Map(); // simple in-memory cache: key -> { at, data }
function cached(key, ms) { const c = memo.get(key); return c && Date.now() - c.at < ms ? c.data : undefined; }
function store(key, data) { if (memo.size > 2000) memo.clear(); memo.set(key, { at: Date.now(), data }); return data; }

// ---------------------------------------------------------------------------
// Places (OpenStreetMap Nominatim)
// ---------------------------------------------------------------------------
export async function geocode(q) {
  q = (q || "").trim().slice(0, 120);
  if (!q) throw new Error("Type a city, ZIP code or address");
  const key = "geo:" + q.toLowerCase();
  const hit = cached(key, 7 * 864e5); if (hit) return hit;
  const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&q=${encodeURIComponent(q)}`,
    { headers: { "User-Agent": UA, "Accept-Language": "en" }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`Place lookup failed (HTTP ${r.status})`);
  const [p] = await r.json();
  if (!p) throw new Error(`Couldn't find "${q}" in the US`);
  return store(key, { lat: +p.lat, lon: +p.lon, label: shortLabel(p.display_name) });
}

export async function reverse(lat, lon) {
  const key = `rev:${lat.toFixed(2)},${lon.toFixed(2)}`;
  const hit = cached(key, 7 * 864e5); if (hit) return hit;
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&lat=${lat}&lon=${lon}`,
      { headers: { "User-Agent": UA, "Accept-Language": "en" }, signal: AbortSignal.timeout(8000) });
    const p = await r.json();
    const a = p.address || {};
    const city = a.city || a.town || a.village || a.county || "";
    return store(key, { label: [city, a.state].filter(Boolean).join(", ") || shortLabel(p.display_name) });
  } catch { return { label: `${lat.toFixed(3)}, ${lon.toFixed(3)}` }; }
}

const shortLabel = (s) => (s || "").split(",").map((x) => x.trim()).filter((x) => x && x !== "United States").slice(0, 3).join(", ");

// ---------------------------------------------------------------------------
// FM towers near a point (FCC FM Query, pipe-delimited output)
// ---------------------------------------------------------------------------
function dms(v) {
  v = Math.abs(v);
  const d = Math.floor(v), mf = (v - d) * 60, m = Math.floor(mf), s = Math.round((mf - m) * 60);
  return s === 60 ? [d, m + 1, 0] : [d, m, s];
}
const titleCase = (s) => (s || "").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

export function parseFmq(text) {
  const out = new Map();
  for (const line of text.split("\n")) {
    if (!line.includes("|")) continue;
    const f = line.split("|").map((s) => s.trim());
    const off = f[0] === "" ? 1 : 0;
    // Find the coordinates block: N/S deg min sec W/E deg min sec
    let i = -1;
    for (let k = off + 8; k < f.length - 7; k++) {
      if ((f[k] === "N" || f[k] === "S") && (f[k + 4] === "W" || f[k + 4] === "E") && !isNaN(parseFloat(f[k + 1]))) { i = k; break; }
    }
    if (i < 0) continue;
    const call = f[off], freq = parseFloat(f[off + 1]), serv = f[off + 2], cls = f[off + 6], status = f[off + 8];
    if (!call || !(freq >= 87.7 && freq <= 108) || !/LIC/.test(status) || !/^(FM|FX|FL)$/.test(serv)) continue;
    const lat = (f[i] === "S" ? -1 : 1) * (+f[i + 1] + +f[i + 2] / 60 + +f[i + 3] / 3600);
    const lon = (f[i + 4] === "W" ? -1 : 1) * (+f[i + 5] + +f[i + 6] / 60 + +f[i + 7] / 3600);
    const erp = Math.max(parseFloat(f[i - 5]) || 0, parseFloat(f[i - 4]) || 0);   // kW
    const haat = Math.max(parseFloat(f[i - 3]) || 0, parseFloat(f[i - 2]) || 0);  // meters
    const st = {
      call, freq: freq.toFixed(1), serv, cls,
      kind: serv === "FX" ? "Translator (repeats another station)" : serv === "FL" ? "Low-power" : "Full power",
      city: titleCase(f[off + 9]), state: f[off + 10],
      erp, haat, lat: +lat.toFixed(5), lon: +lon.toFixed(5),
      licensee: f[i + 8] || "", facid: f[i - 1] || "",
    };
    const key = `${call}|${st.freq}`;
    const prev = out.get(key);
    if (!prev || st.erp > prev.erp) out.set(key, st);
  }
  return [...out.values()].sort((a, b) => a.freq - b.freq);
}

export async function nearby(lat, lon, radiusKm = 160) {
  const key = `fcc:${lat.toFixed(1)},${lon.toFixed(1)},${radiusKm}`;
  const hit = cached(key, 12 * 36e5); if (hit) return hit;
  const [ld, lm, ls] = dms(lat), [od, om, os] = dms(lon);
  const p = new URLSearchParams({
    call: "", arn: "", state: "", city: "", freq: "87.7", fre2: "108.0", serv: "", vac: "", facid: "", asrn: "", class: "",
    list: "4", NextTab: "Results to Next Page/Tab",
    dist: String(radiusKm), dlat2: ld, mlat2: lm, slat2: ls, NS: lat >= 0 ? "N" : "S",
    dlon2: od, mlon2: om, slon2: os, EW: lon < 0 ? "W" : "E", size: "9",
  });
  const r = await fetch(`https://transition.fcc.gov/fcc-bin/fmq?${p}`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`FCC station lookup failed (HTTP ${r.status})`);
  const stations = parseFmq(await r.text());
  if (!stations.length) throw new Error("The FCC lookup returned no stations for this spot");
  return store(key, stations);
}

// ---------------------------------------------------------------------------
// Now playing for a batch of stations (max 6 per request, to stay inside
// Cloudflare's free-plan limit of 50 outgoing requests per visit)
// ---------------------------------------------------------------------------
const IHEART_OWNER = /ihm|iheart|citicasters|capstar|clear channel/i;

export function toStation(s) {
  const call = String(s.call || "").toUpperCase().slice(0, 12);
  const freq = String(s.freq || "").slice(0, 6);
  const http = (u) => (typeof u === "string" && /^https?:\/\//.test(u) ? u : undefined);
  return {
    call, freq, name: "", place: String(s.city || "").slice(0, 40),
    iheart: s.iheart ? String(s.iheart).slice(0, 12) : IHEART_OWNER.test(s.licensee || "") ? (call.includes("-") ? call : `${call}-FM`) : undefined,
    tunein: s.tunein ? String(s.tunein).slice(0, 60) : s.serv === "FX" ? `${freq} ${s.city || ""}` : `${call.split("-")[0]} ${freq}`,
    icy: http(s.icy),
  };
}

export async function playing(list) {
  return Promise.all(list.slice(0, 6).map(async (s) => {
    const st = toStation(s);
    const key = `np:${st.call}|${st.freq}`;
    const hit = cached(key, 30000); if (hit) return hit;
    const r = await checkStation(st);
    r.genre = r.status === SONG ? await songGenre(r.artist, r.title) : "";
    return store(key, { call: s.call, freq: s.freq, ...r });
  }));
}

// Stream links to listen to a station on the page. Plain-http streams are
// passed through /api/stream so the browser will play them on an https page.
export async function listen(s) {
  const urls = await streamsFor(toStation(s));
  return urls.map((u) => ({
    url: u.startsWith("https://") ? u : `/api/stream?u=${encodeURIComponent(u)}`,
    hls: /\.m3u8(\?|$)/i.test(u),
  })).sort((a, b) => a.hls - b.hls);
}

export async function proxyStream(u, request) {
  let url;
  try { url = new URL(u); } catch { return new Response("Bad link", { status: 400 }); }
  if (url.protocol !== "http:" || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname)) {
    return new Response("Not allowed", { status: 403 });
  }
  const r = await fetch(url, { headers: { "User-Agent": UA, ...(request.headers.get("range") ? { range: request.headers.get("range") } : {}) } });
  const type = r.headers.get("content-type") || "";
  if (!/audio|octet-stream|mpegurl|aac|mpeg/i.test(type)) { await r.body?.cancel(); return new Response("Not an audio stream", { status: 415 }); }
  return new Response(r.body, { status: r.status, headers: { "content-type": type, "cache-control": "no-store" } });
}
