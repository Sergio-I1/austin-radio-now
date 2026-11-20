// Austin Radio Now - Cloudflare Worker
//
//   /              Radio near me: type a place or use your location, see nearby
//                  stations, what they're playing, genre, signal and a zone map
//   /austin        Austin / San Marcos live board + song log
//   /api/now       Austin live data (JSON)          /api/log   Austin log (JSON)
//   /log.csv       Austin log as a spreadsheet file
//   /api/geocode?q=   /api/reverse?lat&lon   /api/nearby?lat&lon   POST /api/playing
//
// A cron trigger checks the Austin stations every minute and saves changes
// to a D1 database (binding: DB).

import { KEEP_DAYS, runCheck, liveSnapshot, readLog, fmtTime, csvCell, AUSTIN_PAGE } from "./austin.js";
import { geocode, reverse, nearby, playing } from "./region.js";
import { REGION_PAGE } from "./regionPage.js";

const json = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const html = (s) => new Response(s, { headers: { "content-type": "text/html; charset=utf-8" } });

function coords(url) {
  const lat = parseFloat(url.searchParams.get("lat")), lon = parseFloat(url.searchParams.get("lon"));
  if (!(Math.abs(lat) <= 90 && Math.abs(lon) <= 180)) throw new Error("Bad coordinates");
  return [lat, lon];
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      switch (url.pathname) {
        case "/": return html(REGION_PAGE);
        case "/austin": return html(AUSTIN_PAGE);
        case "/api/now": return json(await liveSnapshot(env));
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
        default: return new Response("Not found", { status: 404 });
      }
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      await runCheck(env);
      if (env.DB && new Date().getUTCMinutes() === 0) {
        await env.DB.prepare("DELETE FROM plays WHERE t < ?").bind(Math.floor(Date.now() / 1000) - KEEP_DAYS * 86400).run();
      }
    })());
  },
};
