/* ITALIANO: PROVA DI BACKSPACE TENUTO PREMUTO IN UNA CASELLA DEI TAG
   Nella casella di una card si scrive una parola sbagliata («smil») e la si cancella tenendo premuto
   Backspace, come in qualunque campo. Finito il testo la tastiera continua a mandare il tasto (circa
   30 volte al secondo, con repeat=true) e ogni ripetizione toglieva l'ultimo tag della foto; nel
   riquadro delle trigger toglieva una trigger da TUTTE le foto. La regola: la pressione singola a
   casella vuota toglie ancora l'ultimo tag (voluto), le ripetizioni automatiche non tolgono tag.
   Si esegue il TagInput VERO di src/components/ui.tsx con un React finto, senza DOM, e un modello
   del browser: quando il gestore non toglie un tag, Backspace cancella un carattere del testo.
   Uso:  node scripts/test-tag-input-backspace-repeat.mjs   (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF BACKSPACE HELD DOWN IN A TAG BOX
   In a card's box a wrong word («smil») is typed and erased by holding Backspace, as in any field.
   Once the text is gone the keyboard keeps sending the key (about 30 times a second, with
   repeat=true) and every repeat removed the photo's last tag; in the trigger box it removed a
   trigger from ALL the photos. The rule: a single press on an empty box still removes the last tag
   (on purpose), automatic repeats remove no tag.
   The REAL TagInput of src/components/ui.tsx runs with a fake React, no DOM, and a browser model:
   when the handler removes no tag, Backspace deletes one character of the text.
   Usage:  node scripts/test-tag-input-backspace-repeat.mjs   (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();

// ITALIANO: React finto e lucide-react finto, come in test-tag-input-remove-after-reorder.mjs.
// ENGLISH: fake React and fake lucide-react, as in test-tag-input-remove-after-reorder.mjs.
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
const r = await esbuild.build({
    entryPoints: [path.join(radice, 'src/components/ui.tsx')], bundle: true, format: 'esm', platform: 'node', write: false,
    plugins: [finti], logLevel: 'silent', jsx: 'automatic', absWorkingDir: radice,
});
const UI = await import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64'));
const trova = (nodo, prova, fuori = []) => {
    if (!nodo || typeof nodo !== 'object') return fuori;
    if (Array.isArray(nodo)) { nodo.forEach(n => trova(n, prova, fuori)); return fuori; }
    if (prova(nodo)) fuori.push(nodo);
    if (nodo.props) trova(nodo.props.children, prova, fuori);
    return fuori;
};

// ITALIANO: una casella con `iniziali` e il testo `testo`; `premi(n, repeat)` manda n keydown di
//           Backspace ridisegnando fra l'uno e l'altro (come React con un evento discreto). Se il
//           gestore non chiama setTags e non annulla il tasto, il browser cancella un carattere.
//           `isGlobal` e' il riquadro delle trigger (stesso componente, setTags diverso).
// ENGLISH: a box with `iniziali` and the text `testo`; `premi(n, repeat)` sends n Backspace keydowns
//          re-rendering between them (as React does with a discrete event). If the handler neither
//          calls setTags nor cancels the key, the browser deletes one character.
//          `isGlobal` is the trigger box (same component, different setTags).
const casella = (iniziali, testo = '', isGlobal = false) => {
    globalThis.__GANCI__ = { i: 0, v: {} };
    let tags = [...iniziali];
    let chiamate = 0;
    const input = () => {
        globalThis.__GANCI__.i = 0;
        return trova(UI.TagInput({ tags, setTags: (n) => { chiamate++; tags = n; }, isGlobal, lang: 'en' }), n => n.type === 'input')[0];
    };
    if (testo) input().props.onChange({ target: { value: testo } });
    const premi = (n, repeat) => {
        for (let k = 0; k < n; k++) {
            const campo = input();
            const prima = chiamate;
            let annullato = false;
            campo.props.onKeyDown({ key: 'Backspace', repeat, preventDefault() { annullato = true; } });
            if (chiamate === prima && !annullato && campo.props.value) campo.props.onChange({ target: { value: campo.props.value.slice(0, -1) } });
        }
    };
    return { premi, stato: () => ({ tags, testo: input().props.value, chiamate }) };
};

{
    // ITALIANO: il caso della segnalazione: «smil» cancellato tenendo premuto il tasto (1 pressione
    //           e 9 ripetizioni). Il testo sparisce, i 5 tag restano.
    // ENGLISH: the reported case: «smil» erased by holding the key (1 press and 9 repeats). The text
    //          goes, the 5 tags stay.
    const c = casella(['a', 'b', 'c', 'd', 'e'], 'smil');
    c.premi(1, false);
    c.premi(9, true);
    const s = c.stato();
    dice('Backspace tenuto premuto su «smil»: il testo sparisce', '', s.testo);
    dice('Backspace tenuto premuto su «smil»: i 5 tag della foto restano', ['a', 'b', 'c', 'd', 'e'], s.tags);
}
{
    const c = casella(['a', 'b', 'c']);
    c.premi(3, true);
    dice('casella vuota, 3 ripetizioni automatiche: nessun tag tolto', ['a', 'b', 'c'], c.stato().tags);
    dice('casella vuota, 3 ripetizioni automatiche: setTags mai chiamato', 0, c.stato().chiamate);
    c.premi(1, false);
    dice('poi una pressione singola toglie solo l\'ultimo tag', ['a', 'b'], c.stato().tags);
}
{
    // ITALIANO: riquadro delle trigger: lo stesso componente; ogni ripetizione toglieva una trigger da tutte le foto.
    // ENGLISH: trigger box: the same component; every repeat removed a trigger from all the photos.
    const c = casella(['ohwx', 'sks'], 'ab', true);
    c.premi(1, false);
    c.premi(5, true);
    dice('riquadro delle trigger: Backspace tenuto premuto su «ab» non toglie trigger', ['ohwx', 'sks'], c.stato().tags);
    dice('riquadro delle trigger: il testo sparisce', '', c.stato().testo);
}
{
    // ITALIANO: casi vicini che non devono cambiare: pressioni singole di seguito a casella vuota
    //           tolgono un tag ciascuna; con il testo nella casella non si tocca nessun tag; senza
    //           tag non succede niente.
    // ENGLISH: neighbouring cases that must not change: single presses in a row on an empty box
    //          remove one tag each; with text in the box no tag is touched; with no tags nothing
    //          happens.
    const c = casella(['a', 'b', 'c']);
    c.premi(2, false);
    dice('due pressioni singole a casella vuota tolgono due tag', ['a'], c.stato().tags);
    const d = casella(['a', 'b'], 'ab');
    d.premi(1, false);
    dice('pressione singola con testo nella casella: cancella un carattere, tag intatti', { tags: ['a', 'b'], testo: 'a' }, { tags: d.stato().tags, testo: d.stato().testo });
    const e = casella([]);
    e.premi(1, false);
    e.premi(2, true);
    dice('nessun tag: nessuna chiamata a setTags', 0, e.stato().chiamate);
}
{
    // ITALIANO: un evento senza il campo repeat (come quello della prova sul riordino) conta come pressione singola.
    // ENGLISH: an event without the repeat field (like the one in the reorder test) counts as a single press.
    globalThis.__GANCI__ = { i: 0, v: {} };
    let tags = ['a', 'b', 'c'];
    const campo = trova(UI.TagInput({ tags, setTags: (n) => { tags = n; }, lang: 'en' }), n => n.type === 'input')[0];
    campo.props.onKeyDown({ key: 'Backspace', preventDefault() { } });
    dice('evento senza repeat: toglie l\'ultimo tag', ['a', 'b'], tags);
}

process.exit(esito());
