/* ITALIANO: PROVA DEL CONTROLLO DEI MODELLI CON L'AI SPENTA
   Il README promette che il programma parla con Google solo con l'AI accesa. Ma la riparazione del
   modello (dopo "modello non disponibile" su una foto) partiva anche se nel frattempo l'AI era stata
   spenta: elenco dei modelli, fino a tre prove con un'immagine minuscola, poi il cambio di modello
   e un avviso, tutto con l'AI spenta. E il controllo di avvio, se l'AI si spegneva mentre girava,
   andava avanti e poteva cambiare il modello. La regola: con l'AI spenta il controllo non parte, e
   se l'AI si spegne mentre Google risponde il controllo si ferma senza cambiare niente e senza
   avvisi.
   Si esegue il testo VERO di controllaModello preso da src/App.tsx, con il servizio vero di
   src/services/geminiService.ts e un Google finto che conta le chiamate (nessuna rete, nessuna chiave).
   Uso:  node scripts/test-model-check-ai-off.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE MODEL CHECK WITH THE AI SWITCHED OFF
   The README promises the program talks to Google only with the AI switched on. But the model repair
   (after "model unavailable" on one photo) started even if the AI had been switched off meanwhile:
   the model list, up to three probes with a tiny image, then a model switch and a notice, all
   with the AI off. And the startup check, if the AI was switched off while it ran, went on and could
   switch the model. The rule: with the AI off the check does not start, and if the AI is switched
   off while Google answers the check stops without changing anything and without notices.
   The REAL text of controllaModello taken from src/App.tsx is run, with the real service of
   src/services/geminiService.ts and a fake Google counting the calls (no network, no key).
   Usage:  node scripts/test-model-check-ai-off.mjs      (exits with code 1 if anything is off) */

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
const i0 = app.indexOf('    const controllaModello = async (');
const fineControlla = /\r?\n    \};\r?\n/g;
fineControlla.lastIndex = Math.max(i0, 0);
const f0 = i0 < 0 ? null : fineControlla.exec(app);
if (!f0) { console.log('NO  non trovato in src/App.tsx: controllaModello'); process.exit(1); }
const modulo = `
export const render = (env: any, snap: { aiModel: string; aiModelloFissato: boolean }) => {
    const { t, geminiApiKey, controlloModelloRef, sceltaManualeRef, ultimaSceltaRef, aiModelloFissatoRef, aiEnabledRef, setControlloModelloInCorso,
            setModelloControllatoIl, setModelliDisponibili, showNotification, setAiModel, setAiModelloFissato,
            elencaModelliRemoti, aggiornaModelloAutomatico, classifyGeminiError, confrontaVersioni, versioneDi, localStorage } = env;
    const aiModel = snap.aiModel;
    const aiModelloFissato = snap.aiModelloFissato;
${app.slice(i0, f0.index + f0[0].length)}
    return { controllaModello };
};`;
const js = (await esbuild.transform(modulo, { loader: 'ts' })).code;
const { render } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));

const M = (nome) => ({ name: 'models/' + nome, displayName: nome, supportedActions: ['generateContent'] });
const pagine = (voci) => ({ async *[Symbol.asyncIterator]() { for (const v of voci) yield v; } });

/* ITALIANO: un'app finta. Google elenca 3.7, 3.6 e 3.5 flash. Con `trattieni` = 'elenco' o 'prova'
   la prima chiamata di quel tipo resta aperta finche' la prova non chiama apri(): nel frattempo si
   puo' spegnere l'AI.
   ENGLISH: a fake app. Google lists 3.7, 3.6 and 3.5 flash. With `trattieni` = 'elenco' or 'prova'
   the first call of that kind stays open until the test calls apri(): meanwhile the AI can be
   switched off. */
