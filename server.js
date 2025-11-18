
import express from "express";
import cors from "cors";
import axios from "axios";
import cheerio from "cheerio";
import NodeCache from "node-cache";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const POLL_INTERVAL = Number(process.env.POLL_INTERVAL || 5000); // ms
const CACHE_TTL = Number(process.env.CACHE_TTL || 15); // seconds

// In-memory cache
const cache = new NodeCache({ stdTTL: CACHE_TTL, checkperiod: CACHE_TTL / 2 });

// Symbol mapping: maps user symbols to scraping sources and URL slugs.
// You can extend this map with new symbols and sources.
const SYMBOL_MAP = {
  "MCX:GOLD1!": {
    name: "MCX GOLD",
    sources: [
      // Try a series of public pages; selectors may need tweaks depending on site structure.
      { url: "https://www.moneycontrol.com/commodity/gold-price.html" , selectors: ["#nse_ticker .pcst", ".inprice", ".price", ".instrument-price_last__KQzyA", ".prc"] },
      { url: "https://in.investing.com/commodities/gold", selectors: [".instrument-price_last__KQzyA", "#last_last", ".text-2xl"] },
      // fallback simple: try to parse first currency-like number from HTML
    ]
  },
  "MCX:SILVER1!": {
    name: "MCX SILVER",
    sources: [
      { url: "https://www.moneycontrol.com/commodity/silver-price.html", selectors: [".inprice", ".price", "#nse_ticker .pcst"] },
      { url: "https://in.investing.com/commodities/silver", selectors: [".instrument-price_last__KQzyA", "#last_last"] }
    ]
  },
  "MCX:CRUDEOIL1!": {
    name: "MCX CRUDEOIL",
    sources: [
      { url: "https://in.investing.com/commodities/brent-oil", selectors: [".instrument-price_last__KQzyA", "#last_last"] },
      { url: "https://www.moneycontrol.com/commodity/crude-oil-price.html", selectors: [".inprice", ".price"] }
    ]
  }
};

// Helper: try to extract numeric price from an HTML page using provided selectors,
// falling back to a regex search for currency-like numbers.
async function scrapePriceFromSource(source) {
  try {
    const res = await axios.get(source.url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; MCX-Scraper/1.0)"
      },
      timeout: 8000
    });
    const html = res.data;
    const $ = cheerio.load(html);

    // Try selectors if provided
    if (source.selectors && source.selectors.length) {
      for (const sel of source.selectors) {
        try {
          const el = $(sel).first();
          if (el && el.text()) {
            const txt = el.text().trim();
            const num = extractNumberFromString(txt);
            if (num !== null) return { price: num, source: source.url, raw: txt };
          }
        } catch (e) {
          // ignore selector errors
        }
      }
    }

    // Fallback: search body text for first currency-like number (₹ or digits with commas)
    const fallback = extractNumberFromString(html);
    if (fallback !== null) return { price: fallback, source: source.url, raw: null };

    return null;
  } catch (err) {
    // network or parse error
    return null;
  }
}

function extractNumberFromString(text) {
  if (!text || typeof text !== "string") return null;
  // Remove non-breaking spaces
  const s = text.replace(/\u00A0/g, " ");
  // Try to find pattern like 72,850.20 or 72850.20 or ₹ 72,850.20
  const regex = /₹?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]+)?|[0-9]+(?:\.[0-9]+)?)/;
  const m = s.match(regex);
  if (m && m[1]) {
    // remove commas
    const numStr = m[1].replace(/,/g, "");
    const num = Number(numStr);
    if (!isNaN(num)) return num;
  }
  return null;
}

// Polling function for a symbol: try all sources sequentially until price found
async function fetchAndCacheSymbol(sym) {
  const entry = SYMBOL_MAP[sym];
  if (!entry) return null;

  for (const source of entry.sources) {
    const result = await scrapePriceFromSource(source);
    if (result && result.price) {
      const payload = {
        symbol: sym,
        name: entry.name,
        price: result.price,
        source: result.source,
        raw: result.raw,
        ts: Date.now()
      };
      // save to cache
      cache.set(sym, payload);
      return payload;
    }
  }
  return null;
}

// Start background pollers for mapped symbols
function startPollers() {
  const symbols = Object.keys(SYMBOL_MAP);
  symbols.forEach((sym) => {
    // initial fetch
    (async () => {
      await fetchAndCacheSymbol(sym);
    })();

    // poll repeatedly
    setInterval(async () => {
      await fetchAndCacheSymbol(sym);
    }, POLL_INTERVAL);
  });
}

app.get("/", (req, res) => {
  res.send("MCX Scraper Backend running");
});

// Endpoint: /mcx?symbol=MCX:GOLD1!
app.get("/mcx", async (req, res) => {
  const symbol = (req.query.symbol || "").toString().trim().toUpperCase();
  if (!symbol) return res.status(400).json({ error: "symbol query required, e.g. ?symbol=MCX:GOLD1!" });

  // ensure it's in our map
  if (!SYMBOL_MAP[symbol]) return res.status(404).json({ error: "symbol not supported" });

  const cached = cache.get(symbol);
  if (cached) {
    return res.json({ ok: true, cached: true, data: cached });
  }

  // try immediate fetch
  const fetched = await fetchAndCacheSymbol(symbol);
  if (fetched) return res.json({ ok: true, cached: false, data: fetched });

  // if nothing, return waiting message
  return res.json({ ok: false, message: "no price available yet, will be polled soon" });
});

// Endpoint: /live?symbol=GOLD  (shortcut)
app.get("/live", async (req, res) => {
  let symbol = (req.query.symbol || "").toString().trim().toUpperCase();
  if (!symbol) return res.status(400).json({ error: "symbol required e.g. ?symbol=GOLD" });

  // Map simple names to MCX symbols
  const mapSimple = {
    "GOLD": "MCX:GOLD1!",
    "SILVER": "MCX:SILVER1!",
    "CRUDE": "MCX:CRUDEOIL1!"
  };
  if (mapSimple[symbol]) symbol = mapSimple[symbol];
  if (!SYMBOL_MAP[symbol]) return res.status(404).json({ error: "symbol not supported" });

  const cached = cache.get(symbol);
  if (cached) return res.json({ ok: true, cached: true, data: cached });

  const fetched = await fetchAndCacheSymbol(symbol);
  if (fetched) return res.json({ ok: true, cached: false, data: fetched });

  return res.json({ ok: false, message: "no price available yet, will be polled soon" });
});

// Simple status endpoint
app.get("/status", (req, res) => {
  const keys = Object.keys(SYMBOL_MAP);
  const cached = keys.map(k => ({ symbol: k, cached: cache.get(k) ? true : false }));
  res.json({ ok: true, symbols: cached, poll_interval_ms: POLL_INTERVAL });
});

// Start pollers and server
startPollers();

app.listen(PORT, () => {
  console.log(`MCX Scraper Backend running on port ${PORT}`);
});
