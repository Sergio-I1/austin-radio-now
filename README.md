# Austin Radio Now

A live board showing what's playing on Austin and San Marcos FM radio (88.7 to 100.7). For each station it shows the current song, or **AD / TALK** when a commercial, DJ or news segment is on. It also keeps a log of everything that played, which you can download as a spreadsheet (CSV).

It runs for free on Cloudflare Workers, so you can open it from your phone anywhere. No laptop has to stay on.

## Two pages

- **`/` - Radio near me.** Type a city, ZIP or address, or tap **Use my location**. It finds every FM tower near you (from the FCC's station database), estimates how well you can hear each one, and shows what's playing with the song's genre (Pop, Country, Hip-Hop/Rap...). Tap a genre to filter.
  - **Map tab** shows the towers, colored by how strong they are where you are.
  - **Advanced: signal zones** draws rings for a station: strong, good, weak, fading, and gone. It can also show where the same frequency turns into a different station, and **Follow me while driving** updates everything as you move.
  - The rings are estimates from each tower's power and antenna height (fitted to the FCC's station-class distances). Hills, buildings, directional antennas and the weather aren't included.
- **`/austin` - Austin live board + song log.** The fixed Austin / San Marcos station list below, checked every minute, with a downloadable log.

Built with help from Claude (Anthropic's AI assistant).

## Stations

| FM | Station | Format |
|---|---|---|
| 88.7 | KAZI | Urban / community |
| 89.5 | KMFA | Classical |
| 89.9 | KTSW (Texas State) | College radio |
| 91.7 | KVRX (UT student) | College radio |
| 93.3 | KGSR | Changed hands in 2026 |
| 93.7 | KLBJ-FM | Classic rock |
| 94.7 | Mix 94.7 (KAMX) | Pop |
| 95.5 | Majic 95.5 (KKMJ) | Soft pop |
| 95.9 | Texas Country (KOKE-FM) | Texas country |
| 96.7 | Kiss FM (KHFI) | Top 40 |
| 98.1 | KVET | Country |
| 98.9 | KUTX | Austin music / indie |
| 100.1 | Sun Radio (KTSN) | Americana |
| 100.7 | KASE | Country |

To add or remove a station, edit the `STATIONS` list at the top of `src/worker.js`. 102.3 and 103.5 Bob FM are already there; just remove the `//` in front of them.

## How it works

- **Every minute**, a Cloudflare cron trigger checks every station and saves each change to a small database (Cloudflare D1).
- **The page** (`/`) shows the live board and refreshes itself every 30 seconds. The **Log** tab shows recent changes and lets you filter by station.
- `/log.csv` downloads the log as a spreadsheet, using Austin time. The log keeps the last 30 days.

Where the song info comes from, tried in this order (song genres come from Apple's public iTunes search, and station locations from the FCC FM Query):
1. **iHeartRadio's live data**, for Kiss FM, KVET and KASE. It's exact and knows when an ad break is on.
2. **The "now playing" tag inside the station's audio stream**, for KUTX.
3. **TuneIn's station directory**, which lists the current song for most stations. Here "AD / TALK" means no song is listed right now, so it's a close guess.

These are public but unofficial sources, so a station may show **NO DATA** if one of them changes.

## Put it online (one time, about 10 minutes)

### Option A: no installs, in the Cloudflare website (Austin board only)
The code is now split into several files, so this paste-in option only works for the older single-file version. Use Option C instead.

1. Make a free account at **dash.cloudflare.com**.
2. Go to **Workers & Pages**, then **Create**, and start from the "Hello World" Worker. Name it `austin-radio-now` and deploy it.
3. Open the Worker, click **Edit code**, replace everything with the contents of `src/worker.js`, and **Deploy**.
4. **The log database:** go to **Storage & Databases > D1**, then **Create** a database named `radio-log`.
5. Back in your Worker, go to **Settings > Bindings > Add > D1 database**. Set the variable name to `DB` and pick `radio-log`.
6. Still in **Settings**, find **Triggers > Cron Triggers > Add** and set it to every minute: `* * * * *`.
7. Open your Worker's link (`https://austin-radio-now.<your-name>.workers.dev`) on your phone, then **Share > Add to Home Screen**.

The tables in the database are created automatically the first time it runs.

### Option B: from your computer with Wrangler (needs Node.js)
```bash
npm install -g wrangler
wrangler login
wrangler d1 create radio-log      # paste the database_id it prints into wrangler.toml
wrangler deploy
```

### Option C: auto-deploy from GitHub
Do Option B's `d1 create` step first and commit the `database_id` in `wrangler.toml`. Then in Cloudflare go to **Workers & Pages > Create > Import a repository** and pick this repo. Every push to GitHub will update the site.

## Laptop-only version

`local/radio_now.py` does the same thing on your own computer, with no Cloudflare needed. Run `python local/radio_now.py`. It shows a live table in the terminal, serves a page your phone can open on the same Wi-Fi, and writes `radio_log.csv`.
