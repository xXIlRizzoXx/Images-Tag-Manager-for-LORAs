/* ITALIANO: PROVA DEL MESSAGGIO QUANDO L'ESPORTAZIONE DEI TAG DEL PROGETTO NON RIESCE A SCRIVERE
   Pannello dei tag del progetto -> Esporta -> un file che non si puo' scrivere (sola lettura,
   aperto da un altro programma, disco pieno): il programma diceva "Impossibile leggere il file dei
   tag", una frase sulla LETTURA di un file da importare, mentre si stava SCRIVENDO un'esportazione.
   Si esegue il testo VERO di handleExportProjectTags preso da src/App.tsx (compilato con esbuild),
   con i testi veri di src/constants.ts e una finestra di salvataggio finta.
   Uso:  node scripts/test-project-tags-export-error.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE MESSAGE WHEN THE PROJECT TAGS EXPORT CANNOT WRITE
   Project tags panel -> Export -> a file that cannot be written (read-only, open in another
   program, disk full): the app said "Could not read the tags file", a sentence about READING a file
   to import, while an export was being WRITTEN.
   The REAL text of handleExportProjectTags taken from src/App.tsx is run (compiled with esbuild),
   with the real strings of src/constants.ts and a fake save dialog.
   Usage:  node scripts/test-project-tags-export-error.mjs      (exits with code 1 if anything is off) */

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
const lingue = (await import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'))).translations;
const t = lingue.en;
const { dice, esito } = creaControlli();

// ITALIANO: il gestore vero, ritagliato dal sorgente fino alla sua riga di chiusura.
// ENGLISH: the real handler, cut out of the source up to its closing line.
const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const inizio = sorgente.indexOf('    const handleExportProjectTags = async () => {');
const chiusura = /\r?\n    \};\r?\n/g;
chiusura.lastIndex = Math.max(inizio, 0);
const fine = inizio < 0 ? null : chiusura.exec(sorgente);
if (inizio < 0 || !fine) {
    console.log('NO  handleExportProjectTags non trovato in src/App.tsx');
    process.exit(1);
}
const js = (await esbuild.transform(sorgente.slice(inizio, fine.index + fine[0].length), { loader: 'ts' })).code;
const fabbrica = new Function('globalTriggers', 'allUniqueTags', 't', 'showNotification', 'soundManager', 'downloadTextFile', 'console', 'window',
    js + '\nreturn handleExportProjectTags;');

// ITALIANO: `guasto` = il nome dell'errore che la scrittura restituisce (null = va tutto bene).
// ENGLISH: `guasto` = the name of the error the write gives back (null = all fine).
const prova = async (guasto, doveGuasto = 'write') => {
    const notifiche = [];
    const errore = () => Object.assign(new Error('fake'), { name: guasto });
    const finestra = {
        showSaveFilePicker: async () => {
            if (guasto && doveGuasto === 'picker') throw errore();
            return {
                name: 'project-tags.json',
                createWritable: async () => ({
                    write: async () => { if (guasto && doveGuasto === 'write') throw errore(); },
                    close: async () => { },
                }),
            };
        },
    };
    const fn = fabbrica(['mychar'], ['mychar', '1girl'], t, (m, tipo) => notifiche.push([m, tipo]),
        { chime() { } }, () => { throw new Error('the download fallback must not run here'); }, { error() { } }, finestra);
    await fn();
    return notifiche;
};

console.log('\n--- la scrittura del file non riesce ---');
for (const nome of ['NotAllowedError', 'NoModificationAllowedError', 'QuotaExceededError']) {
    const n = await prova(nome);
    dice(`${nome}: si dice che il file non si e' potuto salvare`, [[t.tagEditorSaveError, 'error']], n);
}
dice('nelle nove lingue la frase di salvataggio esiste ed e\' diversa da quella di lettura', [],
    ['it', 'en', 'fr', 'es', 'de', 'zh', 'ja', 'pt', 'ru'].filter(l => !lingue[l]
        || typeof lingue[l].tagEditorSaveError !== 'string' || lingue[l].tagEditorSaveError === ''
        || lingue[l].tagEditorSaveError === lingue[l].importTagsError));

console.log('\n--- quello che NON deve cambiare ---');
dice('tutto bene: "tag esportati"', [[t.projectTagsExported, 'success']], await prova(null));
dice('finestra di salvataggio chiusa senza scegliere: nessun messaggio', [], await prova('AbortError', 'picker'));

process.exit(esito());
