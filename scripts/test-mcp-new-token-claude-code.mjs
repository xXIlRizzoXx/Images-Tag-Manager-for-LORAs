/* ITALIANO: PROVA DELL'AVVISO DOPO "CREA UN CODICE NUOVO" PER CLAUDE CODE
   Dopo "Crea un codice nuovo" l'avviso diceva solo di copiare di nuovo la configurazione. Per
   Claude Desktop e Cursor basta: si sostituisce il testo nel loro file. Per Claude Code no: il
   comando copiato e' "claude mcp add ... images-tag-manager ...", e Claude Code rifiuta un secondo
   add con lo stesso nome ("MCP server images-tag-manager already exists in user config"). Chi
   seguiva l'avviso restava col codice vecchio, riceveva un rifiuto a ogni chiamata e nessun testo
   diceva come uscirne. Chi l'aveva aggiunto col comando della 2.0.0 (senza --scope, quindi solo in
   quella cartella) aveva lo stesso problema.
   La regola: in tutte e nove le lingue l'avviso dice, con una frase intera, di togliere prima il
   collegamento vecchio con "claude mcp remove images-tag-manager" (senza --scope: cosi' Claude Code
   lo trova sia nella 2.0.0 sia nella 2.0.1) e poi di usare di nuovo il tasto con la sua etichetta
   vera; il README dice la stessa cosa vicino a "Create a new token".
   Uso:  node scripts/test-mcp-new-token-claude-code.mjs   (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE NOTICE AFTER "CREATE A NEW TOKEN" FOR CLAUDE CODE
   After "Create a new token" the notice only said to copy the configuration again. For Claude
   Desktop and Cursor that is enough: the text in their file is replaced. Not for Claude Code: the
   copied command is "claude mcp add ... images-tag-manager ...", and Claude Code refuses a second
   add with the same name ("MCP server images-tag-manager already exists in user config"). Whoever
   followed the notice kept the old token, got refused on every call and no text said how to get
   out. Whoever had added it with the 2.0.0 command (no --scope, so only in that folder) had the
   same problem.
   The rule: in all nine languages the notice says, in a whole sentence, to first remove the old
   connection with "claude mcp remove images-tag-manager" (no --scope: that way Claude Code finds it
   both from 2.0.0 and from 2.0.1) and then to use the button again with its real label; the README
   says the same thing next to "Create a new token".
   Usage:  node scripts/test-mcp-new-token-claude-code.mjs   (exits with code 1 if anything is off) */

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
const readme = fs.readFileSync(path.join(radice, 'README.md'), 'utf8').replace(/\r\n/g, '\n');

const RIMUOVI = 'claude mcp remove images-tag-manager';

// ITALIANO: premesse: il tasto copia un "mcp add" col nome che il comando di rimozione usa, e
// l'avviso e' proprio quello mostrato dopo un codice nuovo riuscito.
// ENGLISH: premises: the button copies an "mcp add" with the name the remove command uses, and the
// notice is the very one shown after a successful new token.
dice('premessa: il comando per Claude Code e\' un "claude mcp add" con il nome images-tag-manager', true,
    /if \(tipo === 'claudeCode'\) return `claude mcp add [^`]* images-tag-manager \$\{indirizzoMcp\}/.test(app));
dice('premessa: dopo un codice nuovo riuscito si mostra mcpNewTokenDone', true,
    /showNotification\(s\.errore === 'salvataggio' \? t\.mcpErrSave : t\.mcpNewTokenDone/.test(app));

// ITALIANO: l'avviso, lingua per lingua.
// ENGLISH: the notice, language by language.
const LINGUE = ['it', 'en', 'fr', 'es', 'de', 'zh', 'ja', 'pt', 'ru'];
for (const l of LINGUE) {
    const avviso = translations[l]?.mcpNewTokenDone || '';
    const tasto = translations[l]?.mcpCopyClaudeCode || '';
    dice(`[${l}] l'avviso nomina Claude Code`, true, avviso.includes('Claude Code'));
    dice(`[${l}] l'avviso da' il comando "${RIMUOVI}"`, true, avviso.includes(RIMUOVI));
    dice(`[${l}] il comando non fissa un ambito (vale per la 2.0.0 e per la 2.0.1)`, false, /claude mcp remove images-tag-manager\s*-/.test(avviso));
    dice(`[${l}] l'avviso nomina il tasto con la sua etichetta vera "${tasto}"`, true, tasto.length > 0 && avviso.includes(tasto));
    dice(`[${l}] il comando di rimozione viene prima del tasto`, true, avviso.indexOf(RIMUOVI) >= 0 && avviso.indexOf(RIMUOVI) < avviso.indexOf(tasto));
    dice(`[${l}] l'avviso finisce con una frase intera`, true, /[.。]$/.test(avviso));
}

// ITALIANO: il README, sulla riga di "Create a new token".
// ENGLISH: the README, on the "Create a new token" line.
const riga = readme.split('\n').find(r => r.includes('**Create a new token**')) || '';
dice('README: la riga di "Create a new token" si trova', true, riga.length > 0);
dice('README: la riga dice di togliere prima il server da Claude Code', true, riga.includes(RIMUOVI) && riga.includes('Claude Code'));

process.exit(esito());
