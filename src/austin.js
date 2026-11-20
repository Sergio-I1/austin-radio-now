// The Austin / San Marcos board: fixed station list, checked every minute by
// the cron trigger, with a song log saved in D1.
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
export async function runCheck(env) {
  const now = Math.floor(Date.now() / 1000);
  const results = await Promise.all(STATIONS.map(checkStation));
  const since = {};
  if (env.DB) {
    await ensureTables(env.DB);
    const { results: prev } = await env.DB.prepare("SELECT call, k, since FROM last").all();
    const old = Object.fromEntries(prev.map((p) => [p.call, p]));
    const writes = [];
    STATIONS.forEach((st, i) => {
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
    stations: STATIONS.map((st, i) => ({ freq: st.freq, call: st.call, name: st.name, fmt: st.fmt, ...results[i], since: since[st.call] ?? null })),
  };
}

// Short cache so many page views don't hammer the radio feeds.
let cached = null;
export async function liveSnapshot(env) {
  if (cached && Date.now() - cached.at < 20000) return cached.data;
  const data = await runCheck(env);
  cached = { at: Date.now(), data };
  return data;
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


export const AUSTIN_PAGE = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Austin Radio Now</title>
<meta name="theme-color" content="#14110f">
<style>
:root{color-scheme:light dark;--bg:light-dark(#f6f1e8,#14110f);--card:light-dark(#fffdf8,#1f1b18);--ink:light-dark(#1d1916,#f1ebe3);
--mute:light-dark(#6f665d,#a59b90);--line:light-dark(#e4dccf,#2f2925);--song:#1d8a4e;--brk:#c46a00;--nod:#8a8178;--acc:#bf3b1e}
*{box-sizing:border-box;min-width:0}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}
header{padding:20px 16px 10px;max-width:1100px;margin:auto}h1{margin:0;font-size:26px;line-height:1.1}
.sub{color:var(--mute);font-size:13px;margin-top:4px}
nav{display:flex;gap:8px;margin-top:14px}nav button{font:inherit;font-weight:600;padding:10px 16px;min-height:44px;border-radius:99px;border:1px solid var(--line);background:var(--card);color:var(--ink)}
nav button[aria-pressed=true]{background:var(--ink);color:var(--bg);border-color:var(--ink)}
main{padding:6px 12px 32px;max-width:1100px;margin:auto}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px 14px}
.top{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
.freq{font-size:26px;font-weight:800;letter-spacing:-.02em}.name{color:var(--mute);font-size:13px;text-align:right}
.pill{display:inline-block;margin:8px 0 4px;padding:2px 9px;border-radius:99px;font-size:12px;font-weight:700;color:#fff}
.SONG{background:var(--song)}.AD{background:var(--brk)}.NO{background:var(--nod)}
.title{font-weight:700;font-size:17px;line-height:1.25}.artist{font-size:14px}.meta{color:var(--mute);font-size:12px;margin-top:6px}
.bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:4px 0 10px}
select,a.btn{font:inherit;font-size:16px;min-height:44px;padding:8px 12px;border-radius:10px;border:1px solid var(--line);background:var(--card);color:var(--ink);text-decoration:none;display:inline-flex;align-items:center}
.scroll{overflow-x:auto;background:var(--card);border:1px solid var(--line);border-radius:12px}
table{width:100%;border-collapse:collapse;font-size:13px}td,th{padding:7px 9px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top;white-space:nowrap}
td.w{white-space:normal;min-width:180px}th{color:var(--mute);font-weight:600;position:sticky;top:0;background:var(--card)}
.empty{color:var(--mute);padding:16px}
</style></head><body>
<header><h1>Austin radio, right now</h1><div class="sub"><a href="/">Find stations anywhere (radio near me)</a></div><div class="sub" id="upd">Loading…</div>
<nav><button id="tNow" aria-pressed="true">Now playing</button><button id="tLog" aria-pressed="false">Log</button></nav></header>
<main>
<section id="vNow"><div class="grid" id="grid"></div></section>
<section id="vLog" hidden>
<div class="bar"><select id="fStation"><option value="">All stations</option></select><a class="btn" id="dl" href="/log.csv">Download spreadsheet (CSV)</a></div>
<div class="scroll"><table><thead><tr><th>Time</th><th>FM</th><th>Status</th><th>Artist</th><th>Song</th></tr></thead><tbody id="log"></tbody></table></div>
</section></main>
<script>
{
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const cls=s=>s==="SONG"?"SONG":s.startsWith("AD")?"AD":"NO";
const ago=t=>{if(!t)return"";const m=Math.floor((Date.now()/1000-t)/60);return m<1?"just started":m<60?m+" min":Math.floor(m/60)+" h "+(m%60)+" min"};
const clock=t=>new Date(t*1000).toLocaleTimeString([], {hour:"numeric",minute:"2-digit"});
let view="now",stationsLoaded=false;
async function loadNow(){
  const d=await (await fetch("/api/now",{cache:"no-store"})).json();
  if(d.error)throw new Error(d.error);
  $("upd").textContent="Checked "+clock(d.time)+" · updates by itself"+(d.logging?"":" · log not set up");
  $("grid").innerHTML=d.stations.map(r=>'<div class="card"><div class="top"><span class="freq">'+esc(r.freq)+'</span><span class="name">'+esc(r.name)+'<br>'+esc(r.fmt)+'</span></div>'+
   '<span class="pill '+cls(r.status)+'">'+esc(r.status)+'</span>'+
   (r.status==="SONG"?'<div class="title">'+esc(r.title)+'</div><div class="artist">'+esc(r.artist)+'</div>':'<div class="artist">'+esc(r.note||r.title||"")+'</div>')+
   '<div class="meta">'+(r.since?"On for "+ago(r.since)+" · ":"")+"via "+esc(r.src||"-")+'</div></div>').join("");
  if(!stationsLoaded){stationsLoaded=true;$("fStation").innerHTML+=d.stations.map(r=>'<option value="'+esc(r.freq)+'">'+esc(r.freq+" "+r.name)+'</option>').join("")}
}
async function loadLog(){
  const f=$("fStation").value,q=f?"&freq="+encodeURIComponent(f):"";
  $("dl").href="/log.csv"+(f?"?freq="+encodeURIComponent(f):"");
  const rows=await (await fetch("/api/log?limit=300"+q,{cache:"no-store"})).json();
  $("log").innerHTML=rows.length?rows.map(r=>'<tr><td>'+esc(new Date(r.t*1000).toLocaleString([], {month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}))+'</td><td>'+esc(r.freq)+'</td><td><span class="pill '+cls(r.status)+'">'+esc(r.status)+'</span></td><td class="w">'+esc(r.artist)+'</td><td class="w">'+esc(r.title)+'</td></tr>').join(""):'<tr><td colspan="5" class="empty">Nothing logged yet. The log fills in every minute once the database is connected.</td></tr>';
}
async function tick(){try{view==="now"?await loadNow():await loadLog()}catch(e){$("upd").textContent="Could not reach the feeds just now. Trying again…"}}
function show(v){view=v;$("vNow").hidden=v!=="now";$("vLog").hidden=v!=="log";$("tNow").setAttribute("aria-pressed",v==="now");$("tLog").setAttribute("aria-pressed",v==="log");tick()}
$("tNow").onclick=()=>show("now");$("tLog").onclick=()=>show("log");$("fStation").onchange=loadLog;
tick();setInterval(tick,30000);
}
</script></body></html>`;

