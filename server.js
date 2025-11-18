import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";  // FIXED
import cors from "cors";

const PORT = process.env.PORT || 10000;

const app = express();
app.use(cors());

async function scrapeMCX(symbol = "GOLD") {
  try {
    const url = `https://www.moneycontrol.com/commodity/${symbol.toLowerCase()}`;
    const res = await axios.get(url);

    const $ = cheerio.load(res.data);
    const price = $(".commRHS .inprice1 span").first().text().trim();

    return {
      symbol,
      price: price || null,
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    return { error: err.message };
  }
}

app.get("/", (req, res) => {
  res.send("MCX backend running");
});

app.get("/mcx", async (req, res) => {
  const symbol = req.query.symbol || "GOLD";
  const data = await scrapeMCX(symbol);
  res.json(data);
});

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
