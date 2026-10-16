/* ITALIANO: PROVA DEI NOMI CHE DIFFERISCONO SOLO PER LE MAIUSCOLE IN "Esporta (.zip)"
   La cartella X ha A.png, la cartella Y ha a.jpg. Esportando coi nomi originali l'archivio
   conteneva A.txt e a.txt (e con le foto A.png e a.jpg) tutti alla radice: il controllo dei nomi
   doppi distingueva le maiuscole. Windows no: estraendo, a.txt prende il posto di A.txt, e Kohya
   abbina A.png ai tag di Y. Didascalie sbagliate su una foto, senza nessun avviso. L'import
   abbina gia' senza badare alle maiuscole (test-folder-keyer-case); ora anche l'esportazione:
   un nome che differisce solo per le maiuscole passa dalla stessa sottocartella o dallo stesso
   " (2)" dei nomi doppi, e conta nell'avviso.
   Si eseguono i testi VERI di handleExportAll, avviaExport ed exportAllAsZip (src/App.tsx) col
   banco di prova export-harness.mjs, e si rilegge l'archivio con JSZip.
   Uso:  node scripts/test-export-name-case.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF NAMES THAT DIFFER ONLY IN CAPITALS IN "Export (.zip)"
   Folder X has A.png, folder Y has a.jpg. Exporting with the original names, the archive held
   A.txt and a.txt (and with the photos A.png and a.jpg) all at the root: the duplicate-name check
   told capitals apart. Windows does not: on extraction a.txt replaces A.txt, and Kohya pairs A.png
   with Y's tags. Wrong captions on a photo, with no warning at all. The import already pairs
   ignoring capitals (test-folder-keyer-case); now the export does too: a name differing only in
   capitals goes through the same subfolder or " (2)" as duplicate names, and counts in the notice.
   The REAL text of handleExportAll, avviaExport and exportAllAsZip (src/App.tsx) runs on the
   export-harness.mjs bench, and the archive is read back with JSZip.
   Usage:  node scripts/test-export-name-case.mjs      (exits with code 1 if anything is off) */

import { creaControlli } from './main-harness.mjs';
import { creaApp, creaSonda, FotoFinta, byteDi, t } from './export-harness.mjs';

const { dice, esito } = creaControlli();

const progetto = (sonda, coppie) => coppie.map(([cartella, nome, tag], i) => ({
    id: cartella + '/' + nome, file: new FotoFinta(byteDi(40, i), nome, sonda), tags: [tag], isTrashed: false, dirHandle: { name: cartella },
}));
const stelo = (n) => n.slice(0, n.lastIndexOf('.')).toLowerCase();

for (const conImmagini of [false, true]) {
    console.log(`\n--- X/A.png e Y/a.jpg, "${conImmagini ? 'Tag e immagini' : 'Solo i tag'}" coi nomi originali ---`);
    const sonda = creaSonda();
    const r = await creaApp(progetto(sonda, [['X', 'A.png', 'tag_x'], ['Y', 'a.jpg', 'tag_y']]), sonda).esporta(conImmagini);
    const voci = await r.archivio() || {};
    const nomi = Object.keys(voci);
    dice('nessuna voce coincide con un\'altra ignorando le maiuscole', nomi.length, new Set(nomi.map(n => n.toLowerCase())).size);
    const txt = nomi.filter(n => n.endsWith('.txt'));
    const testoDi = (n) => voci[n] ? voci[n].toString('utf8') : '';
    dice('ogni foto ha il suo .txt coi suoi tag', ['tag_x,', 'tag_y,'], txt.map(testoDi).sort());
    if (conImmagini) {
        for (const foto of nomi.filter(n => !n.endsWith('.txt'))) {
            const suo = txt.find(n => stelo(n) === stelo(foto));
            dice(`il .txt accanto a ${foto} ha i tag della sua foto`, foto.endsWith('.png') ? 'tag_x,' : 'tag_y,', suo ? testoDi(suo) : null);
        }
    }
    dice('l\'avviso dei nomi doppi conta 1', true, r.notifiche.some(([m]) => m.includes(t.zipNameCollisionWarn.replace('{n}', '1'))));
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const sonda = creaSonda();
    const r = await creaApp(progetto(sonda, [['X', 'b.png', 'b1'], ['Y', 'c.png', 'c1']]), sonda).esporta(true);
    dice('nomi diversi: tutti alla radice', ['b.png', 'b.txt', 'c.png', 'c.txt'], Object.keys(await r.archivio() || {}).sort());
    dice('...e nessun avviso', [[t.zipSuccess, 'success']], r.notifiche.filter(([, tipo]) => tipo !== 'info'));
    const s2 = creaSonda();
    const r2 = await creaApp(progetto(s2, [['X', 'img.png', 'x1'], ['Y', 'img.png', 'y1']]), s2).esporta(false);
    dice('nomi uguali identici: img.txt e Y/img.txt, come prima', ['Y/img.txt', 'img.txt'], Object.keys(await r2.archivio() || {}).sort());
}

process.exit(esito());
