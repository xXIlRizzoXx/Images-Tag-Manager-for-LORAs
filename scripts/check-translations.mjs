/*
 * ITALIANO: Controllo meccanico delle 9 lingue di src/constants.ts.
 *   Verifica quello che si puo' verificare senza leggere: stesse chiavi ovunque, nessuna voce
 *   vuota, nessun doppione, stessi segnaposto ({n}, {done}, {failed}) in tutte le lingue, e
 *   segnala le voci identiche all'inglese (spesso una traduzione dimenticata, a volte no), e
 *   che una scritta che NOMINA un comando lo chiami con l'etichetta vera di quel comando, e che
 *   ogni chiave letta dal codice senza tipo (t.<chiave> nei componenti) esista davvero.
 *   Serve perche' il controllo dei tipi NON copre queste scritte: quelle lette dentro i
 *   componenti arrivano senza tipo, quindi una chiave mancante li' passerebbe inosservata.
 *   Uso:  node scripts/check-translations.mjs [lingua]
 *   Esce con 1 se trova qualcosa di rotto, cosi' puo' stare in una verifica automatica.
 *
 * ENGLISH: Mechanical check of the 9 languages in src/constants.ts.
 *   Verifies what can be verified without reading: same keys everywhere, no empty entries, no
 *   duplicates, same placeholders ({n}, {done}, {failed}) in every language, and flags entries
 *   identical to English (often a forgotten translation, sometimes not), and that a string
 *   NAMING a command spells it exactly as that command's own label, and that every key the code
 *   reads untyped (t.<key> in the components) really exists.
 *   It exists because the type check does NOT cover these strings: the ones read inside the
 *   components arrive untyped, so a key missing there would go unnoticed.
 *   Usage:  node scripts/check-translations.mjs [language]
 *   Exits 1 when something is broken, so it can sit in an automated check.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const FILE = 'src/constants.ts';
const src = readFileSync(FILE, 'utf8');
const soloLingua = process.argv[2] || '';

const righe = src.split(/\r?\n/);
const lingue = new Map();
let corrente = null;
righe.forEach((riga, i) => {
    const apertura = riga.match(/^    ([a-z]{2}): \{\s*$/);
    if (apertura) { corrente = apertura[1]; lingue.set(corrente, new Map()); return; }
    if (!corrente) return;
    if (/^    \},?\s*$/.test(riga)) { corrente = null; return; }
    const voce = riga.match(/^        ([A-Za-z0-9_]+):\s*(.*)$/);
    if (voce) {
        const valore = voce[2].replace(/,\s*$/, '');
        const testo = valore.startsWith('"') ? valore.slice(1, valore.lastIndexOf('"')) : valore;
        const mappa = lingue.get(corrente);
        if (mappa.has(voce[1])) mappa.set(voce[1], { testo, riga: i + 1, doppione: true });
        else mappa.set(voce[1], { testo, riga: i + 1, doppione: false });
    }
});

const codici = [...lingue.keys()];
console.log(`lingue trovate: ${codici.join(', ')}`);
if (codici.length === 0) { console.error('ERRORE: nessun blocco lingua riconosciuto'); process.exit(1); }
// ITALIANO: le lingue trovate devono essere esattamente le nove attese. Un blocco con la riga
//   d'apertura scritta un po' diversa (un commento in fondo, le virgolette) spariva in silenzio dal
//   controllo, con tutte le sue chiavi, e il controllo passava con otto lingue. E una lingua chiesta
//   sulla riga di comando che non esiste ("pt-BR") non controllava niente e passava lo stesso.
// ENGLISH: the languages found must be exactly the nine expected. A block whose opening line was
//   written a little differently (a trailing comment, quotes) silently dropped out of the check,
//   with all its keys, and the check passed with eight languages. And a language requested on the
//   command line that does not exist ("pt-BR") checked nothing and passed all the same.
const ATTESE = ['it', 'en', 'fr', 'es', 'de', 'zh', 'ja', 'pt', 'ru'];
const nonTrovate = ATTESE.filter(c => !lingue.has(c));
const inattese = codici.filter(c => !ATTESE.includes(c));
if (nonTrovate.length || inattese.length) {
    console.error(`ERRORE: lingue attese ${ATTESE.join(', ')}; non trovate: ${nonTrovate.join(', ') || '-'}; inattese: ${inattese.join(', ') || '-'}`);
    process.exit(1);
}
if (soloLingua && !ATTESE.includes(soloLingua)) {
    console.error(`ERRORE: lingua sconosciuta "${soloLingua}"; quelle valide sono ${ATTESE.join(', ')}`);
    process.exit(1);
}

// ITALIANO: quando una scritta NOMINA un comando, deve nominarlo con l'etichetta vera di
//   quel comando, nella stessa lingua. E' un difetto che qui e' gia' tornato tre volte, e a
//   occhio non si vede: bisogna avere davanti due righe distanti 40 righe l'una dall'altra.
//   Ogni coppia e' [chiave che cita, chiave citata].
// ENGLISH: when a string NAMES a command, it must name it with that command's real label, in
//   the same language. This has come back three times already and the eye does not catch it:
//   the two lines sit forty lines apart. Each pair is [quoting key, quoted key].
// ITALIANO: il terzo elemento, se c'e', da' per una lingua la forma esatta da cercare al posto
//   dell'etichetta: il russo declina i nomi ("в Настройках" e' l'etichetta "Настройки" al caso
//   giusto), e una regola larga per tutti nasconderebbe proprio gli errori che qui si cercano.
// ENGLISH: the third element, when present, gives for one language the exact form to look for
//   instead of the label: Russian inflects nouns ("в Настройках" is the label "Настройки" in the
//   right case), and a loose rule for everyone would hide the very mistakes looked for here.
const CITAZIONI = [
    ['aiSkipTaggedHint', 'aiAutoTagAll'],
    ['trashInfo', 'restore'],
    ['trashInfo', 'emptyTrash'],
    ['trashInfo', 'loadFolder'],
    ['aiKeyGuideStep5Desc', 'aiKeyLabel'],
    ['updateAskMsg', 'settings', { ru: 'Настройках' }],
    ['langPickerHint', 'settings', { ru: 'Настройках' }],
    ['deleteNoRecycleBin', 'loadFolder'],
    ['zipPhotoUnreadable', 'closeImageTitle'],
    ['aiPhotoUnreadable', 'closeImageTitle'],
    ['undoEmptyTxtNotBack', 'saveChanges'],
    ['undoEmptyTxtNotBack', 'restore'],
    ['saveEmptyCaptionOne', 'emptyTrash'],
    ['saveEmptyCaptionMany', 'emptyTrash'],
    ['mcpHint', 'saveChanges'],
    ['mcpEditedNotice', 'saveChanges'],
];

const rif = 'en';
const chiaviRif = new Set(lingue.get(rif).keys());
let problemi = 0;
const segnala = (msg) => { problemi++; console.log('  PROBLEMA  ' + msg); };

for (const codice of codici) {
    if (soloLingua && codice !== soloLingua) continue;
    const mappa = lingue.get(codice);
    console.log(`\n[${codice}] ${mappa.size} voci`);

    const mancanti = [...chiaviRif].filter(k => !mappa.has(k));
    const inPiu = [...mappa.keys()].filter(k => !chiaviRif.has(k));
    if (mancanti.length) segnala(`${mancanti.length} chiavi MANCANTI rispetto a ${rif}: ${mancanti.slice(0, 10).join(', ')}${mancanti.length > 10 ? '…' : ''}`);
    if (inPiu.length) segnala(`${inPiu.length} chiavi IN PIU' rispetto a ${rif}: ${inPiu.slice(0, 10).join(', ')}${inPiu.length > 10 ? '…' : ''}`);

    for (const [chiave, v] of mappa) {
        if (v.doppione) segnala(`chiave DOPPIA "${chiave}" (riga ${v.riga})`);
        if (v.testo.trim() === '') segnala(`voce VUOTA "${chiave}" (riga ${v.riga})`);
        const rifVoce = lingue.get(rif).get(chiave);
        if (!rifVoce) continue;
        const segnaposti = (t) => (t.match(/\{[a-zA-Z0-9_]+\}/g) || []).sort().join(',');
        if (segnaposti(v.testo) !== segnaposti(rifVoce.testo)) {
            segnala(`SEGNAPOSTO diversi in "${chiave}" (riga ${v.riga}): ${segnaposti(v.testo) || '(nessuno)'} invece di ${segnaposti(rifVoce.testo) || '(nessuno)'}`);
        }
    }

    for (const [chiaveCita, chiaveCitata, forme] of CITAZIONI) {
        const cita = mappa.get(chiaveCita);
        const citata = mappa.get(chiaveCitata);
        if (!cita || !citata || !citata.testo.trim()) continue;
        const cercata = (forme && forme[codice]) || citata.testo;
        if (!cita.testo.includes(cercata)) {
            segnala(`"${chiaveCita}" (riga ${cita.riga}) nomina un comando che non si chiama cosi': il bottone "${chiaveCitata}" (riga ${citata.riga}) dice "${cercata}"`);
        }
    }

    if (codice !== rif) {
        const uguali = [...mappa.entries()].filter(([k, v]) => {
            const r = lingue.get(rif).get(k);
            return r && r.testo && v.testo === r.testo && v.testo.length > 3;
        }).map(([k]) => k);
        if (uguali.length) console.log(`  da guardare: ${uguali.length} voci identiche all'inglese (a volte e' giusto: "Zoom", "Original"): ${uguali.slice(0, 12).join(', ')}${uguali.length > 12 ? '…' : ''}`);
    }
}

// ITALIANO: le chiavi lette dal codice. Il confronto qui sopra guarda solo le nove lingue tra loro:
//   una chiave scritta male in un componente (t.tagsAlreadyInsertd), o aggiunta al codice e mai a
//   constants.ts, passava ovunque e la scritta usciva vuota in tutte le lingue. Si leggono i file
//   di src con il compilatore TypeScript e si guarda ogni `t.<chiave>` / `tPending.<chiave>` dove
//   `t` NON ha tipo (any: le props dei componenti, `t: any` nei moduli di utilita'): li' la chiave
//   deve esistere nel blocco inglese. Dove `t` ha un tipo (App.tsx, o una `t` locale di tipo
//   string come in `(t: string) => t.trim()`) controlla gia' il compilatore, e non si segnala.
// ENGLISH: the keys the code reads. The comparison above only checks the nine languages against
//   each other: a key misspelled in a component (t.tagsAlreadyInsertd), or added to the code and
//   never to constants.ts, passed everywhere and the label came out blank in every language. The
//   src files are read with the TypeScript compiler, looking at every `t.<key>` / `tPending.<key>`
//   where `t` is UNTYPED (any: the components' props, `t: any` in utility modules): there the key
//   must exist in the English block. Where `t` has a type (App.tsx, or a local string `t` as in
//   `(t: string) => t.trim()`) the compiler already checks, and nothing is reported.
const fileCodice = [];
const raccogli = (cartella) => {
    if (!existsSync(cartella)) return;
    for (const voce of readdirSync(cartella, { withFileTypes: true })) {
        const pieno = path.join(cartella, voce.name);
        if (voce.isDirectory()) raccogli(pieno);
        else if (/\.tsx?$/.test(voce.name) && !/\.d\.ts$/.test(voce.name) && path.resolve(pieno) !== path.resolve(FILE)) fileCodice.push(pieno);
    }
};
raccogli('src');
if (fileCodice.length) {
    let ts = null;
    try { ts = createRequire(import.meta.url)('typescript'); } catch { /* sotto: segnalato / reported below */ }
    if (!ts) {
        segnala('impossibile caricare il compilatore TypeScript: le chiavi lette dal codice non sono state controllate');
    } else {
        const programma = ts.createProgram(fileCodice, {
            target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
            jsx: ts.JsxEmit.ReactJSX, allowImportingTsExtensions: true, noEmit: true, skipLibCheck: true, types: [],
        });
        const controllore = programma.getTypeChecker();
        const nostri = new Set(fileCodice.map(f => path.resolve(f)));
        let lette = 0;
        for (const sf of programma.getSourceFiles()) {
            if (!nostri.has(path.resolve(sf.fileName))) continue;
            const visita = (nodo) => {
                if (ts.isPropertyAccessExpression(nodo) && ts.isIdentifier(nodo.expression)
                    && (nodo.expression.text === 't' || nodo.expression.text === 'tPending')
                    && (controllore.getTypeAtLocation(nodo.expression).flags & ts.TypeFlags.Any)) {
                    lette++;
                    const nome = nodo.name.text;
                    if (!chiaviRif.has(nome)) {
                        const riga = sf.getLineAndCharacterOfPosition(nodo.name.getStart(sf)).line + 1;
                        segnala(`chiave "${nome}" letta dal codice (${path.relative(process.cwd(), sf.fileName)}:${riga}) ma assente dal blocco ${rif}: uscirebbe vuota in tutte le lingue`);
                    }
                }
                ts.forEachChild(nodo, visita);
            };
            visita(sf);
        }
        console.log(`\nchiavi lette dal codice senza tipo: ${lette} (in ${fileCodice.length} file)`);
    }
}

console.log(problemi === 0 ? '\nESITO: nessun problema meccanico' : `\nESITO: ${problemi} problemi`);
process.exit(problemi === 0 ? 0 : 1);
