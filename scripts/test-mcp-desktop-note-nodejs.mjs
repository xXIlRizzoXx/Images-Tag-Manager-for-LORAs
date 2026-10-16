/* ITALIANO: PROVA DELLA NOTA SU CLAUDE DESKTOP: SERVE NODE.JS
   La configurazione che l'app fa copiare per Claude Desktop lancia "npx -y mcp-remote ...". npx
   arriva solo con Node.js, che l'app non contiene e non installa: su un PC senza Node.js (comune
   fra chi addestra LoRA, che di solito ha Python) Claude Desktop non riesce ad avviare il ponte e
   mostra il server in errore. La nota della finestra "?" di MCP e il README dicevano solo che
   mcp-remote si scarica da solo la prima volta, quindi sembrava che non servisse altro.
   Si controlla: la configurazione di Claude Desktop usa davvero npx (e quelle di Claude Code e
   Cursor no, quindi la nota non deve chiedere Node.js per loro); in tutte e nove le lingue la nota
   nomina Node.js e mcp-remote e dice che Claude Code e Cursor non ne hanno bisogno; la nota sta
   nella finestra "?" di MCP; nel README la riga di mcp-remote nomina Node.js, mentre la riga
   dell'installazione dell'app ("No Node.js") resta com'era, perche' l'app in se' non lo vuole.
   Uso:  node scripts/test-mcp-desktop-note-nodejs.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE CLAUDE DESKTOP NOTE: NODE.JS IS NEEDED
   The configuration the app copies for Claude Desktop runs "npx -y mcp-remote ...". npx only comes
   with Node.js, which the app neither contains nor installs: on a PC without Node.js (common among
   LoRA trainers, who usually have Python) Claude Desktop cannot start the bridge and shows the
   server in error. The note of the MCP "?" window and the README only said that mcp-remote
   downloads itself the first time, so nothing else seemed to be needed.
   Checked: the Claude Desktop configuration really uses npx (and the Claude Code and Cursor ones do
   not, so the note must not ask Node.js for them); in all nine languages the note names Node.js and
   mcp-remote and says Claude Code and Cursor do not need it; the note sits in the MCP "?" window;
   in the README the mcp-remote line names Node.js, while the app's install line ("No Node.js")
   stays as it was, since the app itself does not want it.
   Usage:  node scripts/test-mcp-desktop-note-nodejs.mjs      (exits with code 1 if anything is off) */

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

// ITALIANO: premesse: quale configurazione usa npx, e dove si vede la nota.
// ENGLISH: premises: which configuration uses npx, and where the note is shown.
const i = app.indexOf('const configMcp = (');
const config = i < 0 ? '' : app.slice(i, app.indexOf('\n    };', i));
const rami = config.split(/\n\s*if \(tipo === /);
const ramoCode = rami.find(r => r.startsWith("'claudeCode'")) || '';
const ramoDesktop = rami.find(r => r.startsWith("'desktop'")) || '';
const ramoCursor = config.split('\n').filter(r => /^\s*return /.test(r)).pop() || '';
dice('premessa: la configurazione di Claude Desktop lancia npx con mcp-remote', true, /command: 'npx', args: \['-y', 'mcp-remote'/.test(ramoDesktop));
dice('premessa: quella di Claude Code non usa npx', true, ramoCode.length > 0 && !/npx/.test(ramoCode));
dice('premessa: quella di Cursor (url diretto) non usa npx', true, /url: indirizzoMcp/.test(ramoCursor) && !/npx/.test(ramoCursor));
dice('premessa: la nota sta nella finestra "?" di MCP', true, /mcp: \{ titolo: t\.mcpTitle, testi: \[t\.mcpHint, t\.mcpDesktopNote\] \}/.test(app));

// ITALIANO: la nota, lingua per lingua.
// ENGLISH: the note, language by language.
const LINGUE = ['it', 'en', 'fr', 'es', 'de', 'zh', 'ja', 'pt', 'ru'];
for (const l of LINGUE) {
    const nota = translations[l]?.mcpDesktopNote || '';
    dice(`[${l}] la nota nomina mcp-remote e Claude Desktop`, true, nota.includes('mcp-remote') && nota.includes('Claude Desktop'));
    dice(`[${l}] la nota dice che serve Node.js`, true, nota.includes('Node.js'));
    dice(`[${l}] la nota dice che Claude Code e Cursor non ne hanno bisogno`, true, nota.includes('Claude Code') && nota.includes('Cursor'));
}

// ITALIANO: il README: la riga di mcp-remote nomina Node.js; quella dell'installazione dell'app no.
// ENGLISH: the README: the mcp-remote line names Node.js; the app's install line does not change.
const righe = readme.split('\n');
const rigaPonte = righe.find(r => r.includes('mcp-remote')) || '';
dice('README: la riga di mcp-remote si trova', true, rigaPonte.length > 0);
dice('README: la riga di mcp-remote dice che serve Node.js', true, rigaPonte.includes('Node.js'));
dice('README: la riga di mcp-remote dice che Claude Code e Cursor non ne hanno bisogno', true, rigaPonte.includes('Claude Code') && /Cursor/.test(rigaPonte.slice(rigaPonte.indexOf('Node.js'))));
dice('README: l\'app resta "No Node.js, no setup"', true, righe.some(r => r.includes('No Node.js, no setup')));

process.exit(esito());
