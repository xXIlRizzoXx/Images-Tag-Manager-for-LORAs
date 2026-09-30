/* ITALIANO: PROVA DEL MESSAGGIO A COMPARSA CHE DEVE SPARIRE DA SOLO DOPO 4 SECONDI
   Il messaggio in basso a destra (es. "Tag copiati (5)") restava sullo schermo finche' l'utente
   scriveva: ogni tasto premuto in "Cerca per tag" o nella ricerca delle statistiche ridisegna App,
   App passava a Toast una funzione di chiusura NUOVA a ogni disegno, e Toast faceva ripartire da
   capo i suoi 4 secondi ogni volta che la funzione cambiava. Lo stesso durante "Tagga tutte" con
   l'AI a 16 richieste al minuto o piu': la barra di avanzamento ridisegna App piu' spesso di ogni
   4 secondi, e il messaggio restava fino alla fine del lotto.
   La regola: i 4 secondi partono quando arriva una notifica NUOVA (anche con lo stesso testo di
   quella che c'e', es. "copia i tag" premuto due volte), non a ogni disegno.
   Si disegnano il Toast VERO di src/components/ui.tsx, la riga VERA che lo mette in App.tsx e il
   showNotification VERO, con React e react-dom veri, dentro un DOM finto e con un orologio finto.
   Uso:  node scripts/test-toast-timer.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE POP-UP MESSAGE THAT MUST GO AWAY BY ITSELF AFTER 4 SECONDS
   The bottom-right message (e.g. "Tags copied (5)") stayed on screen while the user kept typing:
   every key pressed in "Search by tag" or in the statistics search re-renders App, App handed
   Toast a NEW close function on every render, and Toast restarted its 4 seconds whenever that
   function changed. The same during "Auto-tag all" with the AI at 16 requests a minute or more:
   the progress bar re-renders App more often than every 4 seconds, and the message stayed until
   the end of the batch.
   The rule: the 4 seconds start when a NEW notification arrives (even with the same text as the
   one on screen, e.g. "copy tags" pressed twice), not on every render.
   The REAL Toast of src/components/ui.tsx, the REAL line that places it in App.tsx and the REAL
   showNotification are rendered with the real React and react-dom, inside a fake DOM and with a
   fake clock.
   Usage:  node scripts/test-toast-timer.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const richiedi = createRequire(path.join(radice, 'package.json'));
const { dice, esito } = creaControlli();

// ITALIANO: un DOM minimo, quanto basta a react-dom per creare, spostare e togliere i nodi.
// ENGLISH: a minimal DOM, just enough for react-dom to create, move and remove nodes.
class Nodo {
    constructor(doc) { this.ownerDocument = doc; this.parentNode = null; this.childNodes = []; }
    get firstChild() { return this.childNodes[0] || null; }
    get lastChild() { return this.childNodes[this.childNodes.length - 1] || null; }
    get nextSibling() { if (!this.parentNode) return null; const c = this.parentNode.childNodes; return c[c.indexOf(this) + 1] || null; }
    appendChild(n) { if (n.parentNode) n.parentNode.removeChild(n); n.parentNode = this; this.childNodes.push(n); return n; }
    insertBefore(n, rif) {
        if (!rif) return this.appendChild(n);
        if (n.parentNode) n.parentNode.removeChild(n);
        n.parentNode = this; this.childNodes.splice(this.childNodes.indexOf(rif), 0, n); return n;
    }
    removeChild(n) { const i = this.childNodes.indexOf(n); if (i >= 0) this.childNodes.splice(i, 1); n.parentNode = null; return n; }
    contains(n) { while (n) { if (n === this) return true; n = n.parentNode; } return false; }
    getRootNode() { let n = this; while (n.parentNode) n = n.parentNode; return n; }
    addEventListener() { }
    removeEventListener() { }
    get textContent() { return this.childNodes.map(c => c.textContent).join(''); }
    set textContent(v) {
        this.childNodes.forEach(c => { c.parentNode = null; });
        this.childNodes = [];
        if (v !== '' && v != null) this.appendChild(this.ownerDocument.createTextNode(String(v)));
    }
}
class Testo extends Nodo {
    constructor(doc, t) { super(doc); this.nodeType = 3; this.nodeName = '#text'; this.nodeValue = t; }
    get textContent() { return this.nodeValue; }
    set textContent(v) { this.nodeValue = v; }
}
class Elemento extends Nodo {
    constructor(doc, tag, ns) {
        super(doc); this.nodeType = 1; this.tagName = tag.toUpperCase(); this.nodeName = this.tagName;
        this.namespaceURI = ns || 'http://www.w3.org/1999/xhtml'; this.attributes = {};
        this.style = { setProperty(k, v) { this[k] = v; }, removeProperty(k) { delete this[k]; } };
    }
    setAttribute(k, v) { this.attributes[k] = String(v); }
    getAttribute(k) { return k in this.attributes ? this.attributes[k] : null; }
    removeAttribute(k) { delete this.attributes[k]; }
    hasAttribute(k) { return k in this.attributes; }
}
class Documento extends Nodo {
    constructor() {
        super(null); this.ownerDocument = null; this.nodeType = 9; this.nodeName = '#document';
        this.body = this.createElement('body'); this.appendChild(this.body); this.activeElement = null;
    }
    createElement(t) { return new Elemento(this, t); }
    createElementNS(ns, t) { return new Elemento(this, t, ns); }
    createTextNode(t) { return new Testo(this, t); }
}
const documento = new Documento();
const finestra = { document: documento, addEventListener() { }, removeEventListener() { }, HTMLIFrameElement: class { }, event: undefined };
documento.defaultView = finestra;
globalThis.window = finestra;
globalThis.document = documento;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const React = richiedi('react');
const { createRoot } = richiedi('react-dom/client');
const { act } = React;

// ITALIANO: il Toast vero; le icone di lucide-react diventano componenti vuoti.
// ENGLISH: the real Toast; the lucide-react icons become empty components.
const iconeVuote = {
    name: 'icone-vuote',
    setup(b) {
        b.onResolve({ filter: /^lucide-react$/ }, () => ({ path: 'lucide', namespace: 'vuote' }));
        b.onLoad({ filter: /.*/, namespace: 'vuote' }, () => ({
            contents: 'export default new Proxy({}, { get: () => () => null });\n' +
                ['X', 'TriangleAlert', 'Info', 'Check', 'Download', 'FileArchive', 'Images', 'FileText'].map(n => `export const ${n} = () => null;`).join('\n'),
            loader: 'js',
        }));
    },
};
const uscita = await esbuild.build({
    stdin: { contents: `export { Toast } from ${JSON.stringify(path.join(radice, 'src/components/ui.tsx').replace(/\\/g, '/'))};`, resolveDir: radice, loader: 'ts' },
    bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'automatic',
    external: ['react', 'react/jsx-runtime', 'react-dom'], plugins: [iconeVuote], logLevel: 'silent',
});
const modulo = { exports: {} };
new Function('require', 'module', 'exports', uscita.outputFiles[0].text)(richiedi, modulo, modulo.exports);
const Toast = modulo.exports.Toast;

