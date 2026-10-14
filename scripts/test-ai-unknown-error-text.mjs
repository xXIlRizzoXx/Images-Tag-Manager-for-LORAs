/* ITALIANO: PROVA DEL MESSAGGIO PER GLI ERRORI AI CHE NON HANNO UN NOME
   Verificando la chiave senza rete, la finestra della chiave mostrava "fetch failed"; con una
   connessione bloccata "The operation was aborted due to timeout"; taggando una foto con una
   richiesta che Google rifiuta (400 INVALID_ARGUMENT) compariva "Errore AI: {"error":{"code":400,...".
   Testi grezzi, in inglese, in tutte e nove le lingue. E una foto che non si puo' mandare (piu'
   grande di 20 MB, o un TIFF che non si riesce a leggere) diceva "Errore AI: Image too large (> 20
   MB)". La regola: ogni errore si dice con una frase tradotta; il testo grezzo resta solo nella
   console, per chi deve capire cosa e' successo.
   Si eseguono i testi VERI di handleAITagSingle e handleVerifyApiKey presi da src/App.tsx, con il
   servizio vero di src/services/geminiService.ts e un Google finto (nessuna rete, nessuna chiave).
   Uso:  node scripts/test-ai-unknown-error-text.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE MESSAGE FOR AI ERRORS THAT HAVE NO NAME
   Verifying the key with no network, the key dialog showed "fetch failed"; on a stalled
   connection "The operation was aborted due to timeout"; tagging a photo with a request Google
   refuses (400 INVALID_ARGUMENT) showed "AI Error: {"error":{"code":400,...". Raw texts, in English,
   in all nine languages. And a photo that cannot be sent (larger than 20 MB, or a TIFF that cannot
   be read) said "AI Error: Image too large (> 20 MB)". The rule: every error is told with a
   translated sentence; the raw text stays only in the console, for whoever must work out what
   happened.
   The REAL text of handleAITagSingle and handleVerifyApiKey taken from src/App.tsx is run, with
   the real service of src/services/geminiService.ts and a fake Google (no network, no key).
   Usage:  node scripts/test-ai-unknown-error-text.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const avvisi = [];
console.warn = (...a) => { avvisi.push(a.map(String).join(' ')); };
const muto = { log() { }, warn: (...a) => { avvisi.push(a.map(String).join(' ')); }, error: (...a) => { avvisi.push(a.map(String).join(' ')); } };

const finto = {
    name: 'google-finto',
    setup(b) {
        b.onResolve({ filter: /^@google\/genai$/ }, () => ({ path: 'finto', namespace: 'finto' }));
        b.onLoad({ filter: /.*/, namespace: 'finto' }, () => ({
            contents: `
                export const Type = { ARRAY: 'ARRAY', STRING: 'STRING' };
                export class GoogleGenAI {
                    constructor() {}
                    get models() {
                        const g = globalThis.__GOOGLE__;
                        return {
                            list: async () => g.list(),
                            generateContent: async () => { g.chiamate++; return g.generate(g.chiamate); },
                        };
                    }
                }`,
            loader: 'js',
        }));
    },
};
const carica = async (rel, plugins = []) => {
    const uscita = await esbuild.build({
        entryPoints: [path.join(radice, rel)],
        bundle: true, format: 'esm', platform: 'node', write: false, plugins, logLevel: 'silent',
    });
    return import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));
};
const S = await carica('src/services/geminiService.ts', [finto]);
const C = await carica('src/utils/tagCase.ts');
const lingue = (await carica('src/constants.ts')).translations;
globalThis.FileReader = class {
    readAsDataURL() {
        this.result = 'data:image/png;base64,AAAA';
        queueMicrotask(() => this.onloadend && this.onloadend());
    }
};

const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const prendi = async (inizioTesto, fineRegex, nome) => {
    const inizio = sorgente.indexOf(inizioTesto);
    fineRegex.lastIndex = Math.max(inizio, 0);
    const fine = inizio < 0 ? null : fineRegex.exec(sorgente);
    if (!fine) { console.log(`NO  ${nome} non trovato in src/App.tsx`); process.exit(1); }
    return (await esbuild.transform(sorgente.slice(inizio, fine.index + fine[0].length), { loader: 'ts' })).code;
};
const codiceUna = await prendi('    const handleAITagSingle = useCallback(',
    /\r?\n    \}, \[aiEnabled, geminiApiKey, aiModel, aiMaxTags, aiCustomPrompt, images, t, updateImageTags\]\);\r?\n/g, 'handleAITagSingle');
const codiceChiave = await prendi('    const handleVerifyApiKey = useCallback(', /\r?\n    \}, \[tempApiKey, t\]\);\r?\n/g, 'handleVerifyApiKey');
const DIP_UNA = ['aiEnabled', 'geminiApiKey', 'aiModel', 'aiMaxTags', 'aiCustomPrompt', 'images', 'imagesRef', 't', 'updateImageTags',
    'getGeminiTags', 'classifyGeminiError', 'showNotification', 'soundManager', 'setRiparaModello', 'setIsApiKeyDialogOpen', 'setIsAIBusy',
    'countNewTagsIgnoringCase', 'useCallback', 'console'];
const fabbricaUna = new Function(...DIP_UNA, codiceUna + '\nreturn handleAITagSingle;');
const fabbricaChiave = new Function('tempApiKey', 't', 'verifyGeminiApiKey', 'setApiKeyError', 'setIsVerifyingApiKey', 'setGeminiApiKey',
    'setIsApiKeyDialogOpen', 'soundManager', 'showNotification', 'useCallback', 'console', codiceChiave + '\nreturn handleVerifyApiKey;');

