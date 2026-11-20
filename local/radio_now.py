#!/usr/bin/env python3
"""
radio_now.py - live "what's playing right now" board for Austin / San Marcos FM radio.

What it does
  * Every 30 seconds it checks each station below (88.7 -> 100.7 FM).
  * Shows SONG (artist - title) or AD / TALK (commercial, DJ, news, no song info).
  * Live table in the terminal AND a web page you can open on your phone
    (same Wi-Fi) that refreshes by itself.
  * Every change is added to radio_log.csv (open it in Excel / Google Sheets).

Run it
  python radio_now.py                 (default: every 30 s, web page on port 8000)
  python radio_now.py --interval 20   (check more often)
  python radio_now.py --no-web        (terminal only)
Stop it with Ctrl+C.

No installs needed: only the Python standard library (Python 3.8+).

Where the info comes from (tried in this order, first one that answers wins)
  1. iHeartRadio live metadata  (KHFI, KVET, KASE - most exact, knows when ads play)
  2. The station's own audio stream "now playing" tag (KUTX)
  3. TuneIn's public station directory, which lists the current song for most stations
These are public but unofficial feeds, so a station can show NO DATA if a feed changes.
To add or remove a station, edit the STATIONS list.
"""

import argparse
import csv
import json
import os
import re
import socket
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# ----------------------------------------------------------------------------
# Stations (Austin / San Marcos area, roughly 88 to 100 FM)
#   iheart : iHeart call letters (only for iHeartMedia stations)
#   icy    : direct audio stream URL that carries a "now playing" tag
#   tunein : what to search on TuneIn
# ----------------------------------------------------------------------------
STATIONS = [
    {"freq": "88.7",  "call": "KAZI",    "name": "KAZI 88.7",            "fmt": "Urban / community",   "tunein": "KAZI 88.7"},
    {"freq": "89.5",  "call": "KMFA",    "name": "KMFA Classical",       "fmt": "Classical",           "tunein": "KMFA"},
    {"freq": "89.9",  "call": "KTSW",    "name": "KTSW (Texas State)",   "fmt": "College radio",       "tunein": "KTSW"},
    {"freq": "91.7",  "call": "KVRX",    "name": "KVRX (UT student)",    "fmt": "College radio",       "tunein": "KVRX"},
    {"freq": "93.3",  "call": "KGSR",    "name": "93.3 KGSR",            "fmt": "Changed hands 2026",  "tunein": "KGSR 93.3"},
    {"freq": "93.7",  "call": "KLBJ-FM", "name": "93.7 KLBJ",            "fmt": "Classic rock",        "tunein": "KLBJ-FM"},
    {"freq": "94.7",  "call": "KAMX",    "name": "Mix 94.7",             "fmt": "Pop (hot AC)",        "tunein": "KAMX Mix 94.7"},
    {"freq": "95.5",  "call": "KKMJ",    "name": "Majic 95.5",           "fmt": "Soft pop (AC)",       "tunein": "KKMJ Majic 95.5"},
    {"freq": "95.9",  "call": "KOKE",    "name": "95.9 Texas Country",   "fmt": "Texas country",       "tunein": "KOKE-FM"},
    {"freq": "96.7",  "call": "KHFI",    "name": "96.7 Kiss FM",         "fmt": "Top 40",              "tunein": "KHFI Kiss FM", "iheart": "KHFI-FM"},
    {"freq": "98.1",  "call": "KVET",    "name": "98.1 KVET",            "fmt": "Country",             "tunein": "KVET-FM",      "iheart": "KVET-FM"},
    {"freq": "98.9",  "call": "KUTX",    "name": "KUTX 98.9",            "fmt": "Austin music / indie", "tunein": "KUTX",
     "icy": "https://streams.kut.org/4430_192.mp3"},
    {"freq": "100.1", "call": "KTSN",    "name": "Sun Radio",            "fmt": "Americana",           "tunein": "Sun Radio Austin"},
    {"freq": "100.7", "call": "KASE",    "name": "KASE 100.7",           "fmt": "Country",             "tunein": "KASE 100.7",   "iheart": "KASE-FM"},
    # Past 100 FM - remove the # to add them:
    # {"freq": "102.3", "call": "KPEZ", "name": "102.3 The Beat", "fmt": "Hip-hop / R&B", "tunein": "KPEZ", "iheart": "KPEZ-FM"},
    # {"freq": "103.5", "call": "KBPA", "name": "103.5 Bob FM",   "fmt": "Variety hits",  "tunein": "KBPA Bob FM"},
]

SONG, BREAK, NODATA = "SONG", "AD / TALK", "NO DATA"
UA = "Mozilla/5.0 (X11; Linux x86_64) radio_now/1.0"
LOG_FILE = "radio_log.csv"