// ITALIANO: da App.tsx: lo stato iniziale del messaggio, showNotification e la riga che mette il Toast.
// ENGLISH: from App.tsx: the message's initial state, showNotification and the line placing the Toast.
const app = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const righe = app.split(/\r?\n/);
const rigaStato = righe.find(r => r.includes('const [toast, setToast] = useState('));
const rigaNotifica = righe.find(r => r.includes('const showNotification = ('));
const rigaToast = righe.find(r => r.includes('<Toast '));
console.log('\n--- i pezzi di App.tsx ---');
dice('stato iniziale, showNotification e <Toast> trovati', [true, true, true], [!!rigaStato, !!rigaNotifica, !!rigaToast]);
if (!rigaStato || !rigaNotifica || !rigaToast) process.exit(esito());
const statoIniziale = new Function('return ' + rigaStato.slice(rigaStato.indexOf('useState(') + 'useState('.length, rigaStato.lastIndexOf(');')))();
const codiceNotifica = (await esbuild.transform(rigaNotifica.trim(), { loader: 'ts' })).code;
const creaNotifica = new Function('setToast', codiceNotifica + '\nreturn showNotification;');
const jsxToast = rigaToast.trim().replace(/^\{/, '').replace(/\}$/, '');
const codiceToast = (await esbuild.transform(`const __el = (${jsxToast});`, { loader: 'tsx', jsx: 'transform', jsxFactory: 'React.createElement' })).code;
const disegnaToast = new Function('React', 'Toast', 'toast', 'setToast', codiceToast + '\nreturn __el;');

