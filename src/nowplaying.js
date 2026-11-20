// Shared "what's playing" logic for any station shaped like
// { call, freq, name?, place?, tunein?, iheart?, icy? }
//
// Order of sources (most accurate first):
//   1. iHeartRadio live data          - exact, knows when an ad break is on
//   2. The station's own audio stream - the tag that's on air right now
//      (ICY "StreamTitle", or Triton's now-playing feed for StreamTheWorld streams)
//   3. TuneIn's directory listing     - covers almost everything, sometimes lags

export const SONG = "SONG", BREAK = "AD / TALK", NODATA = "NO DATA";
export const UA = "Mozilla/5.0 (compatible; austin-radio-now/1.1; +https://github.com/Sergio-I1/austin-radio-now)";
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
  if (!artist || !title) return BREAK; // slogan, station name, show name, or nothing
  const whole = `${artist} ${title}`.toLowerCase();
  if (NOT_MUSIC.test(artist)) return BREAK;
  const call = st.call.split("-")[0].toLowerCase();
  if (call.length > 2 && (artist.toLowerCase().includes(call) || title.toLowerCase() === call)) return BREAK;
  if (st.name && whole.includes(st.name.toLowerCase())) return BREAK;
  return SONG;
}

export async function getText(url, ms = 8000) {
  const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(ms) });
  if (r.status === 204) return "";
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}
export async function getJSON(url) {
  const t = await getText(url);
  return t.trim() ? JSON.parse(t) : null;
}

const memo = new Map();
function cached(key, ms) { const c = memo.get(key); return c && Date.now() - c.at < ms ? c.data : undefined; }
function store(key, data) { if (memo.size > 4000) memo.clear(); memo.set(key, { at: Date.now(), data }); return data; }

// ---------------------------------------------------------------------------
// iHeartRadio
// ---------------------------------------------------------------------------
async function iheartStation(st) {
  if (!st.iheart) return null;
  const key = "ih:" + st.iheart;
  const hit = cached(key, 12 * 36e5); if (hit !== undefined) return hit;
  const d = await getJSON(`https://us.api.iheart.com/api/v2/content/liveStations?callLetters=${encodeURIComponent(st.iheart)}&limit=5`);
  const h = d?.hits?.[0];
  return store(key, h ? { id: h.id, name: h.name, streams: h.streams || {} } : null);
}

async function iheartNow(st) {
  const h = await iheartStation(st);
  if (!h) return null;
  const d = await getJSON(`https://us.api.iheart.com/api/v3/live-meta/stream/${h.id}/currentTrackMeta`);
  if (!d) return { ...R(BREAK, "", "", "iHeart", "Ad, DJ or news"), stationName: h.name };
  const artist = (d.artist || "").trim(), title = (d.title || "").trim();
  let end = d.endDate;
  if (end) {
    if (end > 1e12) end /= 1000;
    if (Date.now() / 1000 > end + 30) return { ...R(BREAK, "", "", "iHeart", `Ad, DJ or news (last song: ${artist} - ${title})`), stationName: h.name };
  }
  return { ...R(classify(artist, title, st), artist, title, "iHeart"), stationName: h.name };
}

// ---------------------------------------------------------------------------
// TuneIn: find the station, its listing text, and its stream links
// ---------------------------------------------------------------------------
function* flatten(items) { for (const x of items || []) { yield x; yield* flatten(x.children); } }

async function tuneinPick(st) {
  const query = st.tunein || `${st.call.split("-")[0]} ${st.freq}`;
  const sk = "tis:" + query;
  let d = cached(sk, 60000);
  if (d === undefined) d = store(sk, await getJSON(`https://opml.radiotime.com/Search.ashx?render=json&query=${encodeURIComponent(query)}`));
  const items = [...flatten(d?.body)].filter((x) => x.type === "audio" && String(x.guide_id || "").startsWith("s"));
  if (!items.length) return null;
  const key = "ti:" + st.call + "|" + st.freq;
  const known = cached(key, 7 * 864e5);
  let pick = known && items.find((x) => x.guide_id === known);
  if (!pick) {
    const call = st.call.split("-")[0].toLowerCase();
    const place = (st.place || "").toLowerCase();
    const score = (x) => {
      const t = `${x.text || ""} ${x.URL || ""} ${x.subtext || ""}`.toLowerCase();
      return (t.includes(st.freq) ? 2 : 0) + (t.includes(call) ? 2 : 0) + (place && t.includes(place) ? 1 : 0);
    };
    pick = items.reduce((a, b) => (score(b) > score(a) ? b : a));
    if (score(pick) < 2) return null;
    store(key, pick.guide_id);
  }
  return pick;
}

