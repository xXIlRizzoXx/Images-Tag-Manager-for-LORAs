/* ITALIANO: PROVA: "GENERA TAG CON AI" DI UNA FOTO SI FERMA SE SI SPEGNE L'AI O SI TOGLIE LA CHIAVE
   Con "Tagga tutte con AI" spegnere l'AI o togliere la chiave fermava gia' anche la richiesta in
   volo; con la richiesta di UNA foto no: la foto continuava a partire verso Google (fino a 90 s)
   e alla risposta i tag arrivavano lo stesso, con il suono e il verde "Tag generati: N", ad AI
   spenta o a chiave tolta. Ora la richiesta singola ha il suo segnale di interruzione, che
   l'interruttore dell'AI e "Togli la chiave" fermano, e dopo l'attesa il risultato si scarta in
   silenzio se l'AI e' spenta o la chiave e' stata tolta o cambiata.
   Si eseguono i testi VERI di handleAITagSingle, di handleClearApiKey e dell'interruttore dell'AI
   (src/App.tsx), con un Google finto: niente rete, niente chiavi vere.
   Casi vicini che non devono cambiare: con l'AI accesa e la stessa chiave i tag arrivano come
   prima; un errore vero di Google con l'AI accesa si mostra come prima; l'interruttore spento
   ferma ancora il lotto, e acceso senza chiave apre la finestra della chiave.
   Uso:  node scripts/test-ai-single-switched-off.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST: "GENERATE TAGS WITH AI" FOR ONE PHOTO STOPS WHEN THE AI IS TURNED OFF OR THE KEY REMOVED
   With "Auto-tag all with AI" turning the AI off or removing the key already stopped the request in
   flight too; with the request for ONE photo it did not: the photo kept going to Google (up to 90 s)
   and on the answer the tags arrived anyway, with the chime and the green "Tags generated: N", with
   the AI off or the key removed. Now the single request has its own abort signal, which the AI switch
   and "Remove the key" stop, and after the wait the result is dropped silently if the AI is off or the
   key was removed or changed.
   The REAL text of handleAITagSingle, handleClearApiKey and the AI switch (src/App.tsx) runs with a
   fake Google: no network, no real keys.
   Neighbouring cases that must not change: with the AI on and the same key the tags arrive as before;
   a real Google error with the AI on is shown as before; the switch turned off still stops the batch,
   and turned on without a key opens the key dialog.
   Usage:  node scripts/test-ai-single-switched-off.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const carica = async (rel) => {
    const uscita = await esbuild.build({ entryPoints: [path.join(radice, rel)], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
    return import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));
};
const C = await carica('src/utils/tagCase.ts');
const t = (await carica('src/constants.ts')).translations.en;
const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const ritaglia = async (intestazione, fineRegex, cosa) => {
    const inizio = sorgente.indexOf(intestazione);
    fineRegex.lastIndex = Math.max(inizio, 0);
    const fine = inizio < 0 ? null : fineRegex.exec(sorgente);
    if (!fine) { console.log(`NO  ${cosa} non trovato in src/App.tsx`); process.exit(1); }
    return (await esbuild.transform(sorgente.slice(inizio, fine.index + fine[0].length), { loader: 'ts' })).code;
};
const codiceUna = await ritaglia('    const handleAITagSingle = useCallback(',
    /\r?\n    \}, \[aiEnabled, geminiApiKey, aiModel, aiMaxTags, aiCustomPrompt, images, t, updateImageTags\]\);\r?\n/g, 'handleAITagSingle');
const codiceTogli = await ritaglia('    const handleClearApiKey = useCallback(', /\r?\n    \}, \[t\]\);\r?\n/g, 'handleClearApiKey');
// ITALIANO: l'interruttore dell'AI nelle Impostazioni: la funzione passata a onChange.
// ENGLISH: the AI switch in Settings: the function passed to onChange.
const iInterruttore = sorgente.indexOf('<AppleToggle checked={aiEnabled} onChange={');
const fInterruttore = iInterruttore < 0 ? -1 : sorgente.indexOf('} colorClass=', iInterruttore);
if (fInterruttore < 0) { console.log('NO  interruttore dell\'AI non trovato in src/App.tsx'); process.exit(1); }
const codiceInterruttore = (await esbuild.transform('const interruttore = ' + sorgente.slice(iInterruttore + '<AppleToggle checked={aiEnabled} onChange={'.length, fInterruttore) + ';', { loader: 'ts' })).code;
// ITALIANO: i ref nuovi della richiesta singola (nessuno nel codice di prima), passati a tutti i pezzi.
// ENGLISH: the single request's new refs (none in the old code), passed to every piece.
const refSingola = [...new Set([...(codiceUna + codiceTogli + codiceInterruttore).matchAll(/\b(aiSingola\w*Ref)\b/g)].map(m => m[1]))];
const muto = { log() { }, warn() { }, error() { } };
const CHIAVE = 'AIza-finta-chiave';

const DIP = ['aiEnabled', 'geminiApiKey', 'aiModel', 'aiMaxTags', 'aiCustomPrompt', 'images', 'imagesRef', 't', 'updateImageTags',
    'getGeminiTags', 'classifyGeminiError', 'showNotification', 'soundManager', 'setRiparaModello', 'setIsApiKeyDialogOpen', 'setIsAIBusy',
    'countNewTagsIgnoringCase', 'useCallback', 'console', 'aiEnabledRef', 'geminiApiKeyRef', ...refSingola];
const fabbrica = new Function(...DIP, codiceUna + '\nreturn handleAITagSingle;');
const NOMI_TOGLI = ['aiCancelRequestedRef', 'setAiCancelRequested', 'aiAbortControllerRef', 'deleteSecret', 'setGeminiApiKey', 'setIsAIBusy',
    'setIsGlobalAITagging', 'setGlobalAIProgress', 'soundManager', 'showNotification', 't', 'useCallback', 'console',
    'provaModelliRef', 'geminiApiKeyRef', ...refSingola];
const NOMI_INT = ['setAiEnabled', 'aiAbortControllerRef', 'handleCancelAITagging', 'geminiApiKey', 'setIsApiKeyDialogOpen', ...refSingola];

// ITALIANO: un'app finta con UNA foto. `durante(app)` gira mentre Google "risponde"; `risposta` e'
//           quello che Google restituisce (o lancia) dopo, a meno che il segnale sia stato fermato.
// ENGLISH: a fake app with ONE photo. `durante(app)` runs while Google "answers"; `risposta` is what
//          Google returns (or throws) afterwards, unless the signal was stopped.
const app = (risposta = async () => ['red hair', 'blue eyes']) => {
    const foto = [{ id: 'f0', isTrashed: false, tags: ['smile'], file: { name: 'f0.png' } }];
    const a = {
        notifiche: [], suoni: 0, aggiornate: [], occupato: [], segnale: null, finestraChiave: false, lottoFermato: false, aiAcceso: true,
        aiEnabledRef: { current: true }, geminiApiKeyRef: { current: CHIAVE }, chiave: CHIAVE,
        ref: Object.fromEntries(refSingola.map(n => [n, { current: null }])),
    };
    a.dip = {
        aiEnabled: true, geminiApiKey: CHIAVE, aiModel: 'gemini-flash', aiMaxTags: 30, aiCustomPrompt: '',
        images: foto, imagesRef: { current: foto }, t, updateImageTags: (id, tags) => a.aggiornate.push([id, tags]),
        getGeminiTags: async (_img, opz) => {
            a.segnale = opz.signal || null;
            await new Promise((ok) => setTimeout(ok, 5));
            if (a.durante) a.durante(a);
            await new Promise((ok) => setTimeout(ok, 5));
            if (a.segnale && a.segnale.aborted) throw new DOMException('This operation was aborted', 'AbortError');
            return risposta();
        },
        classifyGeminiError: () => ({ kind: 'unknown', quotaGiorno: false }),
        showNotification: (m, tipo) => a.notifiche.push([m, tipo]), soundManager: { chime() { a.suoni++; } },
        setRiparaModello: () => { }, setIsApiKeyDialogOpen: (v) => { a.finestraChiave = v; }, setIsAIBusy: (v) => a.occupato.push(v),
        countNewTagsIgnoringCase: C.countNewTagsIgnoringCase, useCallback: (f) => f, console: muto,
        aiEnabledRef: a.aiEnabledRef, geminiApiKeyRef: a.geminiApiKeyRef, ...a.ref,
    };
    a.una = () => fabbrica(...DIP.map(n => a.dip[n]))('f0');
    // ITALIANO: "Togli la chiave" vero. ENGLISH: the real "Remove the key".
    a.togli = () => new Function(...NOMI_TOGLI, codiceTogli + '\nreturn handleClearApiKey;')(
        { current: false }, () => { a.lottoFermato = true; }, { current: null }, async () => true, (v) => { a.chiave = v; }, () => { },
        () => { }, () => { }, { chime() { } }, () => { }, t, (f) => f, muto, { current: null }, a.geminiApiKeyRef, ...refSingola.map(n => a.ref[n]))();
    // ITALIANO: l'interruttore vero; come React, aiEnabledRef segue lo stato al disegno dopo.
    // ENGLISH: the real switch; like React, aiEnabledRef follows the state at the next render.
    a.interruttore = (v, { lotto = null, chiave = CHIAVE } = {}) => new Function(...NOMI_INT, codiceInterruttore + '\nreturn interruttore;')(
        (x) => { a.aiAcceso = x; a.aiEnabledRef.current = x; }, { current: lotto }, () => { a.lottoFermato = true; }, chiave,
        (x) => { a.finestraChiave = x; }, ...refSingola.map(n => a.ref[n]))(v);
    return a;
};
const nienteDopo = (a, restituito) => [a.aggiornate, a.suoni, a.notifiche, restituito, a.occupato[a.occupato.length - 1]];
const NIENTE = [[], 0, [], 0, false];

console.log('\n--- si spegne l\'AI mentre Google risponde ---');
{
    const a = app();
    a.durante = (x) => x.interruttore(false);
    const n = await a.una();
    dice('nessun tag, nessun suono, nessun avviso, restituisce 0, pulsante dell\'AI libero', NIENTE, nienteDopo(a, n));
    dice('la richiesta in volo e\' stata fermata (il segnale passato a Google e\' interrotto)', true, !!a.segnale && a.segnale.aborted);
}
{
    const a = app();
    a.durante = (x) => { x.aiEnabledRef.current = false; };
    const n = await a.una();
    dice('AI spenta (solo lo stato, senza fermare la richiesta): il risultato si scarta in silenzio', NIENTE, nienteDopo(a, n));
}

console.log('\n--- si toglie la chiave mentre Google risponde ---');
{
    const a = app();
    let fatto = null;
    a.durante = (x) => { fatto = x.togli(); };
    const n = await a.una();
    await fatto;
    dice('nessun tag, nessun suono, nessun avviso verde o rosso, restituisce 0', NIENTE, nienteDopo(a, n));
    dice('la richiesta in volo e\' stata fermata', true, !!a.segnale && a.segnale.aborted);
}
{
    const a = app();
    a.durante = (x) => { x.geminiApiKeyRef.current = 'AIza-un-altra-chiave'; };
    const n = await a.una();
    dice('chiave cambiata durante l\'attesa: il risultato della chiave vecchia si scarta in silenzio', NIENTE, nienteDopo(a, n));
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const a = app();
    const n = await a.una();
    dice('AI accesa e stessa chiave: i tag arrivano, suono e avviso verde col numero',
        [[['f0', ['smile', 'red hair', 'blue eyes']]], 1, [[t.aiTagsGenerated.replace('{n}', '2'), 'success']], 2, false], nienteDopo(a, n));
    dice('...e il segnale non resta in giro dopo la risposta', [], refSingola.filter(nome => a.ref[nome].current !== null));
}
{
    const a = app(async () => { throw new TypeError('fetch failed'); });
    const n = await a.una();
    dice('errore vero di Google con l\'AI accesa: l\'avviso rosso c\'e\' come prima', [[`${t.aiError}: ${t.aiRequestFailed}`, 'error']], a.notifiche);
    dice('...e restituisce 0', 0, n);
}
{
    const a = app();
    a.interruttore(false, { lotto: new AbortController() });
    dice('interruttore spento con un lotto in corso: il lotto si ferma come prima', [false, true], [a.aiAcceso, a.lottoFermato]);
    const b = app();
    b.interruttore(true, { chiave: '' });
    dice('interruttore acceso senza chiave: si apre la finestra della chiave come prima', [true, true], [b.aiAcceso, b.finestraChiave]);
    const c = app();
    c.interruttore(false);
    dice('interruttore spento senza nessuna richiesta in corso: nessun errore', false, c.aiAcceso);
    const d = app();
    await d.togli();
    dice('"Togli la chiave" senza nessuna richiesta in corso: chiave vuota, lotto fermato come prima', ['', true], [d.chiave, d.lottoFermato]);
}

process.exit(esito());