const scenario = ({ aiModel, fissato, aiAccesa = true, trattieni = null }) => {
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
    const stato = { aiModel, aiModelloFissato: fissato, scritture: [] };
    const notifiche = [];
    const env = {
        t, geminiApiKey: 'AIza' + 'x'.repeat(35),
        controlloModelloRef: { current: false }, sceltaManualeRef: { current: 0 }, ultimaSceltaRef: { current: '' },
        aiModelloFissatoRef: { current: fissato }, aiEnabledRef: { current: aiAccesa },
        setControlloModelloInCorso: () => { }, setModelloControllatoIl: () => { }, setModelliDisponibili: () => { },
        showNotification: (m, tipo) => notifiche.push([m, tipo]),
        setAiModel: (v) => { stato.aiModel = v; }, setAiModelloFissato: (v) => { stato.aiModelloFissato = v; },
        elencaModelliRemoti: S.elencaModelliRemoti, aggiornaModelloAutomatico: S.aggiornaModelloAutomatico,
        classifyGeminiError: S.classifyGeminiError, confrontaVersioni: S.confrontaVersioni, versioneDi: S.versioneDi,
        localStorage: { getItem: () => null, setItem: (k) => stato.scritture.push(k) },
    };
    const controlla = (rotto, dillo) => render(env, { aiModel, aiModelloFissato: fissato }).controllaModello(rotto, dillo);
    return { stato, notifiche, env, controlla, inAttesa, tieni, apri: () => apri(), chiamate: () => globalThis.__GOOGLE__.chiamate };
};

console.log('\n--- riparazione chiesta con l\'AI gia\' spenta ---');
{
    const s = scenario({ aiModel: 'gemini-3.5-flash', fissato: false, aiAccesa: false });
    await s.controlla(true, true);
    dice('nessuna chiamata a Google', 0, s.chiamate());
    dice('nessun cambio di modello e nessun avviso', ['gemini-3.5-flash', []], [s.stato.aiModel, s.notifiche]);
}

console.log('\n--- controllo di avvio (Automatico): l\'AI si spegne durante la prova del modello nuovo ---');
{
    const s = scenario({ aiModel: 'gemini-3.5-flash', fissato: false, trattieni: 'prova' });
    const corsa = s.controlla(false, false);
    await s.inAttesa;
    s.env.aiEnabledRef.current = false;
    s.apri(); await corsa;
    dice('il modello non cambia', 'gemini-3.5-flash', s.stato.aiModel);
    dice('nessun avviso', [], s.notifiche);
    dice('"ultimo controllo" non si scrive', false, s.stato.scritture.includes('aiModelloControllatoIl'));
}

console.log('\n--- riparazione: l\'AI si spegne mentre Google elenca i modelli ---');
{
    const s = scenario({ aiModel: 'gemini-3.5-flash', fissato: true, trattieni: 'elenco' });
    const corsa = s.controlla(true, true);
    await s.inAttesa;
    s.env.aiEnabledRef.current = false;
    s.apri(); await corsa;
    dice('il modello bloccato non cambia, il blocco resta', ['gemini-3.5-flash', true], [s.stato.aiModel, s.stato.aiModelloFissato]);
    dice('nessun avviso', [], s.notifiche);
}

console.log('\n--- modello bloccato, "Controlla ora": l\'AI si spegne mentre Google elenca i modelli ---');
{
    const s = scenario({ aiModel: 'gemini-3.5-flash', fissato: true, trattieni: 'elenco' });
    const corsa = s.controlla(false, true);
    await s.inAttesa;
    s.env.aiEnabledRef.current = false;
    s.apri(); await corsa;
    dice('nessun avviso "piu\' recente"', [], s.notifiche);
    dice('una sola chiamata: l\'elenco gia\' partito', 1, s.chiamate());
}

/* ITALIANO: il risultato veniva scartato, ma le prove a Google partivano lo stesso DOPO lo
   spegnimento: da una a tre chiamate generateContent (fino a 60 s l'una). Qui si contano le
   chiamate fatte dopo lo spegnimento: devono essere zero. Una prova gia' in volo non si conta
   (e' partita con l'AI accesa).
   ENGLISH: the result was discarded, but the probes to Google still started AFTER the switch-off:
   one to three generateContent calls (up to 60 s each). Here the calls made after the switch-off
   are counted: they must be zero. A probe already in flight is not counted (it started with the
   AI on). */
const no404 = async () => { const e = new Error('{"error":{"code":404,"status":"NOT_FOUND"}}'); e.status = 404; throw e; };
const dopoLoSpegnimento = async (s, rotto, dillo) => {
    const corsa = s.controlla(rotto, dillo);
    await s.inAttesa;
    s.env.aiEnabledRef.current = false;
    const prima = s.chiamate();
    s.apri(); await corsa;
    return s.chiamate() - prima;
};

