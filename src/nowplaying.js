// Shared "what's playing" logic: works for any station object shaped like
// { call, freq, name, place?, tunein?, iheart?, icy? }

export const SONG = "SONG", BREAK = "AD / TALK", NODATA = "NO DATA";
export const UA = "Mozilla/5.0 (compatible; austin-radio-now/1.0; +https://github.com/Sergio-I1/austin-radio-now)";
const NOT_MUSIC = /\b(commercial|advert\w*|sponsor\w*|ad ?break|ads?|promo|traffic|weather|news|station id|spot|liner|imaging|iheart\w*|audacy|tunein|listen live|on air|live stream)\b/i;

export const R = (status, artist = "", title = "", src = "", note = "") => ({ status, artist, title, src, note });

export function splitArtistTitle(text) {
  text = (text || "").trim();
  for (const sep of [" - ", " – ", " — ", " ~ "]) {
    const i = text.indexOf(sep);
    if (i > 0) return [text.slice(0, i).trim(), text.slice(i + sep.length).trim()];
  }
  return ["", text];
}

export function classify(artist, title, st) {
  if (!artist) return BREAK; // slogan, station name, show name, or nothing at all
  const whole = `${artist} ${title}`.toLowerCase();
  if (NOT_MUSIC.test(artist)) return BREAK;
  const call = st.call.split("-")[0].toLowerCase();
  if (whole.includes(call) || (st.name && whole.includes(st.name.toLowerCase()))) return BREAK;
  return SONG;
}

export async function getJSON(url) {
  const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8000) });
  if (r.status === 204) return null;
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const t = await r.text();
  return t.trim() ? JSON.parse(t) : null;
}

// ---------------------------------------------------------------------------
// Source 1: iHeartRadio (exact, knows when a break is on)
// ---------------------------------------------------------------------------
const iheartIds = new Map();
async function iheartNow(st) {
  if (!st.iheart) return null;
  let id = iheartIds.get(st.iheart);
  if (id === undefined) {
    const d = await getJSON(`https://us.api.iheart.com/api/v2/content/liveStations?callLetters=${encodeURIComponent(st.iheart)}&limit=5`);
    id = d?.hits?.[0]?.id ?? null;
    iheartIds.set(st.iheart, id);
  }
  if (!id) return null;
  const d = await getJSON(`https://us.api.iheart.com/api/v3/live-meta/stream/${id}/currentTrackMeta`);
  if (!d) return R(BREAK, "", "", "iHeart", "No song on air");
  const artist = (d.artist || "").trim(), title = (d.title || "").trim();
  let end = d.endDate;
  if (end) {
    if (end > 1e12) end /= 1000;
    if (Date.now() / 1000 > end + 30) return R(BREAK, "", "", "iHeart", `Last song: ${artist} - ${title}`);
  }
  return R(classify(artist, title, st), artist, title, "iHeart");
}

// ---------------------------------------------------------------------------
// Source 2: "now playing" tag inside the audio stream (ICY metadata)
// ---------------------------------------------------------------------------
async function icyNow(st) {
  if (!st.icy) return null;
  const r = await fetch(st.icy, { headers: { "Icy-MetaData": "1", "User-Agent": UA }, signal: AbortSignal.timeout(8000) });
  const metaint = parseInt(r.headers.get("icy-metaint") || "0", 10);
  if (!metaint || !r.body) { await r.body?.cancel(); return null; }
  const reader = r.body.getReader();
  const chunks = []; let have = 0;
  const need = async (n) => { while (have < n) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); have += value.length; } };
  try {
    await need(metaint + 1);
    if (have < metaint + 1) return null;
    let buf = concat(chunks, have);
    const len = buf[metaint] * 16;
    await need(metaint + 1 + len);
    buf = concat(chunks, have);
    const meta = new TextDecoder().decode(buf.subarray(metaint + 1, metaint + 1 + len));
    const tag = (meta.match(/StreamTitle='(.*?)';/) || [, ""])[1].trim();
    const [artist, title] = splitArtistTitle(tag);
    return R(classify(artist, title, st), artist, title, "Stream tag", artist ? "" : tag);
  } finally {
    reader.cancel().catch(() => {});
  }
}
function concat(chunks, total) {
  const out = new Uint8Array(total); let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}

// ---------------------------------------------------------------------------
// Source 3: TuneIn directory (covers almost every station)
// ---------------------------------------------------------------------------
const tuneinIds = new Map();
function* flatten(items) { for (const x of items || []) { yield x; yield* flatten(x.children); } }

async function tuneinNow(st) {
  const query = st.tunein || `${st.call.split("-")[0]} ${st.freq}`;
  const d = await getJSON(`https://opml.radiotime.com/Search.ashx?render=json&query=${encodeURIComponent(query)}`);
  const items = [...flatten(d?.body)].filter((x) => x.type === "audio" && String(x.guide_id || "").startsWith("s"));
  if (!items.length) return null;
  const key = `${st.call}|${st.freq}`;
  let pick = items.find((x) => x.guide_id === tuneinIds.get(key));
  if (!pick) {
    const call = st.call.split("-")[0].toLowerCase();
    const place = (st.place || "").toLowerCase();
    const score = (x) => {
      const t = `${x.text || ""} ${x.URL || ""} ${x.subtext || ""}`.toLowerCase();
      return (t.includes(st.freq) ? 2 : 0) + (t.includes(call) ? 2 : 0) + (place && t.includes(place) ? 1 : 0);
    };
    pick = items.reduce((a, b) => (score(b) > score(a) ? b : a));
    if (score(pick) < 2) return null;
    tuneinIds.set(key, pick.guide_id);
  }
  const tag = (pick.playing || pick.subtext || "").trim();
  const [artist, title] = splitArtistTitle(tag);
  const r = R(classify(artist, title, st), artist, title, "TuneIn", artist ? "" : tag);
  r.stationName = (pick.text || "").replace(/\s*\(.*\)\s*$/, "");
  return r;
}

export async function checkStation(st) {
  const errors = [];
  for (const fn of [iheartNow, icyNow, tuneinNow]) {
    try { const r = await fn(st); if (r) return r; }
    catch (e) { errors.push(`${fn.name.replace("Now", "")}: ${e.name === "TimeoutError" ? "timeout" : e.message}`); }
  }
  return R(NODATA, "", "", "", errors.join("; ") || "No live song info for this station");
}

// ---------------------------------------------------------------------------
// Song genre (Pop, Country, Hip-Hop/Rap...) from Apple's public iTunes search
// ---------------------------------------------------------------------------
const genreMemo = new Map();
export async function songGenre(artist, title) {
  if (!artist || !title) return "";
  const k = `${artist}|${title}`.toLowerCase();
  if (genreMemo.has(k)) return genreMemo.get(k);
  let g = "";
  try {
    const d = await getJSON(`https://itunes.apple.com/search?entity=song&limit=1&country=US&term=${encodeURIComponent(`${artist} ${title}`)}`);
    g = d?.results?.[0]?.primaryGenreName || "";
  } catch { g = ""; }
  if (genreMemo.size > 5000) genreMemo.clear();
  genreMemo.set(k, g);
  return g;
}
