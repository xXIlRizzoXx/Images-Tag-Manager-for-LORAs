/* ITALIANO: PROVA DEL TESTO SCRITTO NELLA CASELLA DEI TAG SENZA PREMERE INVIO
   Scritto "ohwx" nel riquadro "Trigger Words Globali" senza premere Invio, e premuto "Salva
   Modifiche", compariva il messaggio verde ma nessun .txt conteneva ohwx: il testo restava nella
   casella e sembrava applicato. Lo stesso con la casella della card di una foto. Il 2.0.1 aveva
   corretto lo stesso caso solo nell'editor dei file di tag. La regola: uscendo dalla casella (per
   esempio con il clic su "Salva Modifiche") il testo in attesa diventa un tag, come con Invio; un
   tag che c'e' gia' (anche scritto con maiuscole diverse) non si ripete e la casella si svuota.
   Passando a un'altra finestra (Alt+Tab) la casella perde il fuoco ma la parola, forse scritta a
   meta', resta li' com'e'.
   Si esegue il TagInput VERO di src/components/ui.tsx con un React finto, senza DOM.
   Uso:  node scripts/test-tag-input-blur.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF TEXT TYPED IN THE TAG BOX WITHOUT PRESSING ENTER
   With "ohwx" typed in the "Global Trigger Words" box without pressing Enter, and "Save Changes"
   pressed, the green message appeared but no .txt contained ohwx: the text stayed in the box and
   looked applied. The same with the box on a photo's card. 2.0.1 had fixed the same case only in
   the tag file editor. The rule: leaving the box (for example by clicking "Save Changes") turns
   the pending text into a tag, like Enter; a tag already there (also spelled with different case)
   is not repeated and the box is emptied. Switching to another window (Alt+Tab) the box loses
   focus but the word, perhaps half typed, stays there as it is.
   The REAL TagInput of src/components/ui.tsx runs with a fake React, no DOM.
   Usage:  node scripts/test-tag-input-blur.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();

// ITALIANO: un React finto con useState/useRef a ganci numerati e un lucide-react finto (come in
//           test-tag-case-duplicates.mjs): il componente si chiama come una funzione e restituisce l'albero.
// ENGLISH: a fake React with numbered useState/useRef hooks and a fake lucide-react (as in
//          test-tag-case-duplicates.mjs): the component is called as a function and returns the tree.
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
const u = await esbuild.build({
    entryPoints: [path.join(radice, 'src/components/ui.tsx')], bundle: true, format: 'esm', platform: 'node', write: false,
    plugins: [finti], logLevel: 'silent', jsx: 'automatic', absWorkingDir: radice,
});
const UI = await import('data:text/javascript;base64,' + Buffer.from(u.outputFiles[0].text).toString('base64'));
const trova = (nodo, prova, fuori = []) => {
    if (!nodo || typeof nodo !== 'object') return fuori;
    if (Array.isArray(nodo)) { nodo.forEach(n => trova(n, prova, fuori)); return fuori; }
    if (prova(nodo)) fuori.push(nodo);
    if (nodo.props) trova(nodo.props.children, prova, fuori);
    return fuori;
};

// ITALIANO: scrive `testo` nella casella e poi la casella perde il fuoco. `finestraAttiva` e' quello
//           che dice document.hasFocus() in quel momento. Restituisce i tag, quante volte e' stato
//           chiamato setTags e cosa resta scritto nella casella.
// ENGLISH: types `testo` in the box, then the box loses focus. `finestraAttiva` is what
//          document.hasFocus() says at that moment. Returns the tags, how many times setTags was
//          called and what is left in the box.
const esci = (iniziali, testo, { isGlobal = false, finestraAttiva = true } = {}) => {
    globalThis.__GANCI__ = { i: 0, v: {} };
    globalThis.document = { hasFocus: () => finestraAttiva };
    let tags = [...iniziali];
    let chiamate = 0;
    const albero = () => { globalThis.__GANCI__.i = 0; return UI.TagInput({ tags, setTags: (n) => { tags = n; chiamate++; }, isGlobal, lang: 'en' }); };
    const campo = () => trova(albero(), n => n.type === 'input')[0];
    campo().props.onChange({ target: { value: testo } });
    let errore = '';
    try { campo().props.onBlur({ target: {} }); } catch (e) { errore = 'onBlur mancante: ' + e.message; }
    const r = { tags, chiamate, casella: campo().props.value, errore };
    delete globalThis.document;
    return r;
};

console.log('\n--- riquadro delle trigger: "ohwx" scritto senza Invio, poi clic su Salva ---');
dice('"ohwx" diventa una trigger e la casella si svuota', { tags: ['ohwx'], chiamate: 1, casella: '', errore: '' }, esci([], 'ohwx', { isGlobal: true }));
dice('con altre trigger gia\' presenti si aggiunge in fondo', ['tok', 'ohwx'], esci(['tok'], '  ohwx  ', { isGlobal: true }).tags);

console.log('\n--- casella della card di una foto ---');
dice('"red dress" senza Invio entra fra i tag della foto', { tags: ['smile', 'red dress'], chiamate: 1, casella: '', errore: '' }, esci(['smile'], 'red dress'));

console.log('\n--- quello che NON deve cambiare ---');
dice('"Smile" su una foto con "smile": nessun doppione, la casella si svuota', { tags: ['smile'], chiamate: 0, casella: '', errore: '' }, esci(['smile'], 'Smile'));
dice('casella vuota o con soli spazi: nessuna chiamata', [0, 0], [esci(['smile'], '').chiamate, esci(['smile'], '   ').chiamate]);
dice('Alt+Tab (finestra non attiva): la parola resta nella casella e non diventa un tag',
    { tags: [], chiamate: 0, casella: 'ohw', errore: '' }, esci([], 'ohw', { isGlobal: true, finestraAttiva: false }));
{
    globalThis.__GANCI__ = { i: 0, v: {} };
    const albero = UI.TagInput({ tags: ['smile'], setTags: () => { throw new Error('non deve scrivere'); }, readOnly: true, lang: 'en' });
    dice('card in sola lettura: nessuna casella', 0, trova(albero, n => n.type === 'input').length);
}
{
    // ITALIANO: Invio continua a fare quello che faceva.
    // ENGLISH: Enter keeps doing what it did.
    globalThis.__GANCI__ = { i: 0, v: {} };
    let tags = ['smile'];
    const campo = () => { globalThis.__GANCI__.i = 0; return trova(UI.TagInput({ tags, setTags: (n) => { tags = n; }, lang: 'en' }), n => n.type === 'input')[0]; };
    campo().props.onChange({ target: { value: 'hat' } });
    campo().props.onKeyDown({ key: 'Enter', preventDefault() { } });
    dice('Invio aggiunge il tag e svuota la casella', [['smile', 'hat'], ''], [tags, campo().props.value]);
}

process.exit(esito());
