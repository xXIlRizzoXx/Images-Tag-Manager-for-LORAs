/* ITALIANO: PROVA DELLA X DI UNA PILLOLA DOPO CHE LA CARD SI E' RIORDINATA
   Card di una foto con "blue eyes, cat, dog". Si scrive "apple" nella casella della card senza
   Invio e si clicca la X di "dog". Alla pressione del mouse la casella perde il fuoco: "apple"
   diventa un tag e la card si riordina in alfabetico ("apple, blue eyes, cat, dog"). Le pillole
   avevano come key la loro posizione e la X toglieva per posizione: React riusava il pulsante della
   posizione 2, che ora era di "cat", e il clic toglieva "cat" invece di "dog". Il caso tipico e' la
   correzione di un tag: si scrive "blond hair" e si clicca la X di "blonde hair", e sparisce il tag
   appena scritto. Prima correzione: key legata al tag e X che toglie per valore. Restava un
   difetto: nel browser il clic arriva all'elemento che sta SOTTO il puntatore al rilascio; dopo
   il riordino li' c'era un'altra pillola, il clic finiva al contenitore e il primo clic andava a
   vuoto. La regola: premere la X non toglie il fuoco alla casella (onMouseDown con
   preventDefault), quindi niente riordino prima del clic. Il clic toglie il suo tag e, nello
   stesso aggiornamento, fa entrare il testo scritto (come faceva il blur): lasciarlo nella
   casella lo perdeva se la card spariva (ricerca per tag attiva). Poi la casella viene lasciata
   senza un secondo inserimento, cosi' Ctrl+Z annulla la X invece di restare al campo di testo.
   Si esegue il TagInput VERO di src/components/ui.tsx con un React finto, senza DOM, e un modello
   del browser: il blur avviene solo se la pressione non e' stata annullata, e il clic arriva al
   pulsante solo se nella stessa posizione c'e' ancora la stessa pillola.
   Uso:  node scripts/test-tag-input-remove-after-reorder.mjs   (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF A PILL'S X AFTER THE CARD HAS REORDERED ITSELF
   A photo's card with "blue eyes, cat, dog". "apple" is typed in the card's box without Enter and
   the X of "dog" is clicked. On mouse down the box loses focus: "apple" becomes a tag and the card
   reorders alphabetically ("apple, blue eyes, cat, dog"). The pills used their position as key and
   the X removed by position: React reused the button at position 2, which now belonged to "cat",
   and the click removed "cat" instead of "dog". The typical case is correcting a tag: typing
   "blond hair" and clicking the X of "blonde hair" removed the tag just typed. The rule: every pill
   First fix: key tied to the tag and X removing by value. A defect remained: in the browser the
   click reaches the element UNDER the pointer on release; after the reorder another pill was
   there, the click went to the container and the first click was lost. The rule: pressing the X
   does not take the focus from the box (onMouseDown with preventDefault), so no reorder before
   the click. The click removes its tag and, in the same update, puts the typed text in (as the
   blur did): leaving it in the box lost it when the card disappeared (tag search active). Then
   the box is left without a second insertion, so Ctrl+Z undoes the X instead of staying with
   the text field.
   The REAL TagInput of src/components/ui.tsx runs with a fake React, no DOM, and a browser model:
   the blur happens only if the press was not cancelled, and the click reaches the button only if
   the same pill is still at the same position.
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

// ITALIANO: scrive `testo` nella casella (se c'e'), preme il mouse sulla X della pillola `bersaglio`:
//           se la pressione non e' annullata la casella perde il fuoco (blur) e React ridisegna.
//           Al rilascio il browser manda il clic all'elemento sotto il puntatore: se nella stessa
//           posizione c'e' un'altra pillola il clic va al contenitore e non toglie niente.
//           `regola` e' quello che fa chi riceve setTags (la card riordina, le trigger no).
//           Restituisce i tag e il testo rimasto nella casella.
// ENGLISH: types `testo` in the box (if any), presses the mouse on the X of the `bersaglio` pill:
//          unless the press is cancelled the box loses focus (blur) and React re-renders. On
//          release the browser sends the click to the element under the pointer: if another pill
//          sits at the same position the click goes to the container and removes nothing.
//          `regola` is what the setTags receiver does (the card reorders, the triggers do not).
//          Returns the tags and the text left in the box.
const clicX = (iniziali, testo, bersaglio, { regola = (n) => n, isGlobal = false, occorrenza = 0 } = {}) => {
    globalThis.__GANCI__ = { i: 0, v: {} };
    globalThis.document = { hasFocus: () => true };
    let tags = [...iniziali];
    const disegna = () => { globalThis.__GANCI__.i = 0; return UI.TagInput({ tags, setTags: (n) => { tags = regola(n); }, isGlobal, lang: 'en' }); };
    const casella = () => trova(disegna(), n => n.type === 'input')[0];
    const fine = (errore) => { const r = { tags, casella: casella().props.value, errore }; delete globalThis.document; return r; };
    if (testo) casella().props.onChange({ target: { value: testo } });
    const prima = disegna();
    const tutte = pillole(prima);
    const premuta = tutte.filter(p => p.testo === bersaglio)[occorrenza];
    if (!premuta) return fine('pillola non trovata: ' + bersaglio);
    const posto = tutte.indexOf(premuta);
    let annullata = false;
    const pulsantePremuto = trova(premuta.nodo.props.children, n => n.type === 'button')[0];
    pulsantePremuto.props.onMouseDown?.({ preventDefault() { annullata = true; }, stopPropagation() { } });
    if (!annullata) trova(prima, n => n.type === 'input')[0].props.onBlur({ target: {} });
    const sotto = pillole(disegna())[posto];
    if (!sotto || sotto.key !== premuta.key) return fine('clic perso');
    trova(sotto.nodo.props.children, n => n.type === 'button')[0].props.onClick({ stopPropagation() { } });
    return fine('');
};

console.log('\n--- card della galleria: testo senza Invio, poi X su una pillola ---');
dice('"apple" scritto, X su "dog": al primo clic sparisce "dog" ed entra "apple"',
    { tags: ['apple', 'blue eyes', 'cat'], casella: '', errore: '' }, clicX(['blue eyes', 'cat', 'dog'], 'apple', 'dog', { regola: regolaCard([]) }));
dice('correzione: "blond hair" scritto, X su "blonde hair": al primo clic resta solo il nuovo',
    { tags: ['blond hair', 'smile'], casella: '', errore: '' }, clicX(['blonde hair', 'smile'], 'blond hair', 'blonde hair', { regola: regolaCard([]) }));
dice('con una trigger davanti: "bird" scritto, X su "dog"',
    { tags: ['ohwx', 'bird', 'cat'], casella: '', errore: '' }, clicX(['ohwx', 'cat', 'dog'], 'bird', 'dog', { regola: regolaCard(['ohwx']) }));
dice('tag nuovo che finisce in fondo: "zebra" scritto, X su "cat"',
    { tags: ['blue eyes', 'dog', 'zebra'], casella: '', errore: '' }, clicX(['blue eyes', 'cat', 'dog'], 'zebra', 'cat', { regola: regolaCard([]) }));

dice('"dog" scritto di nuovo, X su "dog": sparisce, come col blur seguito dalla X',
    { tags: ['cat'], casella: '', errore: '' }, clicX(['cat', 'dog'], 'dog', 'dog', { regola: regolaCard([]) }));
{
    // ITALIANO: dopo la X la casella va lasciata (Ctrl+Z del progetto non agisce dentro un campo di
    //           testo), e quel blur non deve inserire il testo una seconda volta sui tag vecchi.
    // ENGLISH: after the X the box must be left (the project's Ctrl+Z does not act inside a text
    //          field), and that blur must not insert the text a second time over the old tags.
    globalThis.__GANCI__ = { i: 0, v: {} };
    let tags = ['blonde hair', 'smile'];
    let lasciata = false;
    const disegna = () => { globalThis.__GANCI__.i = 0; return UI.TagInput({ tags, setTags: (n) => { tags = regolaCard([])(n); }, lang: 'en' }); };
    const casella = () => trova(disegna(), n => n.type === 'input')[0];
    const elemento = { blur() { lasciata = true; globalThis.document.activeElement = null; casella().props.onBlur({ target: {} }); } };
    globalThis.document = { hasFocus: () => true, activeElement: elemento };
    casella().props.ref.current = elemento;
    casella().props.onChange({ target: { value: 'blond hair' } });
    const pillola = pillole(disegna()).find(p => p.testo === 'blonde hair');
    trova(pillola.nodo.props.children, n => n.type === 'button')[0].props.onClick({ stopPropagation() { } });
    dice('dopo la X la casella viene lasciata', true, lasciata);
    dice('il blur della casella lasciata non rimette il tag tolto', ['blond hair', 'smile'], tags);
    // ITALIANO: il blur vero successivo funziona di nuovo normalmente.
    // ENGLISH: the next real blur works normally again.
    globalThis.document.activeElement = elemento;
    casella().props.onChange({ target: { value: 'red' } });
    casella().props.onBlur({ target: {} });
    dice('il blur seguente fa entrare il testo come sempre', ['blond hair', 'red', 'smile'], tags);
    delete globalThis.document;
}

{
    // ITALIANO: il cursore e' nella casella di un'altra card (A, con "foo" scritto) e si clicca la X
    //           di una pillola della card B: la casella di A va lasciata, "foo" entra in A con le
    //           regole di A, e B perde solo il tag cliccato.
    // ENGLISH: the cursor is in another card's box (A, with "foo" typed) and the X of a pill of card
    //          B is clicked: A's box must be left, "foo" goes into A with A's rules, and B loses only
    //          the clicked tag.
    const ganciA = { i: 0, v: {} }, ganciB = { i: 0, v: {} };
    let tagsA = ['cat'], tagsB = ['blue eyes', 'smile'];
    const disegnaA = () => { globalThis.__GANCI__ = ganciA; ganciA.i = 0; return UI.TagInput({ tags: tagsA, setTags: (n) => { tagsA = regolaCard([])(n); }, lang: 'en' }); };
    const disegnaB = () => { globalThis.__GANCI__ = ganciB; ganciB.i = 0; return UI.TagInput({ tags: tagsB, setTags: (n) => { tagsB = regolaCard([])(n); }, lang: 'en' }); };
    const casellaA = () => trova(disegnaA(), n => n.type === 'input')[0];
    const elementoA = { blur() { globalThis.document.activeElement = null; casellaA().props.onBlur({ target: {} }); } };
    globalThis.document = { hasFocus: () => true, activeElement: elementoA };
    casellaA().props.ref.current = elementoA;
    casellaA().props.onChange({ target: { value: 'foo' } });
    const pillola = pillole(disegnaB()).find(p => p.testo === 'smile');
    trova(pillola.nodo.props.children, n => n.type === 'button')[0].props.onClick({ stopPropagation() { } });
    // ITALIANO: la casella di un'altra card si lascia dopo il ridisegno (vedi
    //           test-tag-input-remove-trigger-pending-text.mjs): si aspetta un giro.
    // ENGLISH: another card's box is left after the re-render (see
    //          test-tag-input-remove-trigger-pending-text.mjs): wait one turn.
    await new Promise(r => setTimeout(r, 5));
    dice('X nella card B con il cursore nella card A: A lasciata, "foo" entra in A, B perde "smile"',
        { a: ['cat', 'foo'], b: ['blue eyes'], fuoco: null }, { a: tagsA, b: tagsB, fuoco: globalThis.document.activeElement });
    delete globalThis.document;
}

console.log('\n--- quello che NON deve cambiare ---');
dice('X senza aver scritto niente: sparisce il tag cliccato',
    { tags: ['a', 'c'], casella: '', errore: '' }, clicX(['a', 'b', 'c'], '', 'b', { regola: regolaCard([]) }));
dice('riquadro delle trigger (non riordina): "zz" scritto, X su "tok"',
    { tags: ['ohwx', 'zz'], casella: '', errore: '' }, clicX(['tok', 'ohwx'], 'zz', 'tok', { isGlobal: true }));
dice('due tag identici (caso teorico): la X del secondo ne toglie uno solo',
    { tags: ['a', 'b'], casella: '', errore: '' }, clicX(['a', 'a', 'b'], '', 'a', { occorrenza: 1 }));
{
    globalThis.__GANCI__ = { i: 0, v: {} };
    const chiavi = pillole(UI.TagInput({ tags: ['a', 'a', 'b'], setTags: () => { }, lang: 'en' })).map(p => p.key);
    dice('le key delle pillole non si ripetono, anche con due tag identici', 3, new Set(chiavi).size);
}
{
    // ITALIANO: il testo lasciato nella casella entra ancora uscendo dalla casella (blur).
    // ENGLISH: the text left in the box still goes in when leaving the box (blur).
    globalThis.__GANCI__ = { i: 0, v: {} };
    globalThis.document = { hasFocus: () => true };
    let tags = ['cat'];
    const campo = () => { globalThis.__GANCI__.i = 0; return trova(UI.TagInput({ tags, setTags: (n) => { tags = n; }, lang: 'en' }), n => n.type === 'input')[0]; };
    campo().props.onChange({ target: { value: 'apple' } });
    campo().props.onBlur({ target: {} });
    delete globalThis.document;
    dice('il testo rimasto nella casella entra al blur', ['cat', 'apple'], tags);
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
