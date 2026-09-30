/* ITALIANO: PROVA DEL MODELLO AI SCELTO A MANO MENTRE IL CONTROLLO DEI MODELLI E' IN CORSO
   Il controllo dei modelli (quello del giorno all'avvio, "Controlla ora", o la riparazione dopo
   "modello non disponibile") dura qualche secondo: elenco da Google e fino a tre prove. Se nel
   frattempo si sceglieva un modello preciso nella tendina, a controllo finito la scelta veniva
   sostituita dal modello trovato, il blocco tolto, e compariva "Modello AI aggiornato. Prima: ..."
   col modello di prima della scelta. La spiegazione promette "scegliendo un modello preciso,
   resta fisso quello". La regola: una scelta fatta a mano durante il controllo resta, e il
   risultato del controllo si mette da parte (l'elenco della tendina si aggiorna comunque).
   Si eseguono i testi VERI di controllaModello, della tendina e dell'effetto che salva il blocco,
   presi da src/App.tsx, con il servizio vero di src/services/geminiService.ts e un Google finto
   che tiene aperta la prova finche' la scelta non e' fatta (nessuna rete, nessuna chiave).
   Uso:  node scripts/test-model-pick-during-check.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE AI MODEL PICKED BY HAND WHILE THE MODEL CHECK IS RUNNING
   The model check (the daily one at startup, "Check now", or the repair after "model
   unavailable") lasts a few seconds: the list from Google and up to three probes. If a specific
   model was picked in the dropdown meanwhile, once the check ended the choice was replaced by the
   model it found, the lock dropped, and "AI model updated. Before: ..." appeared naming the model
   from before the pick. The hint promises "pick a specific model and that one stays fixed". The
   rule: a choice made by hand during the check stands, and the check's result is set aside (the
   dropdown list is refreshed anyway).
   The REAL text of controllaModello, of the dropdown and of the effect saving the lock, taken from
   src/App.tsx, is run with the real service of src/services/geminiService.ts and a fake Google
   that holds the probe open until the pick is made (no network, no key).
   Usage:  node scripts/test-model-pick-during-check.mjs      (exits with code 1 if anything is off) */

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

// ITALIANO: i tre pezzi veri di src/App.tsx, trovati dal loro testo.
// ENGLISH: the three real pieces of src/App.tsx, found by their text.
const app = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const esci = (cosa) => { console.log('NO  non trovato in src/App.tsx: ' + cosa); process.exit(1); };
const i0 = app.indexOf('    const controllaModello = async (');
const fineControlla = /\r?\n    \};\r?\n/g;
fineControlla.lastIndex = Math.max(i0, 0);
const f0 = i0 < 0 ? null : fineControlla.exec(app);
if (!f0) esci('controllaModello');
const testoControlla = app.slice(i0, f0.index + f0[0].length);
const iAuto = app.indexOf("if (scelto === '__auto__')");
const j0 = app.lastIndexOf('onChange={(e) => {', iAuto);
const j1 = app.indexOf('setAiModelloFissato(true);', iAuto);
const jFine = app.indexOf('}}', j1);
if (iAuto < 0 || j0 < 0 || j1 < 0 || jFine < 0) esci('la tendina del modello');
const testoTendina = app.slice(j0 + 'onChange={'.length, jFine + 1);
const k = app.indexOf("localStorage.setItem('aiModelloFissato'");
const k0 = app.lastIndexOf('    useEffect(() => {', k);
const k1 = app.indexOf('    }, [aiModelloFissato]);', k);
if (k < 0 || k0 < 0 || k1 < 0) esci('l\'effetto che salva il blocco');
const testoEffetto = app.slice(k0 + '    useEffect('.length, k1 + '    }'.length);

const modulo = `
export const render = (env: any, snap: { aiModel: string; aiModelloFissato: boolean }) => {
    const { t, geminiApiKey, controlloModelloRef, sceltaManualeRef, aiModelloFissatoRef, setControlloModelloInCorso,
            setModelloControllatoIl, setModelliDisponibili, showNotification, setAiModel, setAiModelloFissato,
            elencaModelliRemoti, aggiornaModelloAutomatico, localStorage } = env;
    const aiModel = snap.aiModel;
    const aiModelloFissato = snap.aiModelloFissato;
${testoControlla}
    const onChange = ${testoTendina};
    const effettoFissato = ${testoEffetto};
    return { controllaModello, onChange, effettoFissato };
};`;
const js = (await esbuild.transform(modulo, { loader: 'ts' })).code;
const { render } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));

const M = (nome) => ({ name: 'models/' + nome, displayName: nome, supportedActions: ['generateContent'] });
const pagine = (voci) => ({ async *[Symbol.asyncIterator]() { for (const v of voci) yield v; } });
const attendi = (cond) => new Promise(ok => { const g = () => (cond() ? ok() : setTimeout(g, 2)); g(); });