# Words that mean "this is not a song" when they show up as the artist / whole tag
NOT_MUSIC = re.compile(
    r"\b(commercial|advert\w*|sponsor\w*|ad ?break|ads?|promo|traffic|weather|news|"
    r"station id|spot|liner|imaging|iheart\w*|audacy|tunein|listen live|on air|live stream)\b",
    re.I,
)

# ----------------------------------------------------------------------------
# Small HTTP helpers
# ----------------------------------------------------------------------------

def http_get(url, headers=None, timeout=10):
    req = urllib.request.Request(url, headers={"User-Agent": UA, **(headers or {})})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.status, r.read()


def read_exact(resp, n):
    buf = b""
    while len(buf) < n:
        chunk = resp.read(n - len(buf))
        if not chunk:
            break
        buf += chunk
    return buf


def split_artist_title(text):
    """'Artist - Title' -> (artist, title). Returns ('', text) when there is no dash."""
    text = (text or "").strip()
    for sep in (" - ", " – ", " — ", " ~ "):
        if sep in text:
            a, t = text.split(sep, 1)
            return a.strip(), t.strip()
    return "", text


def classify(artist, title, st):
    """Decide if the item is a real song or a break (ad, DJ talk, news, station ID)."""
    if not title and not artist:
        return BREAK
    if not artist:  # just a slogan / station name / show name with no artist
        return BREAK
    whole = f"{artist} {title}"
    if NOT_MUSIC.search(artist):
        return BREAK
    if st["call"].split("-")[0].lower() in whole.lower() or st["name"].lower() in whole.lower():
        return BREAK
    return SONG


def result(st, status, artist="", title="", src="", note=""):
    return {"status": status, "artist": artist, "title": title, "src": src, "note": note}

# ----------------------------------------------------------------------------
# Source 1: iHeartRadio
# ----------------------------------------------------------------------------
_iheart_ids = {}


def iheart_now(st):
    cl = st.get("iheart")
    if not cl:
        return None
    sid = _iheart_ids.get(cl)
    if sid is None:
        q = urllib.parse.urlencode({"callLetters": cl, "limit": 5})
        _, body = http_get(f"https://us.api.iheart.com/api/v2/content/liveStations?{q}")
        hits = json.loads(body).get("hits", [])
        if not hits:
            return None
        sid = hits[0]["id"]
        _iheart_ids[cl] = sid
    status, body = http_get(f"https://us.api.iheart.com/api/v3/live-meta/stream/{sid}/currentTrackMeta")
    if status == 204 or not body.strip():
        return result(st, BREAK, src="iHeart", note="No song on air")
    d = json.loads(body)
    artist, title = (d.get("artist") or "").strip(), (d.get("title") or "").strip()
    end = d.get("endDate")
    if end:
        end = end / 1000 if end > 1e12 else end
        if time.time() > end + 30:  # song already ended -> something else is on
            return result(st, BREAK, src="iHeart", note=f"Last song: {artist} - {title}")
    return result(st, classify(artist, title, st), artist, title, "iHeart")

# ----------------------------------------------------------------------------
# Source 2: "now playing" tag inside the audio stream (ICY metadata)
# ----------------------------------------------------------------------------

def icy_now(st):
    url = st.get("icy")
    if not url:
        return None
    req = urllib.request.Request(url, headers={"Icy-MetaData": "1", "User-Agent": UA})
    with urllib.request.urlopen(req, timeout=10) as r:
        metaint = int(r.headers.get("icy-metaint") or 0)
        if not metaint:
            return None
        read_exact(r, metaint)
        length = read_exact(r, 1)
        if not length:
            return None
        meta = read_exact(r, length[0] * 16).decode("utf-8", "replace")
    m = re.search(r"StreamTitle='(.*?)';", meta)
    tag = m.group(1).strip() if m else ""
    artist, title = split_artist_title(tag)
    return result(st, classify(artist, title, st), artist, title, "Stream tag",
                  "" if artist else tag)

# ----------------------------------------------------------------------------
# Source 3: TuneIn directory
# ----------------------------------------------------------------------------
_tunein_ids = {}


def _flatten(items):
    for x in items or []:
        yield x
        yield from _flatten(x.get("children"))


