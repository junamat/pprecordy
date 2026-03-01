# pprecordy

A fast, async Node.js tool to fetch and export topplay records from the osu! API rankings. Scrapes performance data from the higher ranked players across configurable time windows and countries and exports results to CSV.

## Features

- 🚀 **Fully async** – Concurrent requests with intelligent rate limiting
- 📊 **Flexible filtering** – Query by gamemode, country, date range
- 💾 **CSV export** – Beatmap links, PP, accuracy, mods, ranks, and more
- 🛡️ **Smart backoff** – Detects and respects API rate limits (429 responses)
- 📝 **Optional logging** – Console + file output for long-running jobs
- ⚙️ **Interactive config** – Easy setup wizard on first run
- ⏱️ **Graceful interruption** – Press `Ctrl+C` to skip remaining requests and export current data

## Requirements

- [Node.js](https://nodejs.org/en) (v12 or later)
- osu! API credentials (get them [here](https://osu.ppy.sh/home/account/edit#oauth))

## Installation

```bash
npm install
```

## Quick Start

### First Run (Configuration)

```bash
node config
```

Answer the prompts:
- **Client ID & Secret** – From your osu! API application
- **Country** – Leave blank for all countries, or specify (e.g., `ES`, `US`, `JP`)
- **Gamemode** – Choose: osu (0), mania (1), taiko (2), catch (3)
- **Date range** – Absolute dates or relative time offset (e.g., `20d` for last 20 days)
- **Pages** – How many ranking pages to scan (1 page = 50 players)
- **Logging** – Enable optional file logging

### Run

```bash
node index
```

Fetches top scores from ranked players and exports to `out.csv`.

**Tip:** Press `Ctrl+C` while fetching to skip remaining requests and jump straight to CSV export with collected data.

## Configuration

After first setup, edit `config.json` directly or re-run `node config`. Key fields:

```json
{
  "gamemode": "osu",                     // "osu", "mania", "taiko", "fruits"
  "country": "ES",                       // Country code or empty for all
  "pages": 4,                            // Number of ranking pages
  "time": {
    "absolute_s": 1,                     // 1 = start is absolute timestamp
    "absolute_f": 1,                     // 1 = finish is absolute timestamp 
    "start": 1700000000000,              // Milliseconds since epoch
    "finish": 1700086400000              // 0 = use current time
  },
  "api_key": {
    "client": "YOUR_CLIENT_ID",
    "secret": "YOUR_CLIENT_SECRET"
  },
  "rateLimit": {
    "rpm": 1200,                         // Requests per minute (default 1200). Lower to be conservative.
    "burst": 200,                        // Burst capacity (default 200 in code). Change only if you know the implications.
    "concurrent": 15                      // Max concurrent in-flight requests (default 15)
  },
  "logging": {
    "enabled": true,
    "file": "pprecordy.log"              // Optional file logging
  }
}
```

## Rate Limiting

pprecordy enforces two protections to avoid overloading the osu! API:

- A token-bucket limiter that enforces an RPM budget using `rateLimit.rpm` and `rateLimit.burst`.
- A concurrency cap that limits how many requests are in-flight at once via `rateLimit.concurrent`.

Current defaults (per `index.js`):

- `rateLimit.rpm`: 1200 requests per minute (default). Lower to be conservative.
- `rateLimit.burst`: 200 (default in code). This is the number of tokens the bucket can hold.
- `rateLimit.concurrent`: 15 concurrent in-flight requests (default).

Note on 429 responses:

- 429s can indicate server-side concurrency limits (too many simultaneous connections) rather than only RPM. If you see repeated 429s, reduce `rateLimit.concurrent` first (try 5), then lower `rateLimit.rpm` if needed.
- On 429 the tool performs a short backoff (a few seconds) and retries with exponential backoff.

Edit `config.rateLimit` in `config.json` to tune throughput.

## Output

Results are saved to `out.csv` with columns:
- **Beatmap** – Link to osu! beatmap
- **PP** – Performance points
- **Accuracy** – Hit accuracy %
- **Max Combo** – Best combo achieved
- **Mods** – Modifiers used
- **Rank** – Grade (S, A, B, C, D, F)
- **User** – Player username
- **Date** – When the score was set
- **Replay** – Available or not
- **Score Link** – Direct link to score

## Logging

By default, progress is printed to console only.

**To enable file logging**, set in `config.json`:

```json
"logging": {
  "enabled": true,
  "file": "pprecordy.log"
}
```

All messages (including retries, backoffs, and errors) will be appended to the log file with timestamps.

## Troubleshooting

### 429 Too Many Requests
You're hitting the API rate limit OR (and more likely), too many requests sent by this tool (and perhaps others) are being processed at the moment. The tool will try it's best not to miss any users and will keep retrying. In case you're actually hitting the rate limit, it is very advisable to lower `rateLimit.rpm` in `config.json` and try again.

### Unexpected response shape / timeouts
Network or server hiccup. The tool retries up to 3 times with exponential backoff. Check `pprecordy.log` for details.

### Script gets stuck
Press `Ctrl+C` to stop.

## License

This tool is licensed under the [MIT](LICENSE) license.

