/* ITALIANO: PROVA DEL CONTROLLO DEI MODELLI CON UNA CHIAVE SCADUTA, REVOCATA O SBAGLIATA
   Con una chiave che Google non accetta piu' (revocata in AI Studio, scaduta), "Controlla ora"
   diceva "Il controllo dei modelli non e' riuscito a parlare con Google": l'utente controllava
   la rete, mentre il problema era la chiave. La regola: se Google rifiuta la chiave, il messaggio
   dice che e' la chiave; la frase "non raggiungibile" resta per la rete che non risponde.
   Si eseguono i testi VERI di controllaModello presi da src/App.tsx, con il servizio vero di
   src/services/geminiService.ts e un Google finto (nessuna rete, nessuna chiave), sia con il
   modello su Automatico sia con il modello bloccato a mano.
   Uso:  node scripts/test-model-check-invalid-key.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE MODEL CHECK WITH AN EXPIRED, REVOKED OR WRONG KEY
   With a key Google no longer accepts (revoked in AI Studio, expired), "Check now" said "The
   model check could not reach Google": the user checked the network, while the key was the
   problem. The rule: if Google refuses the key, the message says it is the key; the
   "could not reach" sentence stays for a network that does not answer.
   The REAL text of controllaModello, taken from src/App.tsx, is run with the real service of
   src/services/geminiService.ts and a fake Google (no network, no key), both with the model on
   Automatic and with the model locked by hand.
   Usage:  node scripts/test-model-check-invalid-key.mjs      (exits with code 1 if anything is off) */

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
                    constructor(opts) { this.chiave = opts && opts.apiKey; }
                    get models() {
                        const g = globalThis.__GOOGLE__;
                        return {
                            list: async () => g.list(),
                            generateContent: async (p) => g.generate(p),
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
const t = (await carica('src/constants.ts')).translations.en;

const app = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const i0 = app.indexOf('    const controllaModello = async (');
const fineControlla = /\r?\n    \};\r?\n/g;
fineControlla.lastIndex = Math.max(i0, 0);
const f0 = i0 < 0 ? null : fineControlla.exec(app);
if (!f0) { console.log('NO  non trovato in src/App.tsx: controllaModello'); process.exit(1); }
const testoControlla = app.slice(i0, f0.index + f0[0].length);

const modulo = `
export const render = (env: any, snap: { aiModel: string; aiModelloFissato: boolean }) => {
    const { t, geminiApiKey, controlloModelloRef, sceltaManualeRef, ultimaSceltaRef, aiModelloFissatoRef, setControlloModelloInCorso,
            setModelloControllatoIl, setModelliDisponibili, showNotification, setAiModel, setAiModelloFissato,
            elencaModelliRemoti, aggiornaModelloAutomatico, classifyGeminiError, localStorage } = env;
    const aiModel = snap.aiModel;
    const aiModelloFissato = snap.aiModelloFissato;
${testoControlla}
    return { controllaModello };
};`;
const js = (await esbuild.transform(modulo, { loader: 'ts' })).code;
const { render } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));

// ITALIANO: gli errori come li costruisce la libreria di Google (ApiError: corpo JSON + stato numerico).
// ENGLISH: the errors as Google's library builds them (ApiError: JSON body + numeric status).
class ApiError extends Error {
    constructor(messaggio, stato) { super(messaggio); this.name = 'ApiError'; this.status = stato; }
}
const apiErrore = (stato, corpo) => new ApiError(JSON.stringify({ error: corpo }), stato);
const ERRORI = {
    scaduta: () => apiErrore(400, { code: 400, status: 'INVALID_ARGUMENT', message: 'API key expired. Please renew the API key.',
        details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'API_KEY_INVALID', domain: 'googleapis.com' }] }),
    sbagliata: () => apiErrore(400, { code: 400, status: 'INVALID_ARGUMENT', message: 'API key not valid. Please pass a valid API key.',
        details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'API_KEY_INVALID', domain: 'googleapis.com' }] }),
    rete: () => new Error('fetch failed'),
};

const M = (nome) => ({ name: 'models/' + nome, displayName: nome, supportedActions: ['generateContent'] });
const pagine = (voci) => ({ async *[Symbol.asyncIterator]() { for (const v of voci) yield v; } });

