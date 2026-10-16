/* ITALIANO: PROVA DEL MESSAGGIO FINALE DI "TAGGA TUTTE CON AI"
   Premendo "Annulla" a meta' del tagging in blocco, il messaggio finale diceva
   "Annullato · Completato! · ✓ 2 · ✗ 0 · Tag generati: 8": annullato E completato insieme, in
   tutte e nove le lingue, fatto di pezzi incollati con dei simboli. E quando il tagging si fermava
   per un errore grave (chiave sbagliata, modello non disponibile) lo stesso riepilogo, in verde,
   prendeva il posto del messaggio d'errore appena mostrato. La regola: una frase intera tradotta,
   "finito" oppure "annullato", con i numeri nella forma "etichetta: {n}" che si legge giusta anche
   con 1; dopo un errore grave resta a schermo l'errore.
   Si esegue il testo VERO del riepilogo preso da src/App.tsx, con i testi veri di src/constants.ts.
   Uso:  node scripts/test-ai-batch-summary.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE FINAL MESSAGE OF "AUTO-TAG ALL WITH AI"
   Pressing "Cancel" halfway through bulk tagging, the final message said
   "Cancelled · Completed! · ✓ 2 · ✗ 0 · Tags generated: 8": cancelled AND completed together, in
   all nine languages, made of pieces glued with symbols. And when tagging stopped on a fatal error
   (wrong key, model unavailable) the same summary, in green, replaced the error message just
   shown. The rule: one whole translated sentence, "finished" or "cancelled", with the numbers in
   the "label: {n}" form that reads right with 1 too; after a fatal error the error stays on screen.
   The REAL summary text taken from src/App.tsx is run, with the real strings of src/constants.ts.
   Usage:  node scripts/test-ai-batch-summary.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const uscita = await esbuild.build({
    entryPoints: [path.join(radice, 'src/constants.ts')],
    bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
});
const lingue = (await import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'))).translations;

// ITALIANO: il pezzo vero di handleAITagAll: dal tipo del messaggio fino alla riga che lo mostra.
// ENGLISH: the real piece of handleAITagAll: from the message type down to the line showing it.
const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const inizio = sorgente.indexOf("const successType: 'success' | 'info' | 'error' = cancelled");
const mostra = sorgente.indexOf('showNotification(summary, successType);', inizio);
if (inizio < 0 || mostra < 0) { console.log('NO  riepilogo di handleAITagAll non trovato in src/App.tsx'); process.exit(1); }
const fineRiga = sorgente.indexOf('\n', mostra);
const codice = (await esbuild.transform(sorgente.slice(inizio, fineRiga), { loader: 'ts' })).code;
const riepilogo = new Function('t', 'cancelled', 'fatalAbort', 'okCount', 'errorCount', 'skippedCount', 'totalTagsAdded', 'showNotification', codice);
const prova = (t, cancelled, n, fatalAbort = false) => {
    const notifiche = [];
    riepilogo(t, cancelled, fatalAbort, n.ok, n.err, n.skip, n.tag, (m, tipo) => notifiche.push([m, tipo]));
    return notifiche;
};
const riempi = (s, n) => String(s || '').replace('{ok}', String(n.ok)).replace('{err}', String(n.err)).replace('{skip}', String(n.skip)).replace('{n}', String(n.tag));

const DUE = { ok: 2, err: 0, skip: 0, tag: 8 };
for (const l of Object.keys(lingue)) {
    const t = lingue[l];
    console.log(`\n--- ${l} ---`);
    const annullato = prova(t, true, DUE);
    dice('annullato: non dice anche "completato"', false, annullato.some(([m]) => m.includes(t.completed)));
    dice('annullato: una frase intera, senza simboli incollati', [[riempi(t.aiBatchCancelled, DUE), 'info']], annullato);
    const finito = prova(t, false, DUE);
    dice('finito: non dice "annullato"', false, finito.some(([m]) => m.includes(t.aiCancelled)));
    dice('finito: una frase intera', [[riempi(t.aiBatchDone, DUE), 'success']], finito);
    // ITALIANO: ogni numero viene dopo i due punti ("Foto taggate: 1"), mai prima di un nome che
    //           dovrebbe accordarsi ("1 foto taggate"): cosi' con 1 si legge giusto in ogni lingua.
    // ENGLISH: every number comes after the colon ("Photos tagged: 1"), never before a noun that
    //          would have to agree ("1 photos tagged"): so it reads right with 1 in every language.
    for (const chiave of ['aiBatchDone', 'aiBatchCancelled']) {
        const s = String(t[chiave] || '');
        const segni = ['{ok}', '{err}', '{skip}', '{n}'];
        dice(`${chiave}: i quattro numeri, una volta ciascuno, dopo i due punti`, true,
            segni.every(x => s.split(x).length === 2 && /[:：]\s*$/.test(s.slice(0, s.indexOf(x)))));
    }
}

console.log('\n--- dopo un errore grave resta a schermo l\'errore ---');
dice('fermato da una chiave sbagliata: nessun riepilogo sopra l\'errore', [], prova(lingue.en, false, { ok: 0, err: 0, skip: 0, tag: 0 }, true));

process.exit(esito());
