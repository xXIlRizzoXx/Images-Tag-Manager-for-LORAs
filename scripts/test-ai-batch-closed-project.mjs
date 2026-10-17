/* ITALIANO: PROVA: CHIUDI PROGETTO O RESET DURANTE "TAGGA TUTTE CON AI"
   Con "Tagga tutte con AI" in corso l'utente preme Chiudi progetto (o Reset): il lotto si ferma e
   compare "Progetto chiuso". Un attimo dopo il lotto vedeva l'annullamento, suonava di nuovo e
   mostrava "Tagging con AI annullato. Foto taggate: 1 ... Tag aggiunti: 2" nell'unico posto degli
   avvisi: l'utente non vedeva la conferma della chiusura e leggeva di tag aggiunti a un progetto
   appena chiuso (con "Scarta e chiudi", tag buttati via). Ora, se il progetto e' cambiato durante il
   lotto (Chiudi progetto e Reset aumentano progettoGenRef), il lotto finisce in silenzio. Il pulsante
   Annulla del lotto mostra ancora il suo riepilogo.
   Si esegue il codice VERO di handleAITagAll (vedi ai-batch-harness.mjs), senza rete.
   Uso:  node scripts/test-ai-batch-closed-project.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST: CLOSE PROJECT OR RESET DURING "AUTO-TAG ALL WITH AI"
   With "Auto-tag all with AI" running the user presses Close project (or Reset): the batch stops and
   "Project closed" appears. A moment later the batch saw the cancellation, chimed again and showed
   "AI tagging cancelled. Photos tagged: 1 ... Tags added: 2" in the only notice slot: the user did not
   see the closing confirmation and read about tags added to a project just closed (with "Discard and
   close", tags thrown away). Now, if the project changed during the batch (Close project and Reset
   raise progettoGenRef), the batch ends silently. The batch's Cancel button still shows its summary.
   The REAL code of handleAITagAll runs (see ai-batch-harness.mjs), with no network.
   Usage:  node scripts/test-ai-batch-closed-project.mjs      (exits with code 1 if anything is off) */

import { nuovaApp, t, BUONA } from './ai-batch-harness.mjs';
import { creaControlli } from './main-harness.mjs';

const { dice, esito } = creaControlli();

// ITALIANO: la prima foto risponde subito, la seconda resta in volo finche' non arriva l'abort.
// ENGLISH: the first photo answers at once, the second stays in flight until the abort arrives.
const inVolo = (n, richiesta) => {
    if (n === 1) return BUONA;
    return new Promise((ok, ko) => {
        const s = richiesta?.config?.abortSignal;
        s?.addEventListener('abort', () => ko(Object.assign(new Error('This operation was aborted'), { name: 'AbortError' })), { once: true });
    });
};
const finoAllaSeconda = async (app) => { for (let i = 0; i < 400 && app.chiamate() < 2; i++) await new Promise(r => setImmediate(r)); };

/* ITALIANO: `ferma(app)` = cosa fa l'utente con la seconda richiesta in volo; `avviso` = cio' che
   quell'azione mostra subito dopo (come closeProjectNow e handleResetProject).
   ENGLISH: `ferma(app)` = what the user does with the second request in flight; `avviso` = what that
   action shows right after (as closeProjectNow and handleResetProject). */
const giro = async (ferma, avviso = null) => {
    const app = nuovaApp([{ id: 'a' }, { id: 'b' }, { id: 'c' }], inVolo);
    const lotto = app.tutte();
    await finoAllaSeconda(app);
    const suoniPrima = app.suoni;
    ferma(app);
    if (avviso) { app.suoni++; app.notifiche.push(avviso); }
    await lotto;
    return { app, suoniDopo: app.suoni - suoniPrima };
};

console.log('\n--- Chiudi progetto con una richiesta in volo ---');
{
    const { app, suoniDopo } = await giro((a) => a.chiudiProgetto(), [t.closeAllDone, 'success']);
    dice('premessa: la seconda richiesta era partita', 2, app.chiamate());
    dice('l\'ultimo avviso resta "Progetto chiuso"', [t.closeAllDone, 'success'], app.notifiche[app.notifiche.length - 1]);
    dice('...nessun riepilogo "annullato" del lotto', false, app.notifiche.some(([m]) => m.startsWith(t.aiBatchCancelled.split('{ok}')[0])));
    dice('...e un solo suono (quello della chiusura)', 1, suoniDopo);
}

console.log('\n--- Reset con una richiesta in volo ---');
{
    const { app } = await giro((a) => a.chiudiProgetto(), [t.successReset, 'success']);
    dice('l\'ultimo avviso resta quello del reset', [t.successReset, 'success'], app.notifiche[app.notifiche.length - 1]);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    // ITALIANO: il pulsante Annulla del lotto (il progetto resta lo stesso): il riepilogo c'e' ancora.
    // ENGLISH: the batch's Cancel button (the project stays the same): the summary is still there.
    const { app, suoniDopo } = await giro((a) => a.annulla());
    const ultimo = app.notifiche[app.notifiche.length - 1] || [];
    dice('Annulla: l\'ultimo avviso e\' il riepilogo "annullato", azzurro', [true, 'info'], [String(ultimo[0]).startsWith(t.aiBatchCancelled.split('{ok}')[0]), ultimo[1]]);
    dice('...con il suo suono', 1, suoniDopo);
}
{
    const app = nuovaApp([{ id: 'a' }, { id: 'b' }], () => BUONA);
    await app.tutte();
    const ultimo = app.notifiche[app.notifiche.length - 1] || [];
    dice('lotto finito senza interruzioni: riepilogo "finito", verde', [true, 'success'], [String(ultimo[0]).startsWith(t.aiBatchDone.split('{ok}')[0]), ultimo[1]]);
}

process.exit(esito());
