/* ITALIANO: PROVA DEL TRASCINAMENTO DI UNA CARTELLA PROTETTA
   Trascinando sulla finestra una cartella protetta (C:\Windows, la cartella utente intera, i dati
   dei programmi) il processo principale la rifiuta e manda 'folder:restricted': compare il messaggio
   rosso folderProtected. Subito dopo la maniglia della cartella arriva vuota (rifiutata), nel
   rilascio non c'e' nessuna immagine, e handleDroppedFiles mostrava «Trascina immagini o una
   cartella» (dropOnlyImages) SOPRA il messaggio giusto: l'utente leggeva il motivo sbagliato.
   Ora, se una maniglia e' stata rifiutata e l'avviso della cartella protetta e' appena arrivato
   (anche un attimo dopo il rifiuto), resta a schermo il messaggio rosso.
   Si eseguono i testi VERI di apriCartellaTrascinata e handleDroppedFiles presi da src/App.tsx
   (come in scripts/test-drop-folder.mjs), con le regole vere di imageFile.ts e folderScan.ts.
   Uso:  node scripts/test-drop-protected-folder.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF DROPPING A PROTECTED FOLDER
   Dropping a protected folder on the window (C:\Windows, the whole user folder, the programs' data)
   the main process refuses it and sends 'folder:restricted': the red folderProtected message shows.
   Right after, the folder's handle arrives empty (refused), the drop holds no image, and
   handleDroppedFiles showed "Drag images or a folder" (dropOnlyImages) OVER the right message: the
   user read the wrong reason. Now, if a handle was refused and the protected-folder notice has just
   arrived (even a moment after the refusal), the red message stays on screen.
   The REAL text of apriCartellaTrascinata and handleDroppedFiles taken from src/App.tsx (as in
   scripts/test-drop-folder.mjs) is run, with the real rules of imageFile.ts and folderScan.ts.
   Usage:  node scripts/test-drop-protected-folder.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const carica = async (rel) => {
    const uscita = await esbuild.build({
        entryPoints: [path.join(radice, rel)],
        bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
    });
    return import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));
};
const t = (await carica('src/constants.ts')).translations.en;
const { scanDirectoryHandle, fileDiMac } = await carica('src/utils/folderScan.ts');
const { eFileImmagine } = await carica('src/utils/imageFile.ts');
const { dice, esito } = creaControlli();

const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const ritaglia = (da, a) => {
    const i = sorgente.indexOf(da);
    const j = i < 0 ? -1 : sorgente.indexOf(a, i);
    if (i < 0 || j < 0) { console.log('NO  non trovato in src/App.tsx: ' + da.trim()); process.exit(1); }
    return sorgente.slice(i, j);
};
const pezzoCartella = ritaglia('    const importaCartellaScelta = async (', '    const handleFolderUploadFallback');
const inizioDrop = sorgente.indexOf('    const apriCartellaTrascinata = async (');
const chiusura = /\r?\n    \}, \[([^\]]*)\]\);\r?\n/g;
chiusura.lastIndex = Math.max(inizioDrop, 0);
const fineDrop = inizioDrop < 0 ? null : chiusura.exec(sorgente);
if (!fineDrop) { console.log('NO  apriCartellaTrascinata / handleDroppedFiles non trovati'); process.exit(1); }
const js = (await esbuild.transform(pezzoCartella + sorgente.slice(inizioDrop, fineDrop.index + fineDrop[0].length), { loader: 'ts' })).code;
const fabbrica = new Function('window', 't', 'showNotification', 'calculateImportSummary', 'folderInputRef', 'scanDirectoryHandle',
    'useCallback', 'loadSidecarTxtFiles', 'isTagEditorOpen', 'isApiKeyDialogOpen', 'fileDiMac', 'aperturaCartellaRef', 'aiuto', 'saveCloseDialog', 'eFileImmagine',
    'cartellaProtettaOraRef',
    js + '\nreturn { handleDroppedFiles };');

// ITALIANO: l'app finta. `electron` = nella finestra del programma (con onFolderRestricted); `avviso` = il ref
//           che l'effetto di onFolderRestricted aggiorna all'arrivo di 'folder:restricted'.
// ENGLISH: the fake app. `electron` = in the program's window (with onFolderRestricted); `avviso` = the ref
//          the onFolderRestricted effect updates when 'folder:restricted' arrives.
const ambiente = ({ electron = true } = {}) => {
    const r = { notifiche: [], riepilogo: 0, avviso: { current: 0 } };
    const window = { electronAPI: electron ? { onFolderRestricted: () => () => { }, beginFolderPick: async () => { }, takePickedFolderPath: async () => '' } : undefined };
    r.cartellaProtetta = () => { r.avviso.current = Date.now(); r.notifiche.push([t.folderProtected, 'error']); };
    const fn = fabbrica(window, t, (m, tipo) => r.notifiche.push([m, tipo]), () => { r.riepilogo++; },
        { current: { click() { } } }, scanDirectoryHandle, (f) => f, async () => ({ txtFiles: [], folderOf: null }),
        false, false, fileDiMac, { current: false }, null, { isOpen: false }, eFileImmagine, r.avviso);
    return { r, ...fn };
};
const voceCartella = { name: 'Windows', type: '' };
const rifiutata = () => [Promise.reject(new DOMException('denied', 'NotAllowedError')).catch(() => null)];

console.log('\n--- C:\\Windows trascinata: l\'avviso arriva prima del rifiuto della maniglia ---');
{
    const { r, handleDroppedFiles } = ambiente();
    r.cartellaProtetta();
    await handleDroppedFiles([voceCartella], rifiutata());
    dice('resta solo il messaggio rosso della cartella protetta', [[t.folderProtected, 'error']], r.notifiche);
    dice('...e nessun import', 0, r.riepilogo);
}

console.log('\n--- l\'avviso arriva un attimo DOPO il rifiuto (l\'ordine dei due messaggi non e\' garantito) ---');
{
    const { r, handleDroppedFiles } = ambiente();
    setTimeout(() => r.cartellaProtetta(), 40);
    await handleDroppedFiles([voceCartella], rifiutata());
    dice('niente «Trascina immagini o una cartella» dopo il messaggio rosso', [[t.folderProtected, 'error']], r.notifiche);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const { r, handleDroppedFiles } = ambiente();
    await handleDroppedFiles([voceCartella], rifiutata());
    dice('maniglia rifiutata ma nessun avviso di cartella protetta: «Trascina immagini o una cartella»', [[t.dropOnlyImages, 'info']], r.notifiche);
}
{
    const { r, handleDroppedFiles } = ambiente();
    r.avviso.current = Date.now() - 60000;
    await handleDroppedFiles([voceCartella], rifiutata());
    dice('un avviso vecchio di un minuto non conta', [[t.dropOnlyImages, 'info']], r.notifiche);
}
{
    const { r, handleDroppedFiles } = ambiente();
    const prima = Date.now();
    await handleDroppedFiles([{ name: 'note.txt', type: 'text/plain' }], [Promise.resolve({ kind: 'file', name: 'note.txt' })]);
    dice('un .txt da solo: «Trascina immagini o una cartella», subito', [[[t.dropOnlyImages, 'info']], true], [r.notifiche, Date.now() - prima < 200]);
}
{
    const { r, handleDroppedFiles } = ambiente({ electron: false });
    const prima = Date.now();
    await handleDroppedFiles([voceCartella], [Promise.resolve(null)]);
    dice('nel browser (nessun avviso possibile): «Trascina immagini o una cartella», subito', [[[t.dropOnlyImages, 'info']], true], [r.notifiche, Date.now() - prima < 200]);
}
{
    const { r, handleDroppedFiles } = ambiente();
    r.cartellaProtetta();
    await handleDroppedFiles([{ name: 'a.png', type: 'image/png' }], [Promise.resolve({ kind: 'file', name: 'a.png' })]);
    dice('un\'immagine trascinata subito dopo si importa come sempre', 1, r.riepilogo);
}

console.log('\n--- l\'effetto di onFolderRestricted annota l\'ora dell\'avviso ---');
dice('App.tsx: il gestore di onFolderRestricted aggiorna cartellaProtettaOraRef e mostra folderProtected', true,
    /onFolderRestricted\?\.\(\(\) => \{ cartellaProtettaOraRef\.current = Date\.now\(\); showNotification\(t\.folderProtected, 'error'\); \}\)/.test(sorgente));

process.exit(esito());
