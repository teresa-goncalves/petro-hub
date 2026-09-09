// Gera trends.json: as notícias da seção "Tendências & Novas Energias" (espaço, IA,
// nuclear, novas energias), com os títulos já traduzidos para pt-BR.
// Criado em 09/09/2026: os 4 proxies CORS que o index.html usava para ler esses feeds
// ao vivo no navegador caíram todos (corsproxy.io passou a exigir chave e devolve 401;
// allorigins e codetabs dão timeout; thingproxy morreu), e a seção ficava VAZIA.
// Aqui não há CORS — o Actions busca o feed direto —, então a seção passa a depender de
// um arquivo no repositório, igual às outras cinco.
// Roda no GitHub Actions (Node 20+, fetch nativo, sem dependências).
import { writeFileSync } from 'node:fs';

const FEEDS = [
  { url: "https://www.space.com/feeds/all", src: "Space.com" },
  { url: "https://spacenews.com/feed/", src: "SpaceNews" },
  { url: "https://feeds.arstechnica.com/arstechnica/index", src: "Ars Technica" }
];

const LIMITE = 9; // quantos cartões a seção mostra

// O que ENTRA: o mesmo TRENDRX do index.html.
const TRENDRX = /spacex|starship|\brocket|\blaunch|\bnasa\b|artemis|lunar|\bmoon\b|\bmars\b|astronaut|sat[ée]lite|satellite|nuclear|fus[ãa]o nuclear|fusion|helium|\bh[ée]lio\b|reactor|reator|\bsmr\b|hydrogen|hidrog[êe]nio|geothermal|geot[ée]rmic|carbon capture|captura de carbono|renewable|renov[áa]vel|\bsolar\b|e[óo]lic|wind power|battery|bateria|electric vehicle|ve[íi]culo el[ée]tric|\bev\b|energy transition|transi[çc][ãa]o energ[ée]tic|clean energy|energia limpa|quantum|qu[âa]ntic|intelig[êe]ncia artificial|\bia\b|\bai\b/i;

// O que SAI: o mesmo BLOCKRX do index.html — que é o do update-news.mjs MENOS o bloco de
// espaço/astronomia. Aqui espaço é justamente o tema, então esse bloco não pode entrar.
// Ao mexer no filtro, mexer nos três: update-news.mjs, index.html e este arquivo.
const BLOCKRX = /aluguel social|habitacional|moradias|c[âa]ncer|cancer|colorretal|colorectal|tumor|oncolog|carcinom|doen[çc]a|disease|\bsa[úu]de\b|\bhealth\b|m[ée]dic|medical|hospital|cl[íi]nic|paciente|patient|sintoma|symptom|diagnost|diagnosis|terapia|therapy|tratamento m[ée]dic|vacina|vaccine|v[íi]rus|viral|epidemi|pandemic|obesidade|obesity|diabetes|alzheimer|card[íi]ac|cardiac|nutri|dieta|\bdiet\b|\binss\b|aposentador|aposentadoria|previd[êe]nci|\bbpc\b|pens[ãa]o|pens[õo]es|sal[áa]rio[- ]?m[íi]nimo|abono salarial|bolsa fam[íi]lia|aux[íi]lio|\bfgts\b|13[ºo] sal[áa]rio|concurso p[úu]blico|\bvaga\b|\bvagas\b|emprego|contrata[çc][ãa]o de pessoal|loteria|mega-?sena|hor[óo]scopo|celebridad|novela|\bbbb\b|futebol|campeonato|empr[ée]stimo|consignad|dinheiro esquecido|valores esquecidos|valores a receber|advogado alerta|nome limpo|nome sujo|score de cr[ée]dito|serasa|\bspc\b|golpe do|benef[íi]cio esquecido|d[íi]vida limpa|pouca gente sabe|voc[êe] sabia|curiosidad|ningu[ée]m imagina|cientistas (descobr|revel)|planta sul-americana|[áa]rvore (barrigud|centen|frut|gigante|mais (alta|velha))|tronco barrigudo|celular seguro|rodovia|marginais|ped[áa]gio|pedagio|fezes|fecal|fecais|dejeto|esgoto|reconhecer firma|cart[óo]rio|biometria|quilometragem|vender o carro|venda do carro|\bdetran\b|\batpv\b|abrigo antia[ée]reo|segunda guerra|\bbunker\b|achado arqueol[óo]gic|plataforma (de|da|do) (ia|intelig[êe]ncia artificial|streaming|v[íi]deo|e-?commerce|neg[óo]cios|educa[çc][ãa]o|apostas)|redes sociais|spotify|institui[çc][õo]es financeiras|consumidor\.gov|reclame aqui|lagarta|fungo|planta[çc][ãa]o|casa pr[óo]pria|voltou [àa] escola|\bEJA\b|agricultura familiar|morango|maracuj[áa]|lavoura|colheita|pomar|\bhorta\b|\bro[çc]a\b|flores de goi[áa]s|papel higi[êe]nico|rolos? de papel|excel em pdf|pdf em excel|word em pdf|transformar (excel|word|pdf|planilha)|converter (excel|word|pdf|imagem|arquivo)|dicas (incr[íi]ve|geniais|caseiras|infal[íi]ve)|truques? (incr[íi]ve|geniais|caseiros|infal[íi]ve|de)|\d+ (modos?|formas?|maneiras?|jeitos?|dicas?|truques?) (f[áa]ce|simples|para|de|incr[íi]ve|geniais)|olhar para .{0,40} de outra forma|v[ãa]o fazer voc[êe]|vai fazer voc[êe]|safira|esmeralda|quilates|pedra preciosa|garimpo|po[çc]o (artesiano|tubular|caseiro|de [áa]gua|no quintal)|po[çc]o (na|da) pr[óo]pria terra|[áa]gua subterr[âa]nea|cabelos? oleos|\bfiat\b|renault|volkswagen|chevrolet|hyundai|\btoyota\b|motor turbo|inje[çc][ãa]o direta|taxista|airfryer|air fryer|fog[ãa]o|eletrodom[ée]stic|micro-?ondas|electrolux|\bpix\b|banco central europeu|explora[çc][ãa]o sexual|tr[áa]fico de (pessoas|mulheres)|traficar|aldeia de|chal[ée]|luciano hang|\bhavan\b|\bbets\b|apostar em|casa de aposta|nudific|nudify|deepfake|\bnudes?\b|imagens [íi]ntimas|sexualiz|pornogr|abuso sexual|ass[ée]dio sexual|predador sexual|conte[úu]do sexual|\bcsam\b|aliciamento/i;

