/* ITALIANO: PROVA DELLA FRASE SOTTO "ANNULLA LO SVUOTAMENTO"
   Nella finestra del cestino (e nel suggerimento del pulsante) la frase diceva, in tutte e nove le
   lingue, che l'annullamento funziona finche' il Cestino di Windows non viene svuotato. Ma il
   ricordo dell'ultimo svuotamento vive solo nella memoria del programma: chiudendo il progetto,
   con "Resetta Progetto" o riavviando, il pulsante sparisce, anche se i file sono ancora nel
   Cestino di Windows. Il README dice gia' la condizione giusta ("while the project is still open").
   La regola: finche' chiudere il progetto cancella l'annullamento, la frase nomina il progetto
   aperto in ogni lingua. Si leggono il codice VERO di src/App.tsx e i testi VERI di
   src/constants.ts.
   Uso:  node scripts/test-undo-empty-hint.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE SENTENCE UNDER "UNDO THE EMPTYING"
   In the trash window (and in the button tooltip) the sentence said, in all nine languages, that
   the undo works as long as the Windows Recycle Bin is not emptied. But the memory of the last
   emptying lives only in the app's memory: closing the project, "Reset Project" or a restart makes
   the button vanish, even though the files are still in the Windows Recycle Bin. The README
   already states the right condition ("while the project is still open").
   The rule: while closing the project drops the undo, the sentence names the open project in
   every language. The REAL code of src/App.tsx and the REAL strings of src/constants.ts are read.
   Usage:  node scripts/test-undo-empty-hint.mjs      (exits with code 1 if anything is off) */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const app = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const costanti = fs.readFileSync(path.join(radice, 'src/constants.ts'), 'utf8');

// ITALIANO: premesse: l'ultimo svuotamento e' solo stato di React, mai salvato, e chiudere o
//           resettare il progetto lo cancella.
// ENGLISH: premises: the last emptying is React state only, never saved, and closing or resetting
//          the project clears it.
const soloInMemoria = /const \[ultimoSvuotamento, setUltimoSvuotamento\] = useState/.test(app)
    && !/localStorage\.setItem\([^)]*[Ss]vuotamento/.test(app);
const azzerato = (app.match(/setUltimoSvuotamento\(null\)/g) || []).length;
console.log(soloInMemoria && azzerato >= 2
    ? `L'annullamento vive solo col progetto aperto (azzerato in ${azzerato} punti, mai salvato).`
    : 'L\'annullamento sopravvive alla chiusura del progetto: la regola non si applica.');

// ITALIANO: la parola "progetto" in ogni lingua (in russo la radice: il nome si declina).
// ENGLISH: the word "project" in every language (in Russian the stem: the noun is inflected).
const PROGETTO = { it: 'progetto', en: 'project', fr: 'projet', es: 'proyecto', de: 'Projekt', zh: '项目', ja: 'プロジェクト', pt: 'projeto', ru: 'проект' };
const frasi = new Map();
let lingua = null;
for (const riga of costanti.split(/\r?\n/)) {
    const apertura = riga.match(/^    ([a-z]{2}): \{\s*$/);
    if (apertura) { lingua = apertura[1]; continue; }
    const voce = lingua && riga.match(/^        undoEmptyHint:\s*"(.*)",?\s*$/);
    if (voce) frasi.set(lingua, voce[1]);
}

dice('la frase c\'e\' in tutte e nove le lingue', Object.keys(PROGETTO), [...frasi.keys()]);
if (soloInMemoria && azzerato >= 2) {
    for (const [codice, parola] of Object.entries(PROGETTO)) {
        dice(`[${codice}] la frase dice che serve il progetto aperto ("${parola}")`, true, String(frasi.get(codice) || '').includes(parola));
    }
}

process.exit(esito());
