/* ITALIANO: PROVA DELLA MINIATURA DI UNA FOTO CHE IL PROGRAMMA NON SA MOSTRARE
   Un TIFF (o una HEIC, o un file rovinato) si importa, ma Chromium non lo sa disegnare: la sua
   "miniatura" e' un indirizzo che non si apre, e la galleria mostrava l'icona dell'immagine rotta
   (visto dal vivo il 15/10/2026). Ora una foto 0x0 mostra un riquadro con l'estensione del file e
   "Anteprima non disponibile", in galleria e nel cestino. Si eseguono i pezzi VERI di src/App.tsx
   con React vero (renderToStaticMarkup), senza finestre.
   Uso:  node scripts/test-thumb-unavailable.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE THUMBNAIL OF A PHOTO THE PROGRAM CANNOT SHOW
   A TIFF (or a HEIC, or a damaged file) imports, but Chromium cannot draw it: its "thumbnail" is an
   address that does not open, and the gallery showed the broken-image icon (seen live on
   15/10/2026). Now a 0x0 photo shows a box with the file's extension and "No preview available",
   in the gallery and in the trash. The REAL pieces of src/App.tsx run with real React. */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(radice, 'package.json'));
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { dice, esito } = creaControlli();

const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const inizio = sorgente.indexOf('const senzaAnteprima = ');
const fine = sorgente.indexOf('const GalleryCard = React.memo(');
dice('src/App.tsx ha la regola senzaAnteprima prima di GalleryCard', true, inizio > 0 && fine > inizio);
if (inizio > 0 && fine > inizio) {
    const codice = (await esbuild.transform(sorgente.slice(inizio, fine), { loader: 'tsx', jsx: 'transform' })).code;
    const pezzi = new Function('React', 'ImageIcon', codice + '\nreturn { senzaAnteprima, AnteprimaNonDisponibile };')(
        React, () => React.createElement('svg', { 'data-icona': 'immagine' }));
    const t = { thumbUnavailable: 'No preview available' };
    dice('una foto 0x0 non ha anteprima', true, pezzi.senzaAnteprima({ width: 0, height: 0 }));
    dice('una foto con le sue misure ce l\'ha', false, pezzi.senzaAnteprima({ width: 640, height: 480 }));
    const html = renderToStaticMarkup(React.createElement(pezzi.AnteprimaNonDisponibile, { img: { file: { name: 'scan_01.tiff' } }, isDarkMode: true, t }));
    dice('il riquadro mostra l\'estensione e la frase', true, html.includes('TIFF') && html.includes(t.thumbUnavailable));
    dice('e l\'icona, non un <img> rotto', true, html.includes('data-icona') && !html.includes('<img'));
}
// ITALIANO: ogni miniatura della galleria e del cestino passa dalla regola.
// ENGLISH: every thumbnail of the gallery and of the trash goes through the rule.
const miniature = [...sorgente.matchAll(/<img src=\{img\.thumb\}/g)].map(m => sorgente.slice(Math.max(0, m.index - 400), m.index));
dice('due miniature (galleria e cestino), tutte e due dopo senzaAnteprima(img)', [true, true], miniature.map(prima => /senzaAnteprima\(img\)\s*\r?\n\s*\? <AnteprimaNonDisponibile[^\n]*\r?\n\s*: $/.test(prima)));
const lingue = (await import('data:text/javascript;base64,' + Buffer.from((await esbuild.build({
    entryPoints: [path.join(radice, 'src/constants.ts')], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
})).outputFiles[0].text).toString('base64'))).translations;
dice('la frase esiste in tutte e 9 le lingue', [], Object.keys(lingue).filter(l => !lingue[l].thumbUnavailable));

process.exit(esito());
