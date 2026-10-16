/* ITALIANO: PROVA: TOGLIERE LA CHIAVE API FERMA "PROVA I MODELLI RECENTI" E IL CONTROLLO DEL MODELLO
   "Togli la chiave" fermava solo la taggatura in blocco. Una "Prova i modelli recenti" in corso
   (decine di modelli, una pausa fra l'uno e l'altro) continuava a chiamare Google con la chiave
   appena rimossa, salvava il risultato e alla fine diceva "Test finished" dopo "API Key removed".
   Un controllo del modello in corso faceva lo stesso, e poteva perfino cambiare modello e dire
   "AI model updated". Chi toglie la chiave (magari perche' e' trapelata) si aspetta che il
   programma smetta subito di usarla. La regola: dopo la rimozione nessuna chiamata nuova a Google,
   nessun salvataggio della prova, nessun cambio di modello e nessun avviso oltre a quello della
   rimozione. Una chiamata gia' in volo non si conta (e' partita con la chiave ancora valida).
   Casi vicini che non devono cambiare: la prova e il controllo senza rimozione finiscono come prima.
   Si eseguono i testi VERI di handleClearApiKey, provaModelliChiave e controllaModello presi da
   src/App.tsx, con il servizio vero di src/services/geminiService.ts e un Google finto che conta le
   chiamate (nessuna rete, nessuna chiave vera).
   Uso:  node scripts/test-api-key-removal-stops-checks.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST: REMOVING THE API KEY STOPS "TEST RECENT MODELS" AND THE MODEL CHECK
   "Remove the key" stopped only bulk tagging. A running "Test recent models" (dozens of models, a
   pause between each) kept calling Google with the key just removed, saved the result and in the
   end said "Test finished" after "API Key removed". A running model check did the same, and could
   even switch the model and say "AI model updated". Whoever removes the key (maybe because it
   leaked) expects the program to stop using it at once. The rule: after the removal no new call to
   Google, no saving of the test, no model switch and no notice besides the removal's. A call
   already in flight is not counted (it started while the key was still valid). Neighbouring cases
   that must not change: the test and the check without a removal end as before.
   The REAL texts of handleClearApiKey, provaModelliChiave and controllaModello taken from
   src/App.tsx are run, with the real service and a fake Google counting the calls.
   Usage:  node scripts/test-api-key-removal-stops-checks.mjs      (exits with code 1 if anything is off) */

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
                        const g = globalThis.__GOOGLE__;
                        return {
                            list: async () => { g.chiamate++; return g.list(); },
                            generateContent: async () => { g.chiamate++; return g.generate(); },
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
const prendi = (inizioTesto, fineRegex, nome) => {
    const i = app.indexOf(inizioTesto);
    fineRegex.lastIndex = Math.max(i, 0);
    const f = i < 0 ? null : fineRegex.exec(app);
    if (!f) { console.log('NO  non trovato in src/App.tsx: ' + nome); process.exit(1); }
    return app.slice(i, f.index + f[0].length);
};
const testoTogli = prendi('    const handleClearApiKey = useCallback(', /\r?\n    \}, \[t\]\);\r?\n/g, 'handleClearApiKey');
const testoControlla = prendi('    const controllaModello = async (', /\r?\n    \};\r?\n/g, 'controllaModello');
const testoProva = prendi('    const provaModelliChiave = async () => {', /\r?\n    \};\r?\n/g, 'provaModelliChiave');
const modulo = `
type ModelloChiave = any; type ProvaSalvata = any;
export const render = (env: any, snap: { aiModel: string; aiModelloFissato: boolean }) => {
    const { t, geminiApiKey, geminiApiKeyRef, controlloModelloRef, sceltaManualeRef, ultimaSceltaRef, aiModelloFissatoRef, aiEnabledRef,
            setControlloModelloInCorso, setModelloControllatoIl, setModelliDisponibili, showNotification, setAiModel, setAiModelloFissato,
            elencaModelliRemoti, aggiornaModelloAutomatico, classifyGeminiError, confrontaVersioni, versioneDi, localStorage,
            provaModelliRef, improntaChiave, setProvaModelliStato, setModelliChiave, provaTuttiIModelli,
            aiCancelRequestedRef, setAiCancelRequested, aiAbortControllerRef, deleteSecret, setGeminiApiKey, setIsAIBusy,
            setIsGlobalAITagging, setGlobalAIProgress, soundManager, useCallback } = env;
    const aiModel = snap.aiModel;
    const aiModelloFissato = snap.aiModelloFissato;
${testoTogli}
${testoControlla}
${testoProva}
    return { handleClearApiKey, controllaModello, provaModelliChiave };
};`;
const js = (await esbuild.transform(modulo, { loader: 'ts' })).code;
const { render } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));

