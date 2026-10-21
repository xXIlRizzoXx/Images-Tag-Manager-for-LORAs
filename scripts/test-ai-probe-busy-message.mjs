/* ITALIANO: PROVA DEL MESSAGGIO DI "PROVA I MODELLI RECENTI" CON GOOGLE OCCUPATO
   Se l'elenco dei modelli risponde 429 (troppe richieste) o 503 (sovraccarico), la prova si ferma
   con l'esito 'occupato' e l'app mostrava aiModelCheckBusy: "il controllo verra' ripetuto piu'
   avanti. Resta quello di adesso". Per la prova e' falso: parte solo dal clic sul pulsante, niente
   la ripete da sola, e non cambia nessun modello. Ora ha una frase sua (aiProbeBusy), nelle nove
   lingue, che dice che la prova non e' partita e di riprovare fra qualche minuto.
   Il controllo del modello (che si ripete davvero ogni giorno) tiene la frase di prima.
   Si esegue il testo VERO di provaModelliChiave preso da src/App.tsx con il VERO provaTuttiIModelli
   di src/services/geminiService.ts davanti a un Google finto (nessuna rete).
   Uso:  node scripts/test-ai-probe-busy-message.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE "TEST RECENT MODELS" MESSAGE WITH GOOGLE BUSY
   If the model list answers 429 (too many requests) or 503 (overloaded), the test stops with the
   'occupato' outcome and the app showed aiModelCheckBusy: "the check will be repeated later. The
   current one stays". For the test that is false: it starts only from the button click, nothing
   repeats it by itself, and it changes no model. Now it has its own sentence (aiProbeBusy), in the
   nine languages, saying that the test did not start and to try again in a few minutes.
   The model check (which really repeats every day) keeps the sentence it had.
   The REAL text of provaModelliChiave taken from src/App.tsx runs with the REAL provaTuttiIModelli
   of src/services/geminiService.ts in front of a fake Google (no network).
   Usage:  node scripts/test-ai-probe-busy-message.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
console.warn = () => { };

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
                        return {
                            list: async () => { throw globalThis.__ERRORE__(); },
                            generateContent: async () => { throw new Error('non deve partire'); },
                        };
                    }
                }`,
            loader: 'js',
        }));
    },
};
const carica = async (rel, plugins = []) => {
    const u = await esbuild.build({ entryPoints: [path.join(radice, rel)], bundle: true, format: 'esm', platform: 'node', write: false, plugins, logLevel: 'silent' });
    return import('data:text/javascript;base64,' + Buffer.from(u.outputFiles[0].text).toString('base64'));
};
const S = await carica('src/services/geminiService.ts', [finto]);
const lingue = (await carica('src/constants.ts')).translations;

const app = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const i = app.indexOf('    const provaModelliChiave = async () => {');
const chiusura = /\r?\n    \};\r?\n/g;
chiusura.lastIndex = Math.max(i, 0);
const f = i < 0 ? null : chiusura.exec(app);
if (!f) { console.log('NO  provaModelliChiave non trovato in src/App.tsx'); process.exit(1); }
const modulo = `
type ModelloChiave = any; type ProvaSalvata = any;
export const render = (env: any) => {
    const { t, geminiApiKey, geminiApiKeyRef, controlloModelloRef, aiEnabledRef, provaModelliRef, improntaChiave,
            setProvaModelliStato, setModelliChiave, provaTuttiIModelli, showNotification, localStorage } = env;
${app.slice(i, f.index + f[0].length)}
    return { provaModelliChiave };
};`;
const js = (await esbuild.transform(modulo, { loader: 'ts' })).code;
const { render } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));

const CHIAVE = 'AIza' + 'x'.repeat(35);
const errore = (status, corpo) => Object.assign(new Error(JSON.stringify({ error: corpo })), { status });
const RISPOSTE = {
    '503 (sovraccarico)': () => errore(503, { code: 503, message: 'The model is overloaded. Please try again later.', status: 'UNAVAILABLE' }),
    '429 (troppe richieste)': () => errore(429, { code: 429, message: 'Resource has been exhausted (e.g. check quota).', status: 'RESOURCE_EXHAUSTED' }),
};
// ITALIANO: il clic su "Prova i modelli recenti" con l'elenco che risponde `risposta`.
// ENGLISH: the click on "Test recent models" with the list answering `risposta`.
const clic = async (t, risposta) => {
    globalThis.__ERRORE__ = risposta;
    const notifiche = [];
    const env = {
        t, geminiApiKey: CHIAVE, geminiApiKeyRef: { current: CHIAVE }, controlloModelloRef: { current: null }, aiEnabledRef: { current: true },
        provaModelliRef: { current: null }, improntaChiave: 'impronta', setProvaModelliStato: () => { }, setModelliChiave: () => { },
        provaTuttiIModelli: (k, cb, segnale) => S.provaTuttiIModelli(k, cb, segnale, 0, 10),
        showNotification: (m, tipo) => notifiche.push([m, tipo]), localStorage: { setItem() { } },
    };
    await render(env).provaModelliChiave();
    return notifiche;
};

console.log('\n--- l\'elenco dei modelli risponde occupato ---');
for (const [nome, risposta] of Object.entries(RISPOSTE)) {
    const t = lingue.en;
    const n = await clic(t, risposta);
    dice(`${nome}: la frase della prova (aiProbeBusy), azzurra`, [[t.aiProbeBusy, 'info']], n);
    dice(`${nome}: non la frase del controllo del modello ("verra' ripetuto")`, false, n.some(([m]) => m === t.aiModelCheckBusy));
}

console.log('\n--- la frase nelle nove lingue ---');
// ITALIANO: le parole della promessa "verra' ripetuto" in ogni lingua (dalla frase del controllo).
// ENGLISH: the words of the "will be repeated" promise in each language (from the check's sentence).
const PROMESSA = { it: 'ripet', en: 'repeat', fr: 'refaite', es: 'repetir', de: 'wiederholt', zh: '再次检查', ja: 'もう一度行います', pt: 'repetid', ru: 'повтор' };
for (const [l, t] of Object.entries(lingue)) {
    const frase = t.aiProbeBusy;
    dice(`${l}: aiProbeBusy c'e' e non e' la frase del controllo del modello`, true, typeof frase === 'string' && frase.trim() !== '' && frase !== t.aiModelCheckBusy);
    dice(`${l}: non promette che la prova si ripetera' da sola`, false, typeof frase === 'string' && frase.toLowerCase().includes(PROMESSA[l] || '\u0000'));
    dice(`${l}: la frase del controllo del modello resta (il controllo si ripete davvero)`, true, typeof t.aiModelCheckBusy === 'string' && t.aiModelCheckBusy.toLowerCase().includes(PROMESSA[l]));
}

process.exit(esito());
