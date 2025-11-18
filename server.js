import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());

// Helper fetch with debug
async function debugFetch(label, url) {
  try {
    const finalUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    const res = await fetch(finalUrl);
    const text = await res.text();

    return {
      label,
      success: true,
      url: finalUrl,
      raw: text.slice(0, 200),
      json: JSON.parse(text)
    };

  } catch (err) {
    return {
      label,
      success: false,
      url: url,
      error: err.message
    };
  }
}

// -------------------------
// ENDPOINT: DEBUG DATA
// -------------------------
app.get("/live-data", async (req, res) => {
  const results = {};

  // USDINR
  results.usdinr = await debugFetch(
    "USDINR",
    "https://query1.finance.yahoo.com/v7/finance/quote?symbols=USDINR=X"
  );

  // GOLD/SILVER
  results.metals = await debugFetch(
    "METALS",
    "https://api.metals.live/v1/spot"
  );

  // CRUDE/NG
  results.energy = await debugFetch(
    "ENERGY",
    "https://query1.finance.yahoo.com/v7/finance/quote?symbols=CL=F,NG=F"
  );

  // COPPER/NICKEL
  results.baseMetals = await debugFetch(
    "BASE_METALS",
    "https://query1.finance.yahoo.com/v7/finance/quote?symbols=HG=F,NK=F"
  );

  // NSE/BSE
  results.indices = await debugFetch(
    "INDICES",
    "https://query1.finance.yahoo.com/v7/finance/quote?symbols=^NSEI,^NSEBANK,^BSESN"
  );

  res.json({
    debug: true,
    updated: new Date().toISOString(),
    data: results
  });
});

app.get("/", (req, res) => {
  res.send("MCX DEBUG API Running ✔");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("DEBUG API live on port", PORT));