const M = (nome) => ({ name: 'models/' + nome, displayName: nome, supportedActions: ['generateContent'] });
const pagine = (voci) => ({ async *[Symbol.asyncIterator]() { for (const v of voci) yield v; } });
const CHIAVE = 'AIza' + 'x'.repeat(35);

/* ITALIANO: un'app finta. Google elenca 3.7, 3.6 e 3.5 flash. Con `trattieni` = 'elenco' o 'prova'
   la prima chiamata di quel tipo resta aperta finche' la prova non chiama apri(): nel frattempo si
   toglie la chiave. setGeminiApiKey fa anche il "render": il ref prende il nuovo valore.
   ENGLISH: a fake app. Google lists 3.7, 3.6 and 3.5 flash. With `trattieni` = 'elenco' or 'prova'
   the first call of that kind stays open until the test calls apri(): meanwhile the key is removed.
   setGeminiApiKey also does the "render": the ref takes the new value. */
const scenario = ({ aiModel = 'gemini-3.5-flash', fissato = false, trattieni = null } = {}) => {
    let apri = () => { };
    let partita;
    const inAttesa = new Promise(ok => { partita = ok; });
    const tieni = async () => { partita(); await new Promise(ok => { apri = ok; }); };
    let elenchi = 0, prove = 0;
    globalThis.__GOOGLE__ = {
        chiamate: 0,
        list: async () => { elenchi++; if (trattieni === 'elenco' && elenchi === 1) await tieni(); return pagine([M('gemini-3.7-flash'), M('gemini-3.6-flash'), M('gemini-3.5-flash')]); },
        generate: async () => { prove++; if (trattieni === 'prova' && prove === 1) await tieni(); return { text: '["ok"]' }; },
    };
    const stato = { aiModel, aiModelloFissato: fissato, scritture: [], chiave: CHIAVE };
    const notifiche = [];
    const nulla = () => { };
    const env = {
        t, geminiApiKey: CHIAVE, geminiApiKeyRef: { current: CHIAVE },
        controlloModelloRef: { current: false }, sceltaManualeRef: { current: 0 }, ultimaSceltaRef: { current: '' },
        aiModelloFissatoRef: { current: fissato }, aiEnabledRef: { current: true },
        setControlloModelloInCorso: nulla, setModelloControllatoIl: nulla, setModelliDisponibili: nulla,
        showNotification: (m, tipo) => notifiche.push([m, tipo]),
        setAiModel: (v) => { stato.aiModel = v; }, setAiModelloFissato: (v) => { stato.aiModelloFissato = v; },
        elencaModelliRemoti: S.elencaModelliRemoti, aggiornaModelloAutomatico: S.aggiornaModelloAutomatico,
        classifyGeminiError: S.classifyGeminiError, confrontaVersioni: S.confrontaVersioni, versioneDi: S.versioneDi,
        localStorage: { getItem: () => null, setItem: (k) => stato.scritture.push(k) },
        provaModelliRef: { current: null }, improntaChiave: 'impronta-finta', setProvaModelliStato: nulla, setModelliChiave: nulla,
        // ITALIANO: il servizio vero, senza la pausa di 1,2 s fra un modello e l'altro (la prova non aspetta).
        // ENGLISH: the real service, without the 1.2 s pause between models (the test does not wait).
        provaTuttiIModelli: (k, avanti, segnale) => S.provaTuttiIModelli(k, avanti, segnale, 0),
        aiCancelRequestedRef: { current: false }, setAiCancelRequested: nulla, aiAbortControllerRef: { current: null },
        deleteSecret: async () => true,
        setGeminiApiKey: (v) => { stato.chiave = v; env.geminiApiKeyRef.current = v; },
        setIsAIBusy: nulla, setIsGlobalAITagging: nulla, setGlobalAIProgress: nulla,
        soundManager: { chime: nulla, pop: nulla }, useCallback: (f) => f,
    };
    const f = () => render(env, { aiModel, aiModelloFissato: fissato });
    return { stato, notifiche, env, f, inAttesa, apri: () => apri(), chiamate: () => globalThis.__GOOGLE__.chiamate };
};
// ITALIANO: avvia, aspetta la chiamata trattenuta, toglie la chiave, la lascia finire.
// ENGLISH: start, wait for the held call, remove the key, let it finish.
const togliDurante = async (s, avvia) => {
    const corsa = avvia();
    await s.inAttesa;
    const prima = s.chiamate();
    const avvisiPrima = s.notifiche.length;
    const scrittePrima = s.stato.scritture.length;
    await s.f().handleClearApiKey();
    s.apri();
    await corsa;
    return { dopo: s.chiamate() - prima, avvisi: s.notifiche.slice(avvisiPrima), scritte: s.stato.scritture.slice(scrittePrima) };
};

