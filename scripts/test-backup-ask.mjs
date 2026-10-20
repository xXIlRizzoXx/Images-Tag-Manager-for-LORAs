/* ITALIANO: PROVA: IL BACKUP ANTI-CRASH SI APPLICA SOLO SE L'UTENTE LO VUOLE
   Riaprendo una cartella con modifiche non salvate rimaste da una sessione interrotta, il backup
   anti-crash si applicava senza chiedere niente: l'utente scopriva dopo, da un avviso, che delle foto
   avevano tag diversi dal .txt. Ora il riepilogo dell'importazione lo dice prima (quante foto, di
   quando) con una casella "Recupera dalla copia di sicurezza locale...", spuntata di serie: con la
   spunta le modifiche tornano come prima, senza spunta l'import prende i .txt cosi' come sono.
   Si eseguono calculateImportSummary, confermaImport e processImportData VERI di src/App.tsx (vedi
   import-harness.mjs), con un localStorage finto.
   Uso:  node scripts/test-backup-ask.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST: THE CRASH BACKUP IS APPLIED ONLY WHEN THE USER WANTS IT
   Reopening a folder with unsaved edits left from an interrupted session, the crash backup was applied
   without asking: the user found out afterwards, from a notice, that some photos had tags different
   from the .txt. Now the import summary says it first (how many photos, from when) with a "Recover
   this folder's unsaved changes from the local backup" checkbox, ticked by default: ticked the edits
   come back as before, unticked the import takes the .txt files as they are.
   The REAL calculateImportSummary, confermaImport and processImportData of src/App.tsx run (see
   import-harness.mjs), with a fake localStorage.
   Usage:  node scripts/test-backup-ask.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { creaApp, cartella, riepilogo } from './import-harness.mjs';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const carica = async (rel) => import('data:text/javascript;base64,' + Buffer.from((await esbuild.build({
    entryPoints: [path.join(radice, rel)], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
})).outputFiles[0].text).toString('base64'));
const B = await carica('src/utils/tagBackup.ts');
const S = await carica('src/utils/sidecarTags.ts');
const { dice, esito } = creaControlli();
const NOMI = ['a.png', 'b.png', 'c.png'];

// ITALIANO: la sessione interrotta: si apre la cartella, si aggiunge un tag a b.png, e il backup si scrive.
// ENGLISH: the interrupted session: the folder is opened, a tag is added to b.png, and the backup is written.
const h = cartella('disco1', 'ds');
const prima = creaApp();
await prima.conferma(riepilogo(h, NOMI));
const modificate = prima.images.map(i => i.file.name === 'b.png' ? { ...i, tags: [...i.tags, 'nuovo'] } : i);
const costruito = B.costruisciBackup(modificate, [], 'ds');
const backup = costruito ? JSON.stringify({ ts: Date.UTC(2026, 9, 18, 10, 30), ...costruito }) : null;
dice('premessa: il backup della sessione interrotta esiste', true, backup !== null);

console.log('\n--- il riepilogo dice prima che c\'e\' qualcosa da recuperare ---');
const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const inizio = sorgente.indexOf('    const calculateImportSummary = (');
const fine = /\r?\n    \};\r?\n/g; fine.lastIndex = inizio;
const corpo = fine.exec(sorgente);
if (inizio < 0 || !corpo) { console.log('NO  calculateImportSummary non trovata'); process.exit(1); }
const codice = (await esbuild.transform(sorgente.slice(inizio, corpo.index + corpo[0].length), { loader: 'ts' })).code;
const riepilogoCon = (salvato, d) => {
    let stato = null;
    new Function('makeFolderKeyer', 'setImportSummary', 'recuperoDellImport', 'localStorage', codice + '\nreturn calculateImportSummary;')(
        S.makeFolderKeyer, (v) => { stato = v; }, B.recuperoDellImport, { getItem: (k) => (k === 'tagBackup' ? salvato : null) },
    )(d.imgFiles, d.txtFiles, d.handle, d.folderOf, d.relPathOf, d.pathOf, d.cartellaRelOf);
    return stato && stato.summary;
};
dice('con un backup per questa cartella il riepilogo lo annuncia (foto e data)', { n: 1, ts: Date.UTC(2026, 9, 18, 10, 30) },
    (riepilogoCon(backup, riepilogo(h, NOMI)) || {}).recupero || null);
dice('senza backup niente casella', null, (riepilogoCon(null, riepilogo(h, NOMI)) || {}).recupero || null);
dice('backup di un\'altra cartella (impronta diversa): niente casella', null, (riepilogoCon(backup, riepilogo(cartella('disco2', 'altra'), NOMI)) || {}).recupero || null);

console.log('\n--- la finestra del riepilogo mostra la casella ---');
{
    // ITALIANO: react-dom/server usa require: il pacchetto va in un file .cjs temporaneo, poi si toglie.
    // ENGLISH: react-dom/server uses require: the bundle goes to a temporary .cjs file, removed afterwards.
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'itm-backup-ask-'));
    const uscita = path.join(temp, 'finestra.cjs');
    await esbuild.build({ stdin: { contents: "export { ImportSummaryDialog } from './src/components/ui.tsx'; export { renderToStaticMarkup } from 'react-dom/server'; export { createElement } from 'react'; export { translations } from './src/constants.ts';", resolveDir: radice, loader: 'ts' },
        bundle: true, format: 'cjs', platform: 'node', outfile: uscita, logLevel: 'silent', jsx: 'automatic' });
    const M = createRequire(import.meta.url)(uscita);
    fs.rmSync(temp, { recursive: true, force: true });
    const t = M.translations.it;
    const html = (recupero) => M.renderToStaticMarkup(M.createElement(M.ImportSummaryDialog, { isOpen: true, t, lang: 'it', isDarkMode: true, onConfirm() { }, onCancel() { },
        summary: { imagesCount: 3, textFilesCount: 0, imagesWithText: 0, imagesWithoutText: 3, recupero } }));
    const con = html({ n: 1, ts: Date.UTC(2026, 9, 18, 10, 30) });
    dice('con qualcosa da recuperare: la casella c\'e\' ed e\' spuntata', [true, true], [con.includes(t.importRecoverBackup.replace(/'/g, '&#x27;')), /type="checkbox"[^>]*checked/.test(con)]);
    dice('...con il numero di foto e la data', [true, true], [con.includes(t.importRecoverBackupPhotos.replace('{n}', '1')), con.includes(t.importRecoverBackupDate.split('{data}')[0])]);
    dice('senza niente da recuperare: nessuna casella', false, html(null).includes('type="checkbox"'));
}

console.log('\n--- "Importa" con la casella spuntata: le modifiche tornano (come prima) ---');
{
    const app = creaApp({ backup });
    await app.conferma(riepilogo(h, NOMI), true);
    dice('b.png torna con il tag non salvato', ['nuovo'], (app.images.find(i => i.file.name === 'b.png') || {}).tags);
    dice('l\'avviso conta la foto recuperata', true, app.notifiche.some(([m]) => String(m).includes('1')));
}
console.log('\n--- "Importa" senza spunta: si prendono i .txt cosi\' come sono ---');
{
    const app = creaApp({ backup });
    await app.conferma(riepilogo(h, NOMI), false);
    dice('b.png resta come sul disco', [], (app.images.find(i => i.file.name === 'b.png') || {}).tags);
    dice('nessuna foto da salvare', [], app.images.filter(i => JSON.stringify(i.tags) !== JSON.stringify(i.originalTags)).map(i => i.file.name));
}
console.log('\n--- senza dire niente (vecchi chiamanti): come prima, il backup si applica ---');
{
    const app = creaApp({ backup });
    await app.conferma(riepilogo(h, NOMI));
    dice('b.png torna con il tag non salvato', ['nuovo'], (app.images.find(i => i.file.name === 'b.png') || {}).tags);
}

process.exit(esito());
