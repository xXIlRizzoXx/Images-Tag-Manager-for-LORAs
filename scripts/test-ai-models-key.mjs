/* ITALIANO: PROVA DI "PROVA TUTTI I MODELLI" (tutti i modelli della chiave, provati uno per uno)
   Gira SENZA rete e SENZA chiave: al posto di Google c'e' un finto. Si prova il codice VERO di
   src/services/geminiService.ts compilato al volo con esbuild, e in src/App.tsx si controlla
   che la tendina non lasci scegliere i modelli senza accesso o non adatti, e che spegnere l'AI
   fermi la prova.
   Uso:  node scripts/test-ai-models-key.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF "TEST ALL MODELS" (all the key's models, probed one by one)
   Runs WITHOUT network and WITHOUT a key: Google is replaced by a fake. The REAL code of
   src/services/geminiService.ts is tested, compiled on the fly with esbuild, and in src/App.tsx
   it checks that the dropdown does not let you pick models with no access or not suitable, and
   that switching the AI off stops the test.
   Usage:  node scripts/test-ai-models-key.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
console.warn = () => {};

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
                            list: async (p) => { g.chiamate.push('list'); return g.list(p); },
                            generateContent: async (p) => { g.chiamate.push(p.model); return g.generate(p); },
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
const S = await import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));

let guai = 0, fatti = 0;
const dice = (nome, atteso, avuto) => {
    fatti++;
    const ok = JSON.stringify(atteso) === JSON.stringify(avuto);
    if (!ok) guai++;
    console.log(`${ok ? 'OK ' : 'NO '} ${nome}${ok ? '' : `\n     atteso: ${JSON.stringify(atteso)}\n     avuto:  ${JSON.stringify(avuto)}`}`);
};

class ApiError extends Error { constructor(m, s) { super(m); this.status = s; } }
const api = (stato, corpo) => new ApiError(JSON.stringify({ error: corpo }), stato);
const ERR = {
    senzaGratuito: () => api(429, { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'You exceeded your current quota, please check your plan and billing details.\n* Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 0, model: gemini-3.1-pro' }),
    fretta: () => api(429, { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'You exceeded your current quota, please check your plan and billing details.\n* Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 10, model: gemini-3.8-flash' }),
    nonTrovato: () => api(404, { code: 404, status: 'NOT_FOUND', message: 'models/gemini-x is not found for API version v1beta, or is not supported for generateContent.' }),
    argomento: () => api(400, { code: 400, status: 'INVALID_ARGUMENT', message: 'JSON mode is not enabled for this model.' }),
    fatturazione: () => api(400, { code: 400, status: 'FAILED_PRECONDITION', message: 'Gemini API free tier is not available in your country. Please enable billing on your project.' }),
    chiave: () => api(400, { code: 400, status: 'INVALID_ARGUMENT', message: 'API key not valid. Please pass a valid API key.', details: [{ reason: 'API_KEY_INVALID' }] }),
    servizioSpento: () => api(403, { code: 403, status: 'PERMISSION_DENIED', message: 'Generative Language API has not been used in project 1234 before or it is disabled.', details: [{ reason: 'SERVICE_DISABLED' }] }),
    sovraccarico: () => api(503, { code: 503, status: 'UNAVAILABLE', message: 'The model is overloaded. Please try again later.' }),
    rete: () => new Error('fetch failed: ECONNRESET'),
};
const M = (nome, azioni = ['generateContent']) => ({ name: 'models/' + nome, displayName: nome, supportedActions: azioni });
const pagine = (voci) => ({ async *[Symbol.asyncIterator]() { for (const v of voci) yield v; } });
const google = ({ modelli = [], list, generate }) => {
    globalThis.__GOOGLE__ = { chiamate: [], list: list || (async () => pagine(modelli)), generate: generate || (async () => ({ text: '["ok"]' })) };
    return globalThis.__GOOGLE__;
};
const CHIAVE = 'AIzaFINTA-0123456789-abcdefghij';

// =============================================================================
console.log('\n--- l\'elenco: tutti i modelli che possono leggere una foto, non solo i flash ---');
{
    const grezzi = ['gemini-3.8-flash', 'gemini-3.1-pro', 'gemini-3-flash-preview', 'gemini-3.5-flash-lite', 'gemini-3.8-flash-tts',
        'gemini-3.1-flash-image', 'gemini-embedding-001', 'gemini-3.8-live', 'imagen-4.0', 'gemma-3-27b-it', 'gemini-3.8-flash'].map(n => M(n));
    grezzi.push(M('gemini-solo-conteggio', ['countTokens']));
    const ids = S.scegliModelliChiave(grezzi).map(m => m.id);
    dice('restano pro, preview e lite, non solo i flash', true, ['gemini-3.1-pro', 'gemini-3-flash-preview', 'gemini-3.5-flash-lite'].every(id => ids.includes(id)));
    dice('fuori voce, immagini, embedding, live, imagen, gemma, e chi non genera contenuti', [],
        ids.filter(id => /tts|image|embedding|live|imagen|gemma|conteggio/.test(id)));
    dice('niente doppioni', ids.length, new Set(ids).size);
    dice('in ordine di versione, la piu recente prima', 'gemini-3.8-flash', ids[0]);
}

console.log('\n--- da ogni errore della prova, lo stato giusto del modello ---');
dice('limite 0 del piano gratuito = a pagamento', { stato: 'aPagamento' }, S.statoDaErrore(ERR.senzaGratuito()));
dice('troppe richieste = da riprovare, non scartato', { stato: 'occupato' }, S.statoDaErrore(ERR.fretta()));
dice('Google sovraccarico = da riprovare', { stato: 'occupato' }, S.statoDaErrore(ERR.sovraccarico()));
dice('modello non trovato = senza accesso', { stato: 'senzaAccesso' }, S.statoDaErrore(ERR.nonTrovato()));
dice('400 INVALID_ARGUMENT (niente JSON o niente immagini) = non adatto', { stato: 'nonAdatto' }, S.statoDaErrore(ERR.argomento()));
dice('fatturazione richiesta = a pagamento', { stato: 'aPagamento' }, S.statoDaErrore(ERR.fatturazione()));
dice('chiave rifiutata = si ferma TUTTO', { ferma: 'chiaveNonValida' }, S.statoDaErrore(ERR.chiave()));
dice('API spenta sul progetto = si ferma TUTTO', { ferma: 'progettoRifiutato' }, S.statoDaErrore(ERR.servizioSpento()));
dice('rete assente = si ferma TUTTO', { ferma: 'nonRaggiungibile' }, S.statoDaErrore(ERR.rete()));

// =============================================================================
console.log('\n--- il giro completo ---');
{
    const g = google({
        modelli: ['gemini-3.8-flash', 'gemini-3.1-pro', 'gemini-3-flash-preview', 'gemini-2.0-flash-001', 'gemini-3.5-flash-lite'].map(n => M(n)),
        generate: async (p) => {
            if (p.model === 'gemini-3.1-pro') throw ERR.senzaGratuito();
            if (p.model === 'gemini-3-flash-preview') throw ERR.nonTrovato();
            if (p.model === 'gemini-2.0-flash-001') throw ERR.argomento();
            if (p.model === 'gemini-3.5-flash-lite') throw ERR.fretta();
            return { text: '["ok"]' };
        },
    });
    const passi = [];
    const r = await S.provaTuttiIModelli(CHIAVE, (_m, n) => passi.push(n), undefined, 0);
    const stati = Object.fromEntries(r.modelli.map(m => [m.id, m.stato]));
    dice('esito: fatto', 'fatto', r.esito);
    dice('ogni modello col suo stato', {
        'gemini-3.8-flash': 'utilizzabile', 'gemini-3.5-flash-lite': 'occupato', 'gemini-3.1-pro': 'aPagamento',
        'gemini-3-flash-preview': 'senzaAccesso', 'gemini-2.0-flash-001': 'nonAdatto',
    }, stati);
    dice('l\'avanzamento arriva prima di ogni prova e dopo ognuna', [0, 1, 2, 3, 4, 5], passi);
    dice('una sola richiesta di elenco e una prova per modello', 6, g.chiamate.length);
}
{
    const g = google({ modelli: ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash'].map(n => M(n)),
        generate: async (p) => { if (p.model === 'gemini-3.7-flash') throw ERR.chiave(); return { text: '["ok"]' }; } });
    const r = await S.provaTuttiIModelli(CHIAVE, undefined, undefined, 0);
    dice('chiave rifiutata a meta: si ferma e lo dice', 'chiaveNonValida', r.esito);
    dice('...e non prova i modelli dopo (non sarebbe colpa loro)', ['list', 'gemini-3.8-flash', 'gemini-3.7-flash'], g.chiamate);
    dice('...e il primo resta segnato utilizzabile', 'utilizzabile', r.modelli[0].stato);
}
{
    google({ list: async () => { throw ERR.rete(); } });
    dice('elenco senza rete: non raggiungibile', 'nonRaggiungibile', (await S.provaTuttiIModelli(CHIAVE, undefined, undefined, 0)).esito);
    google({ list: async () => { throw ERR.fretta(); } });
    dice('elenco con troppe richieste: occupato, non "non raggiungibile"', 'occupato', (await S.provaTuttiIModelli(CHIAVE, undefined, undefined, 0)).esito);
    google({ list: async () => { throw ERR.servizioSpento(); } });
    dice('elenco con API spenta: progetto rifiutato', 'progettoRifiutato', (await S.provaTuttiIModelli(CHIAVE, undefined, undefined, 0)).esito);
    google({ modelli: [M('gemini-3.8-flash-tts'), M('imagen-4.0')] });
    dice('nessun modello adatto: lo dice', 'nessunModello', (await S.provaTuttiIModelli(CHIAVE, undefined, undefined, 0)).esito);
    const g = google({ modelli: [M('gemini-3.8-flash')] });
    dice('senza chiave: nessuna chiamata a Google', ['nonRaggiungibile', 0], [(await S.provaTuttiIModelli('', undefined, undefined, 0)).esito, g.chiamate.length]);
}
{
    // ITALIANO: fermata a meta: dopo la seconda prova l'utente preme "Ferma la prova".
    // ENGLISH: stopped halfway: after the second probe the user presses "Stop the test".
    const ctrl = new AbortController();
    const g = google({ modelli: ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash'].map(n => M(n)) });
    const r = await S.provaTuttiIModelli(CHIAVE, (_m, n) => { if (n === 2) ctrl.abort(); }, ctrl.signal, 0);
    dice('fermata: esito fermato', 'fermato', r.esito);
    dice('...i due provati restano, gli altri senza stato', ['utilizzabile', 'utilizzabile', undefined, undefined], r.modelli.map(m => m.stato));
    dice('...e non parte nessuna prova in piu', 3, g.chiamate.length);
}
{
    // ITALIANO: la pausa fra le prove si interrompe subito alla fermata (niente attesa inutile).
    // ENGLISH: the pause between probes ends at once on stop (no pointless wait).
    const ctrl = new AbortController();
    google({ modelli: ['gemini-3.8-flash', 'gemini-3.7-flash'].map(n => M(n)) });
    const inizio = Date.now();
    const p = S.provaTuttiIModelli(CHIAVE, (_m, n) => { if (n === 1) setTimeout(() => ctrl.abort(), 20); }, ctrl.signal, 60_000);
    const r = await p;
    dice('la pausa di 60 s si interrompe alla fermata', ['fermato', true], [r.esito, Date.now() - inizio < 5000]);
}

// =============================================================================
console.log('\n--- in App.tsx ---');
{
    const app = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
    const gruppi = /const GRUPPI_MODELLI[\s\S]*?\];/.exec(app)?.[0] || '';
    const spenti = [...gruppi.matchAll(/stato: '(\w+)'[^}]*spento: (true|false)/g)].filter(x => x[2] === 'true').map(x => x[1]);
    dice('nella tendina non si scelgono i modelli senza accesso o non adatti', ['senzaAccesso', 'nonAdatto'], spenti);
    dice('...a meno che non sia il modello in uso', true, /disabled=\{g\.spento && m\.id !== aiModel\}/.test(app));
    dice('spegnere l\'AI ferma la prova in corso', true, /useEffect\(\(\) => \{ if \(!aiEnabled\) provaModelliRef\.current\?\.abort\(\); \}, \[aiEnabled\]\)/.test(app));
    dice('la prova parte solo con l\'AI accesa e la chiave salvata', true, /if \(!aiEnabledRef\.current \|\| !geminiApiKey \|\| !improntaChiave\) return;/.test(app));
    dice('l\'esito salvato vale solo per la stessa chiave (impronta)', true, /modelliChiave\.impronta === improntaChiave/.test(app));
    dice('la chiave non si salva: solo 8 byte del suo SHA-256', true, /digest\('SHA-256'[\s\S]{0,200}\.slice\(0, 8\)/.test(app) && !/aiModelliChiave[^\n]*geminiApiKey/.test(app));
}

console.log(`\n${guai === 0 ? 'TUTTO A POSTO' : 'PROBLEMI: ' + guai} (${fatti} controlli)`);
process.exit(guai === 0 ? 0 : 1);
