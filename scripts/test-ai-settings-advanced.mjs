/* ITALIANO: PROVA DELLA PARTE "AVANZATE" DELLE IMPOSTAZIONI AI
   Le Impostazioni AI erano tre schede piene (chiave, modello con due pulsanti e due paragrafi,
   Come tagga): troppo per chi vuole solo incollare la chiave. Ora in vista restano chiave e
   modello; i controlli dei modelli e Come tagga stanno in "Avanzate", chiusa di serie, che si
   apre da sola mentre una prova o un controllo e' in corso (altrimenti l'avanzamento sparirebbe).
   Nessuna funzione e' stata tolta.
   Uso:  node scripts/test-ai-settings-advanced.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE "ADVANCED" PART OF THE AI SETTINGS
   The AI settings were three full cards (key, model with two buttons and two paragraphs, How it
   tags): too much for someone who only wants to paste the key. Now key and model stay in view; the
   model checks and How it tags sit in "Advanced", closed by default, which opens by itself while a
   probe or a check is running (or the progress would vanish). No feature was removed.
   Usage:  node scripts/test-ai-settings-advanced.mjs      (exits with code 1 if anything is off) */

import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let guai = 0;
let fatti = 0;
const dice = (cosa, atteso, avuto) => {
    fatti++;
    const ok = JSON.stringify(atteso) === JSON.stringify(avuto);
    if (!ok) guai++;
    console.log(`${ok ? 'OK  ' : 'NO  '} ${cosa}${ok ? '' : `  (atteso ${JSON.stringify(atteso)}, avuto ${JSON.stringify(avuto)})`}`);
};

const app = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8').replace(/\r\n/g, '\n');
const testi = fs.readFileSync(path.join(radice, 'src/constants.ts'), 'utf8');
const APERTA = '(aiAvanzate || provaModelliStato !== null || controlloModelloInCorso)';

dice('"Avanzate" e\' chiusa di serie', true, /const \[aiAvanzate, setAiAvanzate\] = useState\(false\);/.test(app));

// ITALIANO: tutto cio' che sta tra l'inizio della scheda Modello e la fine delle Impostazioni AI.
// ENGLISH: everything between the start of the Model card and the end of the AI settings.
const inizio = app.indexOf('{t.aiModelLabel');
const fine = app.indexOf('{t.mcpTitle}', inizio);
const sezione = inizio > 0 && fine > inizio ? app.slice(inizio, fine) : '';
dice('la sezione Modello / Come tagga si trova', true, sezione.length > 0);

// ITALIANO: il blocco condizionato che contiene un pezzo deve aprirsi PRIMA di lui e non essersi
//           chiuso nel frattempo: si contano le aperture "{APERTA && (" prima del pezzo e le
//           chiusure ")}" del blocco, in modo semplice: il pezzo deve venire dopo un'apertura e
//           prima della chiusura corrispondente.
// ENGLISH: the conditional block holding a piece must open BEFORE it and not have closed meanwhile.
const blocchi = [];
for (let i = sezione.indexOf(`{${APERTA} && (`); i >= 0; i = sezione.indexOf(`{${APERTA} && (`, i + 1)) {
    const chiusura = sezione.indexOf(i === sezione.indexOf(`{${APERTA} && (<>`) ? '</>)}' : '\n                                                    )}', i);
    blocchi.push([i, chiusura < 0 ? sezione.length : chiusura]);
}
const dentro = (pezzo) => { const p = sezione.indexOf(pezzo); return p >= 0 && blocchi.some(([a, b]) => p > a && p < b); };
// ITALIANO: dalla 2.0.1 un blocco solo, SOTTO il pulsante: i controlli dei modelli e Come tagga.
// ENGLISH: since 2.0.1 a single block, BELOW the button: the model checks and How it tags.
dice('un solo blocco si apre con "Avanzate" (controlli dei modelli e Come tagga)', 1, blocchi.length);
dice('il pulsante "Avanzate" sta sopra a "Controlla ora" e a Come tagga', [true, true],
    [sezione.indexOf('{t.aiAdvanced}') >= 0 && sezione.indexOf('{t.aiAdvanced}') < sezione.indexOf('{t.aiModelCheckNow}'),
     sezione.indexOf('{t.aiAdvanced}') >= 0 && sezione.indexOf('{t.aiAdvanced}') < sezione.indexOf('{t.aiCardTagging}')]);
dice('"Controlla ora" sta dentro "Avanzate"', true, dentro('{t.aiModelCheckNow}'));
dice('"Prova i modelli recenti" sta dentro "Avanzate"', true, dentro('t.aiProbeAll'));
dice('il riepilogo e l\'avanzamento della prova stanno dentro "Avanzate"', true, dentro('t.aiProbeSummary') && dentro('t.aiProbeProgress'));
// ITALIANO: dal 16/10/2026 le spiegazioni lunghe non stanno piu' nel pannello ma nella finestra del tasto "?".
// ENGLISH: since 16/10/2026 the long explanations no longer sit in the panel but in the "?" button window.
dice('le spiegazioni lunghe non stanno piu\' nel pannello', [], ['{t.aiModelAutoHint}', '{t.aiProbeHint}', '{t.aiModelLegend}', '{t.aiRpmHint', '{t.aiSkipTaggedHint'].filter(p => sezione.includes(p)));
dice('la scheda Come tagga sta dentro "Avanzate"', true, dentro('{t.aiCardTagging}') && dentro('{t.aiMaxTags') && dentro('{t.aiCustomPromptLabel'));
dice('la tendina del modello resta sempre in vista', false, dentro('value={aiModelloFissato ? aiModel : \'__auto__\'}'));
dice('l\'avviso "questo modello non funziona" resta sempre in vista', false, dentro('{t.aiModelNotWorkingWarning}'));
dice('il pulsante "Avanzate" apre e chiude, e dice se e\' aperto', true,
    /onClick=\{\(\) => setAiAvanzate\(v => !v\)\}\s*aria-expanded=\{\(aiAvanzate \|\| provaModelliStato !== null \|\| controlloModelloInCorso\)/.test(sezione)
    || /onClick=\{\(\) => setAiAvanzate\(v => !v\)\}\s*aria-expanded=\{aiAvanzate \|\| provaModelliStato !== null \|\| controlloModelloInCorso\}/.test(sezione));
const voci = [...testi.matchAll(/^\s*aiAdvanced: "(.+)",\s*$/gm)].map(m => m[1]);
dice('"Avanzate" esiste in 9 lingue', 9, voci.length);

console.log(`\n${guai === 0 ? 'TUTTO A POSTO' : 'PROBLEMI: ' + guai} (${fatti} controlli)`);
process.exit(guai === 0 ? 0 : 1);
