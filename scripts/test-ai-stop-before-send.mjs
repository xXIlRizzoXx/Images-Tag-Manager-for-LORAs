/* ITALIANO: PROVA: ANNULLA, AI SPENTA O CHIAVE TOLTA MENTRE LA FOTO SI PREPARA: LA FOTO NON PARTE
   La libreria vera di Google (@google/genai) guarda il segnale di annullamento SOLO con l'evento
   'abort': un segnale gia' fermato quando arriva la richiesta viene ignorato e la foto parte lo
   stesso (e senza piu' il limite dei 90 secondi). Se l'utente premeva Annulla, spegneva l'AI o
   toglieva la chiave mentre la foto veniva preparata (rilettura dalla cartella, pulizia dei dati
   nascosti, base64), la foto andava a Google e nel lotto riceveva anche i tag. Ora getGeminiTags e
   provaModelloChiave controllano il segnale subito prima di chiamare Google.
   Parte 1: il servizio VERO con la libreria VERA (la versione per il browser, quella della pagina) e
            un fetch finto che conta le richieste: niente rete, nessuna chiave vera.
   Parte 2: il testo VERO di handleAITagAll, di Annulla e dell'interruttore AI (scripts/ai-batch-harness.mjs)
            con un Google finto che, come la libreria vera, ascolta solo l'evento 'abort'.
   Casi vicini che non devono cambiare: senza fermate i tag arrivano; una fermata con la richiesta in
   volo da' ancora AbortError; il lotto senza clic tagga tutte le foto; la prova di un modello senza
   fermate risponde "utilizzabile".
   Uso:  node scripts/test-ai-stop-before-send.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST: CANCEL, AI OFF OR KEY REMOVED WHILE THE PHOTO IS BEING PREPARED: THE PHOTO DOES NOT LEAVE
   The real Google library (@google/genai) looks at the abort signal ONLY through the 'abort' event: a
   signal already aborted when the request starts is ignored and the photo is sent anyway (and without
   the 90-second limit any more). If the user pressed Cancel, turned the AI off or removed the key while
   the photo was being prepared (re-read from the folder, hidden data removed, base64), the photo went
   to Google and in the batch it even got the tags. Now getGeminiTags and provaModelloChiave check the
   signal right before calling Google.
   Part 1: the REAL service with the REAL library (the browser build, the one the page ships) and a fake
           fetch that counts the requests: no network, no real key.
   Part 2: the REAL text of handleAITagAll, Cancel and the AI switch (scripts/ai-batch-harness.mjs) with a
           fake Google that, like the real library, listens to the 'abort' event only.
   Neighbouring cases that must not change: with no stop the tags arrive; a stop with the request in
   flight still gives AbortError; the batch with no click tags every photo; probing a model with no stop
   answers "utilizzabile".
   Usage:  node scripts/test-ai-stop-before-send.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let errori = 0;
const dice = (ok, cosa) => { console.log(`${ok ? 'OK' : 'NO'}  ${cosa}`); if (!ok) errori++; };

// ---------- Parte 1 / Part 1: servizio vero + libreria vera / real service + real library ----------
const uscita = await esbuild.build({
    entryPoints: [path.join(radice, 'src/services/geminiService.ts')],
    bundle: true, format: 'esm', platform: 'browser', write: false, logLevel: 'silent',
});
const S = await import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));

// ITALIANO: fetch finto: registra ogni richiesta, risponde dopo un attimo e reagisce SOLO all'evento 'abort'.
// ENGLISH: fake fetch: records every request, answers after a moment and reacts ONLY to the 'abort' event.
const fetchVero = globalThis.fetch;
const FileReaderVero = globalThis.FileReader;
let inviate = 0;
let inVolo = null;
let nelLettore = null;
globalThis.fetch = async (_url, init) => {
    inviate++;
    await new Promise((ok, no) => {
        const timer = setTimeout(ok, 30);
        init?.signal?.addEventListener('abort', () => { clearTimeout(timer); no(new DOMException('aborted', 'AbortError')); });
        inVolo?.();
    });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '["cat","red hair"]' }] } }] }),
        { status: 200, headers: { 'content-type': 'application/json' } });
};
// ITALIANO: FileReader finto: il passo base64 della preparazione; `nelLettore` e' il clic dell'utente in quel momento.
// ENGLISH: fake FileReader: the base64 step of the preparation; `nelLettore` is the user's click at that moment.
globalThis.FileReader = class {
    readAsDataURL(blob) {
        blob.arrayBuffer().then(ab => {
            nelLettore?.();
            this.result = 'data:' + blob.type + ';base64,' + Buffer.from(ab).toString('base64');
            this.onloadend && this.onloadend();
        });
    }
};
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAD0lEQVR42mNowAEYhpYEAILzYAEllbNjAAAAAElFTkSuQmCC', 'base64');
const foto = () => new File([PNG], 'a.png', { type: 'image/png' });
const opz = (signal) => ({ apiKey: 'FAKE-KEY-ONLY-FOR-THIS-OFFLINE-TEST', modelName: 'gemini-3.6-flash', maxTags: 5, signal });
const prova = async (prepara) => {
    inviate = 0; inVolo = null; nelLettore = null;
    const c = new AbortController();
    prepara(c);
    try { return { tags: await S.getGeminiTags(foto(), opz(c.signal)), inviate }; }
    catch (e) { return { errore: e?.name || String(e), inviate }; }
};

{
    const r = await prova(() => { });
    dice(r.inviate === 1 && JSON.stringify(r.tags) === '["cat","red hair"]', `senza fermate: 1 richiesta e i tag arrivano (${JSON.stringify(r)})`);
}
{
    const r = await prova((c) => { inVolo = () => c.abort(); });
    dice(r.inviate === 1 && r.errore === 'AbortError', `fermata con la richiesta in volo: AbortError come prima (${JSON.stringify(r)})`);
}
{
    const r = await prova((c) => { c.abort(); });
    dice(r.inviate === 0 && r.errore === 'AbortError', `fermata PRIMA della chiamata: nessuna richiesta e AbortError (${JSON.stringify(r)})`);
}
{
    const r = await prova((c) => { nelLettore = () => c.abort(); });
    dice(r.inviate === 0 && r.errore === 'AbortError', `fermata durante la preparazione (base64): nessuna richiesta e AbortError (${JSON.stringify(r)})`);
}
// ITALIANO: "Prova i modelli recenti": un modello provato dopo la fermata non chiama Google e non ha stato.
// ENGLISH: "Test recent models": a model probed after the stop does not call Google and has no state.
{
    inviate = 0; inVolo = null;
    const r = await S.provaModelloChiave('FAKE-KEY-ONLY-FOR-THIS-OFFLINE-TEST', 'gemini-3.6-flash');
    dice(inviate === 1 && r.stato === 'utilizzabile', `prova di un modello senza fermate: 1 richiesta, utilizzabile (${JSON.stringify(r)}, richieste ${inviate})`);
}
{
    inviate = 0; inVolo = null;
    const c = new AbortController(); c.abort();
    const r = await S.provaModelloChiave('FAKE-KEY-ONLY-FOR-THIS-OFFLINE-TEST', 'gemini-3.6-flash', c.signal);
    dice(inviate === 0 && JSON.stringify(r) === '{}', `prova di un modello con il giro gia' fermato: nessuna richiesta, nessuno stato (${JSON.stringify(r)}, richieste ${inviate})`);
}
globalThis.fetch = fetchVero;
globalThis.FileReader = FileReaderVero;

// ---------- Parte 2 / Part 2: il lotto vero / the real batch ----------
const H = await import('./ai-batch-harness.mjs');
const { nuovaApp, BUONA } = H;
const giri = async (n) => { for (let i = 0; i < n; i++) await new Promise(r => setImmediate(r)); };
// ITALIANO: il clic dell'utente cade nel passo base64 della foto numero `quale`.
// ENGLISH: the user's click lands in the base64 step of photo number `quale`.
let letture = 0, alClic = null, quale = 0;
globalThis.FileReader = class {
    readAsDataURL() {
        letture++;
        this.result = 'data:image/png;base64,AAAA';
        if (letture === quale && alClic) alClic();
        setImmediate(() => this.onloadend && this.onloadend());
    }
};
// ITALIANO: Google finto che si comporta come la libreria vera: ascolta solo l'evento 'abort'.
// ENGLISH: fake Google that behaves like the real library: it listens to the 'abort' event only.
const comeLibreriaVera = (_n, richiesta) => new Promise((si, no) => {
    richiesta?.config?.abortSignal?.addEventListener('abort', () => no(new DOMException('aborted', 'AbortError')));
    giri(5).then(() => si(BUONA));
});
const CINQUE = [1, 2, 3, 4, 5].map(i => ({ id: 'f' + i }));
{
    letture = 0; quale = 0; alClic = null;
    const app = nuovaApp(CINQUE, comeLibreriaVera);
    await app.tutte();
    dice(app.chiamate() === 5 && app.foto.every(f => f.tags.length === 2), `lotto senza clic: 5 richieste e 5 foto taggate (richieste ${app.chiamate()})`);
}
for (const [nome, gesto] of [
    ['AI spenta', (app) => app.interruttore(false)],
    ['Annulla', (app) => app.annulla()],
    ['chiave tolta', (app) => { app.annulla(); app.cambiaChiave(''); }],
]) {
    letture = 0; quale = 2;
    const app = nuovaApp(CINQUE, comeLibreriaVera);
    alClic = () => gesto(app);
    await app.tutte();
    const ultimo = app.notifiche[app.notifiche.length - 1]?.[0] || '';
    dice(app.chiamate() === 1, `${nome} durante la preparazione della foto 2: arriva a Google 1 sola richiesta (arrivate ${app.chiamate()})`);
    dice(app.foto[1].tags.length === 0, `${nome}: la foto 2 resta senza tag (${JSON.stringify(app.foto[1].tags)})`);
    dice(!/Photos tagged: 2/.test(ultimo), `${nome}: il riepilogo non conta la foto 2 fra le taggate (${JSON.stringify(ultimo)})`);
}

console.log(errori ? `\nESITO: ${errori} controlli falliti` : '\nESITO: tutto a posto');
process.exit(errori ? 1 : 0);
