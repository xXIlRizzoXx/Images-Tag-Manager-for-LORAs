/* ITALIANO: PROVA: UNA SOLA CARTELLA NON SI DIVIDE IN 10_face/ E 10_face_2/ NELL'ESPORTAZIONE
   L'esportazione conta le cartelle aperte per lotto (lottoImport + cartellaImport). Ma la stessa
   cartella poteva finire in due lotti:
   A) a.png caricata da sola ("Carica immagini"), poi "Carica Cartella" su 10_face (b e c prendono un
      lotto nuovo), poi d.png aggiunta sul disco e 10_face riaperta: le foto gia' aperte venivano da
      due lotti (quello di a, sciolta, e quello di b e c), quindi d prendeva un TERZO lotto. L'archivio
      usciva 10_face/b, 10_face/c, 10_face_2/d e a.png alla radice (sd-scripts non la legge).
      Ora il lotto da riusare si cerca solo fra le foto gia' aperte DI QUESTA cartella.
   B) una foto sciolta nel cestino collegata alla cartella riaperta riceveva anche cartellaImport, ma
      restava nel suo lotto: ripristinata, l'archivio usciva 10_face/a e 10_face_2/b, c.
   Si eseguono i testi VERI di confermaImport e processImportData (import-harness.mjs) e
   dell'esportazione (export-harness.mjs), con cartelle finte.
   Casi vicini che non devono cambiare: la stessa cartella riaperta riusa il suo lotto; due cartelle
   con lo stesso nome ma percorsi diversi restano due lotti (10_face e 10_face_2).
   Uso:  node scripts/test-import-reopen-loose-batch.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST: ONE FOLDER IS NOT SPLIT INTO 10_face/ AND 10_face_2/ IN THE EXPORT
   The export counts the opened folders per batch (lottoImport + cartellaImport). But the same
   folder could end up in two batches:
   A) a.png loaded alone ("Load images"), then "Load Folder" on 10_face (b and c take a new batch),
      then d.png added on disk and 10_face reopened: the photos already open came from two batches
      (a's, loose, and b and c's), so d took a THIRD batch. The archive came out as 10_face/b,
      10_face/c, 10_face_2/d and a.png at the root (sd-scripts does not read it).
      Now the batch to reuse is looked for only among the already open photos OF THIS folder.
   B) a loose trashed photo linked to the reopened folder also got cartellaImport, but stayed in its
      batch: once restored, the archive came out as 10_face/a and 10_face_2/b, c.
   The REAL texts of confermaImport and processImportData (import-harness.mjs) and of the export
   (export-harness.mjs) run, with fake folders.
   Neighbouring cases that must not change: the same folder reopened reuses its batch; two folders
   with the same name but different paths stay two batches (10_face and 10_face_2).
   Usage:  node scripts/test-import-reopen-loose-batch.mjs      (exits with code 1 if anything is off) */

import { creaApp, cartella, riepilogo } from './import-harness.mjs';
import * as Esporta from './export-harness.mjs';
import { creaControlli } from './main-harness.mjs';

const { dice, esito } = creaControlli();
// ITALIANO: una foto caricata da sola (nessuna cartella), con il suo percorso su disco.
// ENGLISH: a photo loaded alone (no folder), with its path on disk.
const sciolta = (id, nome, percorso, { cestinata = false } = {}) => ({
    id, file: { name: nome, percorso, size: 10, lastModified: 1000 }, thumb: '', tags: [], originalTags: [],
    isTrashed: cestinata, dirHandle: null, width: 1, height: 1, lottoImport: 'L0',
});
// ITALIANO: "Solo i tag" delle foto in galleria, ognuna con un tag col suo nome.
// ENGLISH: "Tags only" of the gallery photos, each with a tag named after it.
const esportaTag = async (immagini) => {
    const sonda = Esporta.creaSonda();
    const foto = immagini.filter(i => !i.isTrashed).map(i => ({ ...i, tags: ['t' + i.file.name] }));
    return Object.keys(await (await Esporta.creaApp(foto, sonda).esporta(false)).archivio() || {}).sort();
};
const lottoDi = (app, nome) => (app.images.find(i => i.file.name === nome) || {}).lottoImport;

