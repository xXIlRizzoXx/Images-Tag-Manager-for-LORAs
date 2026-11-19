/* ITALIANO: PROVA DI PIU' CHIAMATE MCP IN FILA SULLE STESSE FOTO (src/App.tsx, imagesRef)
   Un'AI che segue la skill pubblica manda tanti add_tags uno dietro l'altro sulle stesse foto.
   Il gestore MCP aggiorna SUBITO imagesRef e poi chiama setImages; la riga che riallinea
   imagesRef a `images` dopo ogni disegno girava in un useEffect, cioe' in un compito DOPO il
   commit: se nel frattempo era gia' arrivata la chiamata successiva, l'effetto vecchio rimetteva
   in imagesRef i tag di prima, la chiamata dopo partiva da li' e setImages li scriveva sopra per
   intero. Una modifica su due spariva, con «changed» gia' risposto all'AI.
   Modello: React VERO del progetto (build di produzione) su un DOM finto minimo, il VERO
   eseguiStrumentoMcp (src/utils/mcpBridge.ts) e le righe VERE di App.tsx (l'allineamento di
   imagesRef e le due righe di `applica`), ritagliate dal testo del file. Il disegno dura 30 ms
   (attesa attiva) e la chiamata dopo arriva 8 ms dopo la risposta: e' il caso peggiore
   dell'ordine dei compiti (la chiamata gia' in coda passa prima degli effetti passivi). In Node
   lo schedulatore di React usa setImmediate e non MessageChannel come in Chromium: la prova
   dimostra il meccanismo, i tempi veri si guardano nel programma.
   Uso:  node scripts/test-mcp-ref-allineato.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF SEVERAL MCP CALLS IN A ROW ON THE SAME PHOTOS (src/App.tsx, imagesRef)
   An AI following the public skill sends many add_tags one after the other on the same photos.
   The MCP handler updates imagesRef AT ONCE and then calls setImages; the line realigning
   imagesRef to `images` after each render ran in a useEffect, i.e. in a task AFTER the commit:
   if the next call had already arrived, the stale effect put the old tags back into imagesRef,
   the next call started from there and setImages wrote them over in full. Every other change
   vanished, with "changed" already answered to the AI.
   Model: the project's REAL React (production build) on a minimal fake DOM, the REAL
   eseguiStrumentoMcp and the REAL lines of App.tsx (the imagesRef alignment and the two lines of
   `applica`), cut from the file's text. A render lasts 30 ms (busy wait) and the next call
   arrives 8 ms after the answer: the worst case of task ordering (the queued call runs before
   the passive effects). In Node React's scheduler uses setImmediate, not MessageChannel as in
   Chromium: the test shows the mechanism, the real timing is checked in the program.
   Usage:  node scripts/test-mcp-ref-allineato.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

process.env.NODE_ENV = 'production';
const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(radice, 'package.json'));

let guai = 0, fatti = 0;
const dice = (nome, atteso, avuto) => {
    fatti++;
    const ok = JSON.stringify(atteso) === JSON.stringify(avuto);
    if (!ok) guai++;
    console.log(`${ok ? 'OK ' : 'NO '} ${nome}${ok ? '' : `\n     atteso: ${JSON.stringify(atteso)}\n     avuto:  ${JSON.stringify(avuto)}`}`);
};

// --- le righe vere di App.tsx / the real lines of App.tsx ---
const app = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const rigaAllinea = (app.match(/^[ \t]*(use(?:Layout)?Effect\(\(\) => \{ imagesRef\.current = images; \}, \[images\]\);)/m) || [])[1];
const inizioApplica = app.indexOf('applica: (nuovi) => {');
const corpoApplica = inizioApplica >= 0 ? app.slice(inizioApplica, inizioApplica + 2000) : '';
const rigaRef = (corpoApplica.match(/^[ \t]*(imagesRef\.current = imagesRef\.current\.map\(img => \(nuovi\.has\(img\.id\)[^\r\n]*;)/m) || [])[1];
const rigaSet = (corpoApplica.match(/^[ \t]*(setImages\(prev => prev\.map\(img => \(nuovi\.has\(img\.id\)[^\r\n]*;)/m) || [])[1];
dice('App.tsx: trovata la riga che riallinea imagesRef a images', true, !!rigaAllinea);
dice('App.tsx: trovate le due righe di applica (imagesRef subito, poi setImages)', [true, true], [!!rigaRef, !!rigaSet]);
if (!rigaAllinea || !rigaRef || !rigaSet) {
    console.log(`\nESITO: ${guai} problemi su ${fatti} controlli`);
    process.exit(1);
}
// ITALIANO: l'allineamento deve girare dentro il commit, e useLayoutEffect deve essere importato.
// ENGLISH: the alignment must run inside the commit, and useLayoutEffect must be imported.
dice('imagesRef si riallinea a images in un useLayoutEffect (dentro il commit)', true, rigaAllinea.startsWith('useLayoutEffect('));
const importReact = (app.match(/^import React, \{([^}]*)\} from 'react';/m) || [])[1] || '';
dice("useLayoutEffect e' importato da 'react'", true, /\buseLayoutEffect\b/.test(importReact));

// --- DOM finto minimo: il componente non disegna niente / minimal fake DOM, nothing is drawn ---
const nodoFinto = () => ({
    nodeType: 1, tagName: 'DIV', nodeName: 'DIV', namespaceURI: 'http://www.w3.org/1999/xhtml',
    firstChild: null, lastChild: null, childNodes: [], textContent: '',
    addEventListener() { }, removeEventListener() { }, appendChild() { }, removeChild() { }, insertBefore() { },
    setAttribute() { }, removeAttribute() { }, style: {},
});
const documento = { ...nodoFinto(), nodeType: 9, nodeName: '#document', createElement: nodoFinto, createTextNode: nodoFinto, documentElement: nodoFinto(), body: nodoFinto(), activeElement: null };
documento.defaultView = globalThis;
globalThis.window = globalThis;
globalThis.document = documento;
globalThis.HTMLIFrameElement = class { };
globalThis.getSelection = () => null;
globalThis.addEventListener = () => { };
globalThis.removeEventListener = () => { };
if (!globalThis.navigator) globalThis.navigator = { userAgent: 'node' };

const React = require('react');
const { createRoot } = require('react-dom/client');

const pacco = await esbuild.build({ entryPoints: [path.join(radice, 'src/utils/mcpBridge.ts')], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
const { eseguiStrumentoMcp } = await import('data:text/javascript;base64,' + Buffer.from(pacco.outputFiles[0].text).toString('base64'));

// ITALIANO: le righe vere diventano funzioni, con gli stessi nomi liberi che hanno in App.tsx.
// ENGLISH: the real lines become functions, with the same free names they have in App.tsx.
const allinea = new Function('useEffect', 'useLayoutEffect', 'imagesRef', 'images', rigaAllinea);
const applicaVera = new Function('imagesRef', 'setImages', 'nuovi', `${rigaRef}\n${rigaSet}`);

const prova = async (disegnoMs, arrivoMs, chiamate) => {
    const iniziali = [
        { id: 'a', file: { name: 'a.jpg' }, tags: ['uno'], originalTags: ['uno'] },
        { id: 'b', file: { name: 'b.jpg' }, tags: ['uno'], originalTags: ['uno'] },
    ];
    const risposte = [];
    let prossima = 0, statoVivo = null, gestore = () => { }, finito;
    const tutteFatte = new Promise(r => { finito = r; });
    const lenti = { attivi: false };
    const accoda = () => {
        if (prossima >= chiamate.length) { finito(); return; }
        const [strumento, argomenti] = chiamate[prossima++];
        setTimeout(() => gestore(strumento, argomenti), arrivoMs);
    };
    function App() {
        const [images, setImages] = React.useState(iniziali);
        const imagesRef = React.useRef(images);
        statoVivo = images;
        // ITALIANO: un disegno lento, come la galleria vera. / ENGLISH: a slow render, like the real gallery.
        if (lenti.attivi) { const fine = Date.now() + disegnoMs; while (Date.now() < fine) { /* attesa attiva */ } }
        allinea(React.useEffect, React.useLayoutEffect, imagesRef, images);
        gestore = async (strumento, argomenti) => {
            const r = await eseguiStrumentoMcp(strumento, argomenti, {
                foto: () => imagesRef.current,
                trigger: () => [],
                applica: (nuovi) => applicaVera(imagesRef, setImages, nuovi),
                immagine: async () => null,
            });
            risposte.push([strumento, r.risultato]);
            accoda();
        };
        return null;
    }
    const contenitore = nodoFinto();
    contenitore.ownerDocument = documento;
    const radiceReact = createRoot(contenitore);
    radiceReact.render(React.createElement(App));
    await new Promise(r => setTimeout(r, 100));
    lenti.attivi = true;
    accoda();
    await tutteFatte;
    await new Promise(r => setTimeout(r, 100 + disegnoMs * 3));
    radiceReact.unmount();
    return { risposte, statoVivo };
};