def tunein_now(st):
    q = urllib.parse.urlencode({"query": st["tunein"], "render": "json"})
    _, body = http_get(f"https://opml.radiotime.com/Search.ashx?{q}")
    items = [x for x in _flatten(json.loads(body).get("body"))
             if x.get("type") == "audio" and x.get("guide_id", "").startswith("s")]
    if not items:
        return None
    gid = _tunein_ids.get(st["call"])
    pick = next((x for x in items if x.get("guide_id") == gid), None)
    if pick is None:
        call = st["call"].split("-")[0].lower()

        def score(x):
            text = (x.get("text", "") + " " + x.get("URL", "")).lower()
            return (st["freq"] in text) * 2 + (call in text) * 2 + ("austin" in text or "san marcos" in text)

        pick = max(items, key=score)
        if score(pick) == 0:
            return None
        _tunein_ids[st["call"]] = pick.get("guide_id")
    tag = (pick.get("playing") or pick.get("subtext") or "").strip()
    artist, title = split_artist_title(tag)
    return result(st, classify(artist, title, st), artist, title, "TuneIn",
                  "" if artist else tag)

# ----------------------------------------------------------------------------
# Polling + state
# ----------------------------------------------------------------------------
SOURCES = (iheart_now, icy_now, tunein_now)
state = {}            # call -> dict shown in the table
recent = []           # last changes (newest first)
lock = threading.Lock()


def check_station(st):
    errors = []
    for fn in SOURCES:
        try:
            r = fn(st)
            if r:
                return r
        except Exception as e:  # network error, feed changed, etc.
            errors.append(f"{fn.__name__.split('_')[0]}: {type(e).__name__}")
    return result(st, NODATA, note="; ".join(errors) or "No feed found")


def log_row(row):
    new_file = not os.path.exists(LOG_FILE)
    with open(LOG_FILE, "a", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        if new_file:
            w.writerow(["time", "freq", "station", "status", "artist", "title", "source"])
        w.writerow([row["time"], row["freq"], row["name"], row["status"],
                    row["artist"], row["title"], row["src"]])


def poll_once():
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(check_station, STATIONS))
    now = datetime.now()
    with lock:
        for st, r in zip(STATIONS, results):
            old = state.get(st["call"])
            key = (r["status"], r["artist"].lower(), r["title"].lower())
            changed = old is None or old["key"] != key
            state[st["call"]] = {
                **st, **r, "key": key,
                "since": now.strftime("%H:%M:%S") if changed else old["since"],
                "since_ts": now.timestamp() if changed else old["since_ts"],
                "updated": now.strftime("%H:%M:%S"),
            }
            if changed and r["status"] != NODATA:
                row = {"time": now.strftime("%Y-%m-%d %H:%M:%S"), "freq": st["freq"], "name": st["name"],
                       "status": r["status"], "artist": r["artist"], "title": r["title"], "src": r["src"]}
                recent.insert(0, row)
                del recent[200:]
                log_row(row)


def snapshot():
    with lock:
        rows = [{k: v for k, v in state[s["call"]].items() if k != "key"}
                for s in STATIONS if s["call"] in state]
        return {"stations": rows, "recent": recent[:60], "time": datetime.now().strftime("%H:%M:%S")}

# ----------------------------------------------------------------------------
# Terminal view
# ----------------------------------------------------------------------------

def cut(s, n):
    s = s or ""
    return s if len(s) <= n else s[: n - 1] + "…"


def print_table(url):
    snap = snapshot()
    out = ["\033[2J\033[H", f"Austin / San Marcos radio - now playing   (updated {snap['time']})"]
    if url:
        out.append(f"Phone / browser: {url}     Log: {os.path.abspath(LOG_FILE)}")
    out.append("")
    out.append(f"{'FM':>5}  {'STATION':<20} {'STATUS':<9} {'ARTIST':<24} {'SONG':<30} {'SINCE':<8} SOURCE")
    out.append("-" * 112)
    for r in snap["stations"]:
        color = {"SONG": "\033[32m", BREAK: "\033[33m"}.get(r["status"], "\033[90m")
        song = r["title"] if r["status"] == SONG else (r["note"] or r["title"])
        out.append(f"{r['freq']:>5}  {cut(r['name'], 20):<20} {color}{cut(r['status'], 9):<9}\033[0m "
                   f"{cut(r['artist'], 24):<24} {cut(song, 30):<30} {r['since']:<8} {r['src']}")
    out.append("")
    out.append("Ctrl+C to stop.")
    sys.stdout.write("\n".join(out) + "\n")
    sys.stdout.flush()

