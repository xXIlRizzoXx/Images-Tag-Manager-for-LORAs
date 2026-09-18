/* ITALIANO: PROVA DELLA SCELTA AUTOMATICA DEL MODELLO AI E DELLA VERIFICA DELLA CHIAVE
   Gira SENZA rete e SENZA chiave: al posto di Google c'e' un finto che risponde come vuole
   ogni singola prova (elenco dei modelli, chiave sbagliata, modello chiuso, "troppe
   richieste", rete assente). Si prova il codice VERO di src/services/geminiService.ts,
   compilato al volo con esbuild; solo la libreria di Google viene sostituita.
   Uso:  node scripts/test-ai-models.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE AUTOMATIC AI MODEL SELECTION AND OF THE KEY CHECK
   Runs WITHOUT network and WITHOUT a key: Google is replaced by a fake that answers however
   each test needs (model list, bad key, retired model, "too many requests", no network). The
   REAL code of src/services/geminiService.ts is tested, compiled on the fly with esbuild; only
   Google's library is swapped out.
   Usage:  node scripts/test-ai-models.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ITALIANO: gli avvisi del servizio (es. "elenco non ottenuto" nella prova senza rete) sono
//           ATTESI: si mettono da parte, altrimenti la loro traccia sommerge l'esito.
// ENGLISH: the service's warnings (e.g. "list not obtained" in the no-network test) are
//          EXPECTED: set them aside, or their stack trace buries the verdict.
console.warn = () => {};

// --- il Google finto: ogni prova imposta globalThis.__GOOGLE__ come le serve
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
                        const chiave = this.chiave;
                        return {
                            list: async (p) => { g.chiamate.push('list'); return g.list(chiave, p); },
                            generateContent: async (p) => { g.chiamate.push('generate:' + p.model); return g.generate(chiave, p); },
                        };
                    }
                }`,
            loader: 'js',
        }));
    },
};

const uscita = await esbuild.build({
    entryPoints: [path.join(radice, 'src/services/geminiService.ts')],
    bundle: true, format: 'esm', platform: 'node', write: false, plugins: [finto], logLevel: 'silent',
});
const codice = uscita.outputFiles[0].text;
const S = await import('data:text/javascript;base64,' + Buffer.from(codice).toString('base64'));

// --- aiutanti
const errore = (testo) => { const e = new Error(testo); return e; };
const ERR = {
    chiave: () => errore('[400] API key not valid. Please pass a valid API key. API_KEY_INVALID'),
    chiuso: () => errore('[404] models/xxx is not found for API version v1beta. NOT_FOUND'),
    fretta: () => errore('[429] RESOURCE_EXHAUSTED: quota exceeded'),
    rete:   () => errore('fetch failed: ECONNRESET'),
};
const M = (nome, azioni = ['generateContent']) => ({ name: 'models/' + nome, displayName: nome, supportedActions: azioni });
const pagine = (voci) => ({ async *[Symbol.asyncIterator]() { for (const v of voci) yield v; } });

const googleCon = ({ modelli = [], list, generate } = {}) => {
    globalThis.__GOOGLE__ = {
        chiamate: [],
        list: list || (async () => pagine(modelli)),
        generate: generate || (async () => ({ text: '["ok"]' })),
    };
    return globalThis.__GOOGLE__;
};

let guai = 0, fatti = 0;
const dice = (cosa, atteso, avuto) => {
    fatti++;
    const ok = JSON.stringify(atteso) === JSON.stringify(avuto);
    if (!ok) guai++;
    console.log('  ' + (ok ? 'OK  ' : 'NO  ') + cosa + (ok ? '' : `\n        atteso: ${JSON.stringify(atteso)}\n        avuto:  ${JSON.stringify(avuto)}`));
};
const CHIAVE = 'AIza' + 'x'.repeat(35);

// =============================================================================
console.log('\n--- la versione si legge solo subito dopo "gemini-" (difetto F) ---');
dice('gemini-3.6-flash -> [3,6]', [3, 6], S.versioneDi('gemini-3.6-flash'));
dice('gemini-3.10-flash -> [3,10]', [3, 10], S.versioneDi('gemini-3.10-flash'));
dice('la taglia "-8b" NON e una versione', [3, 6], S.versioneDi('gemini-3.6-flash-8b'));
dice('l\'istantanea "-001" NON e una versione', [2, 0], S.versioneDi('gemini-2.0-flash-001'));
dice('senza numero dopo gemini- -> []', [], S.versioneDi('gemini-flash-latest'));
dice('3.10 viene DOPO 3.6 (alfabeticamente sarebbe prima)', true, S.confrontaVersioni([3, 10], [3, 6]) > 0);

console.log('\n--- chi sopravvive al filtro, e in che ordine ---');
const grezzi = [
    M('gemini-3.6-flash'), M('gemini-3.6-flash-8b'), M('gemini-3.10-flash'), M('gemini-3.10-flash-lite'),
    M('gemini-4.0-flash-preview-01-20'), M('gemini-3.9-flash-thinking-exp'), M('gemini-3.6-pro'),
    M('gemini-2.0-flash-001'), M('gemini-3.6-flash-image'), M('gemini-live-2.5-flash'),
    M('gemini-embedding-001', ['embedContent']), M('imagen-4.0-generate-001'), M('gemini-3.6-flash-tts'),
    M('gemini-2.0-flash', []), M('gemini-3.6-flash'),
];
const c = S.scegliCandidati(grezzi);
dice('ordine', ['gemini-3.10-flash', 'gemini-3.10-flash-lite', 'gemini-3.6-flash', 'gemini-3.6-flash-8b', 'gemini-2.0-flash', 'gemini-2.0-flash-001'], c.map(x => x.id));
dice('il flash pieno passa davanti al -8b della stessa versione', true, c.findIndex(x => x.id === 'gemini-3.6-flash') < c.findIndex(x => x.id === 'gemini-3.6-flash-8b'));
dice('niente anteprime, sperimentali, pro, immagini, voce, live, embedding', false, c.some(x => /preview|exp|pro|image|tts|live|embedding/.test(x.id)));
dice('nessun doppione', c.length, new Set(c.map(x => x.id)).size);
dice('elenco nullo o spazzatura non esplode', [], S.scegliCandidati([null, {}, { name: 42 }, 'x']));

// =============================================================================
console.log('\n--- verifica della chiave senza legarsi a un modello (difetto C) ---');
let g = googleCon({ modelli: [M('gemini-3.10-flash')], generate: async () => { throw ERR.chiuso(); } });
let v = await S.verifyGeminiApiKey(CHIAVE);
dice('chiave buona accettata ANCHE se il modello di riserva e chiuso', true, v.ok);
dice('per verificarla si chiede solo l\'elenco, nessuna generazione', ['list'], g.chiamate);
googleCon({ list: async () => { throw ERR.chiave(); } });
v = await S.verifyGeminiApiKey(CHIAVE);
dice('chiave sbagliata rifiutata come chiave sbagliata', ['invalid_key', false], [v.errorKind, v.ok]);
v = await S.verifyGeminiApiKey('corta');
dice('chiave troppo corta rifiutata senza chiamare Google', false, v.ok);

// =============================================================================
console.log('\n--- il giro automatico: ogni esito con il suo motivo (difetti E, H) ---');
g = googleCon({ modelli: [M('gemini-3.10-flash'), M('gemini-3.6-flash')] });
let e = await S.aggiornaModelloAutomatico(CHIAVE, 'gemini-3.10-flash');
dice('gia sul piu recente: invariato', 'invariato', e.esito);
dice('...e senza spendere nemmeno una prova', ['list'], g.chiamate);

g = googleCon({ modelli: [M('gemini-3.10-flash'), M('gemini-3.6-flash')] });
e = await S.aggiornaModelloAutomatico(CHIAVE, 'gemini-3.6-flash');
dice('ne esiste uno piu recente e passa la prova: aggiornato', ['aggiornato', 'gemini-3.10-flash', true], [e.esito, e.modello, e.cambiato]);
dice('...ed e stato PROVATO prima di adottarlo', true, g.chiamate.includes('generate:gemini-3.10-flash'));

g = googleCon({ modelli: [M('gemini-3.10-flash'), M('gemini-3.6-flash')],
    generate: async (_k, p) => { if (p.model === 'gemini-3.10-flash') throw ERR.chiuso(); return { text: '["ok"]' }; } });
e = await S.aggiornaModelloAutomatico(CHIAVE, 'gemini-2.0-flash');
dice('il primo non passa la prova: si prende il secondo', ['aggiornato', 'gemini-3.6-flash'], [e.esito, e.modello]);

g = googleCon({ modelli: [M('gemini-3.10-flash')] });
e = await S.aggiornaModelloAutomatico(CHIAVE, 'gemini-3.6-flash', true);
dice('il modello in uso e chiuso: riparato', ['riparato', 'gemini-3.10-flash'], [e.esito, e.modello]);

googleCon({ list: async () => { throw ERR.rete(); } });
e = await S.aggiornaModelloAutomatico(CHIAVE, 'gemini-3.6-flash');
dice('niente rete: nonRaggiungibile, e il modello NON cambia', ['nonRaggiungibile', 'gemini-3.6-flash', false], [e.esito, e.modello, e.cambiato]);

googleCon({ modelli: [] });
e = await S.aggiornaModelloAutomatico(CHIAVE, 'gemini-3.6-flash');
dice('elenco vuoto: nonRaggiungibile', 'nonRaggiungibile', e.esito);

googleCon({ modelli: [M('gemini-3.10-flash')], generate: async () => { throw ERR.fretta(); } });
e = await S.aggiornaModelloAutomatico(CHIAVE, 'gemini-3.6-flash');
dice('"troppe richieste" durante la prova: occupato, NON scartato', ['occupato', 'gemini-3.6-flash'], [e.esito, e.modello]);

googleCon({ modelli: [M('gemini-3.10-flash')], generate: async () => { throw ERR.rete(); } });
e = await S.aggiornaModelloAutomatico(CHIAVE, 'gemini-3.6-flash');
dice('rete caduta durante la prova: nonRaggiungibile', 'nonRaggiungibile', e.esito);

googleCon({ modelli: [M('gemini-3.10-flash'), M('gemini-3.9-flash')], generate: async () => { throw ERR.chiuso(); } });
e = await S.aggiornaModelloAutomatico(CHIAVE, 'gemini-3.6-flash');
dice('Google risponde ma nessuno passa la prova: nessunoValido', ['nessunoValido', 'gemini-3.6-flash'], [e.esito, e.modello]);
dice('...e l\'elenco trovato viene comunque restituito', 2, e.disponibili.length);

g = googleCon({ modelli: [M('gemini-3.10-flash')] });
e = await S.aggiornaModelloAutomatico('', 'gemini-3.6-flash');
dice('senza chiave non si chiama nemmeno Google', [[], 'nonRaggiungibile'], [g.chiamate, e.esito]);

// =============================================================================
console.log('\n--- il modello salvato non viene piu buttato via ---');
dice('un modello scoperto da Google si tiene', 'gemini-9.9-flash', S.normalizeModelId('gemini-9.9-flash'));
dice('storto -> riserva', S.DEFAULT_GEMINI_MODEL, S.normalizeModelId('../etc/passwd'));
dice('un flash sconosciuto e gratuito-con-limiti, non a pagamento', 'limited', S.getModelTier('gemini-9.9-flash'));

console.log(`\n${guai === 0 ? 'TUTTO A POSTO' : 'PROBLEMI: ' + guai} (${fatti} controlli)`);
process.exit(guai === 0 ? 0 : 1);
