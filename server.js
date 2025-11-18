// server.js
import express from "express";
import cors from "cors";
import axios from "axios";
import * as cheerio from "cheerio";

const app = express();
app.use(cors());

// helper: try selectors, then fallback regex
function extractNumberFromText(text) {
  if (!text) return null;
  const s = text.replace(/\u00A0/g, " ").replace(/\n/g, " ").trim();
  // look for patterns like 72,850.20 or 72850.20 or 72,850
  const m = s.match(/₹?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]+)?|[0-9]+(?:\.[0-9]+)?)/);
  if (!m) return null;
  const numStr = m[1].replace(/,/g, "");
  const num = Number(numStr);
  return Number.isFinite(num) ? num : null;
}

async function fetchHtml(url) {
  try {
    const r = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117 Safari/537.36"
      },
      timeout: 10000
    });
    return r.data;
  } catch (e) {
    return null;
  }
}

async function scrapeWithSelectors(url, selectors = []) {
  const html = await fetchHtml(url);
  if (!html) return null;
  const $ = cheerio.load(html);

  for (const sel of selectors) {
    try {
      const el = $(sel).first();
      if (el && el.text()) {
        const v = extractNumberFromText(el.text());
        if (v !== null) return v;
      }
    } catch {}
  }

  // fallback: try some common classes
  const common = [
    ".inprice",
    ".inprice1",
    ".PRc",
    ".price",
    ".instrument-price_last__KQzyA",
    ".nprc",
    ".lft .price",
    "#nse_ticker",
    ".spPrice"
  ];
  for (const sel of common) {
    const el = $(sel).first();
    if (el && el.text()) {
      const v = extractNumberFromText(el.text());
      if (v !== null) return v;
    }
  }

  // last fallback - search whole html for first number that looks like price
  const maybe = extractNumberFromText(html);
  return maybe;
}

// MoneyControl URLs and suggested selectors
const PAGES = {
  GOLD: {
    url: "https://www.moneycontrol.com/commodity/gold-price.html",
    selectors: [".inprice", ".prc", ".price", ".comm_currentprice span", ".nse_ticker .pcst"]
  },
  SILVER: {
    url: "https://www.moneycontrol.com/commodity/silver-price.html",
    selectors: [".inprice", ".prc", ".price"]
  },
  CRUDE: {
    url: "https://www.moneycontrol.com/commodity/crude-oil-price.html",
    selectors: [".inprice", ".prc", ".price"]
  },
  NATURAL_GAS: {
    url: "https://www.moneycontrol.com/commodity/natural-gas-price.html",
    selectors: [".inprice", ".prc", ".price"]
  },
  COPPER: {
    url: "https://www.moneycontrol.com/commodity/copper-price.html",
    selectors: [".inprice", ".prc", ".price"]
  },
  NICKEL: {
    url: "https://www.moneycontrol.com/commodity/nickel-price.html",
    selectors: [".inprice", ".prc", ".price"]
  },
  // indices (MoneyControl index pages)
  NIFTY: {
    url: "https://www.moneycontrol.com/indian-indices/nifty-50-9.html",
    selectors: [".in_price", ".val", ".inprice", "#nseidx .inprice"]
  },
  BANKNIFTY: {
    url: "https://www.moneycontrol.com/indian-indices/nifty-bank-15.html",
    selectors: [".in_price", ".val", ".inprice"]
  },
  SENSEX: {
    url: "https://www.moneycontrol.com/indian-indices/sensex-4.html",
    selectors: [".in_price", ".val", ".inprice"]
  }
};

async function getMCXAndIndices() {
  const keys = Object.keys(PAGES);
  const results = {};

  // do parallel requests (limit moderate concurrency)
  const promises = keys.map(async (k) => {
    const { url, selectors } = PAGES[k];
    const val = await scrapeWithSelectors(url, selectors);
    results[k] = val === null ? null : Number(val);
  });

  await Promise.all(promises);
  return results;
}

// Convert to MCX approx if required (MoneyControl pages already give domestic MCX rates typically).
// Here we return scraped values as-is (MoneyControl shows domestic prices for commodity pages).
// If any page returns an international price, you can add conversion later.
function formatResponse(scraped) {
  return {
    mcx: {
      gold: scraped.GOLD ?? null,
      silver: scraped.SILVER ?? null,
      crude: scraped.CRUDE ?? null,
      natural_gas: scraped.NATURAL_GAS ?? null,
      copper: scraped.COPPER ?? null,
      nickel: scraped.NICKEL ?? null
    },
    indices: {
      nifty: scraped.NIFTY ?? null,
      banknifty: scraped.BANKNIFTY ?? null,
      sensex: scraped.SENSEX ?? null
    },
    updated: new Date().toISOString()
  };
}

app.get("/live-data", async (req, res) => {
  try {
    const scraped = await getMCXAndIndices();
    const out = formatResponse(scraped);
    return res.json(out);
  } catch (err) {
    return res.status(500).json({ error: "unexpected", detail: err.message });
  }
});

app.get("/", (req, res) => res.send("MCX + NSE/BSE Price API Running ✔"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port", PORT));
