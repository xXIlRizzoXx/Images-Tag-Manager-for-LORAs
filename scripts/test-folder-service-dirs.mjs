/* ITALIANO: PROVA DELLE CARTELLE DI SERVIZIO DEI NAS E DI WINDOWS IN "Carica Cartella"
   Un NAS Synology con l'indicizzazione delle foto accesa mette in ogni cartella @eaDir\<foto>\ con
   SYNOPHOTO_THUMB_XL.jpg, _M.jpg, _SM.jpg, che via rete si vede. "Carica Cartella" ci scendeva: 2 foto
   vere diventavano 8 "immagini", con le miniature del NAS in galleria, .txt scritti dentro @eaDir al
   Salva, richieste AI sprecate e @eaDir nell'archivio esportato. Ora le cartelle di servizio (per nome
   esatto: @eaDir, @Recycle, #recycle, #snapshot, .@__thumb, $RECYCLE.BIN, System Volume Information)
   si saltano, anche con il selettore di riserva.
   Casi vicini che non devono cambiare: una cartella dell'utente che comincia con "@" o "#" ("#train",
   "@anna") resta importata, la cartella scelta non si filtra mai, __MACOSX e "._nome" restano fuori.
   Si esegue il vero src/utils/folderScan.ts su cartelle finte.
   Uso:  node scripts/test-folder-service-dirs.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE NAS AND WINDOWS SERVICE FOLDERS IN "Load Folder"
   A Synology NAS with photo indexing on puts @eaDir\<photo>\ in every folder, with
   SYNOPHOTO_THUMB_XL.jpg, _M.jpg, _SM.jpg, visible over the network. "Load Folder" walked into it: 2
   real photos became 8 "images", with the NAS thumbnails in the gallery, .txt files written into
   @eaDir on Save, wasted AI requests and @eaDir in the exported archive. Now the service folders (by
   exact name: @eaDir, @Recycle, #recycle, #snapshot, .@__thumb, $RECYCLE.BIN, System Volume
   Information) are skipped, with the fallback picker too.
   Neighbouring cases that must not change: a user folder starting with "@" or "#" ("#train", "@anna")
   is still imported, the picked folder is never filtered, __MACOSX and "._name" stay out.
   The real src/utils/folderScan.ts runs on fake folders.
   Usage:  node scripts/test-folder-service-dirs.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const carica = async (rel) => {
    const uscita = await esbuild.build({ entryPoints: [path.join(radice, rel)], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
    return import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));
};
const FS = await carica('src/utils/folderScan.ts');
const { dice, esito } = creaControlli();
console.warn = () => {};

const file = (name, type) => ({ name, type, size: 10, lastModified: 1 });
const voceFile = (f) => ({ kind: 'file', name: f.name, getFile: async () => f });
const voceCartella = (name, voci) => ({
    kind: 'directory', name,
    values() {
        let i = 0;
        return { [Symbol.asyncIterator]() { return this; }, async next() { return i < voci.length ? { value: voci[i++], done: false } : { value: undefined, done: true }; } };
    },
});
const jpg = (n) => voceFile(file(n, 'image/jpeg'));
const txt = (n) => voceFile(file(n, 'text/plain'));
const miniature = (foto) => voceCartella(foto, ['SYNOPHOTO_THUMB_XL.jpg', 'SYNOPHOTO_THUMB_M.jpg', 'SYNOPHOTO_THUMB_SM.jpg'].map(jpg));

console.log('\n--- "Carica Cartella" su un NAS Synology ---');
{
    const cartella = voceCartella('10_anna', [
        jpg('IMG_0001.JPG'), txt('IMG_0001.txt'), jpg('IMG_0002.JPG'), txt('IMG_0002.txt'),
        voceCartella('@eaDir', [miniature('IMG_0001.JPG'), miniature('IMG_0002.JPG')]),
    ]);
    const r = await FS.scanDirectoryHandle(cartella);
    dice('2 foto vere: 2 immagini e 2 .txt, non 8', [2, 2], [r.imgFiles.length, r.txtFiles.length]);
    dice('...nessun percorso dentro @eaDir', [], [...r.relPathOf.values()].filter(p => /@eadir/i.test(p)));
}
{
    const cartella = voceCartella('ds', [
        jpg('a.jpg'),
        voceCartella('#recycle', [jpg('x.jpg')]), voceCartella('#snapshot', [jpg('y.jpg')]), voceCartella('@Recycle', [jpg('z.jpg')]),
        voceCartella('.@__thumb', [jpg('w.jpg')]), voceCartella('$RECYCLE.BIN', [jpg('v.jpg')]), voceCartella('System Volume Information', [jpg('u.jpg')]),
        voceCartella('@EADIR', [jpg('t.jpg')]),
    ]);
    const r = await FS.scanDirectoryHandle(cartella);
    dice('le altre cartelle di servizio (anche con maiuscole diverse) si saltano', ['a.jpg'], r.imgFiles.map(f => f.name));
}

console.log('\n--- selettore di riserva (webkitdirectory) ---');
{
    dice('un file dentro @eaDir si scarta', true, FS.fileDiMac('SYNOPHOTO_THUMB_M.jpg', '10_anna/@eaDir/IMG_0001.JPG/SYNOPHOTO_THUMB_M.jpg'));
    dice('...e dentro #recycle', true, FS.fileDiMac('x.jpg', 'ds/#recycle/x.jpg'));
    dice('una foto vera resta', false, FS.fileDiMac('IMG_0001.JPG', '10_anna/IMG_0001.JPG'));
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const cartella = voceCartella('ds', [voceCartella('#train', [jpg('a.jpg')]), voceCartella('@anna', [jpg('b.jpg')]), voceCartella('eaDir', [jpg('c.jpg')])]);
    const r = await FS.scanDirectoryHandle(cartella);
    dice('cartelle dell\'utente con "#" o "@" davanti restano importate', ['a.jpg', 'b.jpg', 'c.jpg'], r.imgFiles.map(f => f.name).sort());
    const scelta = voceCartella('@eaDir', [jpg('a.jpg')]);
    dice('la cartella scelta non si filtra mai', ['a.jpg'], (await FS.scanDirectoryHandle(scelta)).imgFiles.map(f => f.name));
    dice('...neanche col selettore di riserva', false, FS.fileDiMac('a.jpg', '#recycle/a.jpg'));
    dice('__MACOSX e "._nome" restano fuori', [true, true], [FS.fileDiMac('a.jpg', 'ds/__MACOSX/a.jpg'), FS.fileDiMac('._a.jpg')]);
}

process.exit(esito());