const ok = (n) => {
  const s = (n.title || "") + " " + (n.desc || "");
  return TRENDRX.test(s) && !BLOCKRX.test(s);
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
      return { title, link, date, desc, src: f.src, translated: false };
    }).filter(n => n.title && n.link);
  } catch (e) {
    console.error("Falha no feed", f.url, e.message);
    return [];
  }
}

// --- Tradução dos títulos (mesma cascata do update-news.mjs) ---
let TRAD_OK = 0, TRAD_FALHA = 0, TRAD_ULT_ERRO = "";
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getJson(url) {
  const r = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 PetroHubBot" },
    signal: AbortSignal.timeout(15000)
  });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return await r.json();
}

const TRADUTORES = [
  { nome: "google-gtx", fn: async t => {
      const j = await getJson("https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=pt-BR&dt=t&q=" + encodeURIComponent(t));
      return j[0].map(x => x[0]).join("");
  } },
  { nome: "google-chrome-ex", fn: async t => {
      const j = await getJson("https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=en&tl=pt&q=" + encodeURIComponent(t));
      const v = Array.isArray(j) ? (Array.isArray(j[0]) ? j[0][0] : j[0]) : null;
      return typeof v === "string" ? v : null;
  } },
  { nome: "mymemory", fn: async t => {
      const j = await getJson("https://api.mymemory.translated.net/get?langpair=en|pt-BR&q=" + encodeURIComponent(t));
      const v = j && j.responseData && j.responseData.translatedText;
      if (typeof v !== "string") return null;
      if (/MYMEMORY WARNING|QUERY LENGTH LIMIT|INVALID/i.test(v)) return null;
      return v;
  } },
  { nome: "lingva", fn: async t => {
      const j = await getJson("https://lingva.ml/api/v1/en/pt/" + encodeURIComponent(t));
      return j && typeof j.translation === "string" ? j.translation : null;
  } }
];

async function translatePt(text) {
  for (const p of TRADUTORES) {
    try {
      const out = await p.fn(text);
      if (out && out.trim() && out.trim().toLowerCase() !== text.trim().toLowerCase()) {
        TRAD_OK++;
        return out.trim();
      }
    } catch (e) {
      TRAD_ULT_ERRO = p.nome + ": " + e.message;
    }
  }
  TRAD_FALHA++;
  return null;
}

const results = await Promise.all(FEEDS.map(parseFeed));
let itens = results.flat().filter(ok);

// tira repetido, ordena do mais novo e corta no limite da seção
const vistos = new Set();
itens = itens.filter(n => {
  const k = n.link || n.title;
  if (!k || vistos.has(k)) return false;
  vistos.add(k);
  return true;
});
itens.sort((a, b) => new Date(b.date) - new Date(a.date));
itens = itens.slice(0, LIMITE);

for (const n of itens) {
  const t = await translatePt(n.title);
  if (t) { n.title = t; n.translated = true; }
  await sleep(200);
}

// Rede de segurança: se os feeds falharem todos, NÃO sobrescreve o arquivo bom com um
// vazio — a seção continua mostrando o que já tinha até a próxima rodada dar certo.
if (itens.length === 0) {
  console.log("::warning::Nenhum item passou no filtro; trends.json mantido como estava.");
  process.exit(0);
}

writeFileSync("trends.json", JSON.stringify({ updated: new Date().toISOString(), items: itens }, null, 1));
console.log(`trends.json atualizado: ${itens.length} item(ns).`);
console.log(`Tradução: ${TRAD_OK} título(s) traduzido(s), ${TRAD_FALHA} falha(s).`);
if (TRAD_FALHA > 0) console.log(`::warning::Tradução falhou em ${TRAD_FALHA} título(s). Último erro: ${TRAD_ULT_ERRO}`);
if (itens.length < 5) console.log(`::warning::Só ${itens.length} item(ns) em Tendências — conferir se algum feed mudou de endereço.`);
