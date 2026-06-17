// Atualiza quotes.json: cotações de empresas de óleo & gás e de novas energias.
// Roda no GitHub Actions (Node 20+, fetch nativo, sem dependências e sem chave de API).
// Fonte principal: Yahoo Finance (gráfico v8). Reserva: Stooq (somente preço).
import { writeFileSync } from 'node:fs';

const TICKERS = [
  // Óleo & Gás
  { sym: "PBR",      stooq: "pbr.us",   name: "Petrobras (ADR)",      group: "oil" },
  { sym: "SHEL",     stooq: "shel.us",  name: "Shell",                group: "oil" },
  { sym: "XOM",      stooq: "xom.us",   name: "ExxonMobil",           group: "oil" },
  { sym: "CVX",      stooq: "cvx.us",   name: "Chevron",              group: "oil" },
  { sym: "TTE",      stooq: "tte.us",   name: "TotalEnergies",        group: "oil" },
  { sym: "BP",       stooq: "bp.us",    name: "BP",                   group: "oil" },
  { sym: "EQNR",     stooq: "eqnr.us",  name: "Equinor",              group: "oil" },
  { sym: "PRIO3.SA", stooq: "prio3",    name: "PRIO (B3)",            group: "oil" },
  // Novas Energias & Espaço
  { sym: "SPCX",     stooq: "spcx.us",  name: "SpaceX",               group: "new" },
  { sym: "TSLA",     stooq: "tsla.us",  name: "Tesla",                group: "new" },
  { sym: "NEE",      stooq: "nee.us",   name: "NextEra Energy",       group: "new" },
  { sym: "FSLR",     stooq: "fslr.us",  name: "First Solar",          group: "new" },
  { sym: "CCJ",      stooq: "ccj.us",   name: "Cameco (urânio)",      group: "new" },
  { sym: "CEG",      stooq: "ceg.us",   name: "Constellation (nucl.)", group: "new" }
];

const UA = { "User-Agent": "Mozilla/5.0 (compatible; PetroHubBot/1.0)" };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function yahoo(sym) {
  const u = "https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(sym) + "?range=1d&interval=1d";
  const r = await fetch(u, { headers: UA });
  if (!r.ok) throw new Error("HTTP " + r.status);
  const j = await r.json();
  const m = j.chart.result[0].meta;
  const price = m.regularMarketPrice;
  const prev = m.chartPreviousClose ?? m.previousClose;
  const chg = (price != null && prev) ? ((price - prev) / prev) * 100 : null;
  return {
    price: price != null ? Math.round(price * 100) / 100 : null,
    changePct: chg == null ? null : Math.round(chg * 100) / 100,
    currency: m.currency || "USD"
  };
}

async function stooq(sym) {
  const u = "https://stooq.com/q/l/?s=" + sym + "&f=sc&h&e=csv";
  const r = await fetch(u, { headers: UA });
  if (!r.ok) throw new Error("HTTP " + r.status);
  const t = (await r.text()).trim();
  const row = t.split(/\r?\n/)[1] || "";
  const close = parseFloat(row.split(",")[1]);
  if (isNaN(close)) throw new Error("sem preço");
  // Stooq .us em USD; PRIO (B3) em BRL
  const cur = sym.endsWith(".us") ? "USD" : "BRL";
  return { price: Math.round(close * 100) / 100, changePct: null, currency: cur };
}

const out = [];
for (const t of TICKERS) {
  let q = null;
  try { q = await yahoo(t.sym); }
  catch (e) {
    console.error("Yahoo falhou", t.sym, e.message);
    try { q = await stooq(t.stooq); }
    catch (e2) { console.error("Stooq falhou", t.stooq, e2.message); }
  }
  out.push({
    sym: t.sym, name: t.name, group: t.group,
    price: q ? q.price : null,
    changePct: q ? q.changePct : null,
    currency: q ? q.currency : null
  });
  await sleep(250); // evita rate limit
}

const data = { updated: new Date().toISOString(), quotes: out };
writeFileSync("quotes.json", JSON.stringify(data, null, 1));
const ok = out.filter(x => x.price != null).length;
console.log(`quotes.json atualizado: ${ok}/${out.length} com preço.`);
