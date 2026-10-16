/* ITALIANO: PROVA DEL RIMEDIO NELL'AVVISO "IMPOSSIBILE LEGGERE LA FOTO" DELL'ESPORTAZIONE .zip
   Quando una foto del progetto non si legge piu' (ritoccata in un altro programma, spostata o
   cancellata dopo il caricamento), "Tag e immagini" si ferma e l'avviso la nomina. Il rimedio
   diceva "ricaricala e riprova": ma ricaricarla AGGIUNGE una seconda scheda con lo stesso nome, la
   vecchia resta attiva e illeggibile, e l'esportazione fallisce di nuovo con lo stesso avviso.
   Il rimedio vero e' togliere dal progetto la scheda vecchia con la X della scheda ("Chiudi
   immagine"), che non tocca il disco. Non con "Sposta nel Cestino": svuotando il cestino il file
   VERO sul disco (la versione ritoccata, quella buona) finirebbe nel Cestino di Windows.
   La regola: in tutte e nove le lingue l'avviso nomina la foto e il comando "Chiudi immagine" con
   la sua etichetta vera, e non manda nel cestino. Si leggono i testi VERI di src/constants.ts e
   il codice VERO della X in src/App.tsx.
   Uso:  node scripts/test-zip-unreadable-remedy.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE REMEDY IN THE .zip EXPORT NOTICE "COULD NOT READ THE PHOTO"
   When a project photo can no longer be read (retouched in another program, moved or deleted
   after loading), "Tags and images" stops and the notice names it. The remedy said "load it again
   and retry": but loading it again ADDS a second card with the same name, the old one stays active
   and unreadable, and the export fails again with the same notice.
   The real remedy is to take the old card out of the project with the card's X ("Close image"),
   which does not touch the disk. Not with "Move to Trash": emptying the trash would send the REAL
   file on disk (the retouched version, the good one) to the Windows Recycle Bin.
   The rule: in all nine languages the notice names the photo and the "Close image" command by its
   real label, and does not send to the trash. The REAL strings of src/constants.ts and the REAL
   code of the X in src/App.tsx are read.
   Usage:  node scripts/test-zip-unreadable-remedy.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();

const uscita = await esbuild.build({
    entryPoints: [path.join(radice, 'src/constants.ts')],
    bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
});
const { translations } = await import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));
const app = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');

// ITALIANO: premesse: la X della scheda chiama handleCloseImage con il titolo closeImageTitle, e
//           handleCloseImage toglie la foto dall'elenco senza segnarla come cestinata.
// ENGLISH: premises: the card's X calls handleCloseImage with the title closeImageTitle, and
//          handleCloseImage removes the photo from the list without flagging it as trashed.
dice('premessa: la scheda ha la X "Chiudi immagine"', true, /onClose\(img\.id\)[^\n]*title=\{t\.closeImageTitle\}/.test(app));
const i = app.indexOf('const handleCloseImage = useCallback(');
const corpo = i < 0 ? '' : app.slice(i, app.indexOf('\n    }, [t]);', i));
dice('premessa: chiudere toglie la foto dal progetto', true, /setImages\(prev => prev\.filter\(i => i\.id !== id\)\)/.test(corpo));
dice('premessa: chiudere non cestina e non tocca il disco', false, /isTrashed|trashFiles|deleteImageFiles/.test(corpo));

const ATTESE = ['it', 'en', 'fr', 'es', 'de', 'zh', 'ja', 'pt', 'ru'];
for (const codice of ATTESE) {
    const l = translations[codice] || {};
    const avviso = String(l.zipPhotoUnreadable || '');
    dice(`[${codice}] l'avviso nomina la foto ({name})`, true, avviso.includes('{name}'));
    dice(`[${codice}] l'avviso nomina "${l.closeImageTitle}"`, true, !!l.closeImageTitle && avviso.includes(l.closeImageTitle));
    dice(`[${codice}] l'avviso non manda nel cestino ("${l.moveToTrash}")`, false, !!l.moveToTrash && avviso.includes(l.moveToTrash));
}

process.exit(esito());
