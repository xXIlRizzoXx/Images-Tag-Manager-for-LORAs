/* ITALIANO: PROVA DI "CONTROLLA ORA" CON UN MODELLO LITE BLOCCATO
   Bloccando a mano gemini-3.6-flash-lite e premendo "Controlla ora", l'avviso diceva "E' disponibile
   un modello piu' recente della linea gratuita: gemini-3.6-flash". Non e' piu' recente: e' la stessa
   versione 3.6, solo che nell'elenco il flash pieno viene prima del lite. La regola: "piu' recente"
   si dice solo quando la versione del primo dell'elenco e' davvero piu' alta di quella bloccata;
   altrimenti si dice che il modello in uso e' aggiornato.
   Si esegue il testo VERO di controllaModello preso da src/App.tsx, con il servizio vero di
   src/services/geminiService.ts e un Google finto (nessuna rete, nessuna chiave).
   Uso:  node scripts/test-model-check-locked-lite.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF "CHECK NOW" WITH A LOCKED LITE MODEL
   Locking gemini-3.6-flash-lite by hand and pressing "Check now", the notice said "A newer model of
   the free line is available: gemini-3.6-flash". It is not newer: it is the same version 3.6, only
   the full flash comes before the lite in the list. The rule: "newer" is said only when the version
   of the first in the list is really higher than the locked one; otherwise the model in use is said
   to be up to date.
   The REAL text of controllaModello taken from src/App.tsx is run, with the real service of
   src/services/geminiService.ts and a fake Google (no network, no key).
   Usage:  node scripts/test-model-check-locked-lite.mjs      (exits with code 1 if anything is off) */

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
                            generateContent: async () => { g.chiamate++; return { text: '["ok"]' }; },
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

// ITALIANO: "Controlla ora" con il modello `bloccato` fisso e Google che elenca `elenco`.
// ENGLISH: "Check now" with the `bloccato` model locked and Google listing `elenco`.
const controllaOra = async (bloccato, elenco) => {
    globalThis.__GOOGLE__ = { chiamate: 0, list: async () => pagine(elenco.map(M)) };
    const stato = { aiModel: bloccato, aiModelloFissato: true };
    const notifiche = [];
    const env = {
        t, geminiApiKey: 'AIza' + 'x'.repeat(35),
        controlloModelloRef: { current: false }, sceltaManualeRef: { current: 0 }, ultimaSceltaRef: { current: '' },
        aiModelloFissatoRef: { current: true }, aiEnabledRef: { current: true },
        setControlloModelloInCorso: () => { }, setModelloControllatoIl: () => { }, setModelliDisponibili: () => { },
        showNotification: (m, tipo) => notifiche.push([m, tipo]),
        setAiModel: (v) => { stato.aiModel = v; }, setAiModelloFissato: (v) => { stato.aiModelloFissato = v; },
        elencaModelliRemoti: S.elencaModelliRemoti, aggiornaModelloAutomatico: S.aggiornaModelloAutomatico,
        classifyGeminiError: S.classifyGeminiError, confrontaVersioni: S.confrontaVersioni, versioneDi: S.versioneDi,
        localStorage: { getItem: () => null, setItem: () => { } },
    };
    await render(env, { aiModel: bloccato, aiModelloFissato: true }).controllaModello(false, true);
    return { notifiche, stato };
};
const aggiornato = (m) => [[t.aiModelUpToDate.replace('{a}', m), 'success']];
const nuovo = (m) => [[t.aiModelNewerAvailable.replace('{a}', m), 'info']];

console.log('\n--- modello lite bloccato, il flash pieno della STESSA versione e\' primo nell\'elenco ---');
{
    const r = await controllaOra('gemini-3.6-flash-lite', ['gemini-3.6-flash-lite', 'gemini-3.6-flash']);
    dice('3.6-flash-lite bloccato, elenco 3.6: "aggiornato", non "piu\' recente: gemini-3.6-flash"', aggiornato('gemini-3.6-flash-lite'), r.notifiche);
    dice('...e il modello resta bloccato sul suo', ['gemini-3.6-flash-lite', true], [r.stato.aiModel, r.stato.aiModelloFissato]);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const r = await controllaOra('gemini-3.5-flash', ['gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-3.7-flash']);
    dice('3.5-flash bloccato, elenco guidato da 3.7: "piu\' recente: gemini-3.7-flash"', nuovo('gemini-3.7-flash'), r.notifiche);
    dice('...senza cambiare il modello bloccato', ['gemini-3.5-flash', true], [r.stato.aiModel, r.stato.aiModelloFissato]);
}
{
    const r = await controllaOra('gemini-3.6-flash-lite', ['gemini-3.6-flash-lite', 'gemini-3.7-flash']);
    dice('3.6-flash-lite bloccato, elenco con 3.7: "piu\' recente: gemini-3.7-flash"', nuovo('gemini-3.7-flash'), r.notifiche);
}
{
    const r = await controllaOra('gemini-3.7-flash', ['gemini-3.6-flash', 'gemini-3.7-flash']);
    dice('bloccato proprio sul piu\' recente: "aggiornato"', aggiornato('gemini-3.7-flash'), r.notifiche);
}

process.exit(esito());
