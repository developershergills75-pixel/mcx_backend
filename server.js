// server.js
import express from "express";
import cors from "cors";
import axios from "axios";
import * as cheerio from "cheerio";
import NodeCache from "node-cache";

const app = express();
app.use(cors());

// short in-memory cache to avoid hitting ET too often
const cache = new NodeCache({ stdTTL: 8, checkperiod: 4 }); // cache for 8 seconds

// helpful fetch with axios and UA headers
async function fetchHTML(url) {
  try {
    const { data } = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      },
      timeout: 10000
    });
    return data;
  } catch (err) {
    // return null on network error
    return null;
  }
}

// robust number extractor (handles commas, decimals)
function extractNumberFromString(s) {
  if (!s) return null;
  const cleaned = String(s).replace(/₹/g, "").replace(/\u00A0/g, " ").replace(/,/g, "").trim();
  const m = cleaned.match(/(\d+(\.\d+)?)/);
  if (!m) return null;
  const num = Number(m[1]);
  return Number.isFinite(num) ? num : null;
}

// try many selectors then fallback to searching text
function findPrice($, selectors = []) {
  for (const sel of selectors) {
    try {
      const el = $(sel).first();
      if (el && el.text()) {
        const v = extractNumberFromString(el.text());
        if (v !== null) return v;
      }
    } catch {}
  }

  // fallback: try some common classes
  const alt = [
    ".value", ".price", ".clearfix .val", ".mb0 .value", ".nseValue", ".liveprice", ".priceDetail", ".indexValue"
  ];
  for (const sel of alt) {
    try {
      const el = $(sel).first();
      if (el && el.text()) {
        const v = extractNumberFromString(el.text());
        if (v !== null) return v;
      }
    } catch {}
  }

  // last fallback: scan the text for first number-like token
  const whole = $("body").text();
  return extractNumberFromString(whole);
}

// EconomicTimes page map (URLs chosen to target commodity / index pages)
const PAGES = {
  GOLD: {
    url: "https://economictimes.indiatimes.com/markets/commodities/precious-metals/gold",
    selectors: [
      ".snapshot .value",                  // generic snapshot
      ".price-info .value",                // alt
      ".val", ".price"                     // fallback candidates
    ]
  },
  SILVER: {
    url: "https://economictimes.indiatimes.com/markets/commodities/precious-metals/silver",
    selectors: [".snapshot .value", ".price-info .value", ".val", ".price"]
  },
  CRUDE: {
    url: "https://economictimes.indiatimes.com/markets/commodities/energy/crude-oil",
    selectors: [".snapshot .value", ".price-info .value", ".val", ".price"]
  },
  NATURAL_GAS: {
    url: "https://economictimes.indiatimes.com/markets/commodities/energy/natural-gas",
    selectors: [".snapshot .value", ".price-info .value", ".val", ".price"]
  },
  COPPER: {
    url: "https://economictimes.indiatimes.com/markets/commodities/base-metals/copper",
    selectors: [".snapshot .value", ".price-info .value", ".val", ".price"]
  },
  NICKEL: {
    url: "https://economictimes.indiatimes.com/markets/commodities/base-metals/nickel",
    selectors: [".snapshot .value", ".price-info .value", ".val", ".price"]
  },
  NIFTY: {
    url: "https://economictimes.indiatimes.com/markets/indian-indices/nifty-50-9",
    selectors: [".snapshot .value", ".market-snapshot .value", ".nseindex .value", ".val"]
  },
  BANKNIFTY: {
    url: "https://economictimes.indiatimes.com/markets/indian-indices/bank-nifty-15",
    selectors: [".snapshot .value", ".market-snapshot .value", ".val"]
  },
  SENSEX: {
    url: "https://economictimes.indiatimes.com/markets/indian-indices/sensex-4",
    selectors: [".snapshot .value", ".market-snapshot .value", ".val"]
  }
};

// single scraper worker with caching
async function scrapeKey(key) {
  const conf = PAGES[key];
  if (!conf) return null;

  const cacheKey = `scrape_${key}`;
  const cached = cache.get(cacheKey);
  if (cached !== undefined) return cached;

  const html = await fetchHTML(conf.url);
  if (!html) {
    cache.set(cacheKey, null);
    return null;
  }

  const $ = cheerio.load(html);

  const price = findPrice($, conf.selectors);
  cache.set(cacheKey, price === null ? null : Number(price));
  return price === null ? null : Number(price);
}

// endpoint: /live-data
app.get("/live-data", async (req, res) => {
  try {
    // run parallel
    const keys = Object.keys(PAGES);
    const promises = keys.map(k => scrapeKey(k));
    const vals = await Promise.all(promises);

    // map to response
    const mcx = {
      gold: vals[keys.indexOf("GOLD")] ?? null,
      silver: vals[keys.indexOf("SILVER")] ?? null,
      crude: vals[keys.indexOf("CRUDE")] ?? null,
      natural_gas: vals[keys.indexOf("NATURAL_GAS")] ?? null,
      copper: vals[keys.indexOf("COPPER")] ?? null,
      nickel: vals[keys.indexOf("NICKEL")] ?? null
    };

    const indices = {
      nifty: vals[keys.indexOf("NIFTY")] ?? null,
      banknifty: vals[keys.indexOf("BANKNIFTY")] ?? null,
      sensex: vals[keys.indexOf("SENSEX")] ?? null
    };

    return res.json({
      mcx,
      indices,
      updated: new Date().toISOString()
    });
  } catch (err) {
    return res.status(500).json({ error: "unexpected", detail: err.message });
  }
});

app.get("/", (req, res) => res.send("MCX + NSE/BSE (EconomicTimes) Scraper Running ✔"));

// Render port
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server listening on port", PORT));
