/* ITALIANO: PROVA DELLE ULTIME TRE VERSIONI E DEL TEMPO SCADUTO NELLA PROVA DEI MODELLI
   1. La tendina e la prova tengono solo i modelli delle ultime tre versioni di Gemini (contando
      anche le minori: 4, 3.8, 3.7), senza gli alias senza numero; anche l'esito gia' salvato.
   2. Il tetto di modelli si applica dopo l'ordine per versione, non nell'ordine di Google.
   3. Un modello che non risponde in tempo e' "da riprovare" e il giro continua: prima un solo
      tempo scaduto diventava "Google non raggiungibile" e fermava tutto (visto sul programma
      vero, con la prova ferma al terzo modello di 21).
   Gira SENZA rete: al posto di Google c'e' un finto, il codice e' quello vero compilato con esbuild.
   Uso:  node scripts/test-ai-models-generations.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE LATEST THREE VERSIONS AND OF THE TIMEOUT IN THE MODEL PROBE
   1. The dropdown and the probe keep only the models of the latest three Gemini versions (minor
      ones included: 4, 3.8, 3.7), without number-less aliases; the saved outcome too.
   2. The model cap applies after sorting by version, not in Google's order.
   3. A model that does not answer in time is "try again" and the round goes on: before, a single
      timeout became "Google unreachable" and stopped everything (seen on the real app, with the
      probe stuck at the third model of 21).
   Runs WITHOUT network: Google is a fake, the code is the real one compiled with esbuild.
   Usage:  node scripts/test-ai-models-generations.mjs      (exits with code 1 if anything is off) */

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
const M = (nome) => ({ name: 'models/' + nome, displayName: nome, supportedActions: ['generateContent'] });
const pagine = (voci) => ({ async *[Symbol.asyncIterator]() { for (const v of voci) yield v; } });
const google = ({ modelli = [], generate }) => {
    globalThis.__GOOGLE__ = { chiamate: [], list: async () => pagine(modelli), generate: generate || (async () => ({ text: '["ok"]' })) };
    return globalThis.__GOOGLE__;
};
const CHIAVE = 'AIzaFINTA-0123456789-abcdefghij';

// ITALIANO: l'elenco che la chiave vera vedeva il 15/10/2026 (nomi in forma di id).
// ENGLISH: the list the real key saw on 15/10/2026 (names as ids).
const VERI = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro', 'gemini-3-flash-preview',
    'gemini-3.1-flash-lite', 'gemini-3.1-pro-preview', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.6-flash',
    'gemini-3.7-flash', 'gemini-3.8-flash', 'gemini-4-argon', 'gemini-omni-flash-preview', 'gemini-pro-latest'];

