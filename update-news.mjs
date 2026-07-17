// Atualiza news.json: busca feeds de óleo e gás, acumula (até 1 ano), remove o que é mais antigo.
// Roda no GitHub Actions (Node 20+, fetch nativo, sem dependências).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const FEEDS = [
  { url: "https://epbr.com.br/feed/", src: "epbr", reg: "BR" },
  { url: "https://petronoticias.com.br/feed/", src: "Petronotícias", reg: "BR" },
  { url: "https://tnpetroleo.com.br/feed/", src: "TN Petróleo", reg: "BR" },
  { url: "https://oilprice.com/rss/main", src: "OilPrice", reg: "INT" },
  { url: "https://www.offshore-energy.biz/feed/", src: "Offshore Energy", reg: "INT" },
  { url: "https://clickpetroleoegas.com.br/feed/", src: "ClickPetróleoeGás", reg: "BR" },
  { url: "https://www.cnnbrasil.com.br/feed/", src: "CNN Brasil", reg: "BR" }
];

// Relevância (aplicada às fontes brasileiras, que misturam temas)
const RX = /petr[oó]le|petrobras|\bg[aá]s\b|[oó]leo|offshore|pr[eé]-?sal|\bANP\b|repetro|fpso|combust|explora[çc]|barril|\boil\b|petroleum|upstream|refin|po[çc]o|sonda|plataforma|equinor|shell|prio|braskem|descomission|decommission|desativa[çc][ãa]o|abandono de po[çc]o|plug.?and.?abandon|well abandon/i;

// Bloqueio de temas fora do setor (mesmo que a fonte cite "óleo e gás" no rodapé): saúde, previdência, vagas, espaço/astronomia, etc.
// Obs.: temas de espaço/astronomia pertencem à seção "Tendências", não às notícias de óleo e gás.
const BLOCKRX = /aluguel social|habitacional|moradias|c[âa]ncer|cancer|colorretal|colorectal|tumor|oncolog|carcinom|doen[çc]a|disease|\bsa[úu]de\b|\bhealth\b|m[ée]dic|medical|hospital|cl[íi]nic|paciente|patient|sintoma|symptom|diagnost|diagnosis|terapia|therapy|tratamento m[ée]dic|vacina|vaccine|v[íi]rus|viral|epidemi|pandemic|obesidade|obesity|diabetes|alzheimer|cardíac|cardiac|nutri|dieta|\bdiet\b|\binss\b|aposentador|aposentadoria|previd[êe]nci|\bbpc\b|pens[ãa]o|pens[õo]es|sal[áa]rio[- ]?m[íi]nimo|abono salarial|bolsa fam[íi]lia|aux[íi]lio|\bfgts\b|13[ºo] sal[áa]rio|concurso p[úu]blico|\bvaga\b|\bvagas\b|emprego|contrata[çc][ãa]o de pessoal|loteria|mega-?sena|hor[óo]scopo|celebridad|novela|\bbbb\b|futebol|campeonato|asteroide|asteroid|\blua\b|lunar|espacial|espa[çc]o sideral|\bfoguete|\bnasa\b|spacex|astronom|c[óo]smic|gal[áa]xia|\bestrela\b|telesc[óo]pio|\bmarte\b|\bj[úu]piter\b|\bsaturno\b|plut[ãa]o|cometa|meteoro|buraco negro|via l[áa]ctea|kamo|interestelar|exoplaneta|sonda (espacial|chinesa|da nasa|cient[íi]fica|solar|interestelar)|empr[ée]stimo|consignad|dinheiro esquecido|valores esquecidos|valores a receber|advogado alerta|nome limpo|nome sujo|score de cr[ée]dito|serasa|\bspc\b|golpe do|benef[íi]cio esquecido|d[íi]vida limpa|pouca gente sabe|voc[êe] sabia|[áa]rvore|tronco barrigudo|curiosidad|ningu[ée]m imagina|cientistas (descobr|revel)|planta sul-americana|celular seguro|rodovia|marginais|ped[áa]gio|pedagio|fezes|fecal|fecais|dejeto|esgoto/i;

// Mantém só notícias do setor: legislação sempre entra; demais precisam casar RX e não casar BLOCKRX.
const ok = (n) => {
  const s = (n.title || "") + " " + (n.desc || "");
  return n.reg === "LEI" || (RX.test(s) && !BLOCKRX.test(s));
};

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

async function translatePt(text) {
  try {
    const u = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=pt&dt=t&q=" + encodeURIComponent(text);
    const r = await fetch(u);
    if (!r.ok) return null;
    const j = await r.json();
    return j[0].map(s => s[0]).join("");
  } catch (e) { return null; }
}

const results = await Promise.all(FEEDS.map(parseFeed));
const fresh = results.flat().filter(ok);

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
for (const n of fresh) {
  const k = n.link || n.title;
  if (k && !store[k]) {
    if (n.reg === "INT" && n.title) {
      const t = await translatePt(n.title);
      if (t) { n.title = t; n.translated = true; }
    }
    store[k] = n;
    novos++;
  }
}

// Remove itens fora do tema (ex.: INSS/previdência/vagas) e o que tem mais de 365 dias; ordena
const lim = Date.now() - 365 * 24 * 3600 * 1000;
let all = Object.values(store).filter(n => {
  if (!ok(n)) return false; // limpa itens fora do tema que ficaram salvos em execuções anteriores
  const d = new Date(n.date).getTime();
  return isNaN(d) ? true : d >= lim;
});
all.sort((a, b) => new Date(b.date) - new Date(a.date));
all = all.slice(0, 2000);

writeFileSync("news.json", JSON.stringify(all, null, 1));
console.log(`news.json atualizado: ${all.length} itens no total (${novos} novos nesta execução).`);