const prova = async ({ fissato, rotto = false, dilloComunque = true, list, generate }) => {
    const notifiche = [];
    const salvato = new Map();
    const stato = { aiModel: 'gemini-3.6-flash', aiModelloFissato: fissato };
    globalThis.__GOOGLE__ = {
        list: list || (async () => pagine([M('gemini-3.7-flash'), M('gemini-3.6-flash')])),
        generate: generate || (async () => ({ text: '["ok"]' })),
    };
    const env = {
        t, geminiApiKey: 'AIza' + 'x'.repeat(35),
        controlloModelloRef: { current: false }, sceltaManualeRef: { current: 0 }, ultimaSceltaRef: { current: '' },
        aiModelloFissatoRef: { current: fissato },
        setControlloModelloInCorso: () => { }, setModelloControllatoIl: () => { }, setModelliDisponibili: () => { },
        showNotification: (m, tipo) => notifiche.push([m, tipo]),
        setAiModel: (v) => { stato.aiModel = v; }, setAiModelloFissato: (v) => { stato.aiModelloFissato = v; },
        elencaModelliRemoti: S.elencaModelliRemoti, aggiornaModelloAutomatico: S.aggiornaModelloAutomatico,
        classifyGeminiError: S.classifyGeminiError,
        localStorage: { getItem: (k) => (salvato.has(k) ? salvato.get(k) : null), setItem: (k, v) => salvato.set(k, String(v)) },
    };
    await render(env, stato).controllaModello(rotto, dilloComunque, fissato);
    return { notifiche, stato, controllato: salvato.has('aiModelloControllatoIl') };
};

const chiaveRifiutata = () => [[t.aiModelCheckKeyInvalid, 'error']];
const nonRaggiunto = [[t.aiModelCheckFailed, 'error']];

dice('il testo "chiave rifiutata" esiste', 'string', typeof t.aiModelCheckKeyInvalid);

console.log('\n--- Google rifiuta la chiave: il messaggio dice che e\' la chiave ---');
{
    let r = await prova({ fissato: false, list: async () => { throw ERRORI.scaduta(); } });
    dice('Automatico, chiave scaduta: "chiave rifiutata", NON "non raggiungibile"', chiaveRifiutata(), r.notifiche);
    dice('...il modello non cambia e l\'ultimo controllo non si segna', ['gemini-3.6-flash', false], [r.stato.aiModel, r.controllato]);
    r = await prova({ fissato: true, list: async () => { throw ERRORI.scaduta(); } });
    dice('modello bloccato, chiave scaduta: "chiave rifiutata", NON "non raggiungibile"', chiaveRifiutata(), r.notifiche);
    dice('...il modello resta bloccato e l\'ultimo controllo non si segna', ['gemini-3.6-flash', true, false], [r.stato.aiModel, r.stato.aiModelloFissato, r.controllato]);
    r = await prova({ fissato: false, list: async () => { throw ERRORI.sbagliata(); } });
    dice('Automatico, chiave sbagliata: "chiave rifiutata"', chiaveRifiutata(), r.notifiche);
    r = await prova({ fissato: true, rotto: true, list: async () => { throw ERRORI.sbagliata(); } });
    dice('riparazione (modello bloccato e morto), chiave sbagliata: "chiave rifiutata"', chiaveRifiutata(), r.notifiche);
    r = await prova({ fissato: false, dilloComunque: false, list: async () => { throw ERRORI.scaduta(); } });
    dice('controllo silenzioso all\'avvio, chiave scaduta: nessun avviso', [], r.notifiche);
    r = await prova({ fissato: true, dilloComunque: false, list: async () => { throw ERRORI.scaduta(); } });
    dice('controllo silenzioso all\'avvio, modello bloccato, chiave scaduta: nessun avviso', [], r.notifiche);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    let r = await prova({ fissato: false, list: async () => { throw ERRORI.rete(); } });
    dice('Automatico, rete assente: resta "non raggiungibile"', nonRaggiunto, r.notifiche);
    r = await prova({ fissato: true, list: async () => { throw ERRORI.rete(); } });
    dice('modello bloccato, rete assente: resta "non raggiungibile"', nonRaggiunto, r.notifiche);
    r = await prova({ fissato: false, generate: async () => { throw apiErrore(503, { code: 503, status: 'UNAVAILABLE', message: 'The model is overloaded.' }); } });
    dice('Automatico, prova con Google sovraccarico: resta "occupato"', [[t.aiModelCheckBusy, 'info']], r.notifiche);
    r = await prova({ fissato: true });
    dice('modello bloccato, tutto bene: dice che ce n\'e\' uno piu\' nuovo', [[t.aiModelNewerAvailable.replace('{a}', 'gemini-3.7-flash'), 'info']], r.notifiche);
    r = await prova({ fissato: false });
    dice('Automatico, tutto bene: passa al piu\' recente e lo dice',
        [['gemini-3.7-flash', true], [[t.aiModelSwitched.replace('{da}', 'gemini-3.6-flash').replace('{a}', 'gemini-3.7-flash'), 'info']]],
        [[r.stato.aiModel, r.controllato], r.notifiche]);
}

process.exit(esito());
