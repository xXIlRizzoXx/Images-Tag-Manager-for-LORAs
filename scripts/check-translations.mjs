/*
 * ITALIANO: Controllo meccanico delle 9 lingue di src/constants.ts.
 *   Verifica quello che si puo' verificare senza leggere: stesse chiavi ovunque, nessuna voce
 *   vuota, nessun doppione, stessi segnaposto ({n}, {done}, {failed}) in tutte le lingue, e
 *   segnala le voci identiche all'inglese (spesso una traduzione dimenticata, a volte no), e
 *   che una scritta che NOMINA un comando lo chiami con l'etichetta vera di quel comando.
 *   Serve perche' il controllo dei tipi NON copre queste scritte: quelle lette dentro i
 *   componenti arrivano senza tipo, quindi una chiave mancante li' passerebbe inosservata.
 *   Uso:  node scripts/check-translations.mjs [lingua]
 *   Esce con 1 se trova qualcosa di rotto, cosi' puo' stare in una verifica automatica.
 *
 * ENGLISH: Mechanical check of the 9 languages in src/constants.ts.
 *   Verifies what can be verified without reading: same keys everywhere, no empty entries, no
 *   duplicates, same placeholders ({n}, {done}, {failed}) in every language, and flags entries
 *   identical to English (often a forgotten translation, sometimes not), and that a string
 *   NAMING a command spells it exactly as that command's own label.
 *   It exists because the type check does NOT cover these strings: the ones read inside the
 *   components arrive untyped, so a key missing there would go unnoticed.
 *   Usage:  node scripts/check-translations.mjs [language]
 *   Exits 1 when something is broken, so it can sit in an automated check.
 */
import { readFileSync } from 'node:fs';

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
    ['aiKeyGuideStep5Desc', 'aiKeyLabel'],
    ['updateAskMsg', 'settings', { ru: 'настройках' }],
    ['langPickerHint', 'settings', { ru: 'Настройках' }],
    ['deleteNoRecycleBin', 'loadFolder'],
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

console.log(problemi === 0 ? '\nESITO: nessun problema meccanico' : `\nESITO: ${problemi} problemi`);
process.exit(problemi === 0 ? 0 : 1);
