// Gera launches.json: próximos lançamentos orbitais, traduzidos para pt-BR.
// Fonte: API pública The Space Devs (Launch Library 2), a mesma base do Spaceflight Now.
// Roda no GitHub Actions (Node 20+, fetch nativo, sem dependências).
import { writeFileSync } from 'node:fs';

const ENDPOINTS = [
  "https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=12&hide_recent_previous=true&mode=list",
  "https://lldev.thespacedevs.com/2.2.0/launch/upcoming/?limit=12&hide_recent_previous=true&mode=list"
];

const MES = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];

// Locais mais frequentes → nome em português. A chave é procurada dentro do texto original.
const LOCAIS = [
  ["Vandenberg", "Vandenberg, Califórnia (EUA)"],
  ["Cape Canaveral", "Cabo Canaveral, Flórida (EUA)"],
  ["Kennedy Space Center", "Centro Espacial Kennedy, Flórida (EUA)"],
  ["Starbase", "Starbase, Texas (EUA)"],
  ["Wallops", "Wallops, Virgínia (EUA)"],
  ["Kodiak", "Kodiak, Alasca (EUA)"],
  ["Wenchang", "Wenchang (China)"],
  ["Jiuquan", "Jiuquan (China)"],
  ["Taiyuan", "Taiyuan (China)"],
  ["Xichang", "Xichang (China)"],
  ["Haiyang", "Haiyang · plataforma marítima (China)"],
  ["Baikonur", "Baikonur (Cazaquistão)"],
  ["Vostochny", "Vostochny (Rússia)"],
  ["Plesetsk", "Plesetsk (Rússia)"],
  ["Guiana Space Centre", "Centro Espacial de Kourou (Guiana Francesa)"],
  ["Andøya", "Andøya (Noruega)"],
  ["Esrange", "Esrange (Suécia)"],
  ["SaxaVord", "SaxaVord (Escócia)"],
  ["Rocket Lab Launch Complex 1", "Mahia (Nova Zelândia)"],
  ["Mahia", "Mahia (Nova Zelândia)"],
  ["Satish Dhawan", "Sriharikota (Índia)"],
  ["Tanegashima", "Tanegashima (Japão)"],
  ["Uchinoura", "Uchinoura (Japão)"],
  ["Naro", "Naro (Coreia do Sul)"],
  ["Alcântara", "Alcântara, Maranhão (Brasil)"],
  ["Palmachim", "Palmachim (Israel)"]
];

// Ajustes finais de país, para o que não casar na lista acima.
const PAISES = [
  [/People's Republic of China/gi, "China"],
  [/Russian Federation/gi, "Rússia"],
  [/Republic of Kazakhstan/gi, "Cazaquistão"],
  [/French Guiana/gi, "Guiana Francesa"],
  [/New Zealand/gi, "Nova Zelândia"],
  [/United States|, USA/gi, " (EUA)"],
  [/Japan/gi, "Japão"],
  [/India/gi, "Índia"],
  [/Norway/gi, "Noruega"],
  [/Israel/gi, "Israel"]
];

// Nomes de operadoras que ficam longos demais no cartão.
const OPERADORAS = [
  [/China Aerospace Science and Technology Corporation/i, "CASC"],
  [/China Aerospace Science and Industry Corporation/i, "CASIC"],
  [/Mitsubishi Heavy Industries/i, "MHI"],
  [/National Aeronautics and Space Administration/i, "NASA"],
  [/United Launch Alliance/i, "ULA"],
  [/Russian Federal Space Agency.*/i, "Roscosmos"],
  [/Indian Space Research Organi[sz]ation/i, "ISRO"],
  [/Japan Aerospace Exploration Agency/i, "JAXA"],
  [/European Space Agency/i, "ESA"]
];

const TIPOS = {
  "Communications": "comunicações",
  "Earth Science": "observação da Terra",
  "Planetary Science": "ciência planetária",
  "Astrophysics": "astrofísica",
  "Heliophysics": "física solar",
  "Human Exploration": "voo tripulado",
  "Resupply": "reabastecimento da estação",
  "Test Flight": "voo de teste",
  "Navigation": "navegação",
  "Tourism": "turismo espacial",
  "Government/Top Secret": "carga militar/classificada",
  "Dedicated Rideshare": "carona compartilhada",
  "Suborbital": "voo suborbital",
  "Unknown": ""
};

function local(txt) {
  const t = txt || "";
  for (const [chave, pt] of LOCAIS) if (t.includes(chave)) return pt;
  let out = t;
  for (const [re, pt] of PAISES) out = out.replace(re, pt);
  return out.replace(/\s*,\s*\(EUA\)/, " (EUA)").replace(/\s+/g, " ").trim();
}

function operadora(nome) {
  const t = nome || "";
  for (const [re, curto] of OPERADORAS) if (re.test(t)) return curto;
  return t;
}

// "Falcon 9 Block 5 | Starlink Group 17-53" → { foguete, missao }
function partes(nome) {
  const p = String(nome || "").split("|");
  const foguete = (p.length > 1 ? p[0] : "").replace(/\bBlock 5\b/, "").trim();
  const missao = (p.length > 1 ? p.slice(1).join("|") : p[0] || "Lançamento")
    .replace(/\bGroup\b/, "")
    .replace(/^\s*Unknown Payload\s*$/i, "carga não divulgada")
    .replace(/\s+/g, " ").trim();
  return { foguete, missao };
}

// Data/hora sempre no fuso de Brasília, para o dia do selo bater com o horário do texto.
function brasilia(dt) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false
    }).formatToParts(dt).map(x => [x.type, x.value])
  );
  return p;
}

async function getJSON(u) {
  const r = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0 PetroHubBot" } });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}

let data = null, usada = "";
for (const u of ENDPOINTS) {
  try { data = await getJSON(u); usada = u; break; }
  catch (e) { console.error("Falha em", u, e.message); }
}
if (!data || !Array.isArray(data.results)) {
  console.error("Nenhuma fonte respondeu; launches.json não foi alterado.");
  process.exit(1);
}

const itens = data.results.slice(0, 8).map(l => {
  const dt = new Date(l.net);
  const prec = (l.net_precision && l.net_precision.abbrev) || "";
  // Só mostra dia/mês quando a data é confiável (minuto, hora ou dia).
  const exata = !isNaN(dt) && ["MIN", "HR", "DAY"].includes(prec);
  const { foguete, missao } = partes(l.name);
  const tipo = TIPOS[l.mission_type] || "";
  const p = exata ? brasilia(dt) : null;
  const quando = exata ? p.day + "/" + p.month + ", " + p.hour + ":" + p.minute + " (Brasília)" : "data a confirmar";
  return {
    d: exata ? p.day : "--",
    mo: exata ? MES[Number(p.month) - 1] : "",
    missao: [foguete, missao].filter(Boolean).join(" · "),
    sub: [operadora(l.lsp_name), local(l.location), quando, tipo].filter(Boolean).join(" · "),
    net: l.net || null
  };
});

const out = {
  updated: new Date().toISOString(),
  source: usada.split("/2.2.0")[0],
  items: itens
};
writeFileSync("launches.json", JSON.stringify(out, null, 1));
console.log("launches.json atualizado: " + itens.length + " lançamentos (fonte: " + out.source + ").");
