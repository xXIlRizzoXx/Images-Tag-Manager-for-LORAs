/* ITALIANO: PROVA DELL'INTERRUTTORE AI SPENTO DURANTE "TAGGA TUTTE CON AI"
   Spegnendo l'AI nelle Impostazioni a meta' di una taggatura in blocco, la taggatura andava
   avanti: una foto dopo l'altra continuava a partire verso Google con l'AI segnata "spenta",
   contro quello che promette il README (con l'AI spenta nessuna immagine lascia il computer). E il
   pulsante Annulla spariva, perche' compariva solo con l'AI accesa, mentre la barra viola
   continuava ad avanzare. La regola: spegnere l'AI annulla la taggatura in corso come il pulsante
   Annulla, e il pulsante Annulla resta finche' la taggatura gira.
   Si eseguono i testi VERI presi da src/App.tsx (vedi ai-batch-harness.mjs).
   Uso:  node scripts/test-ai-toggle-stops-batch.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE AI SWITCH TURNED OFF DURING "AUTO-TAG ALL WITH AI"
   Turning the AI off in Settings halfway through bulk tagging did not stop it: photo after photo
   kept going to Google with the AI marked "off", against what the README promises (with the AI off
   no image leaves the computer). And the Cancel button vanished, because it showed only with the
   AI on, while the purple bar kept moving. The rule: switching the AI off cancels the running
   tagging like the Cancel button, and the Cancel button stays while the tagging runs.
   The REAL code taken from src/App.tsx is run (see ai-batch-harness.mjs).
   Usage:  node scripts/test-ai-toggle-stops-batch.mjs      (exits with code 1 if anything is off) */

import { nuovaApp, BUONA, t, sorgenteApp } from './ai-batch-harness.mjs';
import { creaControlli } from './main-harness.mjs';

const { dice, esito } = creaControlli();
const giri = async (n = 20) => { for (let i = 0; i < n; i++) await new Promise(ok => setTimeout(ok, 0)); };
const CINQUE = ['f1', 'f2', 'f3', 'f4', 'f5'].map(id => ({ id }));

console.log('\n--- 5 foto: la seconda richiesta e\' in volo quando si spegne l\'AI ---');
{
    let segnaleSeconda = null;
    const app = nuovaApp(CINQUE, (n, richiesta) => {
        if (n !== 2) return BUONA;
        // ITALIANO: una richiesta lenta vera: risponde dopo un po', a meno che non venga annullata.
        // ENGLISH: a real slow request: it answers after a while, unless it is aborted.
        segnaleSeconda = richiesta?.config?.abortSignal || null;
        return new Promise((si, no) => {
            segnaleSeconda?.addEventListener('abort', () => no(new Error('aborted')));
            giri(30).then(() => si(BUONA));
        });
    });
    const corsa = app.tutte();
    for (let i = 0; i < 50 && app.chiamate() < 2; i++) await giri(1);
    dice('la seconda richiesta e\' partita', 2, app.chiamate());
    app.interruttore(false);
    const finita = await Promise.race([corsa.then(() => true), giri(200).then(() => false)]);
    dice('la taggatura si ferma', true, finita);
    dice('la richiesta in volo viene annullata', true, Boolean(segnaleSeconda && segnaleSeconda.aborted));
    dice('nessuna altra foto parte verso Google', 2, app.chiamate());
    dice('l\'AI risulta spenta', false, app.aiAttiva);
    const annullato = t.aiBatchCancelled.replace('{ok}', '1').replace('{err}', '0').replace('{skip}', '0').replace('{n}', '2');
    dice('il messaggio e\' quello della taggatura annullata', [annullato, 'info'], app.notifiche[app.notifiche.length - 1]);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    // ITALIANO: senza nessuna taggatura in corso spegnere l'AI non lascia un annullamento armato.
    // ENGLISH: with no tagging running, switching the AI off leaves no cancel request armed.
    const ferma = nuovaApp(CINQUE, () => BUONA);
    ferma.interruttore(false);
    dice('a riposo: l\'AI si spegne e basta', [false, false], [ferma.aiAttiva, ferma.annullamentoChiesto()]);
    // ITALIANO: accenderla senza chiave apre ancora la finestra della chiave.
    // ENGLISH: switching it on without a key still opens the key dialog.
    ferma.interruttore(true);
    dice('accesa: l\'AI e\' attiva', true, ferma.aiAttiva);
    const tutte = nuovaApp(CINQUE, () => BUONA);
    await tutte.tutte();
    dice('senza toccare l\'interruttore le 5 foto vengono taggate', 5, tutte.chiamate());
}

console.log('\n--- il pulsante Annulla resta finche\' la taggatura gira ---');
{
    const iAnnulla = sorgenteApp.indexOf('onClick={handleCancelAITagging}');
    const iCondizione = sorgenteApp.lastIndexOf('&& (', iAnnulla);
    const riga = sorgenteApp.slice(sorgenteApp.lastIndexOf('\n', iCondizione) + 1, iCondizione + 4).trim();
    dice('il pulsante esiste ed e\' sotto una condizione', true, iAnnulla > 0 && iCondizione > 0 && riga.includes('isGlobalAITagging'));
    dice('la condizione non dipende dall\'interruttore AI', '{isGlobalAITagging && (', riga);
}

process.exit(esito());