console.log('\n--- "Prova i modelli recenti" in corso, poi "Togli la chiave" ---');
{
    const s = scenario({ trattieni: 'prova' });
    const r = await togliDurante(s, () => s.f().provaModelliChiave());
    dice('nessuna chiamata a Google dopo la rimozione', 0, r.dopo);
    dice('il risultato della prova non si salva dopo la rimozione', false, r.scritte.includes('aiModelliChiave'));
    dice('unico avviso: "API Key removed" (niente "Test finished")', [[t.aiKeyCleared, 'success']], r.avvisi);
    dice('la prova risulta finita (il tasto torna "Prova")', null, s.env.provaModelliRef.current);
}
{
    const s = scenario({ trattieni: 'elenco' });
    const r = await togliDurante(s, () => s.f().provaModelliChiave());
    dice('chiave tolta mentre Google elenca i modelli: nessuna prova parte', 0, r.dopo);
    dice('...e unico avviso quello della rimozione', [[t.aiKeyCleared, 'success']], r.avvisi);
}

console.log('\n--- controllo del modello in corso, poi "Togli la chiave" ---');
{
    const s = scenario({ trattieni: 'elenco' });
    const r = await togliDurante(s, () => s.f().controllaModello(false, true));
    dice('Automatico, chiave tolta durante l\'elenco: nessuna prova parte', 0, r.dopo);
    dice('...il modello non cambia e niente "AI model updated"', ['gemini-3.5-flash', [[t.aiKeyCleared, 'success']]], [s.stato.aiModel, r.avvisi]);
    dice('..."ultimo controllo" non si scrive', false, r.scritte.includes('aiModelloControllatoIl'));
}
{
    const s = scenario({ trattieni: 'prova' });
    const r = await togliDurante(s, () => s.f().controllaModello(false, true));
    dice('Automatico, chiave tolta durante la prima prova: le prove dopo non partono e il modello non cambia', [0, 'gemini-3.5-flash'], [r.dopo, s.stato.aiModel]);
    dice('...e unico avviso quello della rimozione', [[t.aiKeyCleared, 'success']], r.avvisi);
}
{
    const s = scenario({ fissato: true, trattieni: 'elenco' });
    const r = await togliDurante(s, () => s.f().controllaModello(false, true));
    dice('modello bloccato, "Controlla ora", chiave tolta durante l\'elenco: niente "newer model"', [[t.aiKeyCleared, 'success']], r.avvisi);
}

console.log('\n--- senza rimozione: tutto come prima ---');
{
    const s = scenario();
    await s.f().provaModelliChiave();
    dice('la prova finisce con "Test finished" e salva il risultato', [true, true],
        [s.notifiche.some(([m]) => m.startsWith(t.aiProbeDone.split('{')[0])), s.stato.scritture.includes('aiModelliChiave')]);
}
{
    const s = scenario();
    await s.f().controllaModello(false, true);
    dice('il controllo Automatico passa al modello piu\' recente e lo dice', ['gemini-3.7-flash', 1], [s.stato.aiModel, s.notifiche.length]);
}

process.exit(esito());