# ----------------------------------------------------------------------------
# Web page (open on your phone on the same Wi-Fi)
# ----------------------------------------------------------------------------
PAGE = r"""<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Austin radio now</title>
<style>
:root{color-scheme:light dark;--bg:light-dark(#fbf7f0,#121212);--ink:light-dark(#1b1b1b,#eee);--mute:light-dark(#6b6b6b,#9a9a9a);
--line:light-dark(#e3ddd2,#2a2a2a);--song:#1f8a4c;--brk:#c77700;--nod:#888;--card:light-dark(#fff,#1c1c1c)}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 system-ui,-apple-system,Segoe UI,sans-serif}
header{padding:18px 16px 8px}h1{margin:0;font-size:24px}small{color:var(--mute)}
main{padding:0 12px 24px;max-width:1100px;margin:auto}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 14px}
.top{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
.freq{font-size:22px;font-weight:800}.name{color:var(--mute);font-size:13px;text-align:right}
.pill{display:inline-block;margin:8px 0 4px;padding:2px 8px;border-radius:99px;font-size:12px;font-weight:700;color:#fff}
.SONG{background:var(--song)}.AD{background:var(--brk)}.NO{background:var(--nod)}
.title{font-weight:700;font-size:16px}.artist{font-size:14px}.meta{color:var(--mute);font-size:12px;margin-top:6px}
h2{font-size:17px;margin:22px 4px 8px}table{width:100%;border-collapse:collapse;font-size:13px}
td,th{padding:6px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}th{color:var(--mute);font-weight:600}
a{color:inherit}
</style></head><body>
<header><h1>Austin / San Marcos radio, right now</h1><small id="upd">Loading…</small></header>
<main><div class="grid" id="grid"></div>
<h2>Recent changes</h2><table><thead><tr><th>Time</th><th>FM</th><th>Status</th><th>Artist / song</th></tr></thead><tbody id="log"></tbody></table>
<p><small><a href="/radio_log.csv">Download full log (CSV)</a></small></p></main>
<script>
{const esc=s=>(s||"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const cls=s=>s==="SONG"?"SONG":s.startsWith("AD")?"AD":"NO";
const ago=t=>{const m=Math.floor((Date.now()/1000-t)/60);return m<1?"just now":m+" min"};
async function load(){try{const d=await (await fetch("/data.json",{cache:"no-store"})).json();
document.getElementById("upd").textContent="Updated "+d.time+" · refreshes by itself";
document.getElementById("grid").innerHTML=d.stations.map(r=>`<div class="card"><div class="top"><span class="freq">${esc(r.freq)}</span><span class="name">${esc(r.name)}<br>${esc(r.fmt)}</span></div>
<span class="pill ${cls(r.status)}">${esc(r.status)}</span>
${r.status==="SONG"?`<div class="title">${esc(r.title)}</div><div class="artist">${esc(r.artist)}</div>`:`<div class="artist">${esc(r.note||r.title)}</div>`}
<div class="meta">On for ${ago(r.since_ts)} · via ${esc(r.src||"-")}</div></div>`).join("");
document.getElementById("log").innerHTML=d.recent.map(r=>`<tr><td>${esc(r.time.slice(11,16))}</td><td>${esc(r.freq)}</td><td>${esc(r.status)}</td><td>${r.status==="SONG"?esc(r.artist)+" – "+esc(r.title):esc(r.title)}</td></tr>`).join("");
}catch(e){document.getElementById("upd").textContent="Lost connection to the script - is it still running?"}}
load();setInterval(load,10000);}
</script></body></html>"""


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, body, ctype):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/":
            self._send(200, PAGE.encode(), "text/html; charset=utf-8")
        elif path == "/data.json":
            self._send(200, json.dumps(snapshot()).encode(), "application/json")
        elif path == "/radio_log.csv" and os.path.exists(LOG_FILE):
            with open(LOG_FILE, "rb") as f:
                self._send(200, f.read(), "text/csv; charset=utf-8")
        else:
            self._send(404, b"Not found", "text/plain")

    def log_message(self, *args):  # keep the terminal clean
        pass


def lan_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))  # no data is sent; just picks the Wi-Fi address
        ip = s.getsockname()[0]
        s.close()
        return ip
    except OSError:
        return "localhost"


def main():
    ap = argparse.ArgumentParser(description="Live now-playing board for Austin radio")
    ap.add_argument("--interval", type=int, default=30, help="seconds between checks (default 30)")
    ap.add_argument("--port", type=int, default=8000, help="web page port (default 8000)")
    ap.add_argument("--no-web", action="store_true", help="terminal only, no web page")
    args = ap.parse_args()
    if os.name == "nt":
        os.system("")  # turn on colors in Windows terminals

    url = ""
    if not args.no_web:
        server = ThreadingHTTPServer(("0.0.0.0", args.port), Handler)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        url = f"http://{lan_ip()}:{args.port}"

    print("Checking stations for the first time…")
    try:
        while True:
            start = time.time()
            poll_once()
            print_table(url)
            time.sleep(max(5, args.interval - (time.time() - start)))
    except KeyboardInterrupt:
        print(f"\nStopped. Your log is in {os.path.abspath(LOG_FILE)}")


if __name__ == "__main__":
    main()
