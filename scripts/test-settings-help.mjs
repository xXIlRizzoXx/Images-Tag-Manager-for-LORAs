/* ITALIANO: PROVA DEI TASTI "?" DELLE IMPOSTAZIONI
   Il pannello delle Impostazioni era pieno di paragrafi lunghi. Ora ogni sezione (aggiornamenti,
   Strumenti AI, Modello, Come tagga, Server MCP) ha un tasto "?" che apre una finestra con la
   spiegazione completa: gli stessi testi di prima, tolti dal pannello. Restano in vista solo le
   righe brevi necessarie, come "Gemini gira sui server di Google". La spiegazione di MCP si apre
   da sola la prima volta che lo si accende, perche' dice che un'AI in cloud manda le foto ai suoi
   server. La finestra non chiude il pannello, e si chiude con Chiudi, Esc o un clic fuori.
   Uso:  node scripts/test-settings-help.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE SETTINGS "?" BUTTONS
   The Settings panel was full of long paragraphs. Now each section (updates, AI tools, Model, How
   it tags, MCP server) has a "?" button opening a window with the full explanation: the same
   texts as before, removed from the panel. Only the short necessary lines stay in view, such as
   "Gemini runs on Google's servers". The MCP explanation opens by itself the first time it is
   switched on, since it says a cloud AI sends the photos to its servers. The window does not close
   the panel, and closes with Close, Esc or a click outside.
   Usage:  node scripts/test-settings-help.mjs      (exits with code 1 if anything is off) */

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

const SEZIONI = ['aggiornamenti', 'ai', 'modello', 'tagga', 'mcp'];
dice('le sezioni con il tasto "?" sono cinque', true, /type AiutoImpostazioni = 'aggiornamenti' \| 'ai' \| 'modello' \| 'tagga' \| 'mcp';/.test(app));
for (const s of SEZIONI) dice(`la sezione "${s}" ha il suo tasto "?"`, true, app.includes(`{tastoAiuto('${s}')}`));

// ITALIANO: ogni testo spostato deve stare nella finestra e NON piu' nel pannello.
// ENGLISH: every moved text must be in the window and NO longer in the panel.
const mappa = /const testiAiuto: Record<AiutoImpostazioni[\s\S]*?\n    \};/.exec(app)?.[0] || '';
dice('la tabella dei testi della finestra si trova', true, mappa.length > 0);
const SPOSTATI = ['updateCheckHint', 'aiModelAutoHint', 'aiProbeHint', 'aiModelLegend', 'aiRpmHint', 'aiSkipTaggedHint', 'mcpHint', 'mcpDesktopNote'];
const fuoriMappa = app.replace(mappa, '');
dice('ogni testo spostato sta nella finestra', [], SPOSTATI.filter(k => !mappa.includes(`t.${k}`)));
dice('...e nessuno e\' piu\' nel pannello', [], SPOSTATI.filter(k => new RegExp(`t\\.${k}\\b`).test(fuoriMappa)));
dice('"Gemini gira sui server di Google" resta in vista (privacy)', true, /<span>\{t\.aiCloudInfo \|\| ''\}<\/span>/.test(app));

console.log('\n--- la finestra ---');
const finestra = /\{aiuto && \(\n\s*<div ref=\{aiutoRef\}[\s\S]*?\n            \)\}/.exec(app)?.[0] || '';
dice('la finestra si trova ed e\' un dialogo', true, finestra.includes('role="dialog"') && finestra.includes('aria-modal="true"'));
dice('...ha il titolo della sezione e i suoi testi', true, finestra.includes('{testiAiuto[aiuto].titolo}') && finestra.includes('testiAiuto[aiuto].testi'));
dice('...si chiude con Chiudi', true, (finestra.match(/onClick=\{\(\) => setAiuto\(null\)\}/g) || []).length >= 2 && finestra.includes('{t.close}'));
dice('...si chiude con un clic fuori dal riquadro', true, /onMouseDown=\{\(e\) => \{ if \(e\.target === e\.currentTarget\) setAiuto\(null\); \}\}/.test(finestra));
dice('...si chiude con Esc', true, /if \(e\.key === 'Escape'\) \{ e\.stopPropagation\(\); setAiuto\(null\); \}/.test(app));
dice('un clic dentro la finestra non chiude il pannello delle Impostazioni', true,
    /if \(aiutoRef\.current && aiutoRef\.current\.contains\(event\.target\)\) return;\n\s*if \(settingsRef\.current && !settingsRef\.current\.contains\(event\.target\)\) setIsSettingsOpen\(false\);/.test(app));
dice('la finestra sta fuori dal pannello (che si anima con transform e la imprigionerebbe)', true,
    app.indexOf('{aiuto && (') > -1 && app.indexOf('{aiuto && (') < app.indexOf('{isSettingsOpen && <div'));

console.log('\n--- MCP ---');
dice('accendendo MCP la prima volta la spiegazione si apre da sola', true,
    /if \(v\) \{ try \{ if \(localStorage\.getItem\('mcpSpiegazioneVista'\) !== '1'\) \{ localStorage\.setItem\('mcpSpiegazioneVista', '1'\); setAiuto\('mcp'\); \} \} catch \(_\) \{ setAiuto\('mcp'\); \} \}/.test(app));
dice('la spiegazione di MCP dice del cloud (mcpHint) e del download di mcp-remote', true, /mcp: \{ titolo: t\.mcpTitle, testi: \[t\.mcpHint, t\.mcpDesktopNote\] \}/.test(mappa));

const etichette = [...testi.matchAll(/^\s*helpButton: "(.+)",\s*$/gm)].map(m => m[1]);
dice('l\'etichetta del tasto "?" esiste in 9 lingue', 9, etichette.length);

console.log(`\n${guai === 0 ? 'TUTTO A POSTO' : 'PROBLEMI: ' + guai} (${fatti} controlli)`);
process.exit(guai === 0 ? 0 : 1);
