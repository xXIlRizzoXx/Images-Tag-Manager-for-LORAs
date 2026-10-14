/*
 * ITALIANO: unisce nuovi tag al dizionario dei suggerimenti senza creare doppioni.
 *
 *   Passo 1 — guarda cosa c'e' di nuovo:
 *     node scripts/merge-tag-suggestions.mjs lista1.txt lista2.txt
 *   Stampa quanti tag erano gia' presenti (e in quale categoria) e quali mancano.
 *   Con --out piano.json scrive un file gia' pronto da riempire, dove per ogni tag
 *   nuovo si indica la categoria e la traduzione italiana.
 *
 *   Passo 2 — inseriscili davvero:
 *     node scripts/merge-tag-suggestions.mjs --apply piano.json
 *   Aggiunge ogni tag in fondo alla sua categoria dentro src/constants/tagSuggestions.ts.
 *   Non tocca nulla se un tag risulta gia' presente o se la categoria non esiste.
 *
 * ENGLISH: merges new tags into the suggestion dictionary without ever creating duplicates.
 *   Step 1 reports what is new, step 2 (--apply) inserts them into their category.
 *   A tag already in the dictionary is never inserted twice, whatever its spelling.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE_TAG = path.join(ROOT, 'src', 'constants', 'tagSuggestions.ts');

const argv = process.argv.slice(2);
const argOf = (n) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : null; };
const APPLY = argOf('apply');
const OUT = argOf('out');
const ingressi = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));

// ITALIANO: due tag sono "lo stesso tag" anche se scritti con trattini bassi, doppi spazi
//   o maiuscole diverse: e' cosi' che si evitano i doppioni veri.
// ENGLISH: two tags are "the same tag" even when spelled with underscores, extra spaces or
//   different case: that is what actually prevents duplicates.
const chiave = t => String(t).toLowerCase().replace(/[_\s]+/g, ' ').replace(/\s*\(.*?\)\s*/g, ' ').trim();

// ITALIANO: la forma con cui un tag nuovo entra nel dizionario, dove sono tutti in minuscolo con
//   spazi singoli: 'Blue_Sky' diventa 'blue sky'. Le parentesi restano (a differenza di chiave),
//   e un'emoticon senza lettere ne' cifre (^_^) tiene i suoi trattini bassi.
// ENGLISH: the form in which a new tag enters the dictionary, where every tag is lowercase with
//   single spaces: 'Blue_Sky' becomes 'blue sky'. Parentheses stay (unlike chiave), and an
//   emoticon without letters or digits (^_^) keeps its underscores.
// ITALIANO: il trattino basso resta anche dove fa parte del tag, perche' i modelli conoscono
//   solo quella forma: le emoticon di WD14 (o_o, x_x, 0_0: un segno, _, un segno, piu' le poche
//   piu' lunghe) e i tag di qualita' di Pony (score_9, score_8_up, source_anime, rating_safe).
//   Vale anche per un piano corretto a mano, che passa di qui con --apply.
// ENGLISH: the underscore also stays where it is part of the tag, because models only know that
//   form: the WD14 emoticons (o_o, x_x, 0_0: one sign, _, one sign, plus the few longer ones)
//   and Pony's quality tags (score_9, score_8_up, source_anime, rating_safe). This also holds for
//   a plan corrected by hand, which goes through here on --apply.
const EMOTICON_LUNGHE = new Set(['(o)_(o)', '<o>_<o>', '<|>_<|>', '||_||']);
const tieneTrattino = s => /^[^\s_]_[^\s_]$/u.test(s) || EMOTICON_LUNGHE.has(s) || /^(score|source|rating)_[\p{L}\p{N}_]+$/u.test(s);
const grafia = t => {
    const s = String(t).toLowerCase().trim();
    if (tieneTrattino(s)) return s;
    return (/[\p{L}\p{N}]/u.test(s) ? s.replace(/[_\s]+/g, ' ') : s.replace(/\s+/g, ' ')).trim();
};

function leggiDizionario() {
    const src = fs.readFileSync(FILE_TAG, 'utf8');
    const categorie = [];
    const reCat = /\{\s*\n\s*id: '([^']+)',\s*\n\s*name: \{ it: '((?:[^'\\]|\\.)*)', en: '((?:[^'\\]|\\.)*)' \}/g;
    let m;
    while ((m = reCat.exec(src)) !== null) categorie.push({ id: m[1], it: m[2], en: m[3], da: m.index });
    categorie.forEach((c, i) => { c.a = i + 1 < categorie.length ? categorie[i + 1].da : src.length; });

    const perChiave = new Map();
    for (const c of categorie) {
        c.tags = [];
        const blocco = src.slice(c.da, c.a);
        const reTag = /\{ tag: '((?:[^'\\]|\\.)*)'/g;
        let t;
        while ((t = reTag.exec(blocco)) !== null) {
            const nome = t[1].replace(/\\'/g, "'");
            c.tags.push(nome);
            if (!perChiave.has(chiave(nome))) perChiave.set(chiave(nome), { tag: nome, categoria: c.id });
        }
    }
    return { src, categorie, perChiave };
}