async function tuneinNow(st) {
  const pick = await tuneinPick(st);
  if (!pick) return null;
  const tag = (pick.playing || pick.subtext || "").trim();
  const [artist, title] = splitArtistTitle(tag);
  const status = classify(artist, title, st);
  return { ...R(status, artist, title, "TuneIn listing", status === SONG ? "" : tag), stationName: cleanName(pick.text) };
}
const cleanName = (s) => (s || "").replace(/\s*\(.*\)\s*$/, "").trim();

// ---------------------------------------------------------------------------
// Stream links for a station (used for both "now playing" and listening)
// ---------------------------------------------------------------------------
export async function streamsFor(st) {
  const key = "streams:" + st.call + "|" + st.freq;
  const hit = cached(key, 6 * 36e5); if (hit) return hit;
  const urls = [];
  if (st.icy) urls.push(st.icy);
  try {
    const h = await iheartStation(st);
    const s = h?.streams || {};
    for (const k of ["secure_shoutcast_stream", "shoutcast_stream", "secure_hls_stream", "hls_stream"]) if (s[k]) urls.push(s[k]);
  } catch {}
  if (urls.length < 2) {
    try {
      const pick = await tuneinPick(st);
      if (pick?.guide_id) {
        const d = await getJSON(`https://opml.radiotime.com/Tune.ashx?render=json&formats=mp3,aac,hls&id=${pick.guide_id}`);
        for (const x of d?.body || []) if (x.url && /^https?:/.test(x.url) && !/\.(pls|m3u)(\?|$)/i.test(x.url)) urls.push(x.url);
      }
    } catch {}
  }
  const out = [...new Set(urls)];
  return out.length ? store(key, out) : out;
}

// ICY metadata: the "now playing" text sent inside the audio stream itself
export function parseIcy(meta) {
  const title = (meta.match(/StreamTitle='(.*?)';/) || [])[1] || "";
  const url = (meta.match(/StreamUrl='(.*?)';/) || [])[1] || "";
  const attr = (s, k) => (s.match(new RegExp(`${k}="([^"]*)"`)) || [])[1];
  let artist, song;
  if (/text="/.test(title)) { song = attr(title, "text") || ""; artist = attr(title, "artist") || attr(url, "artist") || ""; }
  else [artist, song] = splitArtistTitle(title);
  const spot = attr(title, "song_spot") || attr(url, "song_spot") || "";
  return { artist: artist.trim(), song: song.trim(), isSpot: !!spot && !/^[MF]$/i.test(spot), raw: title };
}

async function icyRead(url) {
  const r = await fetch(url, { headers: { "Icy-MetaData": "1", "User-Agent": UA }, signal: AbortSignal.timeout(7000) });
  const metaint = parseInt(r.headers.get("icy-metaint") || "0", 10);
  if (!r.ok || !metaint || !r.body) { await r.body?.cancel().catch(() => {}); return null; }
  const reader = r.body.getReader();
  const chunks = []; let have = 0;
  const need = async (n) => { while (have < n) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); have += value.length; } };
  try {
    await need(metaint + 1);
    if (have < metaint + 1) return null;
    let buf = concat(chunks, have);
    const len = buf[metaint] * 16;
    if (!len) return { artist: "", song: "", isSpot: false, raw: "" };
    await need(metaint + 1 + len);
    buf = concat(chunks, have);
    return parseIcy(new TextDecoder().decode(buf.subarray(metaint + 1, metaint + 1 + len)));
  } finally { reader.cancel().catch(() => {}); }
}
function concat(chunks, total) { const out = new Uint8Array(total); let o = 0; for (const c of chunks) { out.set(c, o); o += c.length; } return out; }

