/* ITALIANO: PROVA DEL RIPIEGO DI "Carica cartella" SU UNA CARTELLA SENZA IMMAGINI
   Dove il selettore di cartelle non c'e' o e' bloccato (il browser di prova, dove si provano le
   modifiche) "Carica cartella" passa per un campo di scelta nascosto. Scegliendo li' una cartella
   senza immagini non succedeva niente: nessun "Nessuna immagine importata.", al contrario delle
   altre strade, e il campo non si liberava, quindi riscegliendo la stessa cartella il browser
   non avvisava piu' il programma.
   Si esegue il testo VERO di handleFolderUploadFallback preso da src/App.tsx (compilato con
   esbuild), con i testi veri di src/constants.ts e file finti in memoria.
   Uso:  node scripts/test-folder-fallback-empty.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE "Load folder" FALLBACK ON A FOLDER WITH NO IMAGES
   Where the folder picker is missing or blocked (the test browser, where changes are tried out)
   "Load folder" goes through a hidden file input. Picking a folder with no images there did
   nothing: no "No images imported.", unlike the other roads, and the input was not freed, so
   picking the same folder again no longer reached the program at all.
   The REAL text of handleFolderUploadFallback taken from src/App.tsx is run (compiled with
   esbuild), with the real strings of src/constants.ts and fake in-memory files.
   Usage:  node scripts/test-folder-fallback-empty.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const uscita = await esbuild.build({
    entryPoints: [path.join(radice, 'src/constants.ts')],
    bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
});
const t = (await import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'))).translations.en;
const { dice, esito } = creaControlli();

// ITALIANO: il gestore vero, ritagliato dal sorgente fino alla sua riga di chiusura.
// ENGLISH: the real handler, cut out of the source up to its closing line.
const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const inizio = sorgente.indexOf('    const handleFolderUploadFallback = async (e: any) => {');
const chiusura = /\r?\n    \};\r?\n/g;
chiusura.lastIndex = Math.max(inizio, 0);
const fine = inizio < 0 ? null : chiusura.exec(sorgente);
if (inizio < 0 || !fine) {
    console.log('NO  handleFolderUploadFallback non trovato in src/App.tsx');
    process.exit(1);
}
const js = (await esbuild.transform(sorgente.slice(inizio, fine.index + fine[0].length), { loader: 'ts' })).code;
const { fileDiMac } = await import('data:text/javascript;base64,' + Buffer.from((await esbuild.build({
    entryPoints: [path.join(radice, 'src/utils/folderScan.ts')], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
})).outputFiles[0].text).toString('base64'));
const fabbricaVera = new Function('t', 'showNotification', 'calculateImportSummary', 'folderInputRef', 'fileDiMac',
    js + '\nreturn handleFolderUploadFallback;');
const fabbrica = (...a) => fabbricaVera(...a, fileDiMac);

const prova = async (nomi) => {
    const r = { notifiche: [], riepiloghi: 0 };
    const campo = { value: 'C:\\fakepath\\scelta' };
    const fn = fabbrica(t, (m, tipo) => r.notifiche.push([m, tipo]), () => { r.riepiloghi++; }, { current: campo });
    const files = nomi.map(([name, type]) => ({ name, type, webkitRelativePath: 'scelta/' + name }));
    await fn({ target: { files } });
    return { ...r, valore: campo.value };
};

console.log('\n--- una cartella senza immagini ---');
{
    const r = await prova([['a.txt', 'text/plain'], ['note.pdf', 'application/pdf']]);
    dice('si dice "No images imported."', [[t.noImagesTitle, 'info']], r.notifiche);
    dice('nessun riepilogo di import', 0, r.riepiloghi);
    dice('il campo si libera per la scelta successiva', '', r.valore);
}

console.log('\n--- una cartella con un\'immagine (NON deve cambiare) ---');
{
    const r = await prova([['a.jpg', 'image/jpeg'], ['a.txt', 'text/plain']]);
    dice('si apre il riepilogo di import', 1, r.riepiloghi);
    dice('nessun messaggio', [], r.notifiche);
}

process.exit(esito());
