import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());

// -------------------------------
// YOUR METALS API KEY
// -------------------------------
const METALS_API_KEY = "l0q34s9bm33e87c62lp8wzlnd8v78vzn20nlgek1cis2w5da04n237btojxw";

// --------------------------------
// 1) METALS (Gold, Silver, Copper, Nickel)
// --------------------------------
async function getMetals() {
  try {
    const res = await fetch(
      `https://metals-api.com/api/latest?access_key=${METALS_API_KEY}&symbols=XAU,XAG,XCU,XNI&base=USD`
    );
    const data = await res.json();

    if (!data.rates) return { error: "MetalsAPI error" };

    return {
      gold: data.rates.XAU || null,
      silver: data.rates.XAG || null,
      copper: data.rates.XCU || null,
      nickel: data.rates.XNI || null,
    };
  } catch (err) {
    return { error: "MetalsAPI error" };
  }
}

// --------------------------------
// 2) CRUDE + NATURAL GAS
// --------------------------------
async function getEnergy() {
  try {
    const res = await fetch(
      "https://query1.finance.yahoo.com/v7/finance/quote?symbols=CL=F,NG=F"
    );
    const data = await res.json();

    const crude = data.quoteResponse.result.find(i => i.symbol === "CL=F");
    const ng = data.quoteResponse.result.find(i => i.symbol === "NG=F");

    return {
      crude: crude?.regularMarketPrice ?? null,
      natural_gas: ng?.regularMarketPrice ?? null,
    };
  } catch {
    return { crude: null, natural_gas: null };
  }
}

// --------------------------------
// 3) NIFTY + BANKNIFTY
// --------------------------------
async function getNSE() {
  try {
    const res = await fetch(
      "https://query1.finance.yahoo.com/v7/finance/quote?symbols=^NSEI,^NSEBANK"
    );
    const data = await res.json();

    return {
      nifty: data.quoteResponse.result[0]?.regularMarketPrice ?? null,
      banknifty: data.quoteResponse.result[1]?.regularMarketPrice ?? null,
    };
  } catch {
    return { nifty: null, banknifty: null };
  }
}

// --------------------------------
// 4) SENSEX
// --------------------------------
async function getBSE() {
  try {
    const res = await fetch(
      "https://query1.finance.yahoo.com/v7/finance/quote?symbols=^BSESN"
    );
    const data = await res.json();

    return {
      sensex: data.quoteResponse.result[0]?.regularMarketPrice ?? null,
    };
  } catch {
    return { sensex: null };
  }
}

// --------------------------------
// COMBINED API
// --------------------------------
app.get("/live-data", async (req, res) => {
  const metals = await getMetals();
  const energy = await getEnergy();
  const nse = await getNSE();
  const bse = await getBSE();

  res.json({
    status: "success",
    updated: new Date(),
    mcx: { ...metals, ...energy },
    indices: { ...nse, ...bse },
  });
});

app.get("/", (req, res) => {
  res.send("Live Price API Running ✔");
});

app.listen(3000, () => console.log("Server running on port 3000"));