console.log('\n--- chiamate a Google DOPO lo spegnimento dell\'AI ---');
{
    const s = scenario({ aiModel: 'gemini-3.5-flash', fissato: false, trattieni: 'elenco' });
    globalThis.__GOOGLE__.generate = no404;
    dice('riparazione (Automatico), AI spenta durante l\'elenco, candidati 404: nessuna prova parte', 0, await dopoLoSpegnimento(s, true, true));
    dice('...e nessun avviso, nessun cambio', ['gemini-3.5-flash', []], [s.stato.aiModel, s.notifiche]);
}
{
    const s = scenario({ aiModel: 'gemini-3.5-flash', fissato: true, trattieni: 'elenco' });
    dice('riparazione del modello bloccato, AI spenta durante l\'elenco: nessuna prova parte', 0, await dopoLoSpegnimento(s, true, true));
}
{
    const s = scenario({ aiModel: 'gemini-3.5-flash', fissato: false, trattieni: 'elenco' });
    dice('controllo di avvio (Automatico), AI spenta durante l\'elenco: nessuna prova parte', 0, await dopoLoSpegnimento(s, false, false));
    dice('...e il modello non cambia', 'gemini-3.5-flash', s.stato.aiModel);
}
{
    // ITALIANO: l'AI si spegne durante la PRIMA prova (candidati 404): le altre due non partono.
    // ENGLISH: the AI is switched off during the FIRST probe (404 candidates): the other two do not start.
    const s = scenario({ aiModel: 'gemini-3.5-flash', fissato: false, trattieni: 'prova' });
    let prove = 0;
    globalThis.__GOOGLE__.generate = async () => { prove++; if (prove === 1) await s.tieni(); return no404(); };
    dice('riparazione, AI spenta durante la prima prova: le prove dopo non partono', 0, await dopoLoSpegnimento(s, true, true));
    dice('...e nessun avviso', [], s.notifiche);
}

console.log('\n--- il servizio senza il controllo "continua": come prima ---');
{
    const s = scenario({ aiModel: 'gemini-3.5-flash', fissato: false });
    globalThis.__GOOGLE__.generate = no404;
    const e = await S.aggiornaModelloAutomatico(s.env.geminiApiKey, 'gemini-3.5-flash', true);
    dice('senza il quarto argomento: elenco + tre prove, "nessunoValido"', [4, 'nessunoValido'], [s.chiamate(), e.esito]);
    const r = scenario({ aiModel: 'gemini-3.5-flash', fissato: false });
    const e2 = await S.aggiornaModelloAutomatico(r.env.geminiApiKey, 'gemini-3.5-flash', false, () => true);
    dice('con "continua" sempre vero: si passa al piu\' recente come prima', ['gemini-3.7-flash', 'aggiornato', 2], [e2.modello, e2.esito, r.chiamate()]);
    const q = scenario({ aiModel: 'gemini-3.5-flash', fissato: false });
    const e3 = await S.aggiornaModelloAutomatico(q.env.geminiApiKey, 'gemini-3.5-flash', true, () => false);
    dice('con "continua" falso: solo l\'elenco, nessun cambio', [1, false, 'gemini-3.5-flash'], [q.chiamate(), e3.cambiato, e3.modello]);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const s = scenario({ aiModel: 'gemini-3.5-flash', fissato: false });
    await s.controlla(false, false);
    dice('AI accesa, Automatico: si passa al piu\' recente e lo si dice',
        ['gemini-3.7-flash', [[t.aiModelSwitched.replace('{da}', 'gemini-3.5-flash').replace('{a}', 'gemini-3.7-flash'), 'info']]], [s.stato.aiModel, s.notifiche]);
    const r = scenario({ aiModel: 'gemini-3.5-flash', fissato: true });
    await r.controlla(true, true);
    dice('AI accesa, riparazione del modello bloccato: si sostituisce e il blocco cade', ['gemini-3.7-flash', false], [r.stato.aiModel, r.stato.aiModelloFissato]);
}

process.exit(esito());
