/* ITALIANO: PROVA DEL TRASCINAMENTO DI UN'IMMAGINE DELLA PAGINA (MINIATURA, LOGO) DENTRO LA FINESTRA
   Le immagini della pagina sono trascinabili di serie, e in Chromium un'immagine trascinata porta il
   tipo "Files" e un file con i suoi byte. Un clic «sporco» su una miniatura (il mouse si muove di
   qualche pixel prima di rilasciare) accendeva il velo «Rilascia qui le immagini» e al rilascio
   apriva il riepilogo dell'importazione con la miniatura stessa. Il programma non usa trascinamenti
   interni: il trascinamento che parte da un'immagine della pagina viene annullato subito, mentre i
   file trascinati da Esplora file (che non passano da dragstart nella pagina) entrano come prima.
   Si esegue il codice VERO dell'effetto del trascinamento preso da src/App.tsx, con una finestra finta.
   Uso:  node scripts/test-drag-page-image.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF DRAGGING AN IMAGE OF THE PAGE (THUMBNAIL, LOGO) INSIDE THE WINDOW
   Page images are draggable by default, and in Chromium a dragged image carries the "Files" type and
   a file with its bytes. A "sloppy" click on a thumbnail (the mouse moves a few pixels before the
   release) turned on the "Drop images here" overlay and, on release, opened the import summary with
   the thumbnail itself. The program uses no internal drags: a drag that starts from an image of the
   page is cancelled at once, while files dragged from File Explorer (which do not go through a
   dragstart in the page) come in as before.
   The REAL code of the drag effect taken from src/App.tsx is run, with a fake window.
   Usage:  node scripts/test-drag-page-image.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const sorgente = fs.readFileSync(process.argv[2] || path.join(radice, 'src/App.tsx'), 'utf8');
const inizio = sorgente.indexOf('    useEffect(() => {\r\n        let dragDepth = 0;') >= 0
    ? sorgente.indexOf('    useEffect(() => {\r\n        let dragDepth = 0;')
    : sorgente.indexOf('    useEffect(() => {\n        let dragDepth = 0;');
const fine = sorgente.indexOf('    }, []);', inizio);
if (inizio < 0 || fine < 0) { console.log('NO  effetto del trascinamento non trovato in src/App.tsx'); process.exit(1); }
const codice = (await esbuild.transform(sorgente.slice(inizio, fine + '    }, []);'.length), { loader: 'ts' })).code;

// ITALIANO: la finestra finta fa salire gli eventi da un elemento finto fino a lei, come il browser.
// ENGLISH: the fake window bubbles events from a fake element up to itself, like the browser.
const avvia = () => {
    const finestra = new EventTarget();
    const s = { velo: false, rilasci: 0, pulizia: null };
    const useEffect = (f) => { s.pulizia = f(); };
    new Function('useEffect', 'window', 'setIsDragging', 'dropHandlerRef', codice)(
        useEffect, finestra, (v) => { s.velo = v; }, { current: () => { s.rilasci++; } });
    const manda = (tipo, bersaglio = null, dati = { types: ['Files'], files: [{ name: 'a.png' }], items: [] }) => {
        const e = new Event(tipo, { cancelable: true });
        e.dataTransfer = dati;
        if (bersaglio) Object.defineProperty(e, 'target', { value: bersaglio });
        finestra.dispatchEvent(e);
        return e;
    };
    return { s, manda };
};
const elemento = (nodeName) => ({ nodeName, tagName: nodeName });
// ITALIANO: la forma che Chromium da' a un <img> trascinato dalla pagina.
// ENGLISH: the shape Chromium gives to an <img> dragged from the page.
const miniatura = { types: ['text/uri-list', 'text/html', 'Files'], files: [{ name: 'blob.webp', type: 'image/webp' }], items: [] };

console.log('\n--- un\'immagine della pagina trascinata dentro la finestra ---');
for (const [nome, el] of [['una miniatura della galleria', elemento('IMG')], ['il logo (img)', elemento('IMG')]]) {
    const { s, manda } = avvia();
    const partenza = manda('dragstart', el, miniatura);
    dice(nome + ': il trascinamento viene annullato appena parte', true, partenza.defaultPrevented);
    if (!partenza.defaultPrevented) {
        // ITALIANO: senza l'annullamento il browser continuerebbe con questi eventi.
        // ENGLISH: without the cancel the browser would go on with these events.
        manda('dragenter', null, miniatura);
        manda('drop', null, miniatura);
    }
    dice(nome + ': nessun velo e nessun import della miniatura', [false, 0], [s.velo, s.rilasci]);
}

console.log('\n--- quello che non deve cambiare ---');
{
    const { s, manda } = avvia();
    manda('dragenter');
    dice('file da Esplora file (nessun dragstart nella pagina): il velo si accende', true, s.velo);
    const e = manda('drop');
    dice('...e il rilascio importa', [false, 1, true], [s.velo, s.rilasci, e.defaultPrevented]);
}
{
    const { manda } = avvia();
    const e = manda('dragstart', elemento('INPUT'), { types: ['text/plain'], files: [], items: [] });
    dice('trascinare il testo selezionato in un campo resta possibile', false, e.defaultPrevented);
    const t = manda('dragstart', { nodeType: 3, nodeName: '#text' }, { types: ['text/plain'], files: [], items: [] });
    dice('...anche quando il bersaglio e\' un nodo di testo', false, t.defaultPrevented);
}
{
    const { s, manda } = avvia();
    s.pulizia();
    const e = manda('dragstart', elemento('IMG'), miniatura);
    dice('dopo lo smontaggio l\'ascolto del dragstart e\' tolto', false, e.defaultPrevented);
}

process.exit(esito());
