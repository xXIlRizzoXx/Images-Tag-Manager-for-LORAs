/* ITALIANO: PROVA DELL'ORDINE DI "Rinomina in sequenza" (Esporta -> "Tag e immagini")
   La finestra di esportazione promette: "L'ordine e' quello che vedi adesso nella galleria". Ma la
   numerazione 0001, 0002... seguiva l'ordine in cui le foto stavano in memoria (A-Z per nome,
   deciso all'import), non quello scelto in "Ordina per": con "Nome (Z-A)", "Piu' recenti" o "Meno
   recenti" la 0001 non era la prima foto della galleria. Anche con "Nome (A-Z)" l'ordine saltava
   dopo l'annullamento dello svuotamento del cestino, che rimette le foto in fondo all'elenco.
   Si accorgeva solo chi apriva l'archivio.
   Ora l'esportazione ordina come la galleria. Si confrontano i testi VERI di handleExportAll,
   avviaExport ed exportAllAsZip (banco export-harness.mjs) con il testo VERO della galleria
   (displayedImages in src/App.tsx), e si rilegge l'archivio con JSZip.
   Uso:  node scripts/test-export-order.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE ORDER OF "Rename in sequence" (Export -> "Tags and images")
   The export dialog promises: "The order is the one you see in the gallery right now". But the
   0001, 0002... numbering followed the order the photos had in memory (A-Z by name, set at import),
   not the one picked in "Sort by": with "Name (Z-A)", "Newest first" or "Oldest first" 0001 was not
   the first photo of the gallery. Even with "Name (A-Z)" the order broke after the undo of the
   trash emptying, which puts the photos back at the end of the list. Only someone opening the
   archive could notice.
   Now the export sorts like the gallery. The REAL text of handleExportAll, avviaExport and
   exportAllAsZip (export-harness.mjs bench) is compared with the REAL gallery text (displayedImages
   in src/App.tsx), and the archive is read back with JSZip.
   Usage:  node scripts/test-export-order.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import { creaControlli } from './main-harness.mjs';
import { creaApp, creaSonda, FotoFinta, byteDi, sorgenteApp, applySort } from './export-harness.mjs';

const { dice, esito } = creaControlli();

// ITALIANO: la galleria vera: il corpo di displayedImages (foto attive, ricerca per tag, applySort).
// ENGLISH: the real gallery: the body of displayedImages (active photos, tag search, applySort).
const INIZIO = 'const displayedImages = useMemo(';
const iInizio = sorgenteApp.indexOf(INIZIO);
const iFine = iInizio < 0 ? -1 : sorgenteApp.indexOf('}, [images, sortOrder, tagSearch]);', iInizio);
if (iFine < 0) { console.log('NO  displayedImages non trovato in src/App.tsx'); process.exit(1); }
const corpo = (await esbuild.transform('const __galleria = ' + sorgenteApp.slice(iInizio + INIZIO.length, iFine + 1) + ';', { loader: 'ts' })).code;
const galleria = (images, sortOrder, tagSearch = '') =>
    new Function('images', 'sortOrder', 'tagSearch', 'applySort', corpo + '\nreturn __galleria();')(images, sortOrder, tagSearch, applySort).map(i => i.file.name);

// ITALIANO: sei foto, in memoria in ordine A-Z come dopo l'import. Le date non seguono i nomi;
//           echo e' nel cestino, foxtrot non ha tag (entra lo stesso, senza .txt).
// ENGLISH: six photos, kept A-Z in memory as after the import. The dates do not follow the names;
//          echo is in the trash, foxtrot has no tags (it goes in all the same, without a .txt).
const DATI = [
    ['alpha', 3000, ['red', 'smile']], ['bravo', 1000, ['red']], ['charlie', 5000, ['smile']],
    ['delta', 2000, ['smile']], ['echo', 6000, ['blue'], true], ['foxtrot', 4000, []],
];
const progetto = (sonda) => DATI.map(([n, data, tags, cestino], i) => {
    const file = new FotoFinta(byteDi(100, i), n + '.png', sonda);
    Object.defineProperty(file, 'lastModified', { value: data });
    return { id: n, file, tags: [...tags], isTrashed: !!cestino };
});
// ITALIANO: chi c'e' dietro 0001.png, 0002.png...: la foto si riconosce dai suoi byte.
// ENGLISH: who is behind 0001.png, 0002.png...: each photo is recognised by its bytes.
const numerate = (voci) => {
    if (!voci) return null;
    return Object.keys(voci).filter(n => /^\d{4}\.png$/.test(n)).sort().map(n => {
        const i = DATI.findIndex((_, k) => voci[n].equals(Buffer.from(byteDi(100, k))));
        return i < 0 ? '?' : DATI[i][0] + '.png';
    });
};
const esportaRinominando = async (images, ordine) => {
    const sonda = creaSonda();
    const r = await creaApp(images, sonda, { ordine }).esporta(true, true);
    return numerate(await r.archivio());
};

console.log('\n--- 0001, 0002... seguono la galleria, per ogni scelta di "Ordina per" ---');
for (const ordine of ['name-asc', 'name-desc', 'date-desc', 'date-asc']) {
    const images = progetto(creaSonda());
    const vista = galleria(images, ordine);
    dice(`${ordine}: 0001 = ${vista[0]}, in fila come nella galleria`, vista, await esportaRinominando(images, ordine));
}

console.log('\n--- dopo l\'annullamento dello svuotamento (le foto tornate stanno in fondo all\'elenco) ---');
{
    const images = progetto(creaSonda());
    const tornata = images.shift();
    images.push(tornata);
    dice('premessa: in memoria alpha e\' in fondo', 'alpha', images[images.length - 1].id);
    const vista = galleria(images, 'name-asc');
    dice('"Nome (A-Z)": la galleria parte da alpha, e cosi\' 0001', ['alpha.png', vista], [vista[0], await esportaRinominando(images, 'name-asc')]);
}

console.log('\n--- con una ricerca attiva ---');
{
    const images = progetto(creaSonda());
    const vista = galleria(images, 'name-desc', 'smile');
    const tutte = await esportaRinominando(images, 'name-desc');
    dice('premessa: la ricerca "smile" mostra 3 foto', ['delta.png', 'charlie.png', 'alpha.png'], vista);
    dice('si esportano tutte le foto attive (anche quelle nascoste dalla ricerca), come prima', 5, tutte ? tutte.length : 0);
    dice('le foto viste restano in fila come nella galleria', vista, tutte ? tutte.filter(n => vista.includes(n)) : null);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const images = progetto(creaSonda());
    const prima = images.map(i => i.id);
    const sonda = creaSonda();
    const app = creaApp(images, sonda, { ordine: 'name-desc' }).apri();
    dice('la finestra conta le stesse foto: 4 .txt per "Solo i tag", 4 + 5 per "Tag e immagini"', [4, 9],
        app.scelta ? [app.scelta.riepilogo.soloTag.file, app.scelta.riepilogo.conImmagini.file] : null);
    const voci = await (await app.conferma(true)).archivio();
    dice('senza rinominare i nomi restano quelli veri, il cestino resta fuori', ['alpha.png', 'alpha.txt', 'bravo.png', 'bravo.txt', 'charlie.png', 'charlie.txt', 'delta.png', 'delta.txt', 'foxtrot.png'],
        voci ? Object.keys(voci).sort() : null);
    dice('l\'elenco delle foto dell\'app non viene riordinato dall\'esportazione', prima, images.map(i => i.id));
    const soloTag = await (await creaApp(images, creaSonda(), { ordine: 'date-desc' }).esporta(false)).archivio();
    dice('"Solo i tag": i 4 .txt delle foto attive con tag', ['alpha.txt', 'bravo.txt', 'charlie.txt', 'delta.txt'], soloTag ? Object.keys(soloTag).sort() : null);
}

process.exit(esito());
