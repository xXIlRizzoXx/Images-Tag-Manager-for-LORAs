/* ITALIANO: PROVA DELLA SPIEGAZIONE "?" DEL SERVER MCP PER CHI USA CLAUDE CODE
   Dopo un codice nuovo l'avviso a comparsa dice a chi usa Claude Code di togliere prima il
   collegamento vecchio (claude mcp remove images-tag-manager), perche' Claude Code rifiuta un
   secondo "mcp add" con lo stesso nome. Ma l'avviso dura pochi secondi, e dopo un'installazione
   pulita il codice cambia senza nessun avviso: l'istruzione non si trovava piu' da nessuna parte
   nel programma e l'utente restava col codice vecchio, rifiutato a ogni chiamata.
   La regola: la spiegazione "?" del server MCP (che si riapre da sola alla prima accensione dopo
   un'installazione pulita) contiene, in tutte e nove le lingue, una frase intera con il comando di
   rimozione e il tasto con la sua etichetta vera.
   Uso:  node scripts/test-mcp-help-claude-code.mjs   (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE MCP SERVER "?" EXPLANATION FOR CLAUDE CODE USERS
   After a new token the pop-up notice tells Claude Code users to first remove the old connection
   (claude mcp remove images-tag-manager), because Claude Code refuses a second "mcp add" with the
   same name. But the notice lasts a few seconds, and after a clean install the token changes with
   no notice at all: the instruction could no longer be found anywhere in the program and the user
   kept the old token, refused on every call.
   The rule: the MCP server "?" explanation (which reopens by itself the first time the server is
   switched on after a clean install) holds, in all nine languages, a whole sentence with the
   remove command and the button with its real label.
   Usage:  node scripts/test-mcp-help-claude-code.mjs   (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();

const uscita = await esbuild.build({
    entryPoints: [path.join(radice, 'src/constants.ts')],
    bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
});
const { translations } = await import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));
const app = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8').replace(/\r\n/g, '\n');

const RIMUOVI = 'claude mcp remove images-tag-manager';

// ITALIANO: le chiavi dei testi della spiegazione "?" del server MCP, lette dal codice.
// ENGLISH: the keys of the MCP server "?" explanation texts, read from the code.
const m = app.match(/mcp: \{ titolo: t\.mcpTitle, testi: \[([^\]]*)\] \}/);
dice('premessa: la spiegazione "?" del server MCP si trova in App.tsx', true, !!m);
const chiavi = m ? m[1].split(',').map(s => s.trim().replace(/^t\./, '')).filter(Boolean) : [];

const LINGUE = ['it', 'en', 'fr', 'es', 'de', 'zh', 'ja', 'pt', 'ru'];
for (const l of LINGUE) {
    const testi = chiavi.map(k => translations[l]?.[k] || '');
    const tasto = translations[l]?.mcpCopyClaudeCode || '';
    const frase = testi.find(x => x.includes(RIMUOVI)) || '';
    dice(`[${l}] la spiegazione da' il comando "${RIMUOVI}"`, true, frase.length > 0);
    dice(`[${l}] la stessa frase nomina il tasto con la sua etichetta vera "${tasto}"`, true, tasto.length > 0 && frase.includes(tasto));
    dice(`[${l}] il comando di rimozione viene prima del tasto`, true, frase.indexOf(RIMUOVI) >= 0 && frase.indexOf(RIMUOVI) < frase.indexOf(tasto));
    dice(`[${l}] la frase finisce con una frase intera`, true, /[.。]$/.test(frase));
}

process.exit(esito());
