/* ITALIANO: PROVA DEI QUATTRO AVVISI CON UNA SOLA FOTO O UN SOLO FILE (SINGOLARE)
   Quattro avvisi mettevano il numero dopo i due punti e poi continuavano al plurale: con 1 si
   leggeva "...: 1. Non sa cosa contengono e non li riscrive: riprendili a mano" (annulla lo
   svuotamento, .txt mai letto), "premi Ripristina su ognuna, poi Salva Modifiche per riscriverli"
   (.txt non ripreso), "Per queste puoi mettere i tag a mano, oppure convertirle" (foto con dati
   nascosti nel tagging AI in blocco), "They are not saved yet: review them" (foto cambiate da
   un'AI esterna). Ora ognuno ha la sua frase al singolare, senza numero (chiavi ...One, nelle nove
   lingue, come saveDownloadedOne), e App.tsx la sceglie quando il numero e' 1. Le prove di flusso
   (test-undo-empty-unread-txt, test-shared-txt-leftovers, test-ai-batch-summary,
   test-mcp-notice-total e le altre) controllano il messaggio vero con 1 e con piu' di 1.
   Uso:  node scripts/test-singular-notices.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE FOUR NOTICES WITH A SINGLE PHOTO OR FILE (SINGULAR)
   Four notices put the number after the colon and then went on in the plural: with 1 they read
   "...: 1. It does not know what they hold and will not write them again" (undo of the emptying,
   never-read .txt), "press Restore on each of them, then Save Changes to write them again" (.txt
   not taken back), "Tag them by hand, or convert them" (photos with hidden data in bulk AI
   tagging), "They are not saved yet: review them" (photos changed by an external AI). Each now
   has its own singular sentence, without a number (...One keys, in the nine languages, like
   saveDownloadedOne), and App.tsx picks it when the number is 1. The flow tests
   (test-undo-empty-unread-txt, test-shared-txt-leftovers, test-ai-batch-summary,
   test-mcp-notice-total and the others) check the real message with 1 and with more than 1.
   Usage:  node scripts/test-singular-notices.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const uscita = await esbuild.build({
    entryPoints: [path.join(radice, 'src/constants.ts')],
    bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
});
const lingue = (await import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'))).translations;
const app = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');

const CHIAVI = ['undoEmptyTxtNotBack', 'undoEmptyTxtNotBackUnread', 'aiBatchHiddenData', 'mcpEditedNotice'];

console.log('\n--- le nove lingue ---');
for (const [l, t] of Object.entries(lingue)) {
    for (const k of CHIAVI) {
        const uno = t[k + 'One'];
        dice(`${l}: ${k}One c'e', senza {n}, diversa dalla frase al plurale`, [true, false, true],
            [typeof uno === 'string' && uno.trim() !== '', typeof uno === 'string' && uno.includes('{n}'), uno !== t[k]]);
    }
    // ITALIANO: i nomi dei pulsanti sono quelli veri, nello stesso ordine della frase al plurale.
    // ENGLISH: the button names are the real ones, in the same order as the plural sentence.
    const testi = t.undoEmptyTxtNotBackOne || '';
    dice(`${l}: undoEmptyTxtNotBackOne nomina "${t.restore}" e poi "${t.saveChanges}"`, true,
        testi.includes(t.restore) && testi.includes(t.saveChanges) && testi.indexOf(t.restore) < testi.indexOf(t.saveChanges));
    dice(`${l}: mcpEditedNoticeOne nomina "${t.saveChanges}"`, true, (t.mcpEditedNoticeOne || '').includes(t.saveChanges));
}

console.log('\n--- App.tsx sceglie la frase al singolare con 1 ---');
const PUNTI = [
    ['annulla lo svuotamento, .txt non ripresi', /senzaTesto\.size === 1 \? t\.undoEmptyTxtNotBackOne : t\.undoEmptyTxtNotBack\.replace\('\{n\}', String\(senzaTesto\.size\)\)/],
    ['annulla lo svuotamento, .txt mai letti', /testoNonLetto\.size === 1 \? t\.undoEmptyTxtNotBackUnreadOne : t\.undoEmptyTxtNotBackUnread\.replace\('\{n\}', String\(testoNonLetto\.size\)\)/],
    ['tagging AI in blocco, dati nascosti', /nonPulibiliCount === 1 \? t\.aiBatchHiddenDataOne : t\.aiBatchHiddenData\.replace\('\{n\}', String\(nonPulibiliCount\)\)/],
    ['avviso delle foto cambiate da un\'AI esterna', /ancora\.length === 1 \? t\.mcpEditedNoticeOne : t\.mcpEditedNotice\.replace\('\{n\}', String\(ancora\.length\)\)/],
];
for (const [nome, re] of PUNTI) dice(nome, true, re.test(app));
for (const k of CHIAVI) {
    const usi = app.split(`t.${k}.replace(`).length - 1;
    dice(`${k}: nessun uso con {n} senza il ramo per 1`, usi, app.split(`? t.${k}One : t.${k}.replace(`).length - 1);
}

process.exit(esito());
