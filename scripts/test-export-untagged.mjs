/* ITALIANO: PROVA DELLE FOTO SENZA TAG IN "Esporta (.zip)" -> "Tag e immagini"
   Un progetto con 10 foto, 2 ancora senza tag: "Tag e immagini" dava un dataset.zip con 8 foto,
   e l'avviso diceva che era tutto a posto. Le 2 foto senza tag sparivano dal dataset esportato,
   senza una parola. Se nessuna foto aveva tag, l'esportazione si rifiutava ("Nessuna immagine con
   tag da esportare") anche se l'utente voleva le foto. Il filtro "solo foto con tag" veniva da
   quando l'archivio conteneva solo i .txt.
   Ora "Tag e immagini" mette TUTTE le foto attive; una foto senza tag entra SENZA .txt (un .txt
   vuoto fa fermare l'addestramento di Kohya: "caption file is empty"). "Solo i tag" resta com'era.
   Si eseguono i testi VERI di handleExportAll, avviaExport ed exportAllAsZip (src/App.tsx) col
   banco di prova export-harness.mjs, e si rilegge l'archivio con JSZip.
   Uso:  node scripts/test-export-untagged.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF PHOTOS WITHOUT TAGS IN "Export (.zip)" -> "Tags and images"
   A project with 10 photos, 2 still untagged: "Tags and images" gave a dataset.zip with 8 photos,
   and the notice said all was well. The 2 untagged photos vanished from the exported dataset,
   without a word. If no photo had tags, the export refused ("No images with tags to export") even
   though the user wanted the photos. The "only tagged photos" filter dated from when the archive
   held only the .txt files.
   Now "Tags and images" packs ALL active photos; an untagged photo goes in WITHOUT a .txt (an empty
   .txt stops Kohya's training: "caption file is empty"). "Tags only" stays as it was.
   The REAL text of handleExportAll, avviaExport and exportAllAsZip (src/App.tsx) runs on the
   export-harness.mjs bench, and the archive is read back with JSZip.
   Usage:  node scripts/test-export-untagged.mjs      (exits with code 1 if anything is off) */

import { creaControlli } from './main-harness.mjs';
import { creaApp, creaSonda, FotoFinta, byteDi, t, sorgenteApp } from './export-harness.mjs';

const { dice, esito } = creaControlli();

// ITALIANO: 10 foto: p03 e p07 senza tag, p05 nel cestino (con tag).
// ENGLISH: 10 photos: p03 and p07 untagged, p05 in the trash (tagged).
const progetto = (sonda) => Array.from({ length: 10 }, (_, i) => {
    const n = String(i + 1).padStart(2, '0');
    const nome = `p${n}.png`;
    return { id: nome, file: new FotoFinta(byteDi(100, i), nome, sonda), tags: (n === '03' || n === '07') ? [] : ['tag' + n], isTrashed: n === '05' };
});
const nomi = (voci) => voci ? Object.keys(voci).sort() : null;
const foto = (voci) => nomi(voci)?.filter(n => n.endsWith('.png')) || [];
const testi = (voci) => nomi(voci)?.filter(n => n.endsWith('.txt')) || [];

console.log('\n--- 10 foto, 2 senza tag, 1 nel cestino ---');
{
    const sonda = creaSonda();
    const app = creaApp(progetto(sonda), sonda).apri();
    dice('la finestra conta 7 file per "Solo i tag" e 7 + 9 per "Tag e immagini"', [7, 16],
        app.scelta ? [app.scelta.riepilogo.soloTag.file, app.scelta.riepilogo.conImmagini.file] : null);
    const r = await app.conferma(true);
    const voci = await r.archivio();
    dice('"Tag e immagini": ci sono tutte le 9 foto attive, anche p03 e p07', ['p01.png', 'p02.png', 'p03.png', 'p04.png', 'p06.png', 'p07.png', 'p08.png', 'p09.png', 'p10.png'], foto(voci));
    dice('le 2 foto senza tag non hanno un .txt (nemmeno vuoto)', ['p01.txt', 'p02.txt', 'p04.txt', 'p06.txt', 'p08.txt', 'p09.txt', 'p10.txt'], testi(voci));
    dice('nessun .txt vuoto nell\'archivio', [], nomi(voci).filter(n => n.endsWith('.txt') && voci[n].length === 0));
}

console.log('\n--- rinominando in sequenza (0001, 0002...) ---');
{
    const sonda = creaSonda();
    const voci = await (await creaApp(progetto(sonda), sonda).esporta(true, true)).archivio();
    dice('9 foto numerate', ['0001.png', '0002.png', '0003.png', '0004.png', '0005.png', '0006.png', '0007.png', '0008.png', '0009.png'], foto(voci));
    dice('il .txt solo per le foto con tag (p03 = 0003, p07 = 0006 senza)', ['0001.txt', '0002.txt', '0004.txt', '0005.txt', '0007.txt', '0008.txt', '0009.txt'], testi(voci));
    dice('0003.png e\' davvero p03', true, !!voci && voci['0003.png'].equals(Buffer.from(byteDi(100, 2))));
}

console.log('\n--- nessuna foto ha tag ---');
{
    const sonda = creaSonda();
    const senza = [0, 1, 2].map(i => ({ id: `s${i}.png`, file: new FotoFinta(byteDi(50, i), `s${i}.png`, sonda), tags: [], isTrashed: false }));
    const app = creaApp(senza, sonda).apri();
    dice('la finestra di scelta si apre lo stesso', true, !!app.scelta);
    const r = await app.conferma(true);
    dice('"Tag e immagini": le 3 foto, nessun .txt', ['s0.png', 's1.png', 's2.png'], nomi(await r.archivio()));
    const r2 = await creaApp(senza, sonda).esporta(false);
    dice('"Solo i tag": "Nessuna immagine con tag da esportare", nessun archivio', [[[t.errorNoTagsToExport, 'info']], null],
        [r2.notifiche, await r2.archivio()]);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const sonda = creaSonda();
    const voci = await (await creaApp(progetto(sonda), sonda).esporta(false)).archivio();
    dice('"Solo i tag": i 7 .txt delle foto attive con tag, nessuna foto', ['p01.txt', 'p02.txt', 'p04.txt', 'p06.txt', 'p08.txt', 'p09.txt', 'p10.txt'], nomi(voci));
    const tutteNelCestino = progetto(sonda).map(i => ({ ...i, isTrashed: true }));
    const r = creaApp(tutteNelCestino, sonda).apri();
    dice('tutte le foto nel cestino: nessuna finestra, "Nessuna immagine con tag da esportare"', [null, [[t.errorNoTagsToExport, 'info']]], [r.scelta, r.notifiche]);
    dice('la finestra di scelta passa da avviaExport', true, /onConfirm=\{avviaExport\}/.test(sorgenteApp));
}

process.exit(esito());
