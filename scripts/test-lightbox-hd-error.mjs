/* ITALIANO: PROVA DEL VISUALIZZATORE CON UNA FOTO CHE IL PROGRAMMA NON SA MOSTRARE
   Una foto .tif o .heic entra nell'import (il suo tipo comincia con "image/"), ma Chromium non la
   sa disegnare. Aprendola nel visualizzatore, l'immagine HD nascosta dava "errore" e non "caricata":
   la rotella con "Caricamento HD..." restava per sempre su uno sfondo vuoto, a dire di aspettare
   qualcosa che non arriva. Ora l'errore dell'immagine HD toglie la rotella e mostra la frase
   "Il programma non riesce a mostrare questa foto..." (imageUnreadable, gia' in nove lingue).
   Si disegna il componente VERO src/components/Lightbox.tsx con react-dom/server (compilato con
   esbuild). Un render sul server non esegue gli effetti ne' gli eventi: per mettere il
   visualizzatore nello stato "indirizzo HD pronto e fallito", gli stati che partono da null (l'indirizzo
   HD e quello che ha dato errore) partono qui dallo stesso indirizzo finto. Qui non si apre nessuna
   finestra: l'aspetto con un .tif vero resta una verifica a mano.
   Uso:  node scripts/test-lightbox-hd-error.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE VIEWER WITH A PHOTO THE APP CANNOT DISPLAY
   A .tif or .heic photo gets through the import (its type starts with "image/"), but Chromium
   cannot draw it. Opening it in the viewer, the hidden HD image fired "error", not "load": the
   spinner with "Loading HD..." stayed forever over an empty background, telling the user to wait
   for something that never comes. Now the HD image's error removes the spinner and shows the
   sentence "The app cannot display this photo..." (imageUnreadable, already in nine languages).
   The REAL component src/components/Lightbox.tsx is drawn with react-dom/server (compiled with
   esbuild). A server render runs no effects and no events: to put the viewer in the "HD address
   ready and failed" state, the states starting from null (the HD address and the one that failed)
   start here from the same fake address. No window is opened here: the look with a real .tif stays
   a check by hand.
   Usage:  node scripts/test-lightbox-hd-error.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();

// ITALIANO: "react" passa da un modulo ponte: tutto vero, tranne useState, che con il segnale
//           acceso fa partire dall'indirizzo finto gli stati che partirebbero da null.
// ENGLISH: "react" goes through a bridge module: all real, except useState, which with the flag on
//          starts from the fake address the states that would start from null.
const ponte = {
    name: 'ponte-react',
    setup(b) {
        b.onResolve({ filter: /^react$/ }, (a) => (a.namespace === 'ponte' ? undefined : { path: 'react-ponte', namespace: 'ponte' }));
        b.onLoad({ filter: /.*/, namespace: 'ponte' }, () => ({
            resolveDir: radice, loader: 'js',
            contents: `import * as R from 'react';
export * from 'react';
export default (R.default || R);
export const useState = (iniziale) => {
    const coppia = R.useState(iniziale);
    return (globalThis.__statoNullForzato && iniziale === null) ? [globalThis.__statoNullForzato, coppia[1]] : coppia;
};`,
        }));
    },
};
const uscita = await esbuild.build({
    stdin: {
        contents: `import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { Lightbox } from './src/components/Lightbox.tsx';
export const rendi = (props) => renderToStaticMarkup(createElement(Lightbox, props));`,
        resolveDir: radice, loader: 'tsx',
    },
    bundle: true, format: 'cjs', platform: 'node', write: false, logLevel: 'silent', plugins: [ponte],
    define: { 'process.env.NODE_ENV': '"production"' },
});
// ITALIANO: in CommonJS, perche' react-dom/server chiede moduli di Node con require.
// ENGLISH: as CommonJS, because react-dom/server asks for Node modules with require.
const modulo = { exports: {} };
new Function('module', 'exports', 'require', uscita.outputFiles[0].text)(modulo, modulo.exports, createRequire(path.join(radice, 'package.json')));
const { rendi } = modulo.exports;
const t = (await esbuild.build({
    entryPoints: [path.join(radice, 'src/constants.ts')], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
}).then(u => import('data:text/javascript;base64,' + Buffer.from(u.outputFiles[0].text).toString('base64')))).translations.en;