function leggiTagDaFile(file) {
    const testo = fs.readFileSync(file, 'utf8');
    let grezzi = [];
    if (file.toLowerCase().endsWith('.json')) {
        const d = JSON.parse(testo);
        // ITALIANO: il .json salvato dall'editor porta anche nome dell'app, tipo e versione:
        //   se ne prendessi tutte le stringhe finirebbe "Images Tag Manager for LORAs" fra i tag.
        // ENGLISH: the .json written by the editor also carries the app name, type and version:
        //   collecting every string would file "Images Tag Manager for LORAs" as a tag.
        if (d && typeof d === 'object' && !Array.isArray(d) && (Array.isArray(d.tags) || Array.isArray(d.globalTriggers))) {
            grezzi = [...(d.globalTriggers || []), ...(d.tags || [])].filter(v => typeof v === 'string');
        } else {
            const SALTA = new Set(['app', 'type', 'version', 'format', 'generator', 'exportedAt', 'name']);
            const raccogli = (v, chiave) => {
                if (SALTA.has(chiave)) return;
                if (typeof v === 'string') grezzi.push(v);
                else if (Array.isArray(v)) v.forEach(x => raccogli(x, chiave));
                else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => raccogli(x, k));
            };
            raccogli(d, '');
        }
    } else {
        // i .txt dei dataset separano con virgole, a volte con a capo
        grezzi = testo.split(/[,\n\r]+/);
    }
    return grezzi.map(t => t.trim()).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Passo 2: inserimento vero
// ---------------------------------------------------------------------------
if (APPLY) {
    const piano = JSON.parse(fs.readFileSync(APPLY, 'utf8'));
    const { src, categorie, perChiave } = leggiDizionario();
    const perCategoria = new Map();
    const saltati = [];

    for (const [tag, info] of Object.entries(piano)) {
        const k = chiave(tag);
        if (perChiave.has(k)) { saltati.push(`${tag} -> gia' presente in ${perChiave.get(k).categoria}`); continue; }
        const cat = categorie.find(c => c.id === info.categoria);
        if (!cat) { saltati.push(`${tag} -> categoria sconosciuta "${info.categoria}"`); continue; }
        if (!info.it || !String(info.it).trim()) { saltati.push(`${tag} -> manca la traduzione italiana`); continue; }
        if (!perCategoria.has(cat.id)) perCategoria.set(cat.id, []);
        perCategoria.get(cat.id).push({ tag: grafia(tag), it: String(info.it).trim() });
        perChiave.set(k, { tag: grafia(tag), categoria: cat.id });   // niente doppioni dentro lo stesso piano
    }

    // inserisco partendo dal fondo del file, cosi' le posizioni non si spostano
    let nuovo = src;
    const daFare = categorie.filter(c => perCategoria.has(c.id)).sort((a, b) => b.da - a.da);
    for (const cat of daFare) {
        const blocco = nuovo.slice(cat.da, cat.a);
        const ultimo = blocco.lastIndexOf('{ tag:');
        if (ultimo === -1) { saltati.push(`categoria ${cat.id} senza tag, saltata`); continue; }
        const fineRiga = blocco.indexOf('\n', ultimo);
        const punto = cat.da + (fineRiga === -1 ? blocco.length : fineRiga);
        const esc = s => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const righe = perCategoria.get(cat.id)
            .map(v => `\n            { tag: '${esc(v.tag)}', translations: { it: '${esc(v.it)}', en: '${esc(v.tag)}' } },`)
            .join('');
        nuovo = nuovo.slice(0, punto) + righe + nuovo.slice(punto);
        console.log(`  ${cat.en}: +${perCategoria.get(cat.id).length}`);
    }

    if (nuovo !== src) {
        fs.writeFileSync(FILE_TAG, nuovo);
        const aggiunti = [...perCategoria.values()].reduce((s, v) => s + v.length, 0);
        console.log(`\naggiunti ${aggiunti} tag a ${perCategoria.size} categorie`);
    } else {
        console.log('\nnessun tag da aggiungere');
    }
    if (saltati.length) {
        console.log(`\nsaltati ${saltati.length}:`);
        saltati.forEach(s => console.log('  ' + s));
    }
    console.log('\nora lancia:  npx tsc --noEmit');
    process.exit(0);
}

// ---------------------------------------------------------------------------
// Passo 1: rapporto
// ---------------------------------------------------------------------------
if (ingressi.length === 0) {
    console.log('uso: node scripts/merge-tag-suggestions.mjs <file di tag...> [--out piano.json]');
    console.log('     node scripts/merge-tag-suggestions.mjs --apply piano.json');
    process.exit(1);
}

const { categorie, perChiave } = leggiDizionario();
console.log(`dizionario attuale: ${perChiave.size} tag in ${categorie.length} categorie\n`);

const visti = new Map();     // chiave -> prima grafia incontrata, nella forma del dizionario
for (const f of ingressi) {
    const tags = leggiTagDaFile(f);
    let nuoviQui = 0;
    for (const t of tags) {
        const k = chiave(t);
        if (!k) continue;
        if (!visti.has(k)) { visti.set(k, grafia(t)); if (!perChiave.has(k)) nuoviQui++; }
    }
    console.log(`${path.basename(f)}: ${tags.length} tag letti, ${nuoviQui} mai visti prima`);
}

const gia = [...visti.keys()].filter(k => perChiave.has(k));
const nuovi = [...visti.entries()].filter(([k]) => !perChiave.has(k)).map(([, t]) => t).sort();

console.log(`\ntag distinti nei file : ${visti.size}`);
console.log(`gia' nel dizionario   : ${gia.length}  (non vanno reinseriti)`);
console.log(`da aggiungere         : ${nuovi.length}`);

if (nuovi.length) {
    console.log('\nnuovi:');
    nuovi.forEach(t => console.log('  ' + t));
}

if (OUT) {
    const piano = {};
    nuovi.forEach(t => { piano[t] = { categoria: '', it: '' }; });
    fs.writeFileSync(OUT, JSON.stringify(piano, null, 1));
    console.log(`\nscritto ${OUT} — riempi "categoria" e "it" per ogni tag, poi --apply`);
    console.log('categorie disponibili:');
    categorie.forEach(c => console.log(`  ${c.id.padEnd(20)} ${c.en}`));
}
