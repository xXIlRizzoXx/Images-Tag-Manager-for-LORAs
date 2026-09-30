/* ITALIANO: PROVA DEL MESSAGGIO DELLA FINESTRA DELLA CHIAVE API CON UNA CHIAVE SBAGLIATA
   Incollando una chiave sbagliata e premendo "Verifica e salva", la finestra mostrava i primi 200
   caratteri della risposta di Google cosi' com'e', in inglese e in tutte e nove le lingue:
   '{"error":{"code":400,"message":"API key not valid...'. Premendo Invio con una chiave troppo
   corta (il tasto e' spento, Invio no) compariva l'inglese fisso "API key looks invalid (too
   short)". La traduzione giusta c'era gia' (aiKeyInvalid) ma non veniva mai raggiunta. La regola:
   una chiave sbagliata si dice con la frase tradotta; il testo grezzo resta solo per gli errori
   che non si sanno riconoscere.
   Si eseguono il testo VERO di handleVerifyApiKey preso da src/App.tsx e il servizio vero di
   src/services/geminiService.ts, con un Google finto (nessuna rete, nessuna chiave).
   Uso:  node scripts/test-key-dialog-message.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE API KEY DIALOG MESSAGE WITH A WRONG KEY
   Pasting a wrong key and pressing "Verify and save", the dialog showed the first 200 characters of
   Google's answer as it was, in English and in all nine languages:
   '{"error":{"code":400,"message":"API key not valid...'. Pressing Enter with a key too short (the
   button is off, Enter is not) showed the fixed English "API key looks invalid (too short)". The
   right translation already existed (aiKeyInvalid) but was never reached. The rule: a wrong key is
   told with the translated sentence; the raw text stays only for errors nobody can recognise.
   The REAL text of handleVerifyApiKey taken from src/App.tsx and the real service of
   src/services/geminiService.ts are run, with a fake Google (no network, no key).
   Usage:  node scripts/test-key-dialog-message.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
console.warn = () => { };

// ITALIANO: il Google finto, come in test-ai-models.mjs: ogni prova decide cosa risponde list().
// ENGLISH: the fake Google, as in test-ai-models.mjs: every test decides what list() answers.
const finto = {
    name: 'google-finto',
    setup(b) {
        b.onResolve({ filter: /^@google\/genai$/ }, () => ({ path: 'finto', namespace: 'finto' }));
        b.onLoad({ filter: /.*/, namespace: 'finto' }, () => ({
            contents: `
                export const Type = { ARRAY: 'ARRAY', STRING: 'STRING' };
                export class GoogleGenAI {
                    constructor(opts) { this.chiave = opts && opts.apiKey; }
                    get models() {
                        const g = globalThis.__GOOGLE__;
                        return {
                            list: async () => { g.chiamate++; return g.list(); },
                            generateContent: async () => { throw new Error('non usato'); },
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
const lingue = (await carica('src/constants.ts')).translations;

const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const inizio = sorgente.indexOf('    const handleVerifyApiKey = useCallback(');
const chiusura = /\r?\n    \}, \[tempApiKey, t\]\);\r?\n/g;
chiusura.lastIndex = Math.max(inizio, 0);
const fine = inizio < 0 ? null : chiusura.exec(sorgente);
if (!fine) { console.log('NO  handleVerifyApiKey non trovato in src/App.tsx'); process.exit(1); }
const codice = (await esbuild.transform(sorgente.slice(inizio, fine.index + fine[0].length), { loader: 'ts' })).code;
const fabbrica = new Function('tempApiKey', 't', 'verifyGeminiApiKey', 'setApiKeyError', 'setIsVerifyingApiKey', 'setGeminiApiKey',
    'setIsApiKeyDialogOpen', 'soundManager', 'showNotification', 'useCallback', codice + '\nreturn handleVerifyApiKey;');

// ITALIANO: l'errore come lo costruisce DAVVERO la libreria di Google per una chiave sbagliata:
//           il messaggio e' tutto il corpo JSON della risposta.
// ENGLISH: the error as Google's library REALLY builds it for a wrong key: the message is the
//          whole JSON body of the answer.
class ApiError extends Error {
    constructor(messaggio, stato) { super(messaggio); this.name = 'ApiError'; this.status = stato; }
}
const chiaveSbagliata = () => new ApiError(JSON.stringify({ error: {
    code: 400, message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT',
    details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'API_KEY_INVALID', domain: 'googleapis.com' }] } }), 400);

// ITALIANO: preme "Verifica e salva" (o Invio) con questa chiave; restituisce cosa mostra la finestra.
// ENGLISH: presses "Verify and save" (or Enter) with this key; returns what the dialog shows.
const verifica = async (t, chiave, list) => {
    globalThis.__GOOGLE__ = { chiamate: 0, list };
    const r = { errori: [], salvata: null };
    await fabbrica(chiave, t, S.verifyGeminiApiKey, (m) => r.errori.push(m), () => { }, (k) => { r.salvata = k; },
        () => { }, { chime() { } }, () => { }, (f) => f)();
    return { mostrato: r.errori.filter(Boolean).pop(), salvata: r.salvata, chiamate: globalThis.__GOOGLE__.chiamate };
};

const LUNGA = 'AIzaSy' + 'x'.repeat(33);
for (const l of Object.keys(lingue)) {
    const t = lingue[l];
    const sbagliata = await verifica(t, LUNGA, async () => { throw chiaveSbagliata(); });
    dice(`${l}: chiave sbagliata -> la frase tradotta, non il JSON di Google`, t.aiKeyInvalid, sbagliata.mostrato);
    const corta = await verifica(t, 'corta', async () => { throw new Error('non deve chiamare Google'); });
    dice(`${l}: chiave troppo corta (Invio) -> la frase tradotta, senza chiamare Google`, [t.aiKeyInvalid, 0], [corta.mostrato, corta.chiamate]);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const t = lingue.it;
    const rete = await verifica(t, LUNGA, async () => { throw new Error('fetch failed: ECONNRESET'); });
    dice('errore sconosciuto (rete): il testo resta quello vero, utile per capire', 'fetch failed: ECONNRESET', rete.mostrato);
    const buona = await verifica(t, LUNGA, async () => ({ async *[Symbol.asyncIterator]() { } }));
    dice('chiave buona: si salva, nessun errore', [LUNGA, undefined], [buona.salvata, buona.mostrato]);
}

process.exit(esito());
