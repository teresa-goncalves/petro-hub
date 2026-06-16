// Atualiza news.json: busca feeds de óleo e gás, acumula (até 1 ano), remove o que é mais antigo.
// Roda no GitHub Actions (Node 20+, fetch nativo, sem dependências).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const FEEDS = [
  { url: "https://epbr.com.br/feed/", src: "epbr", reg: "BR" },
  { url: "https://petronoticias.com.br/feed/", src: "Petronotícias", reg: "BR" },
  { url: "https://clickpetroleoegas.com.br/feed/", src: "ClickPetróleoeGás", reg: "BR" },
  { url: "https://tnpetroleo.com.br/feed/", src: "TN Petróleo", reg: "BR" },
  { url: "https://oilprice.com/rss/main", src: "OilPrice", reg: "INT" },
  { url: "https://www.offshore-energy.biz/feed/", src: "Offshore Energy", reg: "INT" }
];

// Relevância (aplicada às fontes brasileiras, que misturam temas)
const RX = /petr[oó]le|petrobras|\bg[aá]s\b|[oó]leo|offshore|pr[eé]-?sal|\bANP\b|repetro|fpso|combust|energ[ié]|explora[çc]|barril|\boil\b|petroleum|upstream|refin|po[çc]o|sonda|plataforma|equinor|shell|prio|braskem/i;

function decode(s) {
  return (s || "")
    .replace(/<!\[CDATA\[/g, "").replace(/\]\]>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;|&#8217;|&#8216;/g, "'")
    .replace(/&nbsp;/g, " ").replace(/&#8211;|&#8212;/g, "-")
    .replace(/\s+/g, " ").trim();
}
function tag(block, name) {
  const m = block.match(new RegExp("<" + name + "[^>]*>([\\s\\S]*?)<\\/" + name + ">", "i"));
  return m ? decode(m[1]) : "";
}
function attrLink(block) {
  const m = block.match(/<link[^>]*href="([^"]+)"/i);
  return m ? m[1] : "";
}

async function parseFeed(f) {
  try {
    const res = await fetch(f.url, { headers: { "User-Agent": "Mozilla/5.0 PetroHubBot" } });
    if (!res.ok) { console.error("HTTP", res.status, f.url); return []; }
    const xml = await res.text();
    let blocks = xml.split(/<item[\s>]/i).slice(1);
    if (blocks.length === 0) blocks = xml.split(/<entry[\s>]/i).slice(1);
    return blocks.slice(0, 15).map(b => {
      const title = tag(b, "title");
      let link = tag(b, "link") || attrLink(b);
      const date = tag(b, "pubDate") || tag(b, "published") || tag(b, "updated") || new Date().toISOString();
      const desc = decode(tag(b, "description") || tag(b, "summary")).slice(0, 160);
      return { title, link, date, desc, src: f.src, reg: f.reg, translated: false };
    }).filter(n => n.title && n.link);
  } catch (e) {
    console.error("Falha no feed", f.url, e.message);
    return [];
  }
}

const results = await Promise.all(FEEDS.map(parseFeed));
const fresh = results.flat().filter(n => RX.test(n.title + " " + n.desc));

// Carrega o arquivo existente e mescla (sem sobrescrever itens já salvos)
const store = {};
if (existsSync("news.json")) {
  try {
    JSON.parse(readFileSync("news.json", "utf8")).forEach(n => {
      const k = n.link || n.title; if (k) store[k] = n;
    });
  } catch (e) { console.error("news.json ilegível, recriando."); }
}
let novos = 0;
fresh.forEach(n => { const k = n.link || n.title; if (k && !store[k]) { store[k] = n; novos++; } });

// Remove o que tem mais de 365 dias e ordena
const lim = Date.now() - 365 * 24 * 3600 * 1000;
let all = Object.values(store).filter(n => {
  const d = new Date(n.date).getTime();
  return isNaN(d) ? true : d >= lim;
});
all.sort((a, b) => new Date(b.date) - new Date(a.date));
all = all.slice(0, 2000);

writeFileSync("news.json", JSON.stringify(all, null, 1));
console.log(`news.json atualizado: ${all.length} itens no total (${novos} novos nesta execução).`);
