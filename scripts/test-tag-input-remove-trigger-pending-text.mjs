/* ITALIANO: PROVA DELLA X SU UNA TRIGGER CON DEL TESTO NON CONFERMATO IN UNA CARD
   Trigger "ohwx", foto A con "ohwx, cat" e "dog" scritto nella sua casella senza Invio; si clicca
   la X di "ohwx" nel riquadro Trigger Words in alto. La X non toglie il fuoco (onMouseDown con
   preventDefault), quindi removeTag lascia la casella attiva, quella della card A. Il blur partiva
   DENTRO il clic: l'handleBlur di A vedeva ancora i tag del disegno prima ("ohwx, cat") e metteva
   in coda la lista "ohwx, cat, dog", che React applicava DOPO la rimozione della trigger da tutte
   le foto. La trigger tolta restava su A, come tag normale, e Salva la scriveva nel suo .txt.
   La regola: il blur di una casella di UN ALTRO TagInput parte dopo il ridisegno, cosi' il suo
   handleBlur vede i tag gia' aggiornati. Quello della casella stessa resta immediato.
   Si esegue il TagInput VERO di src/components/ui.tsx con un React finto in cui, come in React
   18/19, gli aggiornamenti di App chiesti dentro un gestore si applicano dopo il gestore, e le
   props restano quelle dell'ultimo disegno.
   Uso:  node scripts/test-tag-input-remove-trigger-pending-text.mjs   (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE X ON A TRIGGER WITH UNCONFIRMED TEXT IN A CARD
   Trigger "ohwx", photo A with "ohwx, cat" and "dog" typed in its box without Enter; the X of
   "ohwx" in the Trigger Words box at the top is clicked. The X keeps the focus (onMouseDown with
   preventDefault), so removeTag leaves the active box, card A's. The blur ran INSIDE the click:
   A's handleBlur still saw the previous render's tags ("ohwx, cat") and queued the list
   "ohwx, cat, dog", which React applied AFTER removing the trigger from every photo. The removed
   trigger stayed on A, as a normal tag, and Save wrote it to its .txt.
   The rule: the blur of a box of ANOTHER TagInput runs after the re-render, so its handleBlur sees
   the updated tags. The box's own blur stays immediate.
   The REAL TagInput of src/components/ui.tsx runs with a fake React where, as in React 18/19, App
   updates requested inside a handler are applied after the handler, and props stay those of the
   last render.
   Usage:  node scripts/test-tag-input-remove-trigger-pending-text.mjs   (exits with code 1 if anything is off) */

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
const unGiro = () => new Promise(r => setTimeout(r, 5));

