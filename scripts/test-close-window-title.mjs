/* ITALIANO: PROVA DI DUE RITOCCHI VISTI DAL VIVO IL 15/10/2026
   1. Alla X della finestra, con modifiche non salvate, la finestra a tre scelte diceva "Chiudere il
      progetto attuale?": si sta chiudendo il PROGRAMMA. Ora titolo e testo lo dicono, e dal tasto
      "Chiudi progetto" resta la frase del progetto.
   2. La scritta "Versione" in fondo alle Impostazioni aveva pochissimo contrasto (grigio 500 su
      fondo scuro, grigio 400 su bianco): ora grigio 400 sul fondo scuro e 600 sul chiaro.
   Si legge src/App.tsx e si caricano i testi veri delle 9 lingue.
   Uso:  node scripts/test-close-window-title.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF TWO TOUCHES SEEN LIVE ON 15/10/2026
   1. At the window's X, with unsaved changes, the three-choice dialog said "Close the current
      project?": the PROGRAM is closing. Title and text now say so, and from the "Close project"
      button the project sentence stays.
   2. The "Version" line at the bottom of Settings had very little contrast: now gray 400 on the
      dark background and 600 on the light one. */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const lingue = (await import('data:text/javascript;base64,' + Buffer.from((await esbuild.build({
    entryPoints: [path.join(radice, 'src/constants.ts')], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
})).outputFiles[0].text).toString('base64'))).translations;

console.log('\n--- la finestra a tre scelte ---');
const i = sorgente.indexOf('<SaveBeforeCloseDialog');
const blocco = i < 0 ? '' : sorgente.slice(i, sorgente.indexOf('/>', i));
dice('dalla X della finestra il titolo parla del programma', true, /title=\{chiusuraFinestraRef\.current \? t\.closeAppTitle : t\.closeAllTitle\}/.test(blocco));
dice('e anche il testo', true, /message=\{chiusuraFinestraRef\.current \? t\.closeAppUnsavedMsg : t\.closeAllUnsavedMsg\}/.test(blocco));
dice('la X della finestra accende chiusuraFinestraRef prima di aprire la finestra', true,
    /chiusuraFinestraRef\.current = true;[\s\S]{0,700}setSaveCloseDialog\(\{ isOpen: true, isSaving: false \}\)/.test(sorgente));
dice('le due frasi nuove esistono in tutte e 9 le lingue', [], Object.keys(lingue).filter(l => !lingue[l].closeAppTitle || !lingue[l].closeAppUnsavedMsg));
dice('in italiano e in inglese nominano il programma', [true, true],
    [/programma/.test(lingue.it.closeAppTitle + lingue.it.closeAppUnsavedMsg), /program/.test(lingue.en.closeAppTitle + lingue.en.closeAppUnsavedMsg)]);

console.log('\n--- la scritta della versione ---');
const v = /<span className=\{`text-\[10px\] \$\{isDarkMode \? '([a-z0-9-]+)' : '([a-z0-9-]+)'\}[^`]*`\}>\{t\.versionLabel\} \{appVersion\}<\/span>/.exec(sorgente);
dice('grigio 400 sul fondo scuro, 600 sul chiaro', ['text-gray-400', 'text-gray-600'], v ? [v[1], v[2]] : null);

process.exit(esito());
