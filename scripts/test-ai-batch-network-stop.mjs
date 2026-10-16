/* ITALIANO: PROVA DI "TAGGA TUTTE CON AI" QUANDO GOOGLE NON SI RAGGIUNGE
   Se il Wi-Fi cadeva all'inizio di una taggatura in blocco di 300 foto, ogni richiesta finiva con
   "fetch failed" (rete assente) o, su una connessione bloccata, con l'attesa massima di 90 secondi.
   La taggatura andava avanti lo stesso, foto dopo foto: una ventina di minuti senza rete, ore con
   la connessione bloccata, e alla fine "Non riuscite: 300" senza dire il perche'. La regola: dopo
   tre foto di fila senza poter raggiungere Google ci si ferma e lo si dice; le foto gia' taggate
   restano. Un errore che arriva DA Google (una foto rifiutata, una richiesta non valida) e una
   foto che non si puo' mandare (troppo grande) non sono "rete assente" e non fermano niente.
   Si eseguono i testi VERI presi da src/App.tsx (vedi ai-batch-harness.mjs).
   Uso:  node scripts/test-ai-batch-network-stop.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF "AUTO-TAG ALL WITH AI" WHEN GOOGLE CANNOT BE REACHED
   If the Wi-Fi dropped early in a bulk run of 300 photos, every request ended with "fetch failed"
   (no network) or, on a stalled connection, with the full 90-second wait. Tagging went on anyway,
   photo after photo: about twenty minutes offline, hours on a stalled connection, and in the end
   "Failed: 300" with no reason. The rule: after three photos in a row that could not reach Google
   the run stops and says so; the photos already tagged stay. An error coming FROM Google (a refused
   photo, an invalid request) and a photo that cannot be sent (too large) are not "no network" and
   stop nothing.
   The REAL code taken from src/App.tsx is run (see ai-batch-harness.mjs).
   Usage:  node scripts/test-ai-batch-network-stop.mjs      (exits with code 1 if anything is off) */

import { nuovaApp, BUONA, t } from './ai-batch-harness.mjs';
import { creaControlli } from './main-harness.mjs';

const { dice, esito } = creaControlli();
const DIECI = Array.from({ length: 10 }, (_, i) => ({ id: 'f' + i }));
const rete = () => new TypeError('fetch failed');
const scaduta = () => new DOMException('The operation was aborted due to timeout', 'TimeoutError');
class ApiError extends Error {
    constructor(messaggio, stato) { super(messaggio); this.name = 'ApiError'; this.status = stato; }
}
const nonValida = () => new ApiError(JSON.stringify({ error: { code: 400, message: 'Request contains an invalid argument.', status: 'INVALID_ARGUMENT' } }), 400);
const fermata = [`${t.aiError}: ${t.aiNetworkStopped}`, 'error'];
const riepilogo = (n) => t.aiBatchDone.replace('{ok}', String(n.ok)).replace('{err}', String(n.err)).replace('{skip}', '0').replace('{n}', String(n.tag));

console.log('\n--- il testo esiste ---');
dice('aiNetworkStopped e\' una frase', 'string', typeof t.aiNetworkStopped);

console.log('\n--- 10 foto, rete assente fin dalla prima ---');
{
    const app = nuovaApp(DIECI, () => { throw rete(); });
    await app.tutte();
    dice('si ferma dopo tre foto di fila: tre richieste, non dieci', 3, app.chiamate());
    dice('...e dice il perche\', senza il riepilogo "Non riuscite: 10"', [fermata], app.notifiche);
}

console.log('\n--- 10 foto, connessione bloccata (ogni richiesta scade) ---');
{
    const app = nuovaApp(DIECI, () => { throw scaduta(); });
    await app.tutte();
    dice('si ferma dopo tre foto di fila', [3, [fermata]], [app.chiamate(), app.notifiche]);
}

console.log('\n--- la rete va e viene: una foto riuscita azzera il conto ---');
{
    // ITALIANO: fallisce, fallisce, riesce, fallisce, fallisce, riesce: mai tre di fila.
    // ENGLISH: fails, fails, succeeds, fails, fails, succeeds: never three in a row.
    const app = nuovaApp(DIECI.slice(0, 6), (n) => { if (n % 3 === 0) return BUONA; throw rete(); });
    await app.tutte();
    dice('tutte e sei le foto vengono provate', 6, app.chiamate());
    dice('...e il riepilogo finale c\'e\'', [[riepilogo({ ok: 2, err: 4, tag: 4 }), 'info']], app.notifiche);
}
{
    const app = nuovaApp(DIECI.slice(0, 4), (n) => { if (n === 1) return BUONA; throw rete(); });
    await app.tutte();
    dice('una riuscita e poi tre senza rete: si ferma alla quarta', [4, [fermata]], [app.chiamate(), app.notifiche]);
    dice('...e la foto gia\' taggata tiene i suoi tag', ['cat', 'sofa'], app.foto[0].tags);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const app = nuovaApp(DIECI.slice(0, 5), () => { throw nonValida(); });
    await app.tutte();
    dice('Google risponde 400 a cinque foto: non e\' "rete assente", si provano tutte', 5, app.chiamate());
    dice('...e il riepilogo dice "Non riuscite: 5"', [[riepilogo({ ok: 0, err: 5, tag: 0 }), 'error']], app.notifiche);
}
{
    // ITALIANO: quattro foto piu' grandi di 20 MB: non partono, e non e' colpa della rete.
    // ENGLISH: four photos larger than 20 MB: they are not sent, and it is not the network's fault.
    const app = nuovaApp(DIECI.slice(0, 4), () => BUONA);
    const grande = new Uint8Array(21 * 1024 * 1024);
    for (const f of app.foto) f.file = new File([grande], f.id + '.png', { type: 'image/png' });
    await app.tutte();
    dice('foto troppo grandi: nessuna richiesta, nessuna "rete assente", il riepilogo c\'e\'',
        [0, [[riepilogo({ ok: 0, err: 4, tag: 0 }), 'error']]], [app.chiamate(), app.notifiche]);
}
{
    const app = nuovaApp(DIECI.slice(0, 3), () => BUONA);
    await app.tutte();
    dice('rete buona: tre foto taggate, riepilogo verde', [3, [[riepilogo({ ok: 3, err: 0, tag: 6 }), 'success']]], [app.chiamate(), app.notifiche]);
}

process.exit(esito());
