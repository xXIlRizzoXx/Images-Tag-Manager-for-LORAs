/* ITALIANO: PROVA DELLA X DI UNA PILLOLA DOPO CHE LA CARD SI E' RIORDINATA
   Card di una foto con "blue eyes, cat, dog". Si scrive "apple" nella casella della card senza
   Invio e si clicca la X di "dog". Alla pressione del mouse la casella perde il fuoco: "apple"
   diventa un tag e la card si riordina in alfabetico ("apple, blue eyes, cat, dog"). Le pillole
   avevano come key la loro posizione e la X toglieva per posizione: React riusava il pulsante della
   posizione 2, che ora era di "cat", e il clic toglieva "cat" invece di "dog". Il caso tipico e' la
   correzione di un tag: si scrive "blond hair" e si clicca la X di "blonde hair", e sparisce il tag
   appena scritto. La regola: ogni pillola ha una key legata al suo tag e la X toglie quel tag,
   qualunque sia la sua posizione dopo il riordino.
   Si esegue il TagInput VERO di src/components/ui.tsx con un React finto, senza DOM: come fa
   React, il clic arriva al pulsante che nel disegno nuovo ha la STESSA key di quello premuto.
   Uso:  node scripts/test-tag-input-remove-after-reorder.mjs   (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF A PILL'S X AFTER THE CARD HAS REORDERED ITSELF
   A photo's card with "blue eyes, cat, dog". "apple" is typed in the card's box without Enter and
   the X of "dog" is clicked. On mouse down the box loses focus: "apple" becomes a tag and the card
   reorders alphabetically ("apple, blue eyes, cat, dog"). The pills used their position as key and
   the X removed by position: React reused the button at position 2, which now belonged to "cat",
   and the click removed "cat" instead of "dog". The typical case is correcting a tag: typing
   "blond hair" and clicking the X of "blonde hair" removed the tag just typed. The rule: every pill
   has a key tied to its tag and the X removes that tag, whatever its position after the reorder.
   The REAL TagInput of src/components/ui.tsx runs with a fake React, no DOM: as React does, the
   click reaches the button that has the SAME key as the pressed one in the new render.
   Usage:  node scripts/test-tag-input-remove-after-reorder.mjs   (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();

// ITALIANO: React finto e lucide-react finto, come in test-tag-input-blur.mjs.
// ENGLISH: fake React and fake lucide-react, as in test-tag-input-blur.mjs.
const testoUi = fs.readFileSync(path.join(radice, 'src/components/ui.tsx'), 'utf8');
const icone = new Set();
for (const m of testoUi.matchAll(/import\s*\{([^}]*)\}\s*from\s*'lucide-react'/g)) {
    m[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0]).filter(Boolean).forEach(n => icone.add(n));
}
const finti = {
    name: 'finti',
    setup(b) {
        b.onResolve({ filter: /^react$/ }, () => ({ path: 'react', namespace: 'finto' }));
        b.onResolve({ filter: /^react\/jsx-runtime$/ }, () => ({ path: 'jsx', namespace: 'finto' }));
        b.onResolve({ filter: /^lucide-react$/ }, () => ({ path: 'lucide', namespace: 'finto' }));
        b.onResolve({ filter: /soundManager$/ }, () => ({ path: 'suoni', namespace: 'finto' }));
        b.onLoad({ filter: /.*/, namespace: 'finto' }, (a) => {
            if (a.path === 'react') return { loader: 'js', contents: `
                const G = () => globalThis.__GANCI__;
                export const useState = (v) => { const S = G(); const i = S.i++; if (!(i in S.v)) S.v[i] = typeof v === 'function' ? v() : v; return [S.v[i], (x) => { S.v[i] = typeof x === 'function' ? x(S.v[i]) : x; }]; };
                export const useRef = (v) => { const S = G(); const i = S.i++; if (!(i in S.v)) S.v[i] = { current: v }; return S.v[i]; };
                export const useEffect = () => {};
                export const useCallback = (f) => f;
                export const useMemo = (f) => f();
                const React = { useState, useRef, useEffect, useCallback, useMemo, memo: (c) => c };
                export default React;` };
            if (a.path === 'jsx') return { loader: 'js', contents: `
                export const jsx = (type, props, key) => ({ type, props, key });
                export const jsxs = jsx; export const Fragment = 'Fragment';` };
            if (a.path === 'lucide') return { loader: 'js', contents: `const I = () => null; export const ${[...icone].map(n => n + ' = I').join(', ')};` };
            return { loader: 'js', contents: 'export const soundManager = { pop(){}, click(){}, chime(){}, enabled: false };' };
        });
    },
};
const carica = async (file, plugins = []) => {
    const r = await esbuild.build({
        entryPoints: [path.join(radice, file)], bundle: true, format: 'esm', platform: 'node', write: false,
        plugins, logLevel: 'silent', jsx: 'automatic', absWorkingDir: radice,
    });
    return import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64'));
};
const UI = await carica('src/components/ui.tsx', [finti]);
const TC = await carica('src/utils/tagCase.ts');
const trova = (nodo, prova, fuori = []) => {
    if (!nodo || typeof nodo !== 'object') return fuori;
    if (Array.isArray(nodo)) { nodo.forEach(n => trova(n, prova, fuori)); return fuori; }
    if (prova(nodo)) fuori.push(nodo);
    if (nodo.props) trova(nodo.props.children, prova, fuori);
    return fuori;
};
// ITALIANO: le pillole sono gli span con una key; il testo del tag e' il loro figlio di tipo stringa.
// ENGLISH: pills are the spans with a key; the tag text is their string child.
const pillole = (albero) => trova(albero, n => n.type === 'span' && n.key !== undefined && n.key !== null)
    .map(p => ({ key: p.key, testo: [].concat(p.props.children).find(c => typeof c === 'string'), nodo: p }));