// ITALIANO: un piccolo App: foto A e B, le trigger, la coda degli aggiornamenti come in React e
//           copie di updateImageTags e handleGlobalTagsChange di src/App.tsx (le loro chiusure
//           vedono lo stato dell'ultimo disegno). Tre caselle: riquadro trigger (T), card A, card B.
// ENGLISH: a small App: photos A and B, the triggers, the update queue as in React and copies of
//          updateImageTags and handleGlobalTagsChange from src/App.tsx (their closures see the last
//          render's state). Three boxes: trigger box (T), card A, card B.
const creaApp = (fotoIniziali, triggerIniziali) => {
    let images = fotoIniziali.map(f => ({ ...f, tags: [...f.tags] }));
    let globalTriggers = [...triggerIniziali];
    const coda = [];
    const setImages = (f) => coda.push(['img', f]);
    const setGlobalTriggers = (v) => coda.push(['trg', v]);
    const faiChiusure = () => {
        const trig = globalTriggers;
        const imgs = images;
        const updateImageTags = (id, newTags) => {
            const uniqueTags = TC.uniqueTagsIgnoringCase(newTags, trig);
            const orderedTags = [...trig.filter(tag => uniqueTags.includes(tag)), ...uniqueTags.filter(tag => !trig.includes(tag)).sort((a, b) => a.localeCompare(b))];
            setImages(prev => prev.map(img => img.id === id ? { ...img, tags: orderedTags } : img));
        };
        const handleGlobalTagsChange = (newGlobalTags) => {
            const added = newGlobalTags.filter(t => !trig.includes(t));
            const removed = trig.filter(t => !newGlobalTags.includes(t));
            setGlobalTriggers(newGlobalTags);
            if (imgs.length > 0) {
                setImages(prev => prev.map(img => {
                    let updatedTags = [...img.tags];
                    added.forEach(tag => { if (!updatedTags.includes(tag)) updatedTags.unshift(tag); });
                    removed.forEach(tag => { updatedTags = updatedTags.filter(t => t !== tag); });
                    updatedTags = TC.uniqueTagsIgnoringCase(updatedTags, newGlobalTags);
                    return { ...img, tags: [...newGlobalTags.filter(t => updatedTags.includes(t)), ...updatedTags.filter(t => !newGlobalTags.includes(t))] };
                }));
            }
        };
        return { updateImageTags, handleGlobalTagsChange };
    };
    let chiusure = faiChiusure();
    let props = { T: globalTriggers, A: images.find(i => i.id === 'A').tags, B: images.find(i => i.id === 'B').tags };
    const ganci = { T: { i: 0, v: {} }, A: { i: 0, v: {} }, B: { i: 0, v: {} } };
    const disegna = (chi) => {
        globalThis.__GANCI__ = ganci[chi]; ganci[chi].i = 0;
        if (chi === 'T') return UI.TagInput({ tags: props.T, setTags: (n) => chiusure.handleGlobalTagsChange(n), isGlobal: true, lang: 'en' });
        return UI.TagInput({ tags: props[chi], setTags: (n) => chiusure.updateImageTags(chi, n), lang: 'en' });
    };
    // ITALIANO: React applica la coda dopo il gestore e ridisegna con props e chiusure nuove.
    // ENGLISH: React applies the queue after the handler and re-renders with new props and closures.
    const ridisegna = () => {
        for (const [k, f] of coda.splice(0)) { if (k === 'img') images = f(images); else globalTriggers = f; }
        chiusure = faiChiusure();
        props = { T: globalTriggers, A: images.find(i => i.id === 'A').tags, B: images.find(i => i.id === 'B').tags };
    };
    const casella = (chi) => trova(disegna(chi), n => n.type === 'input')[0];
    // ITALIANO: un elemento finto per ogni casella: blur() toglie il fuoco e chiama l'onBlur del
    //           disegno ATTUALE (in React il gestore e' sempre quello dell'ultimo disegno).
    // ENGLISH: a fake element per box: blur() takes the focus away and calls the CURRENT render's
    //          onBlur (in React the handler is always the last render's).
    const elementi = {};
    for (const chi of ['T', 'A', 'B']) {
        elementi[chi] = { chi, blur() { if (globalThis.document.activeElement === this) globalThis.document.activeElement = null; casella(chi).props.onBlur({ target: {} }); ridisegna(); } };
        casella(chi).props.ref.current = elementi[chi];
    }
    globalThis.document = { hasFocus: () => true, activeElement: null, body: { body: true } };
    // ITALIANO: scrive `testo` nella casella `chi` senza Invio (il fuoco resta li').
    // ENGLISH: types `testo` in box `chi` without Enter (the focus stays there).
    const scrivi = (chi, testo) => { globalThis.document.activeElement = elementi[chi]; casella(chi).props.onChange({ target: { value: testo } }); ridisegna(); };
    // ITALIANO: preme e clicca la X della pillola `tag` nella casella `chi`; poi React ridisegna.
    // ENGLISH: presses and clicks the X of pill `tag` in box `chi`; then React re-renders.
    const clicX = (chi, tag) => {
        const pill = trova(disegna(chi), n => n.type === 'span' && n.key === tag)[0];
        if (!pill) throw new Error('pillola non trovata: ' + tag);
        const x = trova(pill.props.children, n => n.type === 'button')[0];
        let annullata = false;
        x.props.onMouseDown({ preventDefault() { annullata = true; } });
        if (!annullata) globalThis.document.activeElement?.blur();
        x.props.onClick({ stopPropagation() { } });
        ridisegna();
    };
    const stato = () => ({
        trigger: globalTriggers, A: images.find(i => i.id === 'A').tags, B: images.find(i => i.id === 'B').tags,
        testoA: casella('A').props.value, testoT: casella('T').props.value,
    });
    return { scrivi, clicX, stato, elementi, ridisegna };
};
const finisci = () => { delete globalThis.document; };

