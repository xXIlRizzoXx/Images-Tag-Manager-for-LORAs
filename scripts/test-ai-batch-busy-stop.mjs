/* ITALIANO: PROVA DI "TAGGA TUTTE CON AI" CON GOOGLE SOVRACCARICO PER UN BEL PEZZO
   Google risponde 503 "The model is overloaded" (o 429 per il limite al minuto) a ogni richiesta.
   Per ogni foto si riprovava dopo 15 e 45 secondi, poi si passava alla successiva: 300 foto
   erano circa 5 ore e 900 richieste, e alla fine solo "Non riuscite: 300", senza dire perche'.
   Il blocco per la rete assente contava solo gli errori senza risposta di Google. Ora tre foto
   di fila che, anche dopo i tentativi, trovano Google sovraccarico (o oltre il limite al minuto)
   fermano il lavoro con una frase che dice perche' e cosa fare.
   Si esegue il testo VERO preso da src/App.tsx (vedi ai-batch-harness.mjs), con l'orologio finto.
   Uso:  node scripts/test-ai-batch-busy-stop.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF "AUTO-TAG ALL WITH AI" WITH GOOGLE OVERLOADED FOR A LONG STRETCH
   Google answers 503 "The model is overloaded" (or 429 for the per-minute limit) to every request.
   Each photo was retried after 15 and 45 seconds, then the run moved on: 300 photos meant about
   5 hours and 900 requests, ending with just "Failed: 300", without saying why. The no-network
   stop only counted errors with no answer from Google. Now three photos in a row that, even after
   the retries, find Google overloaded (or past the per-minute limit) stop the run with a sentence
   saying why and what to do.
   The REAL code taken from src/App.tsx is run (see ai-batch-harness.mjs), with the fake clock.
   Usage:  node scripts/test-ai-batch-busy-stop.mjs      (exits with code 1 if anything is off) */

import { nuovaApp, BUONA, t, lingue } from './ai-batch-harness.mjs';
import { creaControlli } from './main-harness.mjs';

const { dice, esito } = creaControlli();
const DIECI = Array.from({ length: 10 }, (_, i) => ({ id: 'f' + i }));
class ApiError extends Error {
    constructor(messaggio, stato) { super(messaggio); this.name = 'ApiError'; this.status = stato; }
}
const apiErrore = (stato, corpo) => new ApiError(JSON.stringify({ error: corpo }), stato);
const sovraccarico = () => apiErrore(503, { code: 503, status: 'UNAVAILABLE', message: 'The model is overloaded. Please try again later.' });
const quota429 = (quotaId) => apiErrore(429, { code: 429, status: 'RESOURCE_EXHAUSTED',
    message: 'You exceeded your current quota, please check your plan and billing details.',
    details: [{ '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaMetric: 'generativelanguage.googleapis.com/generate_content_free_tier_requests', quotaId, quotaValue: '10' }] }] });
const minuto = () => quota429('GenerateRequestsPerMinutePerProjectPerModel-FreeTier');
const giorno = () => quota429('GenerateRequestsPerDayPerProjectPerModel-FreeTier');
const fermata = [`${t.aiError}: ${t.aiBusyStopped}`, 'error'];
const riepilogo = (n) => t.aiBatchDone.replace('{ok}', String(n.ok)).replace('{err}', String(n.err)).replace('{skip}', '0').replace('{n}', String(n.tag));

console.log('\n--- il testo esiste nelle nove lingue ---');
dice('aiBusyStopped e\' una frase in it/en/fr/es/de/zh/ja/pt/ru', [],
    ['it', 'en', 'fr', 'es', 'de', 'zh', 'ja', 'pt', 'ru'].filter(l => !lingue[l] || typeof lingue[l].aiBusyStopped !== 'string' || lingue[l].aiBusyStopped.length < 20));

console.log('\n--- 10 foto, Google risponde 503 sovraccarico a tutto ---');
{
    const app = nuovaApp(DIECI, () => { throw sovraccarico(); });
    await app.tutte();
    dice('si ferma dopo tre foto di fila: 9 richieste (3 tentativi per foto), non 30', 9, app.chiamate());
    dice('...e dice il perche\', senza il riepilogo "Non riuscite: 10"', [fermata], app.notifiche);
}

console.log('\n--- 10 foto, ogni richiesta oltre il limite al minuto (429) ---');
{
    const app = nuovaApp(DIECI, () => { throw minuto(); });
    await app.tutte();
    dice('si ferma dopo tre foto di fila, con la stessa frase', [9, [fermata]], [app.chiamate(), app.notifiche]);
}

console.log('\n--- Google va e viene: una foto riuscita azzera il conto ---');
{
    // ITALIANO: per foto: 3 tentativi falliti, 3 falliti, poi riesce al primo; e cosi' via.
    // ENGLISH: per photo: 3 failed attempts, 3 failed, then success at the first; and so on.
    const app = nuovaApp(DIECI.slice(0, 6), (n) => { if (n % 7 === 0) return BUONA; throw sovraccarico(); });
    await app.tutte();
    dice('tutte e sei le foto vengono provate, e alla fine c\'e\' il riepilogo, non la fermata',
        [14, [[riepilogo({ ok: 2, err: 4, tag: 4 }), 'info']]], [app.chiamate(), app.notifiche]);
}
{
    // ITALIANO: una foto che riesce al secondo tentativo non conta come sovraccarico.
    // ENGLISH: a photo that succeeds on the second attempt does not count as overloaded.
    const app = nuovaApp(DIECI.slice(0, 4), (n) => { if (n % 2 === 0) return BUONA; throw sovraccarico(); });
    await app.tutte();
    dice('503 e poi riuscita, per quattro foto: tutte taggate, riepilogo verde',
        [8, [[riepilogo({ ok: 4, err: 0, tag: 8 }), 'success']]], [app.chiamate(), app.notifiche]);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const app = nuovaApp(DIECI, () => { throw giorno(); });
    await app.tutte();
    dice('quota del GIORNO finita: ci si ferma subito con la sua frase', [1, [[`${t.aiError}: ${t.aiDailyQuota}`, 'error']]], [app.chiamate(), app.notifiche]);
}
{
    // ITALIANO: due foto sovraccariche, poi una riuscita: niente fermata.
    // ENGLISH: two overloaded photos, then one success: no stop.
    const app = nuovaApp(DIECI.slice(0, 3), (n) => { if (n === 7) return BUONA; throw sovraccarico(); });
    await app.tutte();
    dice('due sovraccariche e una riuscita: riepilogo "Taggate 1, Non riuscite 2"',
        [7, [[riepilogo({ ok: 1, err: 2, tag: 2 }), 'info']]], [app.chiamate(), app.notifiche]);
}
{
    const app = nuovaApp(DIECI.slice(0, 3), () => BUONA);
    await app.tutte();
    dice('Google risponde: tre foto taggate, riepilogo verde', [3, [[riepilogo({ ok: 3, err: 0, tag: 6 }), 'success']]], [app.chiamate(), app.notifiche]);
}

process.exit(esito());
