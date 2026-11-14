/* ITALIANO: PROVA DEL CAMPO DI «CARICA IMMAGINI» LIBERATO ANCHE QUANDO NON C'E' NESSUNA IMMAGINE
   Nella finestra di Windows si puo' passare a «Tutti i file» e scegliere un .txt, un .psd o solo
   file nascosti del Mac («._a.jpg»). Il programma avvisa che non ci sono immagini, ma usciva senza
   liberare il campo: riscegliendo gli stessi file il browser non manda piu' l'evento change e il
   pulsante sembra rotto. Si esegue il testo VERO di handleImagesUpload preso da src/App.tsx.
   Uso:  node scripts/test-images-input-reset.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE "LOAD IMAGES" FIELD CLEARED EVEN WHEN THERE IS NO IMAGE
   The Windows dialog can switch to "All files" and pick a .txt, a .psd or only Mac hidden files
   ("._a.jpg"). The program says there are no images, but it returned without clearing the field:
   picking the same files again, the browser sends no change event and the button looks broken.
   The REAL text of handleImagesUpload taken from src/App.tsx is run.
   Usage:  node scripts/test-images-input-reset.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const carica = async (rel) => {
    const uscita = await esbuild.build({ entryPoints: [path.join(radice, rel)], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
    return import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));
};
const FS = await carica('src/utils/folderScan.ts');
const IF = await carica('src/utils/imageFile.ts');
const t = (await carica('src/constants.ts')).translations.en;
const { dice, esito } = creaControlli();
console.warn = () => {};

const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const intestazione = '    const handleImagesUpload = async (e: any) => {';
const inizio = sorgente.indexOf(intestazione);
const chiusura = /\r?\n    \};\r?\n/g;
chiusura.lastIndex = Math.max(inizio, 0);
const fine = inizio < 0 ? null : chiusura.exec(sorgente);
if (!fine) { console.log('NO  non trovato in src/App.tsx: handleImagesUpload'); process.exit(1); }
const codice = (await esbuild.transform(sorgente.slice(inizio, fine.index + fine[0].length), { loader: 'ts' })).code;
const NOMI = ['t', 'showNotification', 'calculateImportSummary', 'imagesInputRef', 'loadSidecarTxtFiles', 'fileDiMac', 'eFileImmagine'];
const fabbrica = new Function(...NOMI, codice + '\nreturn handleImagesUpload;');

const file = (name, type) => ({ name, type, size: 10, lastModified: 1 });
const prova = async (scelti, opzioni = {}) => {
    const r = { notifiche: [], riepiloghi: 0, campo: { value: 'C:\\fakepath\\scelto' } };
    const fn = fabbrica(t, (m, tipo) => r.notifiche.push([m, tipo]),
        () => { r.riepiloghi++; if (opzioni.riepilogoRotto) throw new Error('riepilogo rotto'); },
        { current: r.campo }, async () => ({ txtFiles: [], folderOf: null }), FS.fileDiMac, IF.eFileImmagine);
    try { await fn({ target: { files: scelti } }); } catch { r.errore = true; }
    return r;
};

console.log('\n--- nessuna immagine fra i file scelti ---');
for (const [nome, scelti] of [
    ['un solo .txt', [file('note.txt', 'text/plain')]],
    ['solo file nascosti del Mac', [file('._a.jpg', 'image/jpeg')]],
    ['un .psd senza tipo', [file('a.psd', '')]],
]) {
    const r = await prova(scelti);
    dice(nome + ': compare l\'avviso «nessuna immagine»', [[t.noImagesTitle, 'info']], r.notifiche);
    dice(nome + ': il campo viene liberato (riscegliendo gli stessi file l\'evento riparte)', '', r.campo.value);
    dice(nome + ': nessun riepilogo', 0, r.riepiloghi);
}

console.log('\n--- casi vicini che non devono cambiare ---');
{
    const r = await prova([file('a.png', 'image/png'), file('a.txt', 'text/plain')]);
    dice('con un\'immagine si apre il riepilogo', 1, r.riepiloghi);
    dice('...nessun avviso', [], r.notifiche);
    dice('...e il campo viene liberato come prima', '', r.campo.value);
}
{
    const r = await prova([file('a.png', 'image/png')], { riepilogoRotto: true });
    dice('se il riepilogo lancia un errore il campo viene liberato lo stesso', '', r.campo.value);
}

process.exit(esito());
