/* ITALIANO: PROVA DELLA CRONOLOGIA (CTRL+Z) NELL'ANTEPRIMA DI SVILUPPO
   Nell'anteprima di sviluppo (vite dev, la stessa in cui il programma si prova, ed electron:dev)
   React 19 in StrictMode fa girare due volte l'effetto che registra la cronologia all'avvio. Le due
   corse costruivano la stessa cronologia, ma l'indice veniva avanzato due volte: restava un passo
   oltre l'ultimo. Il primo Ctrl+Z dopo una modifica non cambiava niente e diceva lo stesso "Azione
   annullata"; solo il secondo annullava davvero. La regola: l'indice punta sempre all'ultimo passo
   registrato, anche quando React ripete l'effetto.
   Si esegue l'effetto VERO preso da src/App.tsx dentro un componente, con il React vero
   (react e react-dom del progetto, in modalita' sviluppo) e la regola vera di src/utils/historyUtils.ts.
   Nessuna finestra: il contenitore e' finto e il componente non disegna niente.
   Uso:  node scripts/test-history-strictmode.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE HISTORY (CTRL+Z) IN THE DEVELOPMENT PREVIEW
   In the development preview (vite dev, the one the program is tried in, and electron:dev) React 19
   in StrictMode runs the effect that records the history twice on mount. Both runs built the same
   history, but the index was moved forward twice: it stayed one step past the last one. The first
   Ctrl+Z after an edit changed nothing and still said "Action undone"; only the second really
   undid. The rule: the index always points at the last recorded step, also when React repeats the
   effect.
   The REAL effect taken from src/App.tsx is run inside a component, with the real React (the
   project's react and react-dom, in development mode) and the real rule of src/utils/historyUtils.ts.
   No window: the container is fake and the component draws nothing.
   Usage:  node scripts/test-history-strictmode.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const richiedi = createRequire(path.join(radice, 'package.json'));
const React = richiedi('react');
const { createRoot } = richiedi('react-dom/client');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const u = await esbuild.build({ entryPoints: [path.join(radice, 'src/utils/historyUtils.ts')], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
const H = await import('data:text/javascript;base64,' + Buffer.from(u.outputFiles[0].text).toString('base64'));

// ITALIANO: l'effetto vero della cronologia, dal suo testo fino a `}, [images]);`.
// ENGLISH: the real history effect, from its text down to `}, [images]);`.
const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const iCuore = sorgente.indexOf('        if (isUndoRedoAction.current) {\r\n            isUndoRedoAction.current = false;');
const i0 = sorgente.lastIndexOf('    useEffect(() => {', iCuore);
const i1 = sorgente.indexOf('    }, [images]);', iCuore);
if (iCuore < 0 || i0 < 0 || i1 < 0) { console.log('NO  effetto della cronologia non trovato in src/App.tsx'); process.exit(1); }
const effetto = (await esbuild.transform(sorgente.slice(i0, i1 + '    }, [images]);'.length), { loader: 'ts' })).code;
const corpo = new Function('React', 'useEffect', 'images', 'historyIndex', 'setHistory', 'setHistoryIndex', 'isUndoRedoAction',
    'triggerHistoryRef', 'globalTriggers', effetto);

// ITALIANO: un contenitore finto: il componente restituisce null, React non tocca il DOM.
// ENGLISH: a fake container: the component returns null, React does not touch the DOM.
const nulla = () => { };
const documento = { nodeType: 9, addEventListener: nulla, removeEventListener: nulla, createElement: () => ({ style: {}, setAttribute: nulla, appendChild: nulla }), documentElement: {} };
const contenitore = { nodeType: 1, nodeName: 'DIV', tagName: 'DIV', namespaceURI: 'http://www.w3.org/1999/xhtml', ownerDocument: documento,
    addEventListener: nulla, removeEventListener: nulla, appendChild: nulla, removeChild: nulla, firstChild: null, childNodes: [], style: {} };
globalThis.window = globalThis; globalThis.document = documento; globalThis.HTMLIFrameElement = class { }; documento.activeElement = null; documento.defaultView = globalThis;

const prova = async (strict) => {
    let api;
    function App() {
        const [images, setImages] = React.useState([]);
        const [history, setHistory] = React.useState([]);
        const [historyIndex, setHistoryIndex] = React.useState(-1);
        const isUndoRedoAction = React.useRef(false);
        const triggerHistoryRef = React.useRef([]);
        corpo(React, React.useEffect, images, historyIndex, setHistory, setHistoryIndex, isUndoRedoAction, triggerHistoryRef, []);
        api = { images, history, historyIndex, setImages, triggerHistoryRef };
        return null;
    }
    const root = createRoot(contenitore);
    const avvolto = strict ? React.createElement(React.StrictMode, null, React.createElement(App)) : React.createElement(App);
    const passi = [];
    const annota = (nome) => passi.push([nome, api.history.length - 1 === api.historyIndex, api.history[api.historyIndex] === api.images]);
    await React.act(async () => { root.render(avvolto); });
    annota('avvio');
    const foto = { id: 'a', tags: ['smile'] };
    await React.act(async () => { api.setImages([foto]); });
    annota('importazione');
    await React.act(async () => { api.setImages([{ ...foto, tags: ['smile', 'hat'] }]); });
    annota('modifica');
    // ITALIANO: il primo Ctrl+Z (stessa regola di handleUndo) deve riportare la foto senza "hat".
    // ENGLISH: the first Ctrl+Z (same rule as handleUndo) must bring back the photo without "hat".
    const passo = H.nearestDifferentStep(api.history, api.historyIndex, -1);
    const primoUndo = passo >= 0 ? api.history[passo] : null;
    const triggerAllineate = api.triggerHistoryRef.current.length === api.history.length;
    await React.act(async () => { root.unmount(); });
    return { passi, primoUndo, triggerAllineate };
};

for (const strict of [true, false]) {
    console.log(`\n--- ${strict ? 'StrictMode (anteprima di sviluppo)' : 'senza StrictMode (programma pacchettizzato)'} ---`);
    const r = await prova(strict);
    for (const [nome, ultimo, uguale] of r.passi) {
        dice(`${nome}: l'indice e' sull'ultimo passo della cronologia`, true, ultimo);
        dice(`${nome}: il passo dell'indice e' quello a schermo`, true, uguale);
    }
    dice('il primo Ctrl+Z riporta la foto com\'era prima della modifica', [['smile']], r.primoUndo ? r.primoUndo.map(f => f.tags) : null);
    dice('le trigger della cronologia hanno un passo per ogni passo', true, r.triggerAllineate);
}

process.exit(esito());
