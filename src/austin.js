// The Austin / San Marcos song log: a fixed station list, checked by the cron
// trigger, with every change saved in D1.
import { SONG, NODATA, checkStation } from "./nowplaying.js";

const TZ = "America/Chicago";
const KEEP_DAYS = 30;

export const STATIONS = [
  { freq: "88.7",  call: "KAZI",    name: "KAZI 88.7",          fmt: "Urban / community",    tunein: "KAZI 88.7" },
  { freq: "89.5",  call: "KMFA",    name: "KMFA Classical",     fmt: "Classical",            tunein: "KMFA" },
  { freq: "89.9",  call: "KTSW",    name: "KTSW (Texas State)", fmt: "College radio",        tunein: "KTSW" },
  { freq: "91.7",  call: "KVRX",    name: "KVRX (UT student)",  fmt: "College radio",        tunein: "KVRX" },
  { freq: "93.3",  call: "KGSR",    name: "93.3 KGSR",          fmt: "Changed hands 2026",   tunein: "KGSR 93.3" },
  { freq: "93.7",  call: "KLBJ-FM", name: "93.7 KLBJ",          fmt: "Classic rock",         tunein: "KLBJ-FM" },
  { freq: "94.7",  call: "KAMX",    name: "Mix 94.7",           fmt: "Pop (hot AC)",         tunein: "KAMX Mix 94.7" },
  { freq: "95.5",  call: "KKMJ",    name: "Majic 95.5",         fmt: "Soft pop (AC)",        tunein: "KKMJ Majic 95.5" },
  { freq: "95.9",  call: "KOKE",    name: "95.9 Texas Country", fmt: "Texas country",        tunein: "KOKE-FM" },
  { freq: "96.7",  call: "KHFI",    name: "96.7 Kiss FM",       fmt: "Top 40",               tunein: "KHFI Kiss FM", iheart: "KHFI-FM" },
  { freq: "98.1",  call: "KVET",    name: "98.1 KVET",          fmt: "Country",              tunein: "KVET-FM",      iheart: "KVET-FM" },
  { freq: "98.9",  call: "KUTX",    name: "KUTX 98.9",          fmt: "Austin music / indie", tunein: "KUTX", icy: "https://streams.kut.org/4430_192.mp3" },
  { freq: "100.1", call: "KTSN",    name: "Sun Radio",          fmt: "Americana",            tunein: "Sun Radio Austin" },
  { freq: "100.7", call: "KASE",    name: "KASE 100.7",         fmt: "Country",              tunein: "KASE 100.7",   iheart: "KASE-FM" },
  // Past 100 FM - remove the // to add them:
  // { freq: "102.3", call: "KPEZ", name: "102.3 The Beat", fmt: "Hip-hop / R&B", tunein: "KPEZ", iheart: "KPEZ-FM" },
  // { freq: "103.5", call: "KBPA", name: "103.5 Bob FM",   fmt: "Variety hits",  tunein: "KBPA Bob FM" },
];

let ensured = false;
async function ensureTables(db) {
  if (ensured) return;
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS plays (t INTEGER, freq TEXT, station TEXT, status TEXT, artist TEXT, title TEXT, src TEXT)"),
    db.prepare("CREATE INDEX IF NOT EXISTS plays_t ON plays (t)"),
    db.prepare("CREATE TABLE IF NOT EXISTS last (call TEXT PRIMARY KEY, k TEXT, since INTEGER)"),
  ]);
  ensured = true;
}

// Checks all stations, saves changes, returns the live snapshot.
export { KEEP_DAYS };
// part: check only a third of the stations each minute (0, 1 or 2), so each run stays
// inside Cloudflare's free-plan request limit. Each station is checked every 3 minutes.
export async function runCheck(env, part = null) {
  const now = Math.floor(Date.now() / 1000);
  const todo = STATIONS.filter((_, i) => part === null || i % 3 === part);
  const results = await Promise.all(todo.map(checkStation));
  const since = {};
  if (env.DB) {
    await ensureTables(env.DB);
    const { results: prev } = await env.DB.prepare("SELECT call, k, since FROM last").all();
    const old = Object.fromEntries(prev.map((p) => [p.call, p]));
    const writes = [];
    todo.forEach((st, i) => {
      const r = results[i];
      if (r.status === NODATA) { since[st.call] = old[st.call]?.since ?? null; return; }
      const k = `${r.status}|${r.artist}|${r.title}`.toLowerCase();
      if (old[st.call]?.k === k) { since[st.call] = old[st.call].since; return; }
      since[st.call] = now;
      writes.push(
        env.DB.prepare("INSERT INTO plays VALUES (?,?,?,?,?,?,?)").bind(now, st.freq, st.name, r.status, r.artist, r.status === SONG ? r.title : (r.note || r.title), r.src),
        env.DB.prepare("INSERT INTO last (call, k, since) VALUES (?,?,?) ON CONFLICT(call) DO UPDATE SET k = excluded.k, since = excluded.since").bind(st.call, k, now),
      );
    });
    if (writes.length) await env.DB.batch(writes);
  }
  return {
    time: now,
    logging: !!env.DB,
    stations: todo.map((st, i) => ({ freq: st.freq, call: st.call, name: st.name, fmt: st.fmt, ...results[i], since: since[st.call] ?? null })),
  };
}

export const fmtTime = (t) => new Date(t * 1000).toLocaleString("en-US", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
export const csvCell = (v) => { v = String(v ?? ""); return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };

export async function readLog(env, url) {
  if (!env.DB) return [];
  await ensureTables(env.DB);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "100", 10) || 100, 5000);
  const freq = url.searchParams.get("freq");
  const q = freq
    ? env.DB.prepare("SELECT * FROM plays WHERE freq = ? ORDER BY t DESC, rowid DESC LIMIT ?").bind(freq, limit)
    : env.DB.prepare("SELECT * FROM plays ORDER BY t DESC, rowid DESC LIMIT ?").bind(limit);
  return (await q.all()).results;
}


