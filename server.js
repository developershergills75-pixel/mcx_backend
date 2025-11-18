import express from "express";
import cors from "cors";
import axios from "axios";
import * as cheerio from "cheerio";

const app = express();
app.use(cors());

// Extract number from text
function extractNumber(text) {
  if (!text) return null;
  const match = text.replace(/,/g, "").match(/(\d+(\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

// Fetch HTML
async function fetchHTML(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      },
    });
    return cheerio.load(response.data);
  } catch (err) {
    return null;
  }
}

// Scrape a commodity/index with multiple selectors
async function scrapeValue(url, selectors) {
  const $ = await fetchHTML(url);
  if (!$) return null;

  for (let sel of selectors) {
    const val = $(sel).first().text();
    const num = extractNumber(val);
    if (num) return num;
  }

  // Fallback: search whole page
  const fallback = extractNumber($.html());
  return fallback;
}

// CONFIG (latest working selectors)
const CONFIG = {
  gold: {
    url: "https://www.moneycontrol.com/commodity/gold-price.html",
    selectors: [
      ".comm_cur_prc",
      ".comm_prc span",
      ".inprice",
      ".FL ._flex div:nth-child(1)"
    ]
  },
  silver: {
    url: "https://www.moneycontrol.com/commodity/silver-price.html",
    selectors: [".comm_cur_prc", ".comm_prc span", ".inprice"]
  },
  crude: {
    url: "https://www.moneycontrol.com/commodity/crude-oil-price.html",
    selectors: [".comm_cur_prc", ".pcst", ".inprice"]
  },
  natural_gas: {
    url: "https://www.moneycontrol.com/commodity/natural-gas-price.html",
    selectors: [".comm_cur_prc", ".inprice"]
  },
  copper: {
    url: "https://www.moneycontrol.com/commodity/copper-price.html",
    selectors: [".comm_cur_prc", ".inprice"]
  },
  nickel: {
    url: "https://www.moneycontrol.com/commodity/nickel-price.html",
    selectors: [".comm_cur_prc", ".inprice"]
  },
  nifty: {
    url: "https://www.moneycontrol.com/indian-indices/nifty-50-9.html",
    selectors: [".inprice1", ".pcst", ".inprice"]
  },
  banknifty: {
    url: "https://www.moneycontrol.com/indian-indices/nifty-bank-23.html",
    selectors: [".inprice1", ".pcst", ".inprice"]
  },
  sensex: {
    url: "https://www.moneycontrol.com/indian-indices/sensex-4.html",
    selectors: [".inprice1", ".pcst", ".inprice"]
  }
};

// MASTER API
app.get("/live-data", async (req, res) => {
  const output = {
    mcx: {},
    indices: {},
    updated: new Date().toISOString(),
  };

  output.mcx.gold = await scrapeValue(CONFIG.gold.url, CONFIG.gold.selectors);
  output.mcx.silver = await scrapeValue(CONFIG.silver.url, CONFIG.silver.selectors);
  output.mcx.crude = await scrapeValue(CONFIG.crude.url, CONFIG.crude.selectors);
  output.mcx.natural_gas = await scrapeValue(CONFIG.natural_gas.url, CONFIG.natural_gas.selectors);
  output.mcx.copper = await scrapeValue(CONFIG.copper.url, CONFIG.copper.selectors);
  output.mcx.nickel = await scrapeValue(CONFIG.nickel.url, CONFIG.nickel.selectors);

  output.indices.nifty = await scrapeValue(CONFIG.nifty.url, CONFIG.nifty.selectors);
  output.indices.banknifty = await scrapeValue(CONFIG.banknifty.url, CONFIG.banknifty.selectors);
  output.indices.sensex = await scrapeValue(CONFIG.sensex.url, CONFIG.sensex.selectors);

  res.json(output);
});

app.get("/", (req, res) => {
  res.send("MCX + NSE/BSE Scraper API Running ✔");
});

app.listen(3000, () => console.log("Server running on port 3000 ✔"));
