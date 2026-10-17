/* ITALIANO: PROVA DEL PERCORSO DELLE FOTO QUANDO SI APRE LA RADICE DI UN DISCO
   "Carica Cartella" (o la cartella trascinata) compone il percorso vero di ogni foto con la
   cartella che il processo principale restituisce. Per la radice di un disco quella cartella
   finisce con la barra ("D:\"), e la composizione dava "D:\\a.png": il Cestino di Windows rifiuta
   quel percorso (la foto finiva nella seconda conferma con cancellazione definitiva) e "Annulla lo
   svuotamento" non la ritrovava. La regola: la barra finale della cartella si toglie prima di
   comporre; le cartelle normali, le sottocartelle e le cartelle di rete restano come prima.
   Si esegue il testo VERO della composizione preso da importaCartellaScelta in src/App.tsx.
   Uso:  node scripts/test-folder-root-path.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE PHOTOS' PATH WHEN THE ROOT OF A DRIVE IS OPENED
   "Load Folder" (or the dropped folder) builds each photo's real path from the folder the main
   process returns. For a drive root that folder ends with the separator ("D:\"), and the result
   was "D:\\a.png": the Windows Recycle Bin refuses that path (the photo ended in the second
   confirmation with permanent deletion) and "Undo emptying" did not find it again. The rule: the
   folder's trailing separator is removed before joining; normal folders, subfolders and network
   folders stay as before.
   The REAL text of the joining code taken from importaCartellaScelta in src/App.tsx is run.
   Usage:  node scripts/test-folder-root-path.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const app = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8').replace(/\r\n/g, '\n');

// ITALIANO: il tratto da "const pathOf" alla fine del blocco "if (rootPath)", dentro importaCartellaScelta.
// ENGLISH: the stretch from "const pathOf" to the end of the "if (rootPath)" block, inside importaCartellaScelta.
const iFunz = app.indexOf('\n    const importaCartellaScelta =');
const i0 = iFunz < 0 ? -1 : app.indexOf('        const pathOf = new Map<any, string>();', iFunz);
const i1 = i0 < 0 ? -1 : app.indexOf('\n        }\n', i0);
if (i0 < 0 || i1 < 0) { console.log('NO  composizione del percorso non trovata in importaCartellaScelta'); process.exit(1); }
const testo = app.slice(i0, i1 + '\n        }\n'.length);
const js = (await esbuild.transform(testo + '\nreturn pathOf;', { loader: 'ts' })).code;
const componi = new Function('rootPath', 'imgFiles', 'txtFiles', 'relPathOf', js);

const B = String.fromCharCode(92);
const w = (...pezzi) => pezzi.join(B);
// ITALIANO: una foto finta: relPath come quello del lettore di cartelle ("<radice>/<sotto>/<nome>" senza il nome).
// ENGLISH: a fake photo: relPath like the folder reader's ("<root>/<sub>" without the name).
const percorso = (rootPath, rel, nome = 'a.png') => {
    const f = { name: nome };
    const m = componi(rootPath, [f], [], new Map([[f, rel]]));
    return m.get(f);
};

console.log('\n--- radice di un disco ("D:\\" con la barra finale) ---');
dice('foto alla radice', w('D:', 'a.png'), percorso('D:' + B, 'D:'));
dice('foto in una sottocartella', w('D:', 'sub', 'a.png'), percorso('D:' + B, 'D:/sub'));
dice('foto in due livelli di sottocartelle', w('D:', 'sub', 'x', 'a.png'), percorso('D:' + B, 'D:/sub/x'));
dice('radice di una condivisione di rete con la barra finale', w('', '', 'nas', 'share', 'a.png'), percorso(w('', '', 'nas', 'share', ''), 'share'));
dice('nessuna barra doppia dopo la lettera del disco', false, percorso('D:' + B, 'D:').includes(B + B));

console.log('\n--- quello che NON deve cambiare ---');
dice('cartella normale', w('D:', 'dataset', 'a.png'), percorso(w('D:', 'dataset'), 'dataset'));
dice('cartella normale, sottocartella', w('D:', 'dataset', '10_face', 'a.png'), percorso(w('D:', 'dataset'), 'dataset/10_face'));
dice('cartella di rete: le due barre iniziali restano', w('', '', 'nas', 'share', 'dataset', 'a.png'), percorso(w('', '', 'nas', 'share', 'dataset'), 'dataset'));
dice('percorso con le barre dritte', '/mnt/x/a.png', percorso('/mnt/x', 'x'));
dice('anche il .txt riceve il suo percorso', w('D:', 'a.txt'), (() => {
    const f = { name: 'a.txt' };
    return componi('D:' + B, [], [f], new Map([[f, 'D:']])).get(f);
})());
dice('senza percorso dal processo principale: nessun percorso', 0, componi('', [{ name: 'a.png' }], [], new Map()).size);

process.exit(esito());
