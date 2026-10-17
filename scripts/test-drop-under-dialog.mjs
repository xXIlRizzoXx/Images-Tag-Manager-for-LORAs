/* ITALIANO: PROVA DEL TRASCINAMENTO DI FOTO CON L'EDITOR DEI FILE DI TAG O LA FINESTRA DELLA API KEY APERTI
   Con l'editor dei file di tag (z 320) o la finestra della API key (z 400) aperti, delle foto
   trascinate sulla finestra venivano accettate, ma il riepilogo dell'importazione (z 300) si apriva
   SOTTO: non si vedeva niente, un secondo rilascio sostituiva in silenzio l'importazione in attesa,
   e la domanda compariva solo chiudendo l'altra finestra. La regola: con una di quelle due finestre
   aperta il rilascio non avvia l'importazione e un messaggio (sopra tutto) dice di chiuderla prima.
   Si esegue il testo VERO di handleDroppedFiles preso da src/App.tsx.
   Uso:  node scripts/test-drop-under-dialog.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF DROPPING PHOTOS WITH THE TAG FILE EDITOR OR THE API KEY DIALOG OPEN
   With the Tag file editor (z 320) or the API key dialog (z 400) open, photos dropped on the window
   were accepted, but the import summary (z 300) opened UNDER it: nothing could be seen, a second
   drop silently replaced the pending import, and the question only appeared once the other window
   was closed. The rule: with one of those two windows open the drop does not start the import and
   a message (above everything) says to close it first.
   The REAL text of handleDroppedFiles taken from src/App.tsx is run.
   Usage:  node scripts/test-drop-under-dialog.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const lingue = (await import('data:text/javascript;base64,' + Buffer.from((await esbuild.build({
    entryPoints: [path.join(radice, 'src/constants.ts')], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
})).outputFiles[0].text).toString('base64'))).translations;
const t = lingue.en;
const { fileDiMac } = await import('data:text/javascript;base64,' + Buffer.from((await esbuild.build({
    entryPoints: [path.join(radice, 'src/utils/folderScan.ts')], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
})).outputFiles[0].text).toString('base64'));

const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const inizio = sorgente.indexOf('    const handleDroppedFiles = useCallback(');
const chiusura = /\r?\n    \}, \[([^\]]*)\]\);\r?\n/g;
chiusura.lastIndex = Math.max(inizio, 0);
const fine = inizio < 0 ? null : chiusura.exec(sorgente);
if (!fine) { console.log('NO  handleDroppedFiles non trovato in src/App.tsx'); process.exit(1); }
const codice = (await esbuild.transform(sorgente.slice(inizio, fine.index + fine[0].length), { loader: 'ts' })).code;

const trascina = async ({ editor = false, chiave = false, aiuto = null, chiusura = false } = {}) => {
    const r = { notifiche: [], riepiloghi: 0 };
    const f = new Function('useCallback', 'showNotification', 't', 'loadSidecarTxtFiles', 'calculateImportSummary', 'isTagEditorOpen', 'isApiKeyDialogOpen',
        'fileDiMac', 'aiuto', 'saveCloseDialog', codice + '\nreturn handleDroppedFiles;')(
        (fn) => fn, (m, tipo) => r.notifiche.push([m, tipo]), t, async () => ({ txtFiles: [], folderOf: null }),
        () => { r.riepiloghi++; }, editor, chiave, fileDiMac, aiuto, { isOpen: chiusura, isSaving: false });
    await f([{ name: 'a.png', type: 'image/png' }, { name: 'a.txt', type: 'text/plain' }]);
    return r;
};

console.log('\n--- foto trascinate con l\'editor dei file di tag aperto ---');
{
    const r = await trascina({ editor: true });
    dice('il riepilogo dell\'importazione non si apre (starebbe sotto l\'editor)', 0, r.riepiloghi);
    dice('...e un messaggio dice di chiudere prima l\'editor', [[t.dropCloseWindowFirst, 'info']], r.notifiche);
}

console.log('\n--- foto trascinate con la finestra della API key aperta ---');
{
    const r = await trascina({ chiave: true });
    dice('il riepilogo non si apre, e lo si dice', [0, [[t.dropCloseWindowFirst, 'info']]], [r.riepiloghi, r.notifiche]);
}

// ITALIANO: la spiegazione «?» delle Impostazioni (z 450) e «Salvare prima di chiudere?» (z 500)
//           stanno anche loro sopra al riepilogo (z 300).
// ENGLISH: the Settings "?" explanation (z 450) and "Save before closing?" (z 500) also sit above
//          the summary (z 300).
console.log('\n--- foto trascinate con la spiegazione «?» delle Impostazioni aperta ---');
{
    const r = await trascina({ aiuto: 'mcp' });
    dice('il riepilogo non si apre, e lo si dice', [0, [[t.dropCloseWindowFirst, 'info']]], [r.riepiloghi, r.notifiche]);
}

console.log('\n--- foto trascinate con «Salvare prima di chiudere?» aperta ---');
{
    const r = await trascina({ chiusura: true });
    dice('il riepilogo non si apre, e lo si dice', [0, [[t.dropCloseWindowFirst, 'info']]], [r.riepiloghi, r.notifiche]);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const r = await trascina();
    dice('nessuna di quelle finestre aperta: si apre il riepilogo come sempre', [1, []], [r.riepiloghi, r.notifiche]);
    // ITALIANO: useCallback deve rifarsi quando le due finestre si aprono o si chiudono, o il
    //           gestore vedrebbe sempre il valore del primo disegno.
    // ENGLISH: useCallback must be rebuilt when the two windows open or close, or the handler would
    //          always see the value of the first render.
    const dip = fine[1].split(',').map(s => s.trim());
    dice('handleDroppedFiles dipende da isTagEditorOpen e isApiKeyDialogOpen', [true, true], [dip.includes('isTagEditorOpen'), dip.includes('isApiKeyDialogOpen')]);
    dice('...e anche da aiuto e saveCloseDialog.isOpen', [true, true], [dip.includes('aiuto'), dip.includes('saveCloseDialog.isOpen')]);
}

console.log('\n--- la frase nelle nove lingue ---');
for (const l of ['it', 'en', 'fr', 'es', 'de', 'zh', 'ja', 'pt', 'ru']) {
    dice(l + ': dropCloseWindowFirst presente', true, typeof lingue[l].dropCloseWindowFirst === 'string' && lingue[l].dropCloseWindowFirst.trim().length > 0);
}

process.exit(esito());
