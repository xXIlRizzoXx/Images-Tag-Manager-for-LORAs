/* ITALIANO: PROVA DEL NOME DEL .txt SCRITTO ACCANTO ALLA FOTO
   Una foto con un nome insolito ma valido su Windows (photo..v2.png, IMG_001..jpg, .hidden.png, un
   nome oltre 200 caratteri) si abbinava all'import con photo..v2.txt, come fa Kohya. "Salva
   modifiche" e "Salva .txt" del visualizzatore scrivevano invece un nome "ripulito" (photo.v2.txt):
   un file che nessuno rilegge. Alla riapertura tornavano i tag vecchi, e Kohya non vedeva mai i
   nuovi: il lavoro spariva senza un avviso. La cancellazione definitiva dal cestino usava lo stesso
   nome ripulito anche per la FOTO, e poteva colpire un'altra foto (photo.v2.png).
   Si eseguono i testi VERI di performSave e deleteImageFilesForGood (src/App.tsx) e di
   handleSaveSingleTxt (src/components/Lightbox.tsx), compilati con esbuild, su una cartella finta
   in memoria; il nome atteso e' quello con cui l'import vero (makeFolderKeyer) riabbina il .txt.
   Uso:  node scripts/test-sidecar-name.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE NAME OF THE .txt WRITTEN NEXT TO THE PHOTO
   A photo with an unusual but valid Windows name (photo..v2.png, IMG_001..jpg, .hidden.png, a name
   over 200 characters) paired at import with photo..v2.txt, as Kohya does. "Save changes" and the
   viewer's "Save .txt" wrote a "cleaned" name instead (photo.v2.txt): a file nobody reads back. On
   reopening the old tags came back, and Kohya never saw the new ones: the work vanished with no
   warning. The permanent delete from the trash used the same cleaned name for the PHOTO too, and
   could hit another photo (photo.v2.png).
   The REAL text of performSave and deleteImageFilesForGood (src/App.tsx) and of handleSaveSingleTxt
   (src/components/Lightbox.tsx) is run, compiled with esbuild, on a fake in-memory folder; the
   expected name is the one the real import (makeFolderKeyer) pairs the .txt back with.
   Usage:  node scripts/test-sidecar-name.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';
import { creaApp, creaSonda, FotoFinta, byteDi } from './export-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const carica = async (rel) => {
    const uscita = await esbuild.build({
        entryPoints: [path.join(radice, rel)],
        bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
    });
    return import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));
};
const P = await carica('src/utils/pathUtils.ts');
const S = await carica('src/utils/sidecarTags.ts');
const t = (await carica('src/constants.ts')).translations.en;

// ITALIANO: una funzione vera, ritagliata dal sorgente fino alla sua riga di chiusura.
// ENGLISH: a real function, cut out of the source up to its closing line.
const ritaglia = async (file, intestazione) => {
    const sorgente = fs.readFileSync(path.join(radice, file), 'utf8');
    const inizio = sorgente.indexOf(intestazione);
    const chiusura = /\r?\n    \};\r?\n/g;
    chiusura.lastIndex = Math.max(inizio, 0);
    const fine = inizio < 0 ? null : chiusura.exec(sorgente);
    if (inizio < 0 || !fine) {
        console.log(`NO  non trovato in ${file}: ${intestazione.trim()}`);
        process.exit(1);
    }
    return (await esbuild.transform(sorgente.slice(inizio, fine.index + fine[0].length), { loader: 'tsx' })).code;
};
const jsSalva = await ritaglia('src/App.tsx', '    const performSave = async (imagesToSave: any[]): Promise<boolean> => {');
const jsCancella = await ritaglia('src/App.tsx', '    const deleteImageFilesForGood = async (img: any): Promise<boolean> => {');
const jsLightbox = await ritaglia('src/components/Lightbox.tsx', '    const handleSaveSingleTxt = async () => {');
// ITALIANO: i nomi che i tre testi possono usare, presi dai moduli veri.
// ENGLISH: the names the three texts may use, taken from the real modules.
const aiuti = { buildTagFileName: P.buildTagFileName, sanitizeFileName: P.sanitizeFileName, sidecarTagFileName: P.sidecarTagFileName };
const nomiAiuti = Object.keys(aiuti);
const muto = { log() { }, warn() { }, error() { } };

// ITALIANO: una cartella finta: registra i nomi chiesti a getFileHandle e removeEntry.
// ENGLISH: a fake folder: records the names asked of getFileHandle and removeEntry.
const cartella = () => {
    const c = { scritti: [], tolti: [] };
    c.getFileHandle = async (nome) => ({ createWritable: async () => ({ write: async () => { c.scritti.push(nome); }, close: async () => { } }) });
    c.removeEntry = async (nome) => { c.tolti.push(nome); };
    return c;
};

const salva = async (nome) => {
    const dir = cartella();
    const f = new Function('setIsSaving', 'setImportProgress', 'showNotification', 't', 'getOrderedTagString', 'window', 'setImages', 'soundManager', 'console', ...nomiAiuti,
        jsSalva + '\nreturn performSave;')(() => { }, () => { }, () => { }, t, (tags) => tags.join(', ') + ',', {}, () => { }, { chime() { } }, muto, ...Object.values(aiuti));
    await f([{ id: '1', file: { name: nome }, tags: ['nuovo'], originalTags: ['vecchio'], dirHandle: dir }]);
    return dir.scritti;
};
const salvaLightbox = async (nome) => {
    const dir = cartella();
    const f = new Function('orderTags', 'currentTags', 'image', 'dirHandle', 'updateOriginalTags', 'soundManager', 'showNotification', 't', 'window', 'console', ...nomiAiuti,
        jsLightbox + '\nreturn handleSaveSingleTxt;')((x) => x, ['nuovo'], { id: '1', file: { name: nome } }, dir, () => { }, { chime() { } }, () => { }, t, {}, muto, ...Object.values(aiuti));
    await f();
    return dir.scritti;
};
const cancella = async (nome) => {
    const dir = cartella();
    const f = new Function('console', ...nomiAiuti, jsCancella + '\nreturn deleteImageFilesForGood;')(muto, ...Object.values(aiuti));
    await f({ file: { name: nome }, dirHandle: dir });
    return dir.tolti;
};

// ITALIANO: il .txt che l'import vero abbina a questa foto (stessa chiave di makeFolderKeyer).
// ENGLISH: the .txt the real import pairs with this photo (same makeFolderKeyer key).
const abbinato = (foto, txt) => { const k = S.makeFolderKeyer(null); return k({ name: foto }) === k({ name: txt }); };
// ITALIANO: la regola di Kohya / sd-scripts: os.path.splitext(percorso)[0] + '.txt' (i punti
//           iniziali non aprono l'estensione).
// ENGLISH: the Kohya / sd-scripts rule: os.path.splitext(path)[0] + '.txt' (leading dots do not
//          start the extension).
const kohya = (n) => { const i = n.lastIndexOf('.'); const iniziali = n.length - n.replace(/^\.+/, '').length; return (i >= iniziali && i > 0 ? n.slice(0, i) : n) + '.txt'; };

const INSOLITI = ['photo..v2.png', 'IMG_001..jpg', 'photo..png', '.hidden.png', 'a'.repeat(210) + '.png'];
for (const nome of INSOLITI) {
    const vista = nome.length > 40 ? nome.slice(0, 12) + '…(' + nome.length + ')' : nome;
    console.log(`\n--- ${vista} ---`);
    const [scritto] = await salva(nome);
    dice('"Salva modifiche" scrive il .txt che l\'import riabbina e che Kohya legge', [true, true], [abbinato(nome, scritto), scritto === kohya(nome)]);
    const [daLightbox] = await salvaLightbox(nome);
    dice('"Salva .txt" del visualizzatore scrive lo stesso file', scritto, daLightbox);
    const tolti = await cancella(nome);
    dice('la cancellazione definitiva toglie proprio quella foto e il suo .txt', [true, true], [tolti[0] === nome, tolti[1] === kohya(nome)]);
}

// ITALIANO: anche "Esporta (.zip)" nominava il .txt col nome ripulito: estratto accanto a
//           photo..v2.png, photo.v2.txt non si abbinava, e con le foto dentro anche la foto cambiava nome.
// ENGLISH: "Export (.zip)" too named the .txt with the cleaned name: extracted next to photo..v2.png,
//          photo.v2.txt did not pair, and with the photos in, the photo got renamed as well.
console.log('\n--- "Esporta (.zip)": il .txt nell\'archivio si abbina alla foto ---');
{
    const sonda = creaSonda();
    const images = [{ id: 'a', file: new FotoFinta(byteDi(10, 1), 'photo..v2.png', sonda), tags: ['t'], isTrashed: false }];
    const soloTag = await (await creaApp(images, sonda).esporta(false)).archivio();
    dice('solo i tag: photo..v2.txt, che accanto a photo..v2.png si riabbina', ['photo..v2.txt'], soloTag ? Object.keys(soloTag) : null);
    const conFoto = await (await creaApp(images, sonda).esporta(true)).archivio();
    dice('tag e immagini: la foto tiene il suo nome e il .txt le si abbina', ['photo..v2.png', 'photo..v2.txt'], conFoto ? Object.keys(conFoto) : null);
}

console.log('\n--- quello che NON deve cambiare ---');
for (const nome of ['photo.jpg', '10_face.v1.png', 'IMG_001.JPG']) {
    dice(`${nome}: stesso .txt di prima`, [P.buildTagFileName(nome)], await salva(nome));
}
dice('il nome per un download (fuori dalla cartella della foto) resta ripulito', 'photo.v2.txt', P.buildTagFileName('photo..v2.png'));

process.exit(esito());