// ITALIANO: la stessa regola di updateImageTags (src/App.tsx): doppioni senza maiuscole, prima le
//           trigger nel loro ordine, poi gli altri tag in ordine alfabetico.
// ENGLISH: the same rule as updateImageTags (src/App.tsx): case-insensitive duplicates, triggers
//          first in their order, then the other tags alphabetically.
const regolaCard = (trigger) => (nuovi) => {
    const unici = TC.uniqueTagsIgnoringCase(nuovi, trigger);
    return [...trigger.filter(t => unici.includes(t)), ...unici.filter(t => !trigger.includes(t)).sort((a, b) => a.localeCompare(b))];
};

// ITALIANO: scrive `testo` nella casella (se c'e'), preme il mouse sulla X della pillola `bersaglio`
//           (la casella perde il fuoco), React ridisegna e il clic arriva al pulsante con la stessa
//           key. `regola` e' quello che fa chi riceve setTags (la card riordina, le trigger no).
// ENGLISH: types `testo` in the box (if any), presses the mouse on the X of the `bersaglio` pill (the
//          box loses focus), React re-renders and the click reaches the button with the same key.
//          `regola` is what the setTags receiver does (the card reorders, the triggers do not).
const clicX = (iniziali, testo, bersaglio, { regola = (n) => n, isGlobal = false, occorrenza = 0 } = {}) => {
    globalThis.__GANCI__ = { i: 0, v: {} };
    globalThis.document = { hasFocus: () => true };
    let tags = [...iniziali];
    const disegna = () => { globalThis.__GANCI__.i = 0; return UI.TagInput({ tags, setTags: (n) => { tags = regola(n); }, isGlobal, lang: 'en' }); };
    if (testo) trova(disegna(), n => n.type === 'input')[0].props.onChange({ target: { value: testo } });
    const prima = disegna();
    const premuta = pillole(prima).filter(p => p.testo === bersaglio)[occorrenza];
    if (!premuta) { delete globalThis.document; return { tags, errore: 'pillola non trovata: ' + bersaglio }; }
    trova(prima, n => n.type === 'input')[0].props.onBlur({ target: {} });
    const dopo = pillole(disegna()).find(p => p.key === premuta.key);
    if (!dopo) { delete globalThis.document; return { tags, errore: '' }; }
    const pulsante = trova(dopo.nodo.props.children, n => n.type === 'button')[0];
    pulsante.props.onClick({ stopPropagation() { } });
    delete globalThis.document;
    return { tags, errore: '' };
};

console.log('\n--- card della galleria: testo senza Invio, poi X su una pillola ---');
dice('"apple" scritto, X su "dog": sparisce "dog", "cat" resta',
    { tags: ['apple', 'blue eyes', 'cat'], errore: '' }, clicX(['blue eyes', 'cat', 'dog'], 'apple', 'dog', { regola: regolaCard([]) }));
dice('correzione: "blond hair" scritto, X su "blonde hair": resta il tag nuovo',
    { tags: ['blond hair', 'smile'], errore: '' }, clicX(['blonde hair', 'smile'], 'blond hair', 'blonde hair', { regola: regolaCard([]) }));
dice('con una trigger davanti: "bird" scritto, X su "dog"',
    { tags: ['ohwx', 'bird', 'cat'], errore: '' }, clicX(['ohwx', 'cat', 'dog'], 'bird', 'dog', { regola: regolaCard(['ohwx']) }));
dice('tag nuovo che finisce in fondo: "zebra" scritto, X su "cat"',
    { tags: ['blue eyes', 'dog', 'zebra'], errore: '' }, clicX(['blue eyes', 'cat', 'dog'], 'zebra', 'cat', { regola: regolaCard([]) }));

console.log('\n--- quello che NON deve cambiare ---');
dice('X senza aver scritto niente: sparisce il tag cliccato',
    { tags: ['a', 'c'], errore: '' }, clicX(['a', 'b', 'c'], '', 'b', { regola: regolaCard([]) }));
dice('riquadro delle trigger (non riordina): "zz" scritto, X su "tok"',
    { tags: ['ohwx', 'zz'], errore: '' }, clicX(['tok', 'ohwx'], 'zz', 'tok', { isGlobal: true }));
dice('due tag identici (caso teorico): la X del secondo ne toglie uno solo',
    { tags: ['a', 'b'], errore: '' }, clicX(['a', 'a', 'b'], '', 'a', { occorrenza: 1 }));
{
    globalThis.__GANCI__ = { i: 0, v: {} };
    const chiavi = pillole(UI.TagInput({ tags: ['a', 'a', 'b'], setTags: () => { }, lang: 'en' })).map(p => p.key);
    dice('le key delle pillole non si ripetono, anche con due tag identici', 3, new Set(chiavi).size);
}
{
    globalThis.__GANCI__ = { i: 0, v: {} };
    let tags = ['a', 'b', 'c'];
    const campo = () => { globalThis.__GANCI__.i = 0; return trova(UI.TagInput({ tags, setTags: (n) => { tags = n; }, lang: 'en' }), n => n.type === 'input')[0]; };
    campo().props.onKeyDown({ key: 'Backspace', preventDefault() { } });
    dice('Backspace con la casella vuota toglie ancora l\'ultimo tag', ['a', 'b'], tags);
}
{
    globalThis.__GANCI__ = { i: 0, v: {} };
    const albero = UI.TagInput({ tags: ['smile'], setTags: () => { throw new Error('non deve scrivere'); }, readOnly: true, lang: 'en' });
    dice('card in sola lettura: nessuna X', 0, trova(albero, n => n.type === 'button').length);
}

process.exit(esito());
