import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());

// -------------------------
// Fetch Helper (Safe Proxy)
// -------------------------
async function safeFetch(url) {
  try {
    const res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
    return await res.json();
  } catch (err) {
    return null;
  }
}

// -------------------------
// 1) USD-INR RATE
// -------------------------
async function getUSDINR() {
  try {
    const data = await safeFetch(
      "https://query1.finance.yahoo.com/v7/finance/quote?symbols=USDINR=X"
    );

    return data?.quoteResponse?.result?.[0]?.regularMarketPrice || 84; // fallback
  } catch {
    return 84;
  }
}

// -------------------------
// 2) METALS (Gold & Silver)
// -------------------------
async function getMetals() {
  const data = await safeFetch("https://api.metals.live/v1/spot");

  if (!data) return { gold: null, silver: null };

  const gold = data.find(i => i.gold)?.gold?.price || null;
  const silver = data.find(i => i.silver)?.silver?.price || null;

  return { gold, silver };
}

// -------------------------
// 3) ENERGY (Crude & NG)
// -------------------------
async function getEnergy() {
  const data = await safeFetch(
    "https://query1.finance.yahoo.com/v7/finance/quote?symbols=CL=F,NG=F"
  );

  if (!data) return { crude: null, natural_gas: null };

  return {
    crude: data.quoteResponse.result[0]?.regularMarketPrice || null,
    natural_gas: data.quoteResponse.result[1]?.regularMarketPrice || null
  };
}

// -------------------------
// 4) BASE METALS (Copper, Nickel)
// -------------------------
async function getBaseMetals() {
  const data = await safeFetch(
    "https://query1.finance.yahoo.com/v7/finance/quote?symbols=HG=F,NK=F"
  );

  if (!data) return { copper: null, nickel: null };

  return {
    copper: data.quoteResponse.result[0]?.regularMarketPrice || null,
    nickel: data.quoteResponse.result[1]?.regularMarketPrice || null
  };
}

// -------------------------
// 5) NSE/BSE INDEXES
// -------------------------
async function getIndices() {
  const data = await safeFetch(
    "https://query1.finance.yahoo.com/v7/finance/quote?symbols=^NSEI,^NSEBANK,^BSESN"
  );

  if (!data)
    return { nifty: null, banknifty: null, sensex: null };

  return {
    nifty: data.quoteResponse.result[0]?.regularMarketPrice || null,
    banknifty: data.quoteResponse.result[1]?.regularMarketPrice || null,
    sensex: data.quoteResponse.result[2]?.regularMarketPrice || null
  };
}

// -------------------------
// MCX FORMULAS
// -------------------------
function convertToMCX(intl, usd) {
  return {
    gold: intl.gold ? (intl.gold * usd * 28.3495) / 10 : null,
    silver: intl.silver ? (intl.silver * usd * 28.3495) / 1000 : null,
    crude: intl.crude ? intl.crude * usd : null,
    natural_gas: intl.natural_gas ? intl.natural_gas * usd * 28.32 : null,
    copper: intl.copper ? (intl.copper * 453.592 * usd) / 1000 : null,
    nickel: intl.nickel ? (intl.nickel * usd * 1000) / 1000 : null
  };
}

// -------------------------
// MAIN LIVE API
// -------------------------
app.get("/live-data", async (req, res) => {
  const usd = await getUSDINR();
  const metals = await getMetals();
  const energy = await getEnergy();
  const base = await getBaseMetals();
  const indices = await getIndices();

  const intl = { ...metals, ...energy, ...base };
  const mcx = convertToMCX(intl, usd);

  res.json({
    mcx,
    indices,
    updated: new Date().toISOString()
  });
});

// -------------------------
app.get("/", (req, res) => {
  res.send("MCX + NSE/BSE Price API Running ✔");
});
// -------------------------

app.listen(3000, () => console.log("Server live on port 3000"));
