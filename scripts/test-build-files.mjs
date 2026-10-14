/* ITALIANO: PROVA DI QUALI FILE FINISCONO DENTRO IL PROGRAMMA PUBBLICATO (app.asar)
   build.files diceva "electron/**" (tutto): electron-builder copiava nell'installer e nel portable OGNI
   file della cartella electron, anche quelli che git non segue (appunti privati come un CLAUDE.md
   nascosto solo da .git/info/exclude). electron-builder non legge .gitignore, e le sue esclusioni
   predefinite non toccano i .md: chiunque poteva estrarli dall'.exe pubblico. La regola: della
   cartella electron si spediscono solo i file che servono, nessun .md finisce nel pacchetto, e
   ogni file che il programma carica (o che git segue in electron/ e public/) resta dentro.
   Si usa il filtro VERO di electron-builder (app-builder-lib, gia' installato) sul package.json
   VERO, con nomi di file finti: niente costruzione, niente rete, niente file creati.
   Uso:  node scripts/test-build-files.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF WHICH FILES END UP INSIDE THE PUBLISHED APP (app.asar)
   build.files said "electron/**" (everything): electron-builder copied into the installer and the portable
   EVERY file of the electron folder, even those git does not track (private notes such as a
   CLAUDE.md hidden only by .git/info/exclude). electron-builder does not read .gitignore, and its
   default exclusions do not cover .md files: anyone could extract them from the public .exe. The
   rule: from the electron folder only the needed files ship, no .md gets into the package, and
   every file the app loads (or that git tracks in electron/ and public/) stays in.
   The REAL electron-builder filter (app-builder-lib, already installed) runs on the REAL
   package.json with fake file names: no build, no network, no file created.
   Usage:  node scripts/test-build-files.mjs      (exits with code 1 if anything is off) */

import fs from 'node:fs';
import { createRequire } from 'node:module';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const leggi = (f) => fs.readFileSync(path.join(radice, f), 'utf8');
const richiedi = createRequire(path.join(radice, 'package.json'));

const pacchetto = JSON.parse(leggi('package.json'));
const { getMainFileMatchers } = richiedi('app-builder-lib/out/fileMatcher.js');

// ITALIANO: lo stesso filtro che electron-builder usa per copiare l'app nell'asar (Windows).
// ENGLISH: the same filter electron-builder uses to copy the app into the asar (Windows).
const finto = { info: { projectDir: radice, buildResourcesDir: 'build', isPrepackedAppAsar: false, config: pacchetto.build, debugLogger: { isEnabled: false } } };
const filtri = getMainFileMatchers(radice, path.join(radice, 'app'), (s) => s, pacchetto.build.win || {}, finto, path.join(radice, pacchetto.build.directories.output), false)
    .map((m) => m.createFilter());
const file = { isDirectory: () => false };
const spedito = (rel) => filtri.some((f) => f(path.join(radice, rel), file));

// ITALIANO: i file che il programma carica davvero: path.join(__dirname, ...) in main.cjs e gli
//           src di splash.html. Se uno restasse fuori, il programma pubblicato non partirebbe.
// ENGLISH: the files the app really loads: path.join(__dirname, ...) in main.cjs and the src of
//          splash.html. If one were left out, the published app would not start.
const caricati = new Set();
for (const m of leggi('electron/main.cjs').matchAll(/path\.join\(__dirname, '([^']+)'\)/g)) caricati.add(path.posix.normalize(`electron/${m[1]}`));
for (const m of leggi('electron/splash.html').matchAll(/src="([^"]+)"/g)) caricati.add(path.posix.normalize(`electron/${m[1]}`));
dice('premessa: trovati i file caricati da main.cjs e splash.html (almeno 6)', true, caricati.size >= 6);
for (const rel of caricati) dice(`il programma carica ${rel}: e' nel pacchetto`, true, spedito(rel));

// ITALIANO: ogni file che git segue in electron/ e public/ deve restare nel pacchetto.
// ENGLISH: every file git tracks in electron/ and public/ must stay in the package.
const seguiti = execFileSync('git', ['ls-files', 'electron', 'public'], { cwd: radice, encoding: 'utf8' }).split('\n').map((s) => s.trim()).filter(Boolean);
dice('premessa: git segue almeno 4 file in electron/', true, seguiti.filter((s) => s.startsWith('electron/')).length >= 4);
for (const rel of seguiti) dice(`${rel} (seguito da git) e' nel pacchetto`, true, spedito(rel));
dice('dist/index.html e\' nel pacchetto', true, spedito('dist/index.html'));
dice('dist/assets/index.js e\' nel pacchetto', true, spedito('dist/assets/index.js'));

// ITALIANO: appunti privati o file estranei lasciati nelle cartelle spedite restano fuori.
// ENGLISH: private notes or stray files left in the shipped folders stay out.
for (const rel of ['electron/CLAUDE.md', 'electron/NOTES.md', 'electron/appunti.txt', 'public/CLAUDE.md', 'dist/CLAUDE.md']) {
    dice(`${rel} resta fuori dal pacchetto`, false, spedito(rel));
}

// ITALIANO: make-readme-shots copia foto VERE e i loro .txt in public/__shots, e vite le ricopia in
//           dist/__shots. Se il giro si interrompe (Ctrl+C, console chiusa) la cartella resta: non
//           deve finire ne' nel pacchetto pubblico ne' in git.
// ENGLISH: make-readme-shots copies REAL photos and their .txt files into public/__shots, and vite
//          copies them again into dist/__shots. If the run is interrupted (Ctrl+C, console closed)
//          the folder stays: it must end up neither in the public package nor in git.
for (const rel of ['public/__shots/0001.png', 'public/__shots/0001.txt', 'public/__shots/sotto/0002.jpg', 'dist/__shots/0001.png', 'dist/__shots/0001.txt']) {
    dice(`${rel} (foto vere di make-readme-shots) resta fuori dal pacchetto`, false, spedito(rel));
}
const ignorato = (rel) => spawnSync('git', ['check-ignore', '-q', '--no-index', rel], { cwd: radice }).status === 0;
dice('premessa: git check-ignore riconosce un file ignorato (dist/index.html)', true, ignorato('dist/index.html'));
dice('premessa: git check-ignore non ignora public/logo.png', false, ignorato('public/logo.png'));
for (const rel of ['public/__shots/0001.png', 'public/__shots/0001.txt']) dice(`${rel} e' ignorato da git`, true, ignorato(rel));

process.exit(esito());