// ITALIANO: l'app finta. Google elenca 3.7, 3.6 e 3.5 flash; la prova resta aperta finche' la
//           prova stessa non chiama sblocca(). Il setter del blocco fa girare l'effetto vero che
//           lo salva, come fa React dopo il render.
// ENGLISH: the fake app. Google lists 3.7, 3.6 and 3.5 flash; the probe stays open until the test
//          calls sblocca(). The lock setter runs the real effect that saves it, as React does after
//          the render.
const scenario = (iniziale) => {
    const stato = { ...iniziale, inCorso: false };
    const notifiche = [];
    const salvato = new Map();
    let sblocca = null;
    let provaPartita;
    const provaInCorso = new Promise(ok => { provaPartita = ok; });
    globalThis.__GOOGLE__ = {
        list: async () => pagine([M('gemini-3.7-flash'), M('gemini-3.6-flash'), M('gemini-3.5-flash')]),
        generate: async () => { provaPartita(); await new Promise(ok => { sblocca = ok; }); return { text: '["ok"]' }; },
    };
    const env = {
        t, geminiApiKey: 'AIza' + 'x'.repeat(35),
        controlloModelloRef: { current: false }, sceltaManualeRef: { current: 0 }, aiModelloFissatoRef: { current: iniziale.aiModelloFissato },
        setControlloModelloInCorso: (v) => { stato.inCorso = v; },
        setModelloControllatoIl: () => { }, setModelliDisponibili: () => { },
        showNotification: (m, tipo) => notifiche.push([m, tipo]),
        setAiModel: (v) => { stato.aiModel = v; },
        setAiModelloFissato: (v) => { stato.aiModelloFissato = v; disegna().effettoFissato(); },
        elencaModelliRemoti: S.elencaModelliRemoti, aggiornaModelloAutomatico: S.aggiornaModelloAutomatico,
        localStorage: { getItem: (k) => (salvato.has(k) ? salvato.get(k) : null), setItem: (k, v) => salvato.set(k, String(v)) },
    };
    const disegna = () => render(env, { aiModel: stato.aiModel, aiModelloFissato: stato.aiModelloFissato });
    const finito = () => attendi(() => env.controlloModelloRef.current === false && stato.inCorso === false);
    return { stato, notifiche, disegna, provaInCorso, sblocca: () => sblocca(), finito, salvato };
};
const scegli = (s, valore) => s.disegna().onChange({ target: { value: valore } });
const quadro = (s) => [s.stato.aiModel, s.stato.aiModelloFissato];

console.log('\n--- controllo all\'avvio in corso, si sceglie un modello a mano ---');
{
    const s = scenario({ aiModel: 'gemini-3.6-flash', aiModelloFissato: false });
    s.disegna().controllaModello(false, false);
    await s.provaInCorso;
    scegli(s, 'gemini-3.6-flash');
    s.sblocca(); await s.finito();
    dice('la scelta a mano resta, bloccata', ['gemini-3.6-flash', true], quadro(s));
    dice('nessun "Modello AI aggiornato"', [], s.notifiche);
    dice('il blocco salvato resta quello scelto', 'true', s.salvato.get('aiModelloFissato'));
}

console.log('\n--- si passa ad Automatico (parte il controllo), poi si cambia idea e si sceglie un modello ---');
{
    const s = scenario({ aiModel: 'gemini-3.5-flash', aiModelloFissato: true });
    scegli(s, '__auto__');
    await s.provaInCorso;
    scegli(s, 'gemini-3.6-flash');
    s.sblocca(); await s.finito();
    dice('la scelta a mano resta, bloccata', ['gemini-3.6-flash', true], quadro(s));
    dice('nessun "Modello AI aggiornato. Prima: gemini-3.5-flash"', [], s.notifiche);
}

console.log('\n--- riparazione dopo "modello non disponibile", si sceglie un altro modello a mano ---');
{
    const s = scenario({ aiModel: 'gemini-3.5-flash', aiModelloFissato: true });
    s.disegna().controllaModello(true, true);
    await s.provaInCorso;
    scegli(s, 'gemini-3.6-flash');
    s.sblocca(); await s.finito();
    dice('la scelta a mano resta, bloccata', ['gemini-3.6-flash', true], quadro(s));
    dice('nessun "Modello AI sostituito"', [], s.notifiche);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const s = scenario({ aiModel: 'gemini-3.6-flash', aiModelloFissato: false });
    s.disegna().controllaModello(false, false);
    await s.provaInCorso;
    s.sblocca(); await s.finito();
    dice('Automatico, nessuno tocca niente: si passa al piu\' recente e lo si dice',
        [['gemini-3.7-flash', false], [[t.aiModelSwitched.replace('{da}', 'gemini-3.6-flash').replace('{a}', 'gemini-3.7-flash'), 'info']]], [quadro(s), s.notifiche]);

    const r = scenario({ aiModel: 'gemini-3.5-flash', aiModelloFissato: true });
    r.disegna().controllaModello(true, true);
    await r.provaInCorso;
    r.sblocca(); await r.finito();
    dice('riparazione senza scelte a mano: il modello morto si sostituisce e il blocco cade', ['gemini-3.7-flash', false], quadro(r));

    const a = scenario({ aiModel: 'gemini-3.6-flash', aiModelloFissato: false });
    a.disegna().controllaModello(false, false);
    await a.provaInCorso;
    scegli(a, 'gemini-3.5-flash');
    scegli(a, '__auto__');
    a.sblocca(); await a.finito();
    dice('scelto un modello e poi di nuovo Automatico durante il controllo: vale Automatico', ['gemini-3.7-flash', false], quadro(a));

    const d = scenario({ aiModel: 'gemini-3.6-flash', aiModelloFissato: false });
    d.disegna().controllaModello(false, false);
    await d.provaInCorso;
    d.sblocca(); await d.finito();
    scegli(d, 'gemini-3.6-flash');
    dice('scelta fatta DOPO il controllo: resta, bloccata', ['gemini-3.6-flash', true], quadro(d));
}

process.exit(esito());