const sei = [
    ['add_tags', { ids: ['a', 'b'], tags: ['dragon'] }],
    ['add_tags', { ids: ['a', 'b'], tags: ['full body'] }],
    ['add_tags', { ids: ['a'], tags: ['from side'] }],
    ['add_tags', { ids: ['a', 'b'], tags: ['standing'] }],
    ['add_tags', { ids: ['a'], tags: ['smile'] }],
    ['add_tags', { ids: ['a', 'b'], tags: ['forest'] }],
    ['list_photos', {}],
];
const attesiA = ['dragon', 'forest', 'from side', 'full body', 'smile', 'standing', 'uno'];
const attesiB = ['dragon', 'forest', 'full body', 'standing', 'uno'];
const tagDi = (stato, id) => [...stato.find(i => i.id === id).tags].sort();
const elenco = (risposte) => {
    const l = risposte.find(([s]) => s === 'list_photos');
    return l ? Object.fromEntries(l[1].photos.map(p => [p.id, [...p.tags].sort()])) : null;
};

// 1. il caso segnalato: disegno lento, chiamata dopo gia' in coda / the reported case
{
    const { risposte, statoVivo } = await prova(30, 8, sei);
    dice('disegno 30 ms, chiamata dopo a 8 ms: sei risposte «changed»', [1, 1, 1, 1, 1, 1].map(n => n > 0), risposte.filter(([s]) => s === 'add_tags').map(([, r]) => r.changed > 0));
    dice('disegno 30 ms, chiamata dopo a 8 ms: la foto a ha tutti i tag aggiunti', attesiA, tagDi(statoVivo, 'a'));
    dice('disegno 30 ms, chiamata dopo a 8 ms: la foto b ha tutti i tag aggiunti', attesiB, tagDi(statoVivo, 'b'));
    dice('disegno 30 ms, chiamata dopo a 8 ms: list_photos dice i tag veri', { a: attesiA, b: attesiB }, elenco(risposte));
}
// 2. caso vicino: togli e aggiungi di fila / neighbour case: remove and add in a row
{
    const { statoVivo } = await prova(30, 8, [
        ['add_tags', { ids: ['a'], tags: ['x1'] }],
        ['remove_tags', { ids: ['a'], tags: ['uno'] }],
        ['add_tags', { ids: ['a'], tags: ['x2'] }],
        ['remove_tags', { ids: ['a'], tags: ['x1'] }],
        ['add_tags', { ids: ['a'], tags: ['x3'] }],
    ]);
    dice('togli e aggiungi di fila (disegno 30 ms): restano x2 e x3', ['x2', 'x3'], tagDi(statoVivo, 'a'));
}
// 3. caso vicino: chiamate lente, nessuna sovrapposizione (deve restare giusto)
//    neighbour case: slow calls, no overlap (must stay right)
{
    const { risposte, statoVivo } = await prova(5, 40, sei);
    dice('chiamate distanziate (disegno 5 ms, arrivo 40 ms): la foto a ha tutti i tag', attesiA, tagDi(statoVivo, 'a'));
    dice('chiamate distanziate: list_photos dice i tag veri', { a: attesiA, b: attesiB }, elenco(risposte));
}

console.log(`\nESITO: ${guai} problemi su ${fatti} controlli`);
process.exit(guai ? 1 : 0);