class ApiError extends Error {
    constructor(messaggio, stato) { super(messaggio); this.name = 'ApiError'; this.status = stato; }
}
const ERRORI = {
    rete: () => new TypeError('fetch failed'),
    scaduta: () => new DOMException('The operation was aborted due to timeout', 'TimeoutError'),
    nonValida: () => new ApiError(JSON.stringify({ error: { code: 400, message: 'Request contains an invalid argument.', status: 'INVALID_ARGUMENT' } }), 400),
};
const PNG_MINIMO = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0, 73, 69, 78, 68, 0xAE, 0x42, 0x60, 0x82]);
const GRANDE = new Uint8Array(21 * 1024 * 1024);

// ITALIANO: tagga UNA foto con questo file e questa risposta di Google; restituisce le notifiche.
// ENGLISH: tags ONE photo with this file and this Google answer; returns the notifications.
const una = async (t, generate, file = new File([PNG_MINIMO], 'f0.png', { type: 'image/png' })) => {
    globalThis.__GOOGLE__ = { chiamate: 0, generate, list: async () => ({ async *[Symbol.asyncIterator]() { } }) };
    const foto = [{ id: 'f0', isTrashed: false, tags: [], file }];
    const notifiche = [];
    const r = { riparazioni: 0 };
    const dip = {
        aiEnabled: true, geminiApiKey: 'AIza' + 'x'.repeat(35), aiModel: 'gemini-3.6-flash', aiMaxTags: 30, aiCustomPrompt: '',
        images: foto, imagesRef: { current: foto }, t, updateImageTags: () => { },
        getGeminiTags: S.getGeminiTags, classifyGeminiError: S.classifyGeminiError,
        showNotification: (m, tipo) => notifiche.push([m, tipo]), soundManager: { chime() { } },
        setRiparaModello: () => { r.riparazioni++; }, setIsApiKeyDialogOpen: () => { }, setIsAIBusy: () => { },
        countNewTagsIgnoringCase: C.countNewTagsIgnoringCase, useCallback: (f) => f, console: muto,
    };
    await fabbricaUna(...DIP_UNA.map(n => dip[n]))('f0');
    return { notifiche, riparazioni: r.riparazioni };
};
// ITALIANO: preme "Verifica e salva" con una chiave lunga; restituisce cosa mostra la finestra.
// ENGLISH: presses "Verify and save" with a long key; returns what the dialog shows.
const verifica = async (t, list) => {
    globalThis.__GOOGLE__ = { chiamate: 0, list, generate: async () => ({ text: '[]' }) };
    const errori = [];
    await fabbricaChiave('AIzaSy' + 'x'.repeat(33), t, S.verifyGeminiApiKey, (m) => errori.push(m), () => { }, () => { },
        () => { }, { chime() { } }, () => { }, (f) => f, muto)();
    return errori.filter(Boolean).pop();
};

console.log('\n--- il servizio: questi errori restano "sconosciuti" ---');
for (const [nome, crea] of Object.entries(ERRORI)) dice(`${nome}: kind 'unknown'`, 'unknown', S.classifyGeminiError(crea()).kind);

for (const l of Object.keys(lingue)) {
    const t = lingue[l];
    console.log(`\n--- ${l} ---`);
    dice('le due frasi esistono', ['string', 'string'], [typeof t.aiRequestFailed, typeof t.aiPhotoNotSupported]);
    for (const [nome, crea] of Object.entries(ERRORI)) {
        dice(`finestra della chiave, ${nome}: la frase tradotta, non il testo di Google`, t.aiRequestFailed, await verifica(t, async () => { throw crea(); }));
        const r = await una(t, async () => { throw crea(); });
        dice(`una foto, ${nome}: la frase tradotta, non il testo di Google`, [[`${t.aiError}: ${t.aiRequestFailed}`, 'error']], r.notifiche);
    }
    const grande = await una(t, async () => ({ text: '["cat"]' }), new File([GRANDE], 'f0.png', { type: 'image/png' }));
    dice('una foto piu\' grande di 20 MB: si dice che e\' la foto, non la rete', [[`${t.aiError}: ${t.aiPhotoNotSupported}`, 'error']], grande.notifiche);
    const tiff = await una(t, async () => ({ text: '["cat"]' }), new File([new Uint8Array([73, 73, 42, 0, 8, 0, 0, 0])], 'f0.tif', { type: 'image/tiff' }));
    dice('un TIFF che non si riesce a ridisegnare: si dice che e\' la foto', [[`${t.aiError}: ${t.aiPhotoNotSupported}`, 'error']], tiff.notifiche);
}

console.log('\n--- il testo grezzo resta nella console ---');
avvisi.length = 0;
await verifica(lingue.en, async () => { throw ERRORI.rete(); });
dice('finestra della chiave: "fetch failed" nella console', true, avvisi.some(a => a.includes('fetch failed')));

console.log('\n--- quello che NON deve cambiare ---');
{
    const t = lingue.en;
    const sbagliata = new ApiError(JSON.stringify({ error: { code: 400, message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT',
        details: [{ reason: 'API_KEY_INVALID' }] } }), 400);
    dice('chiave sbagliata: ancora "chiave non valida"', t.aiKeyInvalid, await verifica(t, async () => { throw sbagliata; }));
    const sovraccarico = new ApiError(JSON.stringify({ error: { code: 503, status: 'UNAVAILABLE', message: 'The model is overloaded.' } }), 503);
    dice('Google sovraccarico: ancora la sua frase', [[`${t.aiError}: ${t.aiServerBusy}`, 'error']], (await una(t, async () => { throw sovraccarico; })).notifiche);
    const buona = await una(t, async () => ({ text: '["cat"]' }));
    dice('una foto taggata: il messaggio verde di sempre', [[t.aiTagsGenerated.replace('{n}', '1'), 'success']], buona.notifiche);
}

process.exit(esito());
