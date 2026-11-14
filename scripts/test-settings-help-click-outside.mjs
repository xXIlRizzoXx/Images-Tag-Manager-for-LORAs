/* ITALIANO: PROVA DEL CLIC FUORI DALLA FINESTRA DI AIUTO «?» CON UN CLIC VERO
   La finestra di aiuto si chiude con un clic sullo sfondo scuro, e il pannello Impostazioni (o la
   finestrella del semaforo MCP) sotto deve restare aperto, come con Chiudi o Esc. Con un clic vero
   React 19 ridisegna in un microtask subito dopo il proprio gestore, e il browser svuota i microtask
   prima di passare all'ascolto sul documento: la finestra era gia' smontata, aiutoRef valeva null e
   l'ascolto chiudeva anche il pannello e la finestrella MCP. Un evento finto consegnato tutto di fila
   non lo mostra: qui un DOM finto minimo consegna l'evento come un clic vero (microtask fra un
   ascoltatore e l'altro), con il React vero del progetto, il gestore VERO handleClickOutside e il
   gestore VERO dello sfondo presi da src/App.tsx.
   Uso:  node scripts/test-settings-help-click-outside.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE CLICK OUTSIDE THE "?" HELP WINDOW WITH A REAL CLICK
   The help window closes with a click on the dark backdrop, and the Settings panel (or the small
   MCP light window) below must stay open, as with Close or Esc. With a real click React 19 re-renders
   in a microtask right after its own handler, and the browser drains microtasks before reaching the
   document listener: the window was already unmounted, aiutoRef was null and the listener also
   closed the panel and the MCP window. A fake event delivered all at once does not show it: here a
   minimal fake DOM delivers the event like a real click (microtasks between listeners), with the
   project's real React, the REAL handleClickOutside and the REAL backdrop handler from src/App.tsx.
   Usage:  node scripts/test-settings-help-click-outside.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sorgente = fs.readFileSync(process.argv[2] || path.join(radice, 'src/App.tsx'), 'utf8');
const { dice, esito } = creaControlli();

// --- i due gestori veri di App.tsx
const gestore = /\n        function handleClickOutside\(event: any\) \{[\s\S]*?\r?\n        \}\r?\n/.exec(sorgente);
const sfondo = /<div ref=\{aiutoRef\}[^\r\n]*\r?\n\s*onMouseDown=\{(.+)\}\r?\n/.exec(sorgente);
if (!gestore || !sfondo) { console.log('NO  gestori della finestra di aiuto non trovati in src/App.tsx'); process.exit(1); }
const clicFuori = new Function('aiutoRef', 'settingsRef', 'setIsSettingsOpen', 'mcpFinestraRef', 'setMcpFinestraAperta',
    (await esbuild.transform(gestore[0], { loader: 'ts' })).code + '\nreturn handleClickOutside;');
const sulloSfondo = new Function('setAiuto', 'return ' + (await esbuild.transform('(' + sfondo[1] + ')', { loader: 'ts' })).code);

// --- DOM finto minimo, quanto basta a react-dom 19
class Nodo {
    constructor(doc, tipo, nome) { this.ownerDocument = doc; this.nodeType = tipo; this.nodeName = nome; this.childNodes = []; this.parentNode = null; this._asc = []; }
    get firstChild() { return this.childNodes[0] || null; }
    get lastChild() { return this.childNodes[this.childNodes.length - 1] || null; }
    get nextSibling() { const p = this.parentNode; if (!p) return null; return p.childNodes[p.childNodes.indexOf(this) + 1] || null; }
    get previousSibling() { const p = this.parentNode; if (!p) return null; return p.childNodes[p.childNodes.indexOf(this) - 1] || null; }
    appendChild(f) { if (f.parentNode) f.parentNode.removeChild(f); this.childNodes.push(f); f.parentNode = this; return f; }
    insertBefore(f, rif) { if (f.parentNode) f.parentNode.removeChild(f); const i = rif ? this.childNodes.indexOf(rif) : this.childNodes.length; this.childNodes.splice(i, 0, f); f.parentNode = this; return f; }
    removeChild(f) { const i = this.childNodes.indexOf(f); if (i >= 0) this.childNodes.splice(i, 1); f.parentNode = null; return f; }
    contains(altro) { for (let n = altro; n; n = n.parentNode) if (n === this) return true; return false; }
    addEventListener(tipo, fn, opz) { const cattura = opz === true || !!(opz && opz.capture); this._asc.push({ tipo, fn, cattura }); }
    removeEventListener(tipo, fn, opz) { const cattura = opz === true || !!(opz && opz.capture); this._asc = this._asc.filter(a => !(a.tipo === tipo && a.fn === fn && a.cattura === cattura)); }
    set textContent(v) { this.childNodes.forEach(c => { c.parentNode = null; }); this.childNodes = []; if (v) this.appendChild(new Testo(this.ownerDocument, String(v))); }
    get textContent() { return this.childNodes.map(c => c.textContent).join(''); }
}
class Testo extends Nodo { constructor(doc, v) { super(doc, 3, '#text'); this.nodeValue = v; } get textContent() { return this.nodeValue; } set textContent(v) { this.nodeValue = v; } }
class Elemento extends Nodo {
    constructor(doc, tag) { super(doc, 1, tag.toUpperCase()); this.tagName = tag.toUpperCase(); this.namespaceURI = 'http://www.w3.org/1999/xhtml'; this.attr = {}; this.style = {}; }
    setAttribute(k, v) { this.attr[k] = String(v); } removeAttribute(k) { delete this.attr[k]; } getAttribute(k) { return k in this.attr ? this.attr[k] : null; } hasAttribute(k) { return k in this.attr; }
    get id() { return this.attr.id || ''; }
}
class Documento extends Nodo {
    constructor() { super(null, 9, '#document'); this.documentElement = new Elemento(this, 'html'); this.body = new Elemento(this, 'body'); this.appendChild(this.documentElement); this.documentElement.appendChild(this.body); this.activeElement = this.body; }
    createElement(tag) { return new Elemento(this, tag); }
    createElementNS(_ns, tag) { return new Elemento(this, tag); }
    createTextNode(v) { return new Testo(this, v); }
    createComment(v) { const n = new Nodo(this, 8, '#comment'); n.nodeValue = v; return n; }
    getElementById(id) { const cerca = (n) => { if (n.nodeType === 1 && n.id === id) return n; for (const c of n.childNodes) { const t = cerca(c); if (t) return t; } return null; }; return cerca(this); }
}
const document = new Documento();
document.defaultView = globalThis;
globalThis.window = globalThis;
globalThis.document = document;
globalThis.HTMLElement = Elemento;
globalThis.HTMLIFrameElement = class {};

// ITALIANO: consegna come il browser: cattura dall'alto, poi bolla dal bersaglio al documento; con un
//           clic vero i microtask girano fra un ascoltatore e l'altro.
// ENGLISH: delivery like the browser: capture from the top, then bubble from the target to the
//          document; with a real click microtasks run between one listener and the next.
async function consegna(tipo, bersaglio) {
    const catena = []; for (let n = bersaglio; n; n = n.parentNode) catena.push(n);
    const ev = { type: tipo, target: bersaglio, srcElement: bersaglio, bubbles: true, cancelable: true, isTrusted: true, timeStamp: Date.now(), button: 0, buttons: 1,
        defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this._stop = true; }, getModifierState() { return false; }, composedPath() { return catena; } };
    const giro = async (nodi, cattura) => {
        for (const n of nodi) {
            for (const a of [...n._asc]) {
                if (a.tipo !== tipo || a.cattura !== cattura) continue;
                ev.currentTarget = n; globalThis.event = ev;
                a.fn.call(n, ev);
                globalThis.event = undefined;
                await Promise.resolve(); await Promise.resolve();
            }
            if (ev._stop) return;
        }
    };
    await giro([...catena].reverse(), true);
    if (!ev._stop) await giro(catena, false);
}
const riposo = () => new Promise(r => setTimeout(r, 30));

process.env.NODE_ENV = 'production';
const richiedi = createRequire(path.join(radice, 'package.json'));
const React = richiedi('react');
const { createRoot } = richiedi('react-dom/client');
const h = React.createElement;
let stato = {};
function App() {
    const [aiuto, setAiuto] = React.useState('mcp');
    const [isSettingsOpen, setIsSettingsOpen] = React.useState(true);
    const [mcpFinestraAperta, setMcpFinestraAperta] = React.useState(true);
    const aiutoRef = React.useRef(null);
    const settingsRef = React.useRef(null);
    const mcpFinestraRef = React.useRef(null);
    stato = { aiuto, isSettingsOpen, mcpFinestraAperta, setAiuto, setIsSettingsOpen, setMcpFinestraAperta };
    React.useEffect(() => {
        const fn = clicFuori(aiutoRef, settingsRef, setIsSettingsOpen, mcpFinestraRef, setMcpFinestraAperta);
        document.addEventListener('mousedown', fn);
        return () => document.removeEventListener('mousedown', fn);
    }, []);
    return h('div', { id: 'app' },
        h('div', { id: 'galleria' }, 'galleria'),
        aiuto && h('div', { ref: aiutoRef, id: 'sfondo', onMouseDown: sulloSfondo(setAiuto) },
            h('div', { id: 'riquadro' }, h('p', { id: 'testo' }, 'spiegazione'))),
        h('div', { ref: settingsRef, id: 'impostazioni' }, isSettingsOpen ? h('div', { id: 'pannello' }, 'pannello') : null),
        h('div', { ref: mcpFinestraRef, id: 'semaforo' }, mcpFinestraAperta ? h('div', { id: 'finestrella' }, 'mcp') : null));
}
const contenitore = document.createElement('div');
contenitore.setAttribute('id', 'root');
document.body.appendChild(contenitore);
createRoot(contenitore).render(h(App));
await riposo();
const riapri = async () => { stato.setAiuto('mcp'); stato.setIsSettingsOpen(true); stato.setMcpFinestraAperta(true); await riposo(); };
const quadro = () => ({ aiuto: !!stato.aiuto, impostazioni: stato.isSettingsOpen, mcp: stato.mcpFinestraAperta });

console.log('\n--- clic vero sullo sfondo scuro della finestra di aiuto ---');
await consegna('mousedown', document.getElementById('sfondo')); await riposo();
dice('si chiude la finestra di aiuto, il pannello Impostazioni e la finestrella MCP restano aperti',
    { aiuto: false, impostazioni: true, mcp: true }, quadro());

console.log('\n--- casi vicini che non devono cambiare ---');
await riapri();
await consegna('mousedown', document.getElementById('testo')); await riposo();
dice('clic dentro il riquadro: resta aperto tutto', { aiuto: true, impostazioni: true, mcp: true }, quadro());
await consegna('mousedown', document.getElementById('pannello')); await riposo();
dice('clic nel pannello con la finestra aperta: resta aperto tutto (la finestrella MCP si chiude, come prima)',
    { aiuto: true, impostazioni: true, mcp: false }, quadro());
stato.setAiuto(null); await riposo();
stato.setMcpFinestraAperta(true); await riposo();
await consegna('mousedown', document.getElementById('galleria')); await riposo();
dice('senza finestra di aiuto, un clic nella galleria chiude ancora pannello e finestrella MCP',
    { aiuto: false, impostazioni: false, mcp: false }, quadro());

process.exit(esito());
