// Austin Radio Now - Cloudflare Worker
//
//   /                 The radio sheet: stations near any place (or your location),
//                     what's playing, genre, signal, a map, a player, and the Austin log
//   /austin           Opens the sheet on the Austin log tab
//   /log.csv          Austin log as a spreadsheet file
//   /api/geocode?q=   /api/reverse?lat&lon   /api/nearby?lat&lon
//   POST /api/playing (now playing for up to 6 stations)
//   POST /api/listen  (stream links for one station)
//   /api/stream?u=    (passes plain-http radio streams through, so phones will play them)
//   /api/log          Austin log (JSON)
//
// A cron trigger checks the Austin stations (a third each minute) and saves
// every change to a D1 database (binding: DB).

import { KEEP_DAYS, STATIONS, runCheck, readLog, fmtTime, csvCell } from "./austin.js";
import { geocode, reverse, nearby, playing, listen, proxyStream, toStation } from "./region.js";
import { debugStation } from "./nowplaying.js";
import { PAGE } from "./page.js";

const json = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

function coords(url) {
  const lat = parseFloat(url.searchParams.get("lat")), lon = parseFloat(url.searchParams.get("lon"));
  if (!(Math.abs(lat) <= 90 && Math.abs(lon) <= 180)) throw new Error("Bad coordinates");
  return [lat, lon];
}

// The Austin list, shared with the page so its rows can be played too
const AUSTIN = JSON.stringify(STATIONS.map(({ freq, call, name, fmt, tunein, iheart, icy }) => ({ freq, call, name, fmt, tunein, iheart, icy })));

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      switch (url.pathname) {
        case "/":
          return new Response(PAGE.replace("__AUSTIN__", AUSTIN.replace(/</g, "\\u003c")), { headers: { "content-type": "text/html; charset=utf-8" } });
        case "/austin": return Response.redirect(new URL("/#log", url).toString(), 302);
        case "/api/log": return json(await readLog(env, url));
        case "/log.csv": {
          if (!url.searchParams.get("limit")) url.searchParams.set("limit", "5000");
          const rows = await readLog(env, url);
          const lines = ["time (Austin),freq,station,status,artist,title,source",
            ...rows.map((r) => [fmtTime(r.t), r.freq, r.station, r.status, r.artist, r.title, r.src].map(csvCell).join(","))];
          return new Response(lines.join("\n"), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="austin-radio-log.csv"' } });
        }
        case "/api/geocode": return json(await geocode(url.searchParams.get("q")));
        case "/api/reverse": return json(await reverse(...coords(url)));
        case "/api/nearby": {
          const [lat, lon] = coords(url);
          return json({ stations: await nearby(lat, lon) });
        }
        case "/api/playing": {
          if (request.method !== "POST") return json({ error: "Use POST" }, 405);
          const list = await request.json();
          if (!Array.isArray(list)) return json({ error: "Expected a list" }, 400);
          return json(await playing(list));
        }
        case "/api/listen": {
          if (request.method !== "POST") return json({ error: "Use POST" }, 405);
          return json({ streams: await listen(await request.json()) });
        }
        case "/debug": {
          // e.g. /debug?call=KKMJ-FM&freq=95.5&city=Austin  - shows what each source says
          const q = Object.fromEntries(url.searchParams);
          const a = STATIONS.find((x) => x.freq === q.freq);
          return new Response(JSON.stringify(await debugStation(toStation({ ...(a || {}), ...q })), null, 2), { headers: { "content-type": "application/json" } });
        }
        case "/api/stream": return proxyStream(url.searchParams.get("u") || "", request);
        default: return new Response("Not found", { status: 404 });
      }
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      const minute = new Date(event.scheduledTime || Date.now()).getUTCMinutes();
      await runCheck(env, minute % 3);
      if (env.DB && minute === 0) {
        await env.DB.prepare("DELETE FROM plays WHERE t < ?").bind(Math.floor(Date.now() / 1000) - KEEP_DAYS * 86400).run();
      }
    })());
  },
};
