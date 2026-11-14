/* ITALIANO: PROVA CHE OGNI PROVA CON creaControlli PORTI IL SUO VERDETTO AL CODICE DI USCITA
   esito() di main-harness.mjs stampa «PROBLEMI: N» e restituisce 0 o 1, ma NON chiude il processo.
   run-tests.mjs guarda solo il codice di uscita: una prova che chiama esito() da sola esce sempre
   con 0 e non puo' mai fallire (era successo a test-build-zip-target.mjs). Qui si legge ogni
   scripts/test-*.mjs che usa creaControlli: ogni chiamata a esito() deve stare dentro
   process.exit(...) oppure finire in una variabile poi passata a process.exit(variabile).
   Uso:  node scripts/test-esito-esce.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST THAT EVERY TEST USING creaControlli CARRIES ITS VERDICT TO THE EXIT CODE
   main-harness.mjs esito() prints "PROBLEMI: N" and returns 0 or 1 but does NOT end the process.
   run-tests.mjs only looks at the exit code: a test that calls esito() on its own always exits 0
   and can never fail (it happened to test-build-zip-target.mjs). Every scripts/test-*.mjs that
   uses creaControlli is read: each esito() call must sit inside process.exit(...) or go into a
   variable later passed to process.exit(variable).
   Usage:  node scripts/test-esito-esce.mjs      (exits with code 1 if anything is off) */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';

const cartella = path.dirname(fileURLToPath(import.meta.url));
const { dice, esito } = creaControlli();

// ITALIANO: restituisce le chiamate a esito() che non arrivano al codice di uscita.
// ENGLISH: returns the esito() calls that do not reach the exit code.
const chiamateSenzaUscita = (testo) => {
    const male = [];
    const re = /\besito\s*\(\s*\)/g;
    let m;
    while ((m = re.exec(testo))) {
        const prima = testo.slice(Math.max(0, m.index - 80), m.index);
        if (/process\.exit\(\s*$/.test(prima)) continue;
        const assegnata = /(?:^|[\s;{(])([A-Za-z_$][\w$]*)\s*=\s*$/.exec(prima);
        if (assegnata && new RegExp('process\\.exit\\(\\s*' + assegnata[1] + '\\s*\\)').test(testo.slice(m.index))) continue;
        const riga = testo.slice(0, m.index).split('\n').length;
        male.push(riga);
    }
    return male;
};

// ITALIANO: casi di controllo del riconoscitore (le forme usate oggi e quella sbagliata).
// ENGLISH: checks on the matcher itself (the forms used today and the wrong one).
dice('forma process.exit(esito()) accettata', [], chiamateSenzaUscita('x();\nprocess.exit(esito());\n'));
dice('forma con variabile poi passata a process.exit accettata', [],
    chiamateSenzaUscita('let codice = 1;\ntry { codice = esito(); } finally { pulisci(); }\nprocess.exit(codice);\n'));
dice('forma esito(); da sola rifiutata', [2], chiamateSenzaUscita('x();\nesito();\n'));
dice('variabile mai passata a process.exit rifiutata', [1], chiamateSenzaUscita('const c = esito();\nconsole.log(c);\n'));

// ITALIANO: questo file si salta: i casi qui sopra contengono esito() dentro testi di esempio.
// ENGLISH: this file is skipped: the cases above hold esito() inside sample strings.
const questo = path.basename(fileURLToPath(import.meta.url));
const file = fs.readdirSync(cartella).filter((n) => /^test-.*\.mjs$/.test(n) && n !== questo).sort();
let conControlli = 0;
for (const nome of file) {
    const testo = fs.readFileSync(path.join(cartella, nome), 'utf8').replace(/\r\n/g, '\n');
    if (!/\bcreaControlli\s*\(/.test(testo)) continue;
    conControlli++;
    dice(nome + ': ogni esito() arriva a process.exit', [], chiamateSenzaUscita(testo));
}
dice('le prove con creaControlli sono state trovate', true, conControlli > 100);

process.exit(esito());
