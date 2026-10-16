/* ITALIANO: PROVA DELL'AVVISO GIALLO SULLA QUALITA' DI UNA FOTO
   Una foto che il programma non sa mostrare (un .tif da 24 megapixel: Chromium non legge il TIFF,
   ne' HEIC, ne' un file rovinato) arriva con larghezza e altezza 0. L'avviso giallo diceva "Per il
   training si consiglia almeno 1 megapixel... Qualita' di questa immagine: 0x0 (0.00 MP)": dava
   per piccola una foto grande e taceva il problema vero, che la foto non si vede. La regola: 0x0
   non e' una misura; per quelle foto l'avviso dice che il programma non riesce a mostrarle e che i
   tag si possono comunque modificare e salvare. L'avviso del megapixel resta per le foto piccole.
   Si provano la regola vera di src/utils/imageQuality.ts e la miniatura vera di
   src/utils/imageUtils.ts (compilate con esbuild, con un browser finto che non legge il file), e
   sul sorgente che le tre schede (galleria, cestino, visualizzatore) passino tutte dalla regola.
   Uso:  node scripts/test-image-quality-warning.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE YELLOW WARNING ABOUT A PHOTO'S QUALITY
   A photo the program cannot display (a 24-megapixel .tif: Chromium does not read TIFF, nor HEIC,
   nor a damaged file) arrives with width and height 0. The yellow warning said "Recommended for
   training: at least 1 megapixel... Quality of this image: 0x0 (0.00 MP)": it called a large photo
   small and kept quiet about the real problem, that the photo does not show. The rule: 0x0 is not
   a measurement; for those photos the warning says the program cannot display them and that the
   tags can still be edited and saved. The megapixel warning stays for small photos.
   The real rule of src/utils/imageQuality.ts and the real thumbnail of src/utils/imageUtils.ts are
   tested (compiled with esbuild, with a fake browser that cannot read the file), and on the source
   that the three cards (gallery, trash, viewer) all go through the rule.
   Usage:  node scripts/test-image-quality-warning.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const carica = async (rel) => {
    if (!fs.existsSync(path.join(radice, rel))) return {};
    const uscita = await esbuild.build({
        entryPoints: [path.join(radice, rel)],
        bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
    });
    return import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));
};
const lingue = (await carica('src/constants.ts')).translations;
const Q = await carica('src/utils/imageQuality.ts');
const I = await carica('src/utils/imageUtils.ts');
const { dice, esito } = creaControlli();
const t = lingue.en;

const testo = (w, h) => (typeof Q.qualityWarningText === 'function' ? Q.qualityWarningText(t, w, h) : 'regola mancante');

console.log('\n--- una foto che il programma non sa leggere (TIFF) ---');
{
    // ITALIANO: il browser finto: createImageBitmap rifiuta il file, e anche <img> da' errore.
    // ENGLISH: the fake browser: createImageBitmap rejects the file, and <img> errors too.
    globalThis.createImageBitmap = async () => { throw new Error('The source image could not be decoded.'); };
    globalThis.URL.createObjectURL = () => 'blob:finto';
    globalThis.Image = class { set src(_) { queueMicrotask(() => this.onerror && this.onerror()); } };
    const r = await I.generateThumbnail({ name: 'ritratto-24mp.tif', type: 'image/tiff' });
    dice('premessa: la miniatura arriva con 0x0', [0, 0], [r.width, r.height]);
    dice('l\'avviso dice che il programma non riesce a mostrarla', t.imageUnreadable, testo(r.width, r.height));
    dice('e non parla di megapixel', false, String(testo(r.width, r.height)).includes(t.imageQualityLabel));
    dice('lo stesso con una sola misura a 0', t.imageUnreadable, testo(0, 5000));
}

console.log('\n--- il testo nuovo c\'e\' in tutte le nove lingue ---');
for (const [lingua, testi] of Object.entries(lingue)) {
    dice(`${lingua}: imageUnreadable`, true, typeof testi.imageUnreadable === 'string' && testi.imageUnreadable.trim().length > 20);
}

console.log('\n--- quello che NON deve cambiare ---');
dice('una foto piccola (800x600): l\'avviso del megapixel con la sua misura', `${t.minQualityWarning}\n${t.imageQualityLabel}: 800x600 (0.48 MP)`, testo(800, 600));
dice('una foto da 1024x1024: nessun avviso', null, testo(1024, 1024));
dice('una foto da 24 megapixel: nessun avviso', null, testo(4000, 6000));

// ITALIANO: le tre schede che mostrano l'avviso devono passare dalla regola: nessun confronto
//           "larghezza x altezza < 1048576" scritto a mano deve restare nei sorgenti.
// ENGLISH: the three cards showing the warning must go through the rule: no hand-written
//          "width x height < 1048576" comparison may be left in the sources.
console.log('\n--- src/App.tsx e src/components/Lightbox.tsx ---');
{
    const app = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
    const visore = fs.readFileSync(path.join(radice, 'src/components/Lightbox.tsx'), 'utf8');
    const crudo = /\.width \* \w+\.height < 1048576/g;
    dice('App.tsx: nessun confronto scritto a mano (galleria e cestino)', 0, (app.match(crudo) || []).length);
    dice('Lightbox.tsx: nessun confronto scritto a mano (visualizzatore)', 0, (visore.match(crudo) || []).length);
    dice('App.tsx: la galleria e il cestino usano la regola', true, (app.match(/qualityWarningText\(t, img\.width, img\.height\)/g) || []).length >= 2);
    dice('Lightbox.tsx: il visualizzatore usa la regola', true, /qualityWarningText\(t, image\.width, image\.height\)/.test(visore));
}

process.exit(esito());
