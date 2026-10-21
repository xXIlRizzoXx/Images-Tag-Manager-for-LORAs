/* ITALIANO: PROVA: IL COMANDO COPIATO PER CLAUDE CODE VALE IN TUTTE LE CARTELLE
   `claude mcp add` senza --scope usa l'ambito "local": il server vale solo per la cartella da cui
   si lancia il comando. Chi lo incollava in un terminale aperto altrove e poi avviava Claude Code
   nella cartella del dataset non vedeva images-tag-manager. Ora il comando ha `--scope user`, prima
   del nome. Casi vicini che non devono cambiare: --transport http, l'indirizzo, l'intestazione
   Bearer con il codice per ultima; la configurazione per Claude Desktop e Cursor resta la stessa.
   La prova ritaglia la vera configMcp da src/App.tsx.
   Uso:  node scripts/test-mcp-claude-code-scope.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST: THE COMMAND COPIED FOR CLAUDE CODE WORKS IN EVERY FOLDER
   `claude mcp add` without --scope uses the "local" scope: the server only works in the folder the
   command is run from. Whoever pasted it into a terminal opened elsewhere and then started Claude
   Code in the dataset folder did not see images-tag-manager. Now the command has `--scope user`,
   before the name. Neighbouring cases that must not change: --transport http, the address, the
   Bearer header with the token last; the configuration for Claude Desktop and Cursor stays the same.
   The test cuts the real configMcp out of src/App.tsx.
   Usage:  node scripts/test-mcp-claude-code-scope.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8').replace(/\r\n/g, '\n');
const inizio = sorgente.indexOf('    const configMcp = (');
const fine = sorgente.indexOf('\n    };\n', inizio);
if (inizio < 0 || fine < 0) { console.log('NO  configMcp non trovata in src/App.tsx'); process.exit(1); }
const ritaglio = sorgente.slice(inizio, fine + 7);
const js = (await esbuild.transform(ritaglio, { loader: 'ts' })).code;
const crea = new Function('mcpStato', 'indirizzoMcp', `${js}\nreturn configMcp;`);

let guai = 0, fatti = 0;
const dice = (nome, atteso, avuto) => {
    fatti++;
    const ok = JSON.stringify(atteso) === JSON.stringify(avuto);
    if (!ok) guai++;
    console.log(`${ok ? 'OK ' : 'NO '} ${nome}${ok ? '' : `\n     atteso: ${JSON.stringify(atteso)}\n     avuto:  ${JSON.stringify(avuto)}`}`);
};

const url = 'http://127.0.0.1:37620/images-tag-manager';
const configMcp = crea({ porta: 37620, codice: 'CODICE-FINTO' }, url);
const cmd = configMcp('claudeCode');
dice('comando per Claude Code', `claude mcp add --transport http --scope user images-tag-manager ${url} --header "Authorization: Bearer CODICE-FINTO"`, cmd);
dice('--scope user viene prima del nome del server', true, cmd.indexOf('--scope user') >= 0 && cmd.indexOf('--scope user') < cmd.indexOf(' images-tag-manager '));
dice('--header resta per ultimo, dopo l\'indirizzo', true, cmd.indexOf(url) < cmd.indexOf('--header') && cmd.endsWith('"Authorization: Bearer CODICE-FINTO"'));
const desktop = JSON.parse(configMcp('desktop'));
dice('Claude Desktop invariato', { command: 'npx', args: ['-y', 'mcp-remote', url, '--allow-http', '--header', 'Authorization:${AUTH_HEADER}'], env: { AUTH_HEADER: 'Bearer CODICE-FINTO' } }, desktop.mcpServers['images-tag-manager']);
const cursor = JSON.parse(configMcp('cursor'));
dice('Cursor invariato', { url, headers: { Authorization: 'Bearer CODICE-FINTO' } }, cursor.mcpServers['images-tag-manager']);

console.log(`\n${guai === 0 ? 'TUTTO A POSTO' : 'PROBLEMI: ' + guai} (${fatti} controlli)`);
process.exit(guai === 0 ? 0 : 1);