console.log('\n--- A) foto sciolta, poi la sua cartella, poi la cartella riaperta con una foto nuova ---');
{
    const h = cartella('E:10_face', '10_face');
    const app = creaApp({ iniziali: [sciolta('a', 'a.png', 'E:\\10_face\\a.png')] });
    await app.conferma(riepilogo(h, ['a.png', 'b.png', 'c.png']));
    dice('premessa: b e c entrano, a no', ['a.png', 'b.png', 'c.png'], app.nomi());
    await app.conferma(riepilogo(h, ['a.png', 'b.png', 'c.png', 'd.png']));
    dice('entra solo d.png', ['a.png', 'b.png', 'c.png', 'd.png'], app.nomi());
    dice('d.png entra nel lotto di b e c (la stessa cartella)', [true, true], [!!lottoDi(app, 'd.png'), lottoDi(app, 'd.png') === lottoDi(app, 'b.png')]);
    dice('a.png resta nel suo lotto di foto sciolte', 'L0', lottoDi(app, 'a.png'));
    dice('l\'archivio resta piatto, come per una sola cartella', ['a.txt', 'b.txt', 'c.txt', 'd.txt'], await esportaTag(app.images));
}

console.log('\n--- B) foto sciolta nel cestino collegata alla cartella, poi ripristinata ---');
{
    const h = cartella('E:10_face', '10_face');
    const app = creaApp({ iniziali: [sciolta('a', 'a.png', 'E:\\10_face\\a.png', { cestinata: true })] });
    await app.conferma(riepilogo(h, ['a.png', 'b.png', 'c.png']));
    dice('premessa: la foto del cestino e\' collegata alla cartella', true, app.images.find(i => i.id === 'a').dirHandle === h);
    const ripristinate = app.images.map(i => ({ ...i, isTrashed: false }));
    dice('l\'archivio resta piatto, nessun 10_face_2', ['a.txt', 'b.txt', 'c.txt'], await esportaTag(ripristinate));
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const h = cartella('E:10_face', '10_face');
    const app = creaApp();
    await app.conferma(riepilogo(h, ['a.png', 'b.png']));
    await app.conferma(riepilogo(h, ['a.png', 'b.png', 'c.png']));
    dice('la stessa cartella riaperta riusa il suo lotto', [true, true], [!!lottoDi(app, 'c.png'), lottoDi(app, 'c.png') === lottoDi(app, 'a.png')]);

    // ITALIANO: char_anna\10_face e char_bea\10_face: stesso nome, cartelle diverse.
    // ENGLISH: char_anna\10_face and char_bea\10_face: same name, different folders.
    const anna = { ...cartella('E:char_anna/10_face', '10_face') };
    const bea = { ...cartella('E:char_bea/10_face', '10_face') };
    const due = creaApp();
    const ra = riepilogo(anna, ['a.png']);
    ra.imgFiles.forEach(f => { f.percorso = 'E:\\char_anna\\10_face\\' + f.name; });
    ra.pathOf = new Map(ra.imgFiles.map(f => [f, f.percorso]));
    await due.conferma(ra);
    const rb = riepilogo(bea, ['b.png']);
    rb.imgFiles.forEach(f => { f.percorso = 'E:\\char_bea\\10_face\\' + f.name; });
    rb.pathOf = new Map(rb.imgFiles.map(f => [f, f.percorso]));
    await due.conferma(rb);
    dice('due cartelle con lo stesso nome: due lotti', true, !!lottoDi(due, 'a.png') && lottoDi(due, 'a.png') !== lottoDi(due, 'b.png'));
    dice('...e l\'archivio le tiene separate', ['10_face/a.txt', '10_face_2/b.txt'], await esportaTag(due.images));
}

process.exit(esito());