console.log('\n--- ultime tre versioni ---');
{
    const ids = S.scegliModelliChiave(VERI.map(M)).map(m => m.id);
    dice('restano solo 4, 3.8 e 3.7, la piu recente prima', ['gemini-4-argon', 'gemini-3.8-flash', 'gemini-3.7-flash'], ids);
    const conVarianti = S.scegliModelliChiave(['gemini-3.8-flash', 'gemini-3.8-flash-lite', 'gemini-3.8-pro', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash'].map(M)).map(m => m.id);
    dice('una versione tiene tutte le sue varianti (flash, lite, pro)', ['gemini-3.8-flash', 'gemini-3.8-flash-lite', 'gemini-3.8-pro', 'gemini-3.7-flash', 'gemini-3.6-flash'], conVarianti);
    dice('gli alias senza numero escono', [], S.ultimeGenerazioni([{ id: 'gemini-flash-latest', versione: [] }]));
    // ITALIANO: il filtro conserva l'ordine d'ingresso (ordina chi lo chiama): conta CHI resta.
    // ENGLISH: the filter keeps the input order (the caller sorts): what counts is WHO stays.
    dice('"3" e "3.8" sono versioni diverse, "3" viene dopo "3.1" e il 2.5 esce', ['3', '3.1', '3.8'],
        S.ultimeGenerazioni([[3], [3, 1], [3, 8], [2, 5]].map(v => ({ versione: v }))).map(m => m.versione.join('.')));
    dice('con meno di tre versioni restano tutte', 2, S.ultimeGenerazioni([{ versione: [3, 8] }, { versione: [3, 7] }]).length);
    dice('un esito salvato senza "versione" non manda in errore', [], S.ultimeGenerazioni([{ id: 'x' }]));
    dice('le versioni tenute sono tre', 3, S.GENERAZIONI_TENUTE);
}

console.log('\n--- il tetto dopo l\'ordine ---');
{
    // ITALIANO: 70 modelli vecchi PRIMA dei nuovi nell'ordine di Google: i nuovi devono restare.
    // ENGLISH: 70 old models BEFORE the new ones in Google's order: the new ones must stay.
    const vecchi = Array.from({ length: 70 }, (_, i) => `gemini-1.${i}-flash`);
    const ids = S.scegliModelliChiave([...vecchi, 'gemini-3.8-flash', 'gemini-3.7-flash'].map(M)).map(m => m.id);
    dice('i modelli piu recenti non vengono tagliati via dal tetto', true, ids.includes('gemini-3.8-flash') && ids.includes('gemini-3.7-flash'));
}

// ITALIANO: in Node il timer di AbortSignal.timeout non tiene vivo il processo (nell'app si'):
//           senza questo intervallo il test usciva prima che il tempo scadesse.
// ENGLISH: in Node the AbortSignal.timeout timer does not keep the process alive (in the app it
//          does): without this interval the test exited before the time ran out.
const tieniVivo = setInterval(() => {}, 1000);
console.log('\n--- tempo scaduto su un modello ---');
{
    const g = google({
        modelli: ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash'].map(M),
        generate: (p) => p.model !== 'gemini-3.8-flash' ? Promise.resolve({ text: '["ok"]' })
            : new Promise((_, no) => p.config.abortSignal.addEventListener('abort', () => no(Object.assign(new Error('This operation was aborted'), { name: 'AbortError' })), { once: true })),
    });
    const r = await S.provaTuttiIModelli(CHIAVE, undefined, undefined, 0, 50);
    dice('il giro arriva in fondo', 'fatto', r.esito);
    dice('il modello lento e\' "da riprovare", gli altri provati', ['occupato', 'utilizzabile', 'utilizzabile'], r.modelli.map(m => m.stato));
    dice('tutti e tre provati', ['list', 'gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash'], g.chiamate);
}
{
    // ITALIANO: la fermata dell'utente resta una fermata, non un tempo scaduto.
    // ENGLISH: the user's stop stays a stop, not a timeout.
    const ctrl = new AbortController();
    google({
        modelli: ['gemini-3.8-flash', 'gemini-3.7-flash'].map(M),
        generate: (p) => new Promise((_, no) => { p.config.abortSignal.addEventListener('abort', () => no(new Error('aborted')), { once: true }); setTimeout(() => ctrl.abort(), 10); }),
    });
    const r = await S.provaTuttiIModelli(CHIAVE, undefined, ctrl.signal, 0, 5000);
    dice('fermata dall\'utente: esito fermato, il modello resta senza stato', ['fermato', undefined], [r.esito, r.modelli[0].stato]);
}
clearInterval(tieniVivo);
{
    const sorgente = fs.readFileSync(path.join(radice, 'src/services/geminiService.ts'), 'utf8');
    dice('una prova ha almeno 60 secondi (i modelli recenti ragionano a lungo)', true, Number((/const PROVA_TIMEOUT_MS = ([\d_]+);/.exec(sorgente)?.[1] || '0').replace(/_/g, '')) >= 60000);
}

console.log('\n--- in App.tsx ---');
{
    const app = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
    dice('anche l\'esito gia\' salvato mostra solo le ultime tre versioni', true, /\? ultimeGenerazioni\(modelliChiave\.modelli\) : null;/.test(app));
}

console.log(`\n${guai === 0 ? 'TUTTO A POSTO' : 'PROBLEMI: ' + guai} (${fatti} controlli)`);
process.exit(guai === 0 ? 0 : 1);
