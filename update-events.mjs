// Mantém events.json: a agenda de feiras e congressos do setor.
//
// IMPORTANTE — o que este robô faz e o que ele NÃO faz.
// Não existe uma API pública de agenda de eventos de óleo e gás (diferente das
// notícias, cotações e lançamentos). Então este robô NÃO descobre eventos novos:
// ele faz a manutenção da lista curada, que é a parte que envelhece sozinha.
//
//   1. remove do site tudo que já aconteceu;
//   2. reordena por data;
//   3. confere se o site oficial de cada evento ainda responde;
//   4. quando o site publica a data em formato estruturado (JSON-LD schema.org),
//      compara com a data do arquivo e AVISA se divergir — sem sobrescrever,
//      porque uma página costuma anunciar vários sub-eventos e a leitura
//      automática erraria;
//   5. avisa quando sobram poucos eventos futuros, que é a hora de incluir novos.
//
// Os avisos saem no log do GitHub Actions (aba Actions) e ficam gravados no
// campo "avisos" do próprio events.json.
//
// Roda no GitHub Actions (Node 20+, fetch nativo, sem dependências).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const ARQUIVO = 'events.json';
const MINIMO_CONFORTAVEL = 6;   // abaixo disso, pede eventos novos
const HORIZONTE_CURTO = 120;    // dias: se o último evento estiver mais perto que isso, avisa

if (!existsSync(ARQUIVO)) {
  console.error(ARQUIVO + ' não encontrado — nada a fazer.');
  process.exit(1);
}

let base;
try {
  base = JSON.parse(readFileSync(ARQUIVO, 'utf8'));
} catch (e) {
  console.error(ARQUIVO + ' ilegível:', e.message);
  process.exit(1);
}

const itens = Array.isArray(base.items) ? base.items : [];
const avisos = [];
const hoje = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
const dia = 24 * 3600 * 1000;

function data(s) {
  const d = new Date(String(s || '') + 'T00:00:00Z');
  return isNaN(d) ? null : d;
}

// ---------- 1. remove o que já terminou ----------
const vencidos = [];
let futuros = itens.filter(ev => {
  const fim = data(ev.fim) || data(ev.inicio);
  if (!fim) { avisos.push('"' + ev.nome + '" está sem data válida e foi mantido — confira o arquivo.'); return true; }
  if (fim < hoje) { vencidos.push(ev.nome); return false; }
  return true;
});
vencidos.forEach(n => console.log('· encerrado, saiu da agenda: ' + n));

// ---------- 2. ordena (quem está sem data vai para o fim, não para o topo) ----------
futuros.sort((a, b) => {
  const da = data(a.inicio), db = data(b.inicio);
  if (!da && !db) return 0;
  if (!da) return 1;
  if (!db) return -1;
  return da - db;
});

// ---------- 3 e 4. confere os sites oficiais ----------
async function checa(ev) {
  if (!ev.url) return;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    const r = await fetch(ev.url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 PetroHubBot' }
    });
    clearTimeout(t);

    if (r.status >= 400) {
      avisos.push('O site de "' + ev.nome + '" respondeu ' + r.status + ' — o link pode ter mudado.');
      return;
    }

    const html = await r.text();
    // procura datas em JSON-LD (schema.org/Event), quando o site publicar
    const datas = new Set();
    for (const m of html.matchAll(/"startDate"\s*:\s*"(\d{4}-\d{2}-\d{2})/g)) datas.add(m[1]);
    if (datas.size && !datas.has(ev.inicio)) {
      avisos.push(
        'Possível mudança de data em "' + ev.nome + '": o arquivo diz ' + ev.inicio +
        ' e o site publica ' + [...datas].join(', ') + '. Confira antes de alterar.'
      );
    }
  } catch (e) {
    avisos.push('Não consegui abrir o site de "' + ev.nome + '" (' + (e.name === 'AbortError' ? 'tempo esgotado' : e.message) + ').');
  }
}

await Promise.all(futuros.map(checa));

// ---------- 5. a lista está encolhendo? ----------
if (futuros.length < MINIMO_CONFORTAVEL) {
  avisos.push('Só restam ' + futuros.length + ' eventos futuros na agenda — hora de pesquisar e incluir novos.');
}
const ultimo = futuros.length ? data(futuros[futuros.length - 1].inicio) : null;
if (ultimo && (ultimo - hoje) / dia < HORIZONTE_CURTO) {
  avisos.push('A agenda só alcança ' + Math.round((ultimo - hoje) / dia) + ' dias à frente — vale buscar eventos mais distantes.');
}

// ---------- grava ----------
const saida = {
  updated: new Date().toISOString(),
  avisos,
  items: futuros
};
writeFileSync(ARQUIVO, JSON.stringify(saida, null, 1) + '\n');

console.log(ARQUIVO + ': ' + futuros.length + ' eventos futuros, ' + vencidos.length + ' removidos por já terem ocorrido.');
if (avisos.length) {
  console.log('\nAvisos para revisão humana:');
  // ::warning:: destaca a linha na interface do GitHub Actions
  avisos.forEach(a => console.log('::warning::' + a));
} else {
  console.log('Nenhum aviso: links respondendo e agenda com folga.');
}
