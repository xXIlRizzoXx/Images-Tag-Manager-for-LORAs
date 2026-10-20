/* ITALIANO: PROVA DI "TAGGA TUTTE CON AI" QUANDO LA CHIAVE API CAMBIA A META' LOTTO
   Durante un lotto lungo l'utente puo' aprire le Impostazioni e salvare una chiave nuova (per
   esempio perche' ha revocato la vecchia in AI Studio). Il lotto usava la chiave chiusa nella sua
   closure: le foto rimaste partivano con la chiave VECCHIA, e se era revocata usciva "API key non
   valida" con la finestra della chiave riaperta, anche se quella appena salvata era buona.
   "Togli la chiave", il controllo del modello e la prova dei modelli si fermavano gia' con una
   chiave tolta o cambiata; ora anche il lotto: si ferma come un annullamento e lo dice con il
   riepilogo "annullato", 3 secondi dopo e senza coprire un errore a schermo (con una chiave TOLTA
   niente riepilogo, che coprirebbe l'avviso della chiave), le foto gia' taggate restano. Salvare
   di nuovo la STESSA chiave non lo ferma.
   Si esegue il codice VERO di handleAITagAll (vedi ai-batch-harness.mjs), senza rete.
   Uso:  node scripts/test-ai-batch-key-changed.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF "AUTO-TAG ALL WITH AI" WHEN THE API KEY CHANGES HALFWAY THROUGH THE BATCH
   During a long batch the user can open Settings and save a new key (for example because they
   revoked the old one in AI Studio). The batch used the key captured in its closure: the remaining
   photos went out with the OLD key, and if it was revoked "API key not valid" showed up with the
   key dialog reopened, even though the key just saved was good. "Remove the key", the model check
   and the model test already stopped on a removed or changed key; now the batch does too: it stops
   like a cancel and says so with the "cancelled" summary, 3 seconds later and without covering an
   error on screen (with a REMOVED key no summary, which would cover the key notice), the photos
   already tagged stay. Saving the SAME key again does not stop it.
   The REAL code of handleAITagAll runs (see ai-batch-harness.mjs), with no network.
   Usage:  node scripts/test-ai-batch-key-changed.mjs      (exits with code 1 if anything is off) */

import { nuovaApp, t, BUONA } from './ai-batch-harness.mjs';
import { creaControlli } from './main-harness.mjs';

const { dice, esito } = creaControlli();
const NUOVA = 'AIza' + 'n'.repeat(35);
const annullato = (app) => {
    const ultimo = app.notifiche[app.notifiche.length - 1] || [];
    return [String(ultimo[0]).startsWith(t.aiBatchCancelled.split('{ok}')[0]), ultimo[1]];
};
// ITALIANO: l'errore che Google da' per una chiave revocata (come lo costruisce la sua libreria).
// ENGLISH: the error Google gives for a revoked key (as its library builds it).
class ApiError extends Error {
    constructor(messaggio, stato) { super(messaggio); this.name = 'ApiError'; this.status = stato; }
}
const chiaveRevocata = () => new ApiError(JSON.stringify({ error: {
    code: 400, message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT',
    details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'API_KEY_INVALID', domain: 'googleapis.com' }] } }), 400);
const fotoQuattro = () => [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];

console.log('\n--- chiave nuova salvata mentre parte la prima foto ---');
{
    let app = null;
    app = nuovaApp(fotoQuattro(), (n) => { if (n === 1) app.cambiaChiave(NUOVA); return BUONA; });
    await app.tutte();
    dice('dopo il cambio nessuna altra foto parte con la chiave vecchia', 1, app.chiamate());
    dice('la foto gia\' partita resta taggata', ['cat', 'sofa'], app.foto[0].tags);
    dice('le altre restano come erano', [[], [], []], app.foto.slice(1).map(f => f.tags));
    // ITALIANO: con una chiave CAMBIATA il riepilogo "annullato" resta: e' l'unica frase che dice che il
    //           lotto si e' fermato (l'utente aveva cambiato chiave proprio per andare avanti). Arriva dopo
    //           la richiesta in volo, non sopra l'avviso "chiave salvata". Solo per una chiave TOLTA si tace.
    // ENGLISH: with a CHANGED key the "cancelled" summary stays: it is the only sentence saying the batch
    //          stopped (the user changed key precisely to go on). It comes after the request in flight, not
    //          over the "key saved" notice. Only for a REMOVED key does it stay silent.
    dice('il lotto si ferma e il riepilogo "annullato" lo dice', [true, 'info'], annullato(app));
    dice('nessuna finestra della chiave riaperta', false, app.finestraChiave);
}

console.log('\n--- chiave cambiata e la vecchia revocata: la richiesta in volo torna "chiave non valida" ---');
{
    let app = null;
    app = nuovaApp(fotoQuattro(), (n) => { if (n === 1) { app.cambiaChiave(NUOVA); throw chiaveRevocata(); } return BUONA; });
    await app.tutte();
    dice('una sola richiesta', 1, app.chiamate());
    dice('nessun "API key non valida" per la chiave che l\'utente ha gia\' sostituito', false,
        app.notifiche.some(([m]) => m.includes(t.aiKeyInvalid)));
    dice('nessuna finestra della chiave riaperta', false, app.finestraChiave);
    dice('il lotto si ferma e il riepilogo "annullato" lo dice', [true, 'info'], annullato(app));
}

console.log('\n--- chiave cambiata e un errore a schermo: il riepilogo non lo copre ---');
{
    let app = null;
    app = nuovaApp(fotoQuattro(), (n) => { if (n === 1) { app.cambiaChiave(NUOVA); app.avviso(t.apiKeyNotSaved, 'error'); } return BUONA; });
    await app.tutte();
    await new Promise(r => setTimeout(r, 0));
    const ultimo = app.notifiche[app.notifiche.length - 1] || [];
    dice('l\'errore della chiave resta a schermo, il riepilogo non lo copre', [t.apiKeyNotSaved, 'error'], [ultimo[0], ultimo[1]]);
}

console.log('\n--- chiave tolta a meta\' lotto (il ref torna vuoto) ---');
{
    let app = null;
    app = nuovaApp(fotoQuattro(), (n) => { if (n === 2) app.cambiaChiave(''); return BUONA; });
    await app.tutte();
    dice('si ferma dopo la richiesta in volo', 2, app.chiamate());
    dice('chiave tolta: nessun riepilogo sopra l\'avviso della chiave', [false, undefined], annullato(app));
}

console.log('\n--- quello che NON deve cambiare ---');
{
    let app = null;
    app = nuovaApp(fotoQuattro(), (n) => { if (n === 1) app.cambiaChiave(app.chiave); return BUONA; });
    await app.tutte();
    dice('la STESSA chiave salvata di nuovo: il lotto continua', 4, app.chiamate());
    const ultimo = app.notifiche[app.notifiche.length - 1] || [];
    dice('...e finisce con il riepilogo normale', [true, 'success'], [String(ultimo[0]).startsWith(t.aiBatchDone.split('{ok}')[0]), ultimo[1]]);
}
{
    const app = nuovaApp(fotoQuattro(), () => BUONA);
    await app.tutte();
    dice('senza cambi: tutte le foto partono', 4, app.chiamate());
}
{
    const app = nuovaApp(fotoQuattro(), () => { throw chiaveRevocata(); });
    await app.tutte();
    dice('chiave non valida senza cambio: si dice e si riapre la finestra della chiave', [1, true, true],
        [app.chiamate(), app.notifiche.some(([m]) => m.includes(t.aiKeyInvalid)), app.finestraChiave]);
}

process.exit(esito());
