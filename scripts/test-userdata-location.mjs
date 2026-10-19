/* ITALIANO: PROVA DI DOVE STANNO I DATI DEL PROGRAMMA (regola fissa: solo in %APPDATA%)
   I dati del programma (chiave cifrata secrets.json, mcp.json, ui-lang.json, e la cartella di
   Chromium con Local Storage e copie di emergenza) stanno solo nella cartella userData che Electron
   sceglie da solo, cioe' %APPDATA%\images-tag-manager, sia con l'installer sia con il portable.
   Mai accanto all'exe e mai in PORTABLE_EXECUTABLE_DIR (la cartella che l'exe portable di
   electron-builder mette nell'ambiente). Una riga come
       if (process.env.PORTABLE_EXECUTABLE_DIR) app.setPath('userData', ...)
   non rompe nessun'altra prova, perche' il banco di prova non imposta quella variabile: questa
   prova la vieta nel codice VERO di electron/main.cjs (senza i commenti), pretende che ogni
   app.getPath chieda solo 'userData' e che i tre file partano da li', poi carica main.cjs con
   PORTABLE_EXECUTABLE_DIR impostata a una cartella finta e controlla che parta e non ci scriva
   niente. Il server MCP (electron/mcp-server.src.mjs) non scrive mai su disco.
   Uso:  node scripts/test-userdata-location.mjs   (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF WHERE THE PROGRAM'S DATA LIVES (fixed rule: only in %APPDATA%)
   The program's data (encrypted key secrets.json, mcp.json, ui-lang.json, and Chromium's folder
   with Local Storage and the emergency backups) lives only in the userData folder Electron picks
   by itself, i.e. %APPDATA%\images-tag-manager, with both the installer and the portable build.
   Never next to the exe and never in PORTABLE_EXECUTABLE_DIR (the folder electron-builder's
   portable exe puts in the environment). A line such as
       if (process.env.PORTABLE_EXECUTABLE_DIR) app.setPath('userData', ...)
   breaks no other test, because the test bench does not set that variable: this test forbids it
   in the REAL code of electron/main.cjs (without comments), requires every app.getPath to ask for
   'userData' only and the three files to start from there, then loads main.cjs with
   PORTABLE_EXECUTABLE_DIR set to a fake folder and checks it starts and writes nothing there.
   The MCP server (electron/mcp-server.src.mjs) never writes to disk.
   Usage:  node scripts/test-userdata-location.mjs   (exits with code 1 if anything is off) */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { caricaMain, creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();

// ITALIANO: toglie i commenti // e /* */ lasciando intatte le stringhe ('...', "...", `...`),
//           cosi' un indirizzo come 'https://...' non viene scambiato per un commento.
// ENGLISH: removes // and /* */ comments while keeping strings ('...', "...", `...`) intact,
//          so an address such as 'https://...' is not mistaken for a comment.
const senzaCommenti = (src) => {
    let fuori = '', i = 0;
    while (i < src.length) {
        const c = src[i], d = src[i + 1];
        if (c === '/' && d === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
        if (c === '/' && d === '*') { const f = src.indexOf('*/', i + 2); i = f < 0 ? src.length : f + 2; fuori += ' '; continue; }
        if (c === '\'' || c === '"' || c === '`') {
            let j = i + 1;
            while (j < src.length && src[j] !== c) { if (src[j] === '\\') j++; j++; }
            fuori += src.slice(i, j + 1); i = j + 1; continue;
        }
        fuori += c; i++;
    }
    return fuori;
};

const main = senzaCommenti(fs.readFileSync(path.join(radice, 'electron', 'main.cjs'), 'utf8'));
const mcp = senzaCommenti(fs.readFileSync(path.join(radice, 'electron', 'mcp-server.src.mjs'), 'utf8'));

for (const [nome, codice] of [['main.cjs', main], ['mcp-server.src.mjs', mcp]]) {
    dice(`${nome}: non usa PORTABLE_EXECUTABLE_DIR`, false, codice.includes('PORTABLE_EXECUTABLE_DIR'));
    dice(`${nome}: non sposta le cartelle di Electron (setPath)`, null, (codice.match(/\bsetPath\s*\(/) || [null])[0]);
    dice(`${nome}: non cambia la cartella dei dati di Chromium (user-data-dir)`, false, /user-data-dir/i.test(codice));
    dice(`${nome}: non costruisce percorsi dalla cartella dell'exe (process.execPath)`, false, codice.includes('process.execPath'));
}

// ITALIANO: ogni app.getPath(...) chiede solo 'userData' (niente 'exe', 'appData', 'home'...).
// ENGLISH: every app.getPath(...) asks for 'userData' only (no 'exe', 'appData', 'home'...).
{
    const richieste = [...main.matchAll(/\bgetPath\s*\(\s*([^)]*)\)/g)].map((m) => m[1].trim());
    dice('main.cjs: chiede almeno una volta la cartella userData', true, richieste.length > 0);
    dice('main.cjs: ogni app.getPath chiede solo \'userData\'', [], richieste.filter((r) => r !== '\'userData\''));
    for (const file of ['secrets.json', 'mcp.json', 'ui-lang.json']) {
        const righe = main.split('\n').filter((r) => r.includes(`'${file}'`));
        dice(`main.cjs: ${file} si costruisce con path.join(app.getPath('userData'), '${file}')`, true,
            righe.length > 0 && righe.every((r) => r.includes(`path.join(app.getPath('userData'), '${file}')`)));
    }
}

// ITALIANO: il server MCP cambia i tag solo in memoria: nessuna scrittura su disco.
// ENGLISH: the MCP server changes tags in memory only: no write to disk.
dice('mcp-server.src.mjs: nessuna scrittura su disco', null,
    (mcp.match(/\b(writeFile|appendFile|mkdir|createWriteStream|rename|copyFile|unlink|rmSync|rm)(Sync)?\s*\(/) || [null])[0]);

// ITALIANO: main.cjs vero, caricato come lo avvia l'exe portable (con PORTABLE_EXECUTABLE_DIR):
//           il finto `app` del banco non ha setPath, quindi un tentativo di spostare userData fa
//           fallire il caricamento; e nella cartella finta non deve comparire niente.
// ENGLISH: the real main.cjs, loaded the way the portable exe starts it (with
//          PORTABLE_EXECUTABLE_DIR): the bench's fake `app` has no setPath, so an attempt to move
//          userData makes loading fail; and nothing must appear in the fake folder.
{
    const cartellaExe = fs.mkdtempSync(path.join(os.tmpdir(), 'itm-test-portable-'));
    process.env.PORTABLE_EXECUTABLE_DIR = cartellaExe;
    let errore = null;
    try { caricaMain(); } catch (e) { errore = String(e && e.message || e); }
    dice('main.cjs si carica con PORTABLE_EXECUTABLE_DIR impostata (nessun setPath)', null, errore);
    dice('nella cartella dell\'exe portable non compare nessun file', [], fs.readdirSync(cartellaExe));
    delete process.env.PORTABLE_EXECUTABLE_DIR;
    fs.rmSync(cartellaExe, { recursive: true, force: true });
}

process.exit(esito());
