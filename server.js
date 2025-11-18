import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());

// Safe Fetch (Yahoo & other APIs को unblock करता है)
async function proxyFetch(url) {
  try {
    const res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
    return await res.json();
  } catch {
    return null;
  }
}

// 1) USD-INR
async function getUSDINR() {
  const data = await proxyFetch(
    "https://query1.finance.yahoo.com/v7/finance/quote?symbols=USDINR=X"
  );
  return data?.quoteResponse?.result?.[0]?.regularMarketPrice || 84;
}

// 2) Gold & Silver (Metals.live — unblocked)
async function getMetals() {
  const data = await proxyFetch("https://api.metals.live/v1/spot");
  if (!data) return { gold: null, silver: null };

  return {
    gold: data[0]?.gold || null,
    silver: data[1]?.silver || null
  };
}

// 3) Crude & NG
async function getEnergy() {
  const data = await proxyFetch(
    "https://query1.finance.yahoo.com/v7/finance/quote?symbols=CL=F,NG=F"
  );

  return {
    crude: data?.quoteResponse?.result?.[0]?.regularMarketPrice || null,
    natural_gas: data?.quoteResponse?.result?.[1]?.regularMarketPrice || null
  };
}

// 4) Copper & Nickel
async function getBaseMetals() {
  const data = await proxyFetch(
    "https://query1.finance.yahoo.com/v7/finance/quote?symbols=HG=F,NK=F"
  );

  return {
    copper: data?.quoteResponse?.result?.[0]?.regularMarketPrice || null,
    nickel: data?.quoteResponse?.result?.[1]?.regularMarketPrice || null
  };
}

// 5) NSE + BSE
async function getIndices() {
  const data = await proxyFetch(
    "https://query1.finance.yahoo.com/v7/finance/quote?symbols=^NSEI,^NSEBANK,^BSESN"
  );

  return {
    nifty: data?.quoteResponse?.result?.[0]?.regularMarketPrice || null,
    banknifty: data?.quoteResponse?.result?.[1]?.regularMarketPrice || null,
    sensex: data?.quoteResponse?.result?.[2]?.regularMarketPrice || null
  };
}

// MCX conversion formulas
function convertMCX(raw, usd) {
  return {
    gold: raw.gold ? (raw.gold * usd * 28.3495) / 10 : null,
    silver: raw.silver ? (raw.silver * usd * 28.3495) / 1000 : null,
    crude: raw.crude ? raw.crude * usd : null,
    natural_gas: raw.natural_gas ? raw.natural_gas * usd * 28.32 : null,
    copper: raw.copper ? (raw.copper * 453.592 * usd) / 1000 : null,
    nickel: raw.nickel ? raw.nickel * usd : null
  };
}

// MAIN ENDPOINT
app.get("/live-data", async (req, res) => {
  const usd = await getUSDINR();
  const metals = await getMetals();
  const energy = await getEnergy();
  const base = await getBaseMetals();
  const indices = await getIndices();

  const intl = { ...metals, ...energy, ...base };
  const mcx = convertMCX(intl, usd);

  res.json({
    mcx,
    indices,
    updated: new Date().toISOString()
  });
});

app.get("/", (req, res) => {
  res.send("MCX + NSE/BSE Price API Running ✔");
});

app.listen(3000, () => console.log("Server live on PORT 3000 ✔"));
