
# MCX Scraper Backend (Option C)

This project is a simple Node.js backend that scrapes public commodity pages to provide near-live MCX prices.
It polls multiple public sources and caches the latest price for fast responses.

## Features
- Scrapes multiple public pages (MoneyControl, Investing.com) for GOLD, SILVER, CRUDE.
- Poll interval configurable (`POLL_INTERVAL` in ms).
- Caches last price in memory (configurable TTL).
- Endpoints:
  - `/` - health check
  - `/mcx?symbol=MCX:GOLD1!`
  - `/live?symbol=GOLD` (shortcut)
  - `/status` - status and cached info

## How to deploy (Render)
1. Create a new GitHub repo and push this project.
2. Sign in to https://render.com and create a new **Web Service**.
3. Connect to your GitHub repo.
4. Build Command: `npm install`
5. Start Command: `npm start` (or `node server.js`)
6. Set environment variables if needed (`POLL_INTERVAL`, `CACHE_TTL`, `PORT`).

## Quick local run
1. `npm install`
2. `node server.js`
3. Open `http://localhost:3000/live?symbol=GOLD`

## Notes
- Scraping selectors may need tuning if source websites change their HTML structure.
- For production, consider using a headless browser (Puppeteer) or a paid data provider for guaranteed tick-level live data.
- Respect the terms of use of the target websites.
