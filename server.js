import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";
import cors from "cors";

const app = express();
app.use(cors());

// ------------------------
//  MCX URL MAPPING
// ------------------------
const mcxUrls = {
  GOLD: "https://www.moneycontrol.com/commodity/gold-price.html",
  SILVER: "https://www.moneycontrol.com/commodity/silver-price.html",
  CRUDEOIL: "https://www.moneycontrol.com/commodity/crude-oil-price.html",
  NATURALGAS: "https://www.moneycontrol.com/commodity/natural-gas-price.html",
  COPPER: "https://www.moneycontrol.com/commodity/copper-price.html",
  ZINC: "https://www.moneycontrol.com/commodity/zinc-price.html",
  NICKEL: "https://www.moneycontrol.com/commodity/nickel-price.html",
  LEAD: "https://www.moneycontrol.com/commodity/lead-price.html",
  ALUMINIUM: "https://www.moneycontrol.com/commodity/aluminium-price.html",
};

// ------------------------
//  PRICE SCRAPER
// ------------------------
async function fetchMCXPrice(symbol) {
  const url = mcxUrls[symbol];
  if (!url) return null;

  const { data } = await axios.get(url);
  const $ = cheerio.load(data);

  // UNIVERSAL SELECTORS (WORKING 2025)
  const price =
    $("span.dpiGreen").first().text().trim() ||
    $("span.blkGreen").first().text().trim() ||
    $("span#commodity_live_price").first().text().trim();

  return price || null;
}

// ------------------------
//  ROUTES
// ------------------------
app.get("/", (req, res) => {
  res.send("✔ MCX Backend Running — GOLD, SILVER, CRUDEOIL, NG, COPPER, ZINC etc.");
});

// Fetch a single symbol
app.get("/mcx", async (req, res) => {
  const symbol = req.query.symbol?.toUpperCase();

  if (!symbol) {
    return res.json({ error: "Symbol required" });
  }

  try {
    const price = await fetchMCXPrice(symbol);

    res.json({
      symbol,
      price,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.json({ error: err.message });
  }
});

// Fetch ALL MCX symbols at once (useful for your watchlist)
app.get("/mcx/all", async (req, res) => {
  const results = {};

  for (const symbol of Object.keys(mcxUrls)) {
    try {
      results[symbol] = await fetchMCXPrice(symbol);
    } catch {
      results[symbol] = null;
    }
  }

  res.json({
    data: results,
    timestamp: new Date().toISOString(),
  });
});

// ------------------------
app.listen(3000, () => console.log("MCX Backend Live on PORT 3000"));
