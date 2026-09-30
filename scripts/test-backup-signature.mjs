/* ITALIANO: PROVA DELL'IMPRONTA DEL BACKUP ANTI-CRASH, CARTELLA PER CARTELLA
   L'impronta che lega il backup alla sua cartella (nome + quante foto + prima e ultima) si
   calcolava sulla lista IN MEMORIA col nome dell'ULTIMA cartella aperta. Bastava chiudere una
   sola foto con la "x", aprire una seconda cartella o aggiungere foto con "Carica immagini", e
   il backup non combaciava piu' con nessuna cartella: dopo un crash tutte le modifiche non
   salvate andavano perse, senza un messaggio.
   Si provano le regole VERE di src/utils/tagBackup.ts (compilato al volo con esbuild): si
   scrive il backup come fa l'effetto di App.tsx e lo si rilegge come fa l'import.
   Uso:  node scripts/test-backup-signature.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE CRASH BACKUP FINGERPRINT, FOLDER BY FOLDER
   The fingerprint tying the backup to its folder (name + photo count + first and last) was
   computed on the IN-MEMORY list with the name of the LAST folder opened. Closing a single photo
   with the "x", opening a second folder or adding photos with "Load images" was enough for the
   backup to match no folder at all: after a crash every unsaved edit was lost, with no message.
   The REAL rules of src/utils/tagBackup.ts are tested (compiled on the fly with esbuild): the
   backup is written as App.tsx's effect does and read back as the import does.
   Usage:  node scripts/test-backup-signature.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const carica = async (rel) => {
    const uscita = await esbuild.build({
        entryPoints: [path.join(radice, rel)],
        bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
    });
    return import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));
};
const B = await carica('src/utils/tagBackup.ts');
const { dice, esito } = creaControlli();

const SEP = '\x1f';
// ITALIANO: un import come lo fa processImportData: ogni foto porta il lotto e la cartella.
//           La cartella '' e' "Carica immagini" / trascinamento (nessuna cartella scelta).
// ENGLISH: an import as processImportData does it: every photo carries the batch and the folder.
//          Folder '' is "Load images" / drag and drop (no picked folder).
const importa = (cartella, lotto, nomi) => nomi.map(n => ({
    id: lotto + '/' + n, file: { name: n }, tags: ['x'], originalTags: ['x'],
    backupKey: cartella + SEP + n, lottoImport: lotto, cartellaImport: cartella,
}));
const modifica = (images, id) => images.map(i => i.id === id ? { ...i, tags: ['x', 'nuovo'] } : i);
const chiusa = (img) => ({ id: img.id, name: img.file.name, lotto: img.lottoImport, cartella: img.cartellaImport });
const scrivi = (images, chiuse, corrente) => {
    const b = B.costruisciBackup(images, chiuse, corrente);
    return b ? JSON.stringify({ ts: 1, ...b }) : null;
};
// ITALIANO: le chiavi che l'import di quella cartella ritrova nel backup (null = backup scartato).
// ENGLISH: the keys the import of that folder finds in the backup (null = backup discarded).
const ritrova = (salvato, cartella, nomi) => {
    const r = B.backupDellImport(salvato, cartella, B.folderSignature(cartella, nomi));
    return r ? Object.keys(r.voci).sort() : null;
};
// ITALIANO: true = la chiave c'e', false = il backup e' della cartella ma la chiave no, null = backup scartato.
// ENGLISH: true = the key is there, false = the backup is the folder's but lacks the key, null = backup discarded.
const ha = (lista, chiave) => lista ? lista.includes(chiave) : null;
// ITALIANO: le chiavi che NON appartengono a quella cartella (non ce ne devono essere).
// ENGLISH: the keys that do NOT belong to that folder (there must be none).
const estranee = (lista, cartella) => lista ? lista.filter(k => !k.startsWith(cartella + SEP)) : null;
const ABCD = ['a.png', 'b.png', 'c.png', 'd.png'];

console.log('\n--- una foto chiusa con la "x" (il file resta su disco) ---');
{
    let images = importa('dataset', 'L1', ABCD);
    images = modifica(images, 'L1/b.png');
    const chiuse = [chiusa(images[0])];
    images = images.filter(i => i.id !== 'L1/a.png');
    dice('riaprendo la cartella la modifica di b.png si ritrova', true, ha(ritrova(scrivi(images, chiuse, 'dataset'), 'dataset', ABCD), 'dataset' + SEP + 'b.png'));
}

console.log('\n--- due cartelle aperte insieme ---');
{
    let images = [...importa('char1', 'L1', ['p1.png', 'p2.png', 'p3.png']), ...importa('char2', 'L2', ['q1.png', 'q2.png'])];
    images = modifica(modifica(images, 'L1/p2.png'), 'L2/q1.png');
    const salvato = scrivi(images, [], 'char2');
    const r1 = ritrova(salvato, 'char1', ['p1.png', 'p2.png', 'p3.png']);
    const r2 = ritrova(salvato, 'char2', ['q1.png', 'q2.png']);
    dice('char1 ritrova la sua modifica, e niente di char2', [true, []], [ha(r1, 'char1' + SEP + 'p2.png'), estranee(r1, 'char1')]);
    dice('char2 ritrova la sua modifica, e niente di char1', [true, []], [ha(r2, 'char2' + SEP + 'q1.png'), estranee(r2, 'char2')]);
}

console.log('\n--- foto aggiunte con "Carica immagini" alla cartella aperta ---');
{
    let images = [...importa('dataset', 'L1', ABCD), ...importa('', 'L2', ['extra.png'])];
    images = modifica(images, 'L1/c.png');
    dice('la cartella ritrova la sua modifica', true, ha(ritrova(scrivi(images, [], 'dataset'), 'dataset', ABCD), 'dataset' + SEP + 'c.png'));
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const images = modifica(importa('dataset', 'L1', ABCD), 'L1/a.png');
    const salvato = scrivi(images, [], 'dataset');
    dice('stessa cartella, stesse foto: si ritrova', true, ha(ritrova(salvato, 'dataset', ABCD), 'dataset' + SEP + 'a.png'));
    dice('un ALTRO dataset con lo stesso nome ma altre foto: scartato', null, ritrova(salvato, 'dataset', ['a.png', 'b.png', 'c.png', 'd.png', 'e.png', 'f.png']));
    dice('una cartella con un altro nome: scartato', null, ritrova(salvato, 'altro', ABCD));
    dice('le stesse foto aperte senza cartella ("Carica immagini"): il backup della cartella non si applica', null, ritrova(salvato, '', ABCD));

    const nelCestino = images.map(i => i.id === 'L1/d.png' ? { ...i, isTrashed: true } : i);
    dice('una foto nel cestino e\' ancora su disco: conta', true, ha(ritrova(scrivi(nelCestino, [], 'dataset'), 'dataset', ABCD), 'dataset' + SEP + 'a.png'));

    const svuotato = images.filter(i => i.id !== 'L1/d.png');
    dice('cestino svuotato (file andato nel Cestino di Windows): non conta piu\'', true, ha(ritrova(scrivi(svuotato, [], 'dataset'), 'dataset', ['a.png', 'b.png', 'c.png']), 'dataset' + SEP + 'a.png'));

    const tornata = [chiusa(images[3])];
    dice('chiusa e riportata con Ctrl+Z: contata una volta sola', true, ha(ritrova(scrivi(images, tornata, 'dataset'), 'dataset', ABCD), 'dataset' + SEP + 'a.png'));
}

console.log('\n--- due lotti con la stessa impronta (stessa cartella aperta due volte, o una copia) ---');
{
    const images = [...modifica(importa('dataset', 'L1', ABCD), 'L1/a.png'), ...importa('dataset', 'L2', ABCD)];
    dice('non si puo\' sapere quale sia quale: nessun ripristino (lato sicuro)', null, ritrova(scrivi(images, [], 'dataset'), 'dataset', ABCD));
    // ITALIANO: anche in lettura: un backup con due sorgenti gemelle (scritto a mano o da altro) non si applica.
    // ENGLISH: on reading too: a backup with two twin sources (hand-written or from elsewhere) is not applied.
    const firma = B.folderSignature('dataset', ABCD);
    const gemelle = JSON.stringify({ ts: 1, folder: 'dataset', sources: [
        { signature: firma, data: { ['dataset' + SEP + 'a.png']: { tags: ['uno'], base: 'x' } } },
        { signature: firma, data: { ['dataset' + SEP + 'b.png']: { tags: ['due'], base: 'x' } } },
    ] });
    dice('due sorgenti con la stessa impronta nel backup: scartato', null, ritrova(gemelle, 'dataset', ABCD));
}

process.exit(esito());