// Triton Digital (StreamTheWorld) public now-playing feed
export function parseTriton(xml) {
  const prop = (n) => ((xml.match(new RegExp(`<property name="${n}"><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></property>`)) || [])[1] || "").trim();
  return { song: prop("cue_title"), artist: prop("track_artist_name"), start: +prop("cue_time_start") || 0, dur: +prop("cue_time_duration") || 0 };
}
async function tritonNow(url, st) {
  const seg = new URL(url).pathname.split("/").pop().replace(/\.(aac|mp3)$/i, "").replace(/_SC$/i, "");
  for (const mount of [...new Set([seg, seg.replace(/AAC$/i, "")])]) {
    if (!mount) continue;
    const xml = await getText(`https://np.tritondigital.com/public/nowplaying?mountName=${encodeURIComponent(mount)}&numberToFetch=1&eventType=track`);
    if (!/nowplaying-info/.test(xml)) continue;
    const t = parseTriton(xml);
    if (t.start && t.dur && Date.now() > t.start + t.dur + 60000) return R(BREAK, "", "", "Station stream", `Ad, DJ or news (last song: ${t.artist} - ${t.song})`);
    return R(classify(t.artist, t.song, st), t.artist, t.song, "Station stream");
  }
  return null;
}

async function streamNow(st) {
  const urls = (await streamsFor(st)).filter((u) => !/\.m3u8(\?|$)/i.test(u)).slice(0, 2);
  for (const u of urls) {
    try {
      if (/streamtheworld\.com/i.test(u)) { const t = await tritonNow(u, st); if (t) return t; continue; }
      const m = await icyRead(u);
      if (!m) continue;
      if (m.isSpot) return R(BREAK, "", "", "Station stream", "Ad, DJ or news");
      if (!m.artist && !m.song) continue; // stream sends no song tags; try the next source
      const status = classify(m.artist, m.song, st);
      return R(status, m.artist, m.song, "Station stream", status === SONG ? "" : m.raw);
    } catch {}
  }
  return null;
}

// ---------------------------------------------------------------------------
export async function checkStation(st) {
  const r = await checkSources(st);
  if (!r.stationName) { try { const p = await tuneinPick(st); if (p) r.stationName = cleanName(p.text); } catch {} }
  return r;
}

async function checkSources(st) {
  const errors = [];
  let best = null;
  for (const fn of [iheartNow, streamNow, tuneinNow]) {
    try {
      const r = await fn(st);
      if (!r) continue;
      if (r.status === SONG) return { ...best, ...r, stationName: r.stationName || best?.stationName };
      best = best || r; // keep a break/talk answer, but let a later source find a song
      if (fn === iheartNow) return r; // iHeart is exact about breaks
    } catch (e) { errors.push(`${fn.name.replace("Now", "")}: ${e.name === "TimeoutError" ? "timeout" : e.message}`); }
  }
  return best || R(NODATA, "", "", "", errors.length ? "Couldn't reach this station's info" : "No live song info for this station");
}

// Song genre (Pop, Country, Holiday...) from Apple's public iTunes search
export async function songGenre(artist, title) {
  if (!artist || !title) return "";
  const k = `genre:${artist}|${title}`.toLowerCase();
  const hit = cached(k, 30 * 864e5); if (hit !== undefined) return hit;
  let g = "";
  try {
    const d = await getJSON(`https://itunes.apple.com/search?entity=song&limit=1&country=US&term=${encodeURIComponent(`${artist} ${title}`)}`);
    g = d?.results?.[0]?.primaryGenreName || "";
  } catch { return ""; }
  return store(k, g);
}

// For troubleshooting one station: what every source says, and its stream links
export async function debugStation(st) {
  const out = { station: st, sources: {} };
  for (const fn of [iheartNow, streamNow, tuneinNow]) {
    try { out.sources[fn.name] = (await fn(st)) || "no answer"; }
    catch (e) { out.sources[fn.name] = "error: " + e.message; }
  }
  try { out.streams = await streamsFor(st); } catch (e) { out.streams = "error: " + e.message; }
  for (const u of (Array.isArray(out.streams) ? out.streams : []).slice(0, 3)) {
    try {
      if (/streamtheworld\.com/i.test(u)) out.sources["triton " + u] = (await tritonNow(u, st)) || "no answer";
      else out.sources["icy " + u] = (await icyRead(u)) || "no tag in stream";
    } catch (e) { out.sources["stream " + u] = "error: " + e.message; }
  }
  return out;
}