console.log('\n--- X su una trigger con testo non confermato in una card ---');
{
    const app = creaApp([{ id: 'A', tags: ['ohwx', 'cat'] }, { id: 'B', tags: ['ohwx', 'smile'] }], ['ohwx']);
    app.scrivi('A', 'dog');
    app.clicX('T', 'ohwx');
    await unGiro();
    dice('"dog" scritto in A, X su "ohwx" del riquadro: la trigger sparisce da tutte, "dog" entra in A',
        { trigger: [], A: ['cat', 'dog'], B: ['smile'], testoA: '', testoT: '' }, app.stato());
    dice('la casella di A e\' stata lasciata', null, globalThis.document.activeElement);
    finisci();
}
{
    // ITALIANO: due trigger, si toglie la seconda: la prima resta davanti e "dog" entra in ordine.
    // ENGLISH: two triggers, the second is removed: the first stays in front and "dog" goes in, sorted.
    const app = creaApp([{ id: 'A', tags: ['ohwx', 'tok', 'cat'] }, { id: 'B', tags: ['ohwx', 'tok'] }], ['ohwx', 'tok']);
    app.scrivi('A', 'dog');
    app.clicX('T', 'tok');
    await unGiro();
    dice('due trigger, X su "tok" con "dog" scritto in A',
        { trigger: ['ohwx'], A: ['ohwx', 'cat', 'dog'], B: ['ohwx'], testoA: '', testoT: '' }, app.stato());
    finisci();
}

console.log('\n--- quello che NON deve cambiare ---');
{
    // ITALIANO: X su un tag di un'altra card (B) con "dog" scritto in A.
    // ENGLISH: X on a tag of another card (B) with "dog" typed in A.
    const app = creaApp([{ id: 'A', tags: ['ohwx', 'cat'] }, { id: 'B', tags: ['ohwx', 'smile'] }], ['ohwx']);
    app.scrivi('A', 'dog');
    app.clicX('B', 'smile');
    await unGiro();
    dice('X su "smile" della card B con "dog" scritto in A: B perde "smile", "dog" entra in A',
        { trigger: ['ohwx'], A: ['ohwx', 'cat', 'dog'], B: ['ohwx'], testoA: '', testoT: '' }, app.stato());
    dice('la casella di A e\' stata lasciata (X nella card B)', null, globalThis.document.activeElement);
    finisci();
}
{
    // ITALIANO: X su un tag della stessa card con testo: tutto nello stesso clic, nessun doppio inserimento.
    // ENGLISH: X on a tag of the same card with text: all in the same click, no double insertion.
    const app = creaApp([{ id: 'A', tags: ['ohwx', 'cat'] }, { id: 'B', tags: ['ohwx', 'smile'] }], ['ohwx']);
    app.scrivi('A', 'dog');
    app.clicX('A', 'cat');
    dice('X su "cat" della stessa card con "dog" scritto: subito, senza aspettare',
        { trigger: ['ohwx'], A: ['ohwx', 'dog'], B: ['ohwx', 'smile'], testoA: '', testoT: '' }, app.stato());
    dice('la casella della stessa card e\' lasciata subito', null, globalThis.document.activeElement);
    await unGiro();
    dice('e dopo non cambia niente', { trigger: ['ohwx'], A: ['ohwx', 'dog'], B: ['ohwx', 'smile'], testoA: '', testoT: '' }, app.stato());
    finisci();
}
{
    // ITALIANO: testo "zz" nel riquadro delle trigger, X su un tag della card A: "zz" diventa trigger
    //           su tutte le foto e A perde il tag cliccato.
    // ENGLISH: text "zz" in the trigger box, X on a tag of card A: "zz" becomes a trigger on every
    //          photo and A loses the clicked tag.
    const app = creaApp([{ id: 'A', tags: ['ohwx', 'cat'] }, { id: 'B', tags: ['ohwx', 'smile'] }], ['ohwx']);
    app.scrivi('T', 'zz');
    app.clicX('A', 'cat');
    await unGiro();
    dice('"zz" scritto nel riquadro, X su "cat" di A',
        { trigger: ['ohwx', 'zz'], A: ['ohwx', 'zz'], B: ['ohwx', 'zz', 'smile'], testoA: '', testoT: '' }, app.stato());
    finisci();
}
{
    // ITALIANO: se prima del ridisegno il fuoco e' gia' andato altrove, la casella non si tocca.
    // ENGLISH: if the focus has already moved elsewhere before the re-render, the box is not touched.
    const app = creaApp([{ id: 'A', tags: ['ohwx', 'cat'] }, { id: 'B', tags: ['ohwx', 'smile'] }], ['ohwx']);
    app.scrivi('A', 'dog');
    app.clicX('B', 'smile');
    const altrove = { blur() { } };
    const prima = globalThis.document.activeElement;
    globalThis.document.activeElement = altrove;
    await unGiro();
    if (prima === app.elementi.A) {
        dice('fuoco spostato prima del ridisegno: "dog" resta nella casella di A', 'dog', app.stato().testoA);
    } else {
        dice('fuoco spostato prima del ridisegno: la casella di A non era ancora lasciata', true, prima === app.elementi.A);
    }
    finisci();
}

process.exit(esito());
