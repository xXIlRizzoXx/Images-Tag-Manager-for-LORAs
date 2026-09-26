/* ITALIANO: PROVA DEI TAG CHE ARRIVANO DALL'AI
   Un tag e' quello che sta tra due virgole nel file .txt. Se l'AI restituisce un elemento come
   "red hair, blue eyes", l'app mostrava UNA pillola ma scriveva DUE tag nel .txt, e la
   deduplica non vedeva il doppione "blue eyes". Qui si controlla che i tag dell'AI vengano
   spezzati su virgola e a capo come fanno incolla, importazione ed editor.
   Gira SENZA rete e SENZA chiave: si prova il codice VERO di src/services/geminiService.ts,
   compilato con esbuild; la libreria di Google e' sostituita da un finto che restituisce
   la risposta decisa da ogni prova.
   Uso:  node scripts/test-ai-tags.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE TAGS COMING FROM THE AI
   A tag is what sits between two commas in the .txt file. If the AI returned an element such
   as "red hair, blue eyes", the app showed ONE pill but wrote TWO tags into the .txt, and the
   dedupe could not see the duplicate "blue eyes". This checks that AI tags are split on comma
   and newline like paste, import and the editor do.
   Runs WITHOUT network and WITHOUT a key: the REAL code of src/services/geminiService.ts is
   tested, compiled with esbuild; Google's library is replaced by a fake that returns the
   answer each test decides.
   Usage:  node scripts/test-ai-tags.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ITALIANO: la risposta non-JSON e' ATTESA in una prova: il suo avviso si mette da parte.
// ENGLISH: the non-JSON answer is EXPECTED in one test: its message is set aside.
console.error = () => {};

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
                        return { generateContent: async () => ({ text: globalThis.__RISPOSTA__ }) };
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

// ITALIANO: Node ha File ma non FileReader: basta un finto che dia un data URL qualunque.
// ENGLISH: Node has File but no FileReader: a fake returning any data URL is enough.
globalThis.FileReader = class {
    readAsDataURL() {
        this.result = 'data:image/png;base64,AAAA';
        queueMicrotask(() => this.onloadend && this.onloadend());
    }
};

let guai = 0, fatti = 0;
const dice = (cosa, atteso, avuto) => {
    fatti++;
    const ok = JSON.stringify(atteso) === JSON.stringify(avuto);
    if (!ok) guai++;
    console.log('  ' + (ok ? 'OK  ' : 'NO  ') + cosa + (ok ? '' : `\n        atteso: ${JSON.stringify(atteso)}\n        avuto:  ${JSON.stringify(avuto)}`));
};

const foto = new File([new Uint8Array([1, 2, 3])], 'foto.png', { type: 'image/png' });
const tagDa = async (risposta, maxTags = 30) => {
    globalThis.__RISPOSTA__ = risposta;
    return S.getGeminiTags(foto, { apiKey: 'AIza' + 'x'.repeat(35), modelName: 'gemini-3.6-flash', maxTags });
};
const A_CAPO = String.fromCharCode(10);
const RITORNO = String.fromCharCode(13);

// =============================================================================
console.log('\n--- un elemento con dentro piu tag si spezza come nel .txt ---');
dice('virgola dentro un elemento, e il doppione nascosto si vede',
    ['red hair', 'blue eyes', 'close-up', 'portrait'],
    await tagDa('["red hair, blue eyes", "blue eyes", "close-up, portrait"]'));
dice('a capo dentro un elemento (anche \\r\\n)',
    ['smile', 'teeth', 'blue sky', 'white clouds'],
    await tagDa(JSON.stringify(['smile' + A_CAPO + 'teeth', 'blue sky' + RITORNO + A_CAPO + 'white clouds'])));
dice('il limite di tag conta i tag veri, non gli elementi', ['a', 'b'], await tagDa('["a, b, c"]', 2));
dice('i pezzi vuoti spariscono', ['ok'], await tagDa('[", ,", "ok", ","]'));

console.log('\n--- quello che funzionava resta uguale ---');
dice('minuscole, spazi tolti, doppioni tolti', ['red hair'], await tagDa('["Red Hair", " red hair "]'));
dice('ogni tag resta sotto i 60 caratteri', ['x'.repeat(60)], await tagDa(JSON.stringify(['x'.repeat(80)])));
dice('elementi che non sono testo vengono ignorati', ['cat'], await tagDa('[42, null, "cat"]'));
dice('una risposta che non e un elenco da nessun tag', [], await tagDa('{"tags": "cat"}'));
dice('una risposta che non e JSON da nessun tag', [], await tagDa('cat, dog'));

console.log(`\n${guai === 0 ? 'TUTTO A POSTO' : 'PROBLEMI: ' + guai} (${fatti} controlli)`);
process.exit(guai === 0 ? 0 : 1);
