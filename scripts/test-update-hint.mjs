/* ITALIANO: PROVA DELLA FRASE SOTTO "AVVISAMI QUANDO ESCE UNA VERSIONE NUOVA"
   Nelle Impostazioni, sotto l'interruttore del controllo aggiornamenti, la frase diceva in tutte e
   nove le lingue che, spento, il programma non si collega mai a internet da solo. Ma con l'AI
   accesa e la chiave salvata, all'avvio (al massimo una volta al giorno) il programma chiede a
   Google l'elenco dei modelli e puo' provarne uno, senza che nessuno tocchi niente: la promessa
   era falsa per chiunque usi l'AI. La regola: finche' quel controllo automatico esiste, la frase
   deve nominare Google, l'unico indirizzo che il programma raggiunge da solo oltre a GitHub.
   Si legge il codice VERO: l'effetto d'avvio di src/App.tsx e le nove frasi di src/constants.ts.
   Uso:  node scripts/test-update-hint.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE SENTENCE UNDER "TELL ME WHEN A NEWER VERSION IS OUT"
   In Settings, under the update-check switch, the sentence said in all nine languages that, when
   off, the app never connects to the internet on its own. But with the AI on and a key saved, at
   startup (at most once a day) the app asks Google for the list of models and may try one, with
   nobody touching anything: the promise was false for anyone using the AI. The rule: while that
   automatic check exists, the sentence must name Google, the only address the app reaches on its
   own besides GitHub.
   The REAL code is read: the startup effect of src/App.tsx and the nine sentences of
   src/constants.ts.
   Usage:  node scripts/test-update-hint.mjs      (exits with code 1 if anything is off) */

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();

const app = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const costanti = fs.readFileSync(path.join(radice, 'src/constants.ts'), 'utf8');

// ITALIANO: l'effetto d'avvio che controlla i modelli da solo, senza guardare l'interruttore.
// ENGLISH: the startup effect that checks the models on its own, without looking at the switch.
const effetto = app.match(/useEffect\(\(\) => \{\s*if \(!aiEnabled \|\| !geminiApiKey\) return;[\s\S]{0,300}?\}, \[aiEnabled, geminiApiKey\]\);/);
const controlloDaSolo = !!effetto && /controllaModello\(/.test(effetto[0]) && !/updateCheck/.test(effetto[0]);
console.log(controlloDaSolo
    ? 'Il programma controlla i modelli di Google da solo all\'avvio: la frase deve dirlo.'
    : 'Nessun controllo automatico dei modelli trovato: la regola non si applica.');

const frasi = new Map();
let lingua = null;
for (const riga of costanti.split(/\r?\n/)) {
    const apertura = riga.match(/^    ([a-z]{2}): \{\s*$/);
    if (apertura) { lingua = apertura[1]; continue; }
    const voce = lingua && riga.match(/^        updateCheckHint:\s*"(.*)",?\s*$/);
    if (voce) frasi.set(lingua, voce[1]);
}

dice('la frase c\'e\' in tutte e nove le lingue', 9, frasi.size);
if (controlloDaSolo) {
    for (const [codice, frase] of frasi) {
        dice(`[${codice}] la frase nomina Google`, true, frase.includes('Google'));
    }
}

process.exit(esito());
