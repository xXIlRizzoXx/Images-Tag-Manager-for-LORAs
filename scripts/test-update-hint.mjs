/* ITALIANO: PROVA DELLA FRASE SOTTO "AVVISAMI QUANDO ESCE UNA VERSIONE NUOVA"
   Nelle Impostazioni, sotto l'interruttore del controllo aggiornamenti, la frase diceva in tutte e
   nove le lingue che, spento, il programma non si collega mai a internet da solo. Ma con l'AI
   accesa e la chiave salvata, all'avvio (al massimo una volta al giorno) il programma chiede a
   Google l'elenco dei modelli e puo' provarne uno, senza che nessuno tocchi niente: la promessa
   era falsa per chiunque usi l'AI. La regola: finche' quel controllo automatico esiste, la frase
   deve nominare Google, l'unico indirizzo che il programma raggiunge da solo oltre a GitHub.
   E deve dire "oltre a questo controllo": senza, con l'interruttore acceso, "si collega da solo
   soltanto a Google" era falso. Il controllo dei modelli e' "al massimo una volta al giorno", non
   solo all'avvio: parte anche quando si accende l'AI o si salva la chiave.
   Si legge il codice VERO: l'effetto d'avvio di src/App.tsx e le nove frasi di src/constants.ts.
   Uso:  node scripts/test-update-hint.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE SENTENCE UNDER "TELL ME WHEN A NEWER VERSION IS OUT"
   In Settings, under the update-check switch, the sentence said in all nine languages that, when
   off, the app never connects to the internet on its own. But with the AI on and a key saved, at
   startup (at most once a day) the app asks Google for the list of models and may try one, with
   nobody touching anything: the promise was false for anyone using the AI. The rule: while that
   automatic check exists, the sentence must name Google, the only address the app reaches on its
   own besides GitHub.
   And it must say "apart from this check": without it, with the switch on, "connects on its own
   only to Google" was false. The model check is "at most once a day", not only at startup: it also
   runs when the AI is switched on or the key is saved.
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

// ITALIANO: la frase su Google diceva "da solo il programma si collega soltanto a Google", senza
//           condizioni: falso proprio con l'interruttore acceso, quando all'avvio si collega anche a
//           GitHub. Deve escludere questo controllo ("oltre a questo controllo"). E il controllo dei
//           modelli non parte solo all'avvio: anche quando si accende l'AI o si salva la chiave, al
//           massimo una volta al giorno. Le parole di ogni lingua:
// ENGLISH: the Google sentence said "on its own the app connects only to Google", with no
//          condition: false precisely with the switch on, when at startup it also connects to
//          GitHub. It must exclude this check ("apart from this check"). And the model check does
//          not start only at startup: also when the AI is switched on or the key is saved, at most
//          once a day. The words of every language:
const ESCLUSIONE = {
    it: ['Oltre a questo controllo', 'al massimo una volta al giorno'],
    en: ['Apart from this check', 'at most once a day'],
    fr: ['En dehors de cette vérification', 'au plus une fois par jour'],
    es: ['Aparte de esta comprobación', 'como mucho una vez al día'],
    de: ['Abgesehen von dieser Prüfung', 'höchstens einmal am Tag'],
    zh: ['除了这项检查', '每天最多一次'],
    ja: ['この確認のほかに', '1日に最大1回'],
    pt: ['Além desta verificação', 'no máximo uma vez por dia'],
    ru: ['Кроме этой проверки', 'не чаще раза в день'],
};
const aggiornamentiDaSoli = /if \(updateCheckChoice !== 'on'\) return\b[^;]*;[\s\S]{0,400}?checkForUpdate\(/.test(app);
console.log(aggiornamentiDaSoli
    ? 'Con l\'interruttore acceso il programma si collega da solo anche a GitHub: la frase su Google deve escluderlo.'
    : 'Nessun controllo automatico degli aggiornamenti trovato.');

dice('la frase c\'e\' in tutte e nove le lingue', 9, frasi.size);
if (controlloDaSolo) {
    for (const [codice, frase] of frasi) {
        dice(`[${codice}] la frase nomina Google`, true, frase.includes('Google'));
        const [esclusione, unaVolta] = ESCLUSIONE[codice] || [];
        if (aggiornamentiDaSoli) dice(`[${codice}] la frase su Google esclude il controllo di GitHub ("${esclusione}")`, true, !!esclusione && frase.includes(esclusione));
        dice(`[${codice}] il controllo dei modelli e' "${unaVolta}", non "all'avvio"`, true, !!unaVolta && frase.includes(unaVolta));
    }
}

process.exit(esito());