const nulla = () => { };
const props = {
    image: { id: 'a', name: 'photo.tif', tags: ['smile'], originalTags: ['smile'], thumb: 'thumb.png', file: { name: 'photo.tif' }, width: 0, height: 0 },
    onClose: nulla, updateTags: nulla, allTags: ['smile'], t, onNext: nulla, onPrev: nulla, hasNext: false, hasPrev: false,
    slideDirection: null, showNotification: nulla, updateOriginalTags: nulla, dirHandle: null, isDarkMode: false,
    onMoveToTrash: nulla, imageIndex: 0, imageCount: 1, lang: 'en', globalTriggers: [],
};
const html = (stato, misure = {}) => {
    globalThis.__statoNullForzato = stato;
    try { return rendi({ ...props, image: { ...props.image, ...misure } }); } finally { globalThis.__statoNullForzato = undefined; }
};
// ITALIANO: il velo sopra la foto (rotella o frase), fino al riquadro dell'immagine HD. L'avviso giallo
//           nell'angolo ha la stessa frase per una foto 0x0: per questo si guarda solo il velo.
// ENGLISH: the veil over the photo (spinner or sentence), up to the HD image's box. The yellow warning
//          in the corner has the same sentence for a 0x0 photo: that is why only the veil is checked.
const velo = (h) => {
    const i = h.indexOf('<div class="absolute inset-0 flex flex-col items-center justify-center z-10">');
    const f = i < 0 ? -1 : h.indexOf('<div class="w-full h-full"', i);
    return f < 0 ? '' : h.slice(i, f);
};
// ITALIANO: il testo di React esce con le entita' HTML: confronto sul testo visibile.
// ENGLISH: React's output carries HTML entities: compare on the visible text.
const visibile = (h) => h.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

console.log('\n--- immagine HD che il programma non sa mostrare (errore) ---');
{
    for (const [nome, misure] of [['foto 0x0 (TIFF, HEIC)', {}], ['foto con le misure ma file rovinato', { width: 2048, height: 2048 }]]) {
        const h = visibile(html('blob:hd-1', misure));
        const v = velo(h);
        dice(`${nome}: l'immagine HD nascosta c'e' (indirizzo pronto)`, true, h.includes('src="blob:hd-1"'));
        dice(`${nome}: il velo sopra la foto c'e' (la miniatura sfocata resta)`, true, v.includes('thumb.png'));
        dice(`${nome}: niente piu' "Loading HD..."`, false, v.includes(t.loadingHD));
        dice(`${nome}: niente rotella che gira`, false, /animate-spin/.test(v));
        dice(`${nome}: si legge che la foto non si puo' mostrare (imageUnreadable)`, true, v.includes(t.imageUnreadable));
    }
}

console.log('\n--- l\'immagine HD ha una strada per l\'errore ---');
{
    const sorgente = fs.readFileSync(path.join(radice, 'src/components/Lightbox.tsx'), 'utf8');
    const img = (sorgente.match(/<img src=\{highResUrl\}[^\n]*?\/>/) || [''])[0];
    dice('l\'<img> HD si trova', true, img.length > 0);
    dice('ha onLoad (come prima)', true, /onLoad=\{/.test(img));
    dice('ha onError', true, /onError=\{/.test(img));
}

console.log('\n--- quello che NON deve cambiare ---');
{
    for (const [nome, misure] of [['foto 0x0', {}], ['foto 2048x2048', { width: 2048, height: 2048 }]]) {
        const v = velo(visibile(html(undefined, misure)));
        dice(`${nome}, all'apertura, prima che l'HD arrivi: "Loading HD..." con la rotella`, [true, true], [v.includes(t.loadingHD), /animate-spin/.test(v)]);
        dice(`${nome}: senza la frase della foto illeggibile nel velo`, false, v.includes(t.imageUnreadable));
        dice(`${nome}: la miniatura sfocata sotto`, true, v.includes('thumb.png'));
    }
    // ITALIANO: l'avviso giallo nell'angolo per la foto 0x0 resta com'era.
    // ENGLISH: the yellow warning in the corner for the 0x0 photo stays as it was.
    dice('foto 0x0: l\'avviso giallo nell\'angolo ha ancora la sua frase', true, visibile(html(undefined)).includes(t.imageUnreadable));
}

process.exit(esito());