// ITALIANO: l'orologio finto, messo DOPO che React ha preso i suoi timer veri. Anche Date.now
//           segue l'orologio finto, cosi' due notifiche a 3 secondi l'una dall'altra hanno
//           davvero 3 secondi di distanza.
// ENGLISH: the fake clock, installed AFTER React took its real timers. Date.now follows the fake
//          clock too, so two notifications 3 seconds apart really are 3 seconds apart.
let adesso = 0, progressivo = 0;
const timer = new Map();
const BASE = 1_700_000_000_000;
globalThis.setTimeout = (fn, ms) => { const id = ++progressivo; timer.set(id, { fn, quando: adesso + (ms || 0) }); return id; };
globalThis.clearTimeout = (id) => { timer.delete(id); };
Date.now = () => BASE + adesso;
const avanzaFino = async (fine) => {
    for (;;) {
        let primo = null;
        for (const [id, x] of timer) if (x.quando <= fine && (!primo || x.quando < primo[1].quando)) primo = [id, x];
        if (!primo) break;
        timer.delete(primo[0]);
        adesso = primo[1].quando;
        await act(async () => { primo[1].fn(); });
    }
    adesso = fine;
};

/* ITALIANO: una App ridotta: lo stato del messaggio, una casella di ricerca (stato che non c'entra
   col messaggio, come tagSearch) e il Toast messo con la riga vera. `azioni` = [momento, cosa].
   Restituisce il momento in cui il messaggio e' sparito dallo schermo.
   ENGLISH: a trimmed App: the message state, a search box (state unrelated to the message, like
   tagSearch) and the Toast placed with the real line. `azioni` = [moment, what]. Returns the moment
   the message left the screen. */
const prova = async (azioni, fino = 20000) => {
    const banco = {};
    const Banco = () => {
        const [toast, setToast] = React.useState(statoIniziale);
        const [, setRicerca] = React.useState('');
        banco.notifica = creaNotifica(setToast);
        banco.digita = () => setRicerca(s => s + 'a');
        return React.createElement('div', null, disegnaToast(React, Toast, toast, setToast));
    };
    const contenitore = documento.createElement('div');
    documento.body.appendChild(contenitore);
    const radiceReact = createRoot(contenitore);
    adesso = 0; timer.clear();
    await act(async () => { radiceReact.render(React.createElement(Banco)); });
    for (const [quando, cosa] of azioni) {
        const id = ++progressivo;
        timer.set(id, { fn: () => cosa(banco), quando });
    }
    let sparito = null;
    let visto = false;
    while (adesso < fino) {
        await avanzaFino(adesso + 50);
        const visibile = contenitore.textContent !== '';
        if (visibile) { visto = true; sparito = null; } else if (visto && sparito === null) sparito = adesso;
    }
    await act(async () => { radiceReact.unmount(); });
    documento.body.removeChild(contenitore);
    return sparito;
};
const ogni = (passo, fino, cosa) => Array.from({ length: Math.floor(fino / passo) }, (_, i) => [(i + 1) * passo, cosa]);
const copiati = (b) => b.notifica('Tags copied (5)', 'success');

console.log('\n--- l\'utente scrive nella ricerca mentre c\'e\' il messaggio ---');
dice('un tasto al secondo fino a 8 s: il messaggio sparisce a 4 s, non 4 s dopo l\'ultimo tasto', 4000,
    await prova([[0, copiati], ...ogni(1000, 8000, b => b.digita())]));
dice('"Tagga tutte" a 16 richieste/minuto (un disegno ogni 3,75 s per 75 s): sparisce a 4 s', 4000,
    await prova([[0, copiati], ...ogni(3750, 75000, b => b.digita())], 90000));

console.log('\n--- una notifica nuova riparte da capo ---');
dice('un altro messaggio dopo 3 s resta i suoi 4 s: sparisce a 7 s', 7000,
    await prova([[0, copiati], [3000, b => b.notifica('Tags pasted', 'success')]]));
dice('lo STESSO messaggio di nuovo dopo 3 s (copia premuto due volte): sparisce a 7 s', 7000,
    await prova([[0, copiati], [3000, copiati]]));
dice('e cosi\' anche mentre l\'utente scrive: sparisce a 7 s', 7000,
    await prova([[0, copiati], [3000, copiati], ...ogni(1000, 12000, b => b.digita())]));

console.log('\n--- quello che NON deve cambiare ---');
dice('senza altro in corso: sparisce a 4 s', 4000, await prova([[0, copiati]]));
const nuove = app.match(/setToast\(\{ show: true[^\n]*\}\)/g) || [];
dice('ogni notifica nuova in App.tsx porta il suo id (almeno 3 punti: showNotification, Ctrl+Z, Ctrl+Shift+Z)', [true, true],
    [nuove.length >= 3, nuove.every(n => /\bid: /.test(n))]);

process.exit(esito());
