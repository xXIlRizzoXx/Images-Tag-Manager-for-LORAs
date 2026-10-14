/* ITALIANO: PROVA DEL BACKUP ANTI-CRASH PER LE FOTO CARICATE SENZA CARTELLA
   Foto aperte con "Carica immagini" o trascinate nella finestra, tag modificati, poi manca la
   corrente. Il backup si scriveva ogni secondo, ma alla riapertura non si applicava MAI: il
   programma lo rifiutava perche' quelle foto non hanno una cartella scelta, e le modifiche non
   salvate andavano perse. Il README promette un backup che sopravvive a un'interruzione di
   corrente, senza condizioni, e presenta le tre strade come equivalenti.
   Ora le riconosce l'impronta (nessuna cartella + quante foto + la prima e l'ultima), come per
   le cartelle; in Electron la chiave di ogni foto porta anche il suo percorso completo (anche
   trascinandole senza .txt), e ogni voce l'impronta dei tag che aveva su disco, quindi i tag non
   possono finire su un'altra serie. Nel browser, dove il percorso non si conosce, la chiave e' il
   solo nome: due serie con gli stessi nomi non si distinguono, e quelle foto restano fuori.
   Si provano le regole VERE di src/utils/tagBackup.ts (compilato al volo con esbuild): si scrive
   il backup come fa l'effetto di App.tsx e lo si rilegge come fa l'import.
   Uso:  node scripts/test-backup-load-images.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE CRASH BACKUP FOR PHOTOS LOADED WITHOUT A FOLDER
   Photos opened with "Load images" or dropped on the window, tags edited, then a power cut. The
   backup was written every second, but on reopening it was NEVER applied: the program refused it
   because those photos have no picked folder, and the unsaved edits were lost. The README promises
   a backup that survives a power cut, with no conditions, and presents the three roads as equal.
   Now the fingerprint recognises them (no folder + photo count + first and last), as for folders;
   in Electron every photo's key also carries its full path (when dropped with no .txt too), and
   every entry the fingerprint of the tags it had on disk, so the tags cannot land on another set.
   In the browser, where the path is unknown, the key is the bare name: two sets with the same names
   cannot be told apart, and those photos stay out.
   The REAL rules of src/utils/tagBackup.ts are tested (compiled on the fly with esbuild): the backup
   is written as App.tsx's effect does and read back as the import does.
   Usage:  node scripts/test-backup-load-images.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const uscita = await esbuild.build({
    entryPoints: [path.join(radice, 'src/utils/tagBackup.ts')],
    bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
});
const B = await import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));
const { dice, esito } = creaControlli();

const SEP = '\x1f';
// ITALIANO: un import come lo fa processImportData. `cartella` e' il nome della cartella scelta
//           ('' = "Carica immagini", trascinamento, ripiego del browser); `dir` e' cio' che
//           makeBackupKeyer mette davanti al nome (in Electron il percorso vero, nel browser '').
// ENGLISH: an import as processImportData does it. `cartella` is the picked folder's name
//          ('' = "Load images", drag and drop, browser fallback); `dir` is what makeBackupKeyer puts
//          in front of the name (in Electron the real path, in the browser '').
const importa = (cartella, dir, lotto, nomi, tagSuDisco = ['x']) => nomi.map(n => ({
    id: lotto + '/' + n, file: { name: n }, tags: [...tagSuDisco], originalTags: [...tagSuDisco],
    backupKey: dir + SEP + n, lottoImport: lotto, cartellaImport: cartella,
}));
const modifica = (images, id) => images.map(i => i.id === id ? { ...i, tags: [...i.tags, 'nuovo'] } : i);
const scrivi = (images, corrente = '') => {
    const b = B.costruisciBackup(images, [], corrente);
    return b ? JSON.stringify({ ts: 1, ...b }) : null;
};
// ITALIANO: riapertura: le voci del backup per questo import (null = backup scartato).
// ENGLISH: reopening: the backup entries for this import (null = backup discarded).
const rilegge = (salvato, cartella, nomi) => {
    const r = B.backupDellImport(salvato, cartella, B.folderSignature(cartella, nomi));
    return r ? r.voci : null;
};
// ITALIANO: i tag che l'import rimette sulla foto (null = restano quelli del .txt).
// ENGLISH: the tags the import puts back on the photo (null = the .txt's own stay).
const ripristina = (voci, chiave, tagSuDisco = ['x']) =>
    voci && voci[chiave] ? B.tagDaRipristinare(voci[chiave], tagSuDisco, tagSuDisco, [], undefined, 1) : null;

const DIR = 'E:\\dataset\\serie_a';
const NOMI = Array.from({ length: 30 }, (_, i) => `img_${String(i + 1).padStart(3, '0')}.png`);

console.log('\n--- "Carica immagini" in Electron (percorso vero nella chiave) ---');
{
    const salvato = scrivi(modifica(importa('', DIR, 'L1', NOMI), 'L1/img_007.png'));
    dice('il backup viene scritto', true, salvato !== null);
    const voci = rilegge(salvato, '', NOMI);
    dice('riaprendo le stesse foto la modifica torna', ['x', 'nuovo'], ripristina(voci, DIR + SEP + 'img_007.png'));
}

console.log('\n--- "Carica immagini" o trascinamento nel browser (solo il nome nella chiave) ---');
{
    // ITALIANO: senza percorso due serie con gli stessi nomi non si distinguono: il backup non si scrive.
    // ENGLISH: with no path two sets with the same names cannot be told apart: the backup is not written.
    dice('il backup non si scrive', null, scrivi(modifica(importa('', '', 'L1', ['a.png', 'b.png', 'c.png']), 'L1/b.png')));
}

console.log('\n--- una cartella e delle foto sfuse aperte insieme ---');
{
    let images = [...importa('dataset', 'dataset', 'L1', ['p1.png', 'p2.png']), ...importa('', DIR, 'L2', ['q1.png', 'q2.png', 'q3.png'])];
    images = modifica(modifica(images, 'L1/p2.png'), 'L2/q3.png');
    const salvato = scrivi(images, 'dataset');
    const cartella = rilegge(salvato, 'dataset', ['p1.png', 'p2.png']);
    const sfuse = rilegge(salvato, '', ['q1.png', 'q2.png', 'q3.png']);
    dice('la cartella ritrova la sua modifica, e solo quella', [['dataset' + SEP + 'p2.png'], ['x', 'nuovo']], [cartella ? Object.keys(cartella) : null, ripristina(cartella, 'dataset' + SEP + 'p2.png')]);
    dice('le foto sfuse ritrovano la loro, e solo quella', [[DIR + SEP + 'q3.png'], ['x', 'nuovo']], [sfuse ? Object.keys(sfuse) : null, ripristina(sfuse, DIR + SEP + 'q3.png')]);
}

console.log('\n--- quello che NON deve cambiare (il lato sicuro) ---');
{
    const salvato = scrivi(modifica(importa('', DIR, 'L1', NOMI), 'L1/img_007.png'));
    // ITALIANO: premessa: il backup c'e' ed e' leggibile, quindi i "niente" qui sotto non sono a vuoto.
    // ENGLISH: premise: the backup exists and is readable, so the "nothing" below is not vacuous.
    dice('premessa: il backup delle foto sfuse c\'e\' e si rilegge', true, rilegge(salvato, '', NOMI) !== null);
    dice('foto sfuse: una cartella con gli stessi nomi non le riceve', null, rilegge(salvato, 'serie_a', NOMI));
    dice('foto sfuse: riaprendone solo una parte non si applica', null, rilegge(salvato, '', NOMI.slice(0, 29)));
    const cartella = scrivi(modifica(importa('dataset', 'dataset', 'L1', NOMI), 'L1/img_007.png'), 'dataset');
    dice('una cartella: le stesse foto aperte sfuse non la ricevono', null, rilegge(cartella, '', NOMI));

    const gemelli = [...modifica(importa('', DIR, 'L1', NOMI), 'L1/img_007.png'), ...importa('', DIR, 'L2', NOMI)];
    dice('le stesse foto sfuse aperte due volte: non si sa quale sia quale, nessun ripristino', null, scrivi(gemelli));

    // ITALIANO: un'ALTRA serie con gli stessi 30 nomi (0001..0030 e' comune) in un'altra cartella:
    //           in Electron la chiave porta il percorso, quindi le sue foto non ricevono niente.
    // ENGLISH: ANOTHER set with the same 30 names (0001..0030 is common) in another folder: in
    //          Electron the key carries the path, so its photos receive nothing.
    const altra = rilegge(salvato, '', NOMI);
    dice('un\'altra serie con gli stessi nomi in un\'altra cartella: niente', null, ripristina(altra, 'E:\\dataset\\serie_b' + SEP + 'img_007.png'));
}

process.exit(esito());
