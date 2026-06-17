// Gera catalog.json: lista completa de bens do Anexo II do Decreto 12.955/2026 (Repetro),
// Tabelas I a IV, lida direto do Planalto. Associa um ícone por categoria (palavra-chave).
// Roda no GitHub Actions (Node 20+, fetch nativo, sem dependências).
import { writeFileSync } from 'node:fs';

const URL = "https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2026/decreto/d12955.htm";

function iconFor(d) {
  d = d.toLowerCase();
  if (/\brov\b|ve[íi]culo submarino/.test(d)) return 'rov';
  if (/v[áa]lvula|[áa]rvore de natal|obturador|atuador|christmas/.test(d)) return 'valvula';
  if (/compressor|turbina|\bskid\b|expander|compander|soprador|compress[ãa]o/.test(d)) return 'skid';
  if (/bomba|bombeamento|hidr[áa]ulica de pot[êe]ncia|\bhpu\b/.test(d)) return 'bomba';
  if (/manifold|\bplet\b|\bplem\b|submarin|inje[çc][ãa]o de [áa]gua|\brwi\b|jumper|umbilical/.test(d)) return 'subsea';
  if (/transformador|painel|quadro|el[ée]tric|gerador/.test(d)) return 'eletrica';
  if (/\bfpso\b/.test(d)) return 'fpso';
  if (/plataforma|navio-?sonda|drillship|semissubmers|jack-?up/.test(d)) return 'plataforma';
  if (/navio|embarca[çc][ãa]o|\bbarco\b|\bpsv\b|\bahts\b|\bdsv\b|\bplsv\b|aliviador/.test(d)) return 'barco';
  if (/criog[êe]nic|\bgnl\b|tanque|regaseific|vaporiz/.test(d)) return 'cryo';
  if (/defensa|fender/.test(d)) return 'defensa';
  if (/ferramenta|cortador|\bchave\b|alicate/.test(d)) return 'ferramenta';
  if (/filtr|secagem|membrana|difusor|separador/.test(d)) return 'filtro';
  if (/guindaste|elevador|mesa.*perfura|guincho/.test(d)) return 'guindaste';
  if (/\bcabo\b|amarra|\bcorda\b|corrente|gancho/.test(d)) return 'cabo';
  if (/fonte radioativa|instrumento|medi[çc][ãa]o|sensor|controle|aquisi[çc][ãa]o|cromatografia/.test(d)) return 'instr';
  if (/\btubo\b|\bduto\b|drill pipe|wash pipe|riser|coluna|mangueira|mangote|conex|junta|flange/.test(d)) return 'tubo';
  return 'tubo';
}

function parseTable(text, startRe, endRe, hasActivity) {
  const i = text.search(startRe);
  if (i < 0) return [];
  const rest = text.slice(i);
  const j = rest.slice(60).search(endRe);
  const seg = j < 0 ? rest.slice(0, 70000) : rest.slice(0, j + 60);
  const after = seg.split(/DESCRI[ÇC][ÃA]O COMERCIAL/i)[1] || seg;
  const re = /(\d{1,3})\s+(\d{2,4}(?:\.\d{2}){0,3})\s+(.+?)(?=\s+\d{1,3}\s+\d{2,4}(?:\.\d{2}){0,3}\s+|$)/g;
  let m, out = [];
  while ((m = re.exec(after))) {
    let desc = m[3].replace(/\s+/g, ' ').trim();
    if (hasActivity) {
      const dot = desc.indexOf('. ');
      if (dot > 0 && dot < 90) desc = desc.slice(dot + 2);
    }
    desc = desc.replace(/\*+/g, '').replace(/\s*\.$/, '.').trim().slice(0, 130);
    if (desc.length > 3) out.push({ ncm: m[2], desc, ic: iconFor(desc) });
  }
  return out;
}

const res = await fetch(URL, { headers: { "User-Agent": "Mozilla/5.0 PetroHubBot" } });
if (!res.ok) { console.error("HTTP", res.status); process.exit(1); }
const ab = await res.arrayBuffer();
// A página do Planalto costuma ser ISO-8859-1/Windows-1252. Tenta UTF-8;
// se aparecer caractere de substituição, redecodifica como windows-1252.
let html = new TextDecoder('utf-8', { fatal: false }).decode(ab);
if (html.includes('�')) {
  html = new TextDecoder('windows-1252').decode(ab);
}
// remove scripts/estilos e tags; decodifica entidades básicas; normaliza espaços
let t = html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ');
t = t.replace(/&nbsp;/gi, ' ').replace(/&ordm;|&#186;/gi, 'º').replace(/&ordf;|&#170;/gi, 'ª')
     .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
     .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&deg;/gi, '°')
     .replace(/&[a-z0-9#]+;/gi, ' ').replace(/\s+/g, ' ');

const tables = {
  T1: parseTable(t, /TABELA I\s+LISTA DE BENS\s*\(REPETRO-TEMPOR/i, /TABELA II\s+LISTA DE BENS/i, false),
  T2: parseTable(t, /TABELA II\s+LISTA DE BENS\s*\(GNL/i, /TABELA III\s+LISTA DE BENS/i, true),
  T3: parseTable(t, /TABELA III\s+LISTA DE BENS\s*\(REPETRO-PERMAN/i, /TABELA IV\s+LISTA DE BENS/i, false),
  T4: parseTable(t, /TABELA IV\s+LISTA DE BENS\s*\(REPETRO-ENTREP/i, /ANEXO III|ANEXO IV|A N E X O/i, false)
};

const counts = { T1: tables.T1.length, T2: tables.T2.length, T3: tables.T3.length, T4: tables.T4.length };
const data = { updated: new Date().toISOString(), source: URL, counts, tables };
writeFileSync("catalog.json", JSON.stringify(data));
console.log("catalog.json gerado:", JSON.stringify(counts));
