/* ITALIANO: PROVA: LE PILLOLE DEI TAG NON TENGONO UN'ANIMAZIONE SEMPRE ACCESA
   Con mille foto la vista Quadrate scorreva a circa 20 fotogrammi al secondo (Intere a circa 40).
   Misurato sull'exe vero il 20/10/2026: il tempo andava quasi tutto nella composizione dei livelli,
   471 livelli composti, di cui 308 erano pillole dei tag con un'animazione "attiva" (l'entrata
   zoom-in con fill-mode "both" resta in vigore anche finita, e content-visibility la fa ripartire a
   ogni card che rientra a schermo) e 154 lo sfocato dietro il cerchio di selezione e il contatore dei
   tag di ogni card. Tolte tutte e due le cose: Quadrate circa 39 fotogrammi al secondo, Intere circa 56.
   La regola: l'animazione d'ingresso c'e' solo per una pillola nata dopo la comparsa della casella, e
   sparisce quando finisce; le targhette sopra la foto non hanno backdrop-blur.
   Si esegue il TagInput VERO di src/components/ui.tsx con un React finto (come
   test-tag-input-remove-after-reorder.mjs), senza DOM.
   Uso:  node scripts/test-tag-pill-animation.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST: TAG PILLS DO NOT KEEP AN ANIMATION ALWAYS ON
   With a thousand photos the Square view scrolled at about 20 frames per second (Original at about
   40). Measured on the real exe on 20/10/2026: nearly all the time went into layer compositing, 471
   composited layers, 308 of them tag pills with an "active" animation (the zoom-in entrance with
   fill-mode "both" stays in effect even when finished, and content-visibility restarts it whenever a
   card comes back on screen) and 154 the backdrop blur behind each card's selection circle and tag
   counter. Both removed: Square about 39 frames per second, Original about 56.
   The rule: the entry animation exists only for a pill born after the box appeared, and goes away
   when it ends; the badges on the photo have no backdrop-blur.
   The REAL TagInput of src/components/ui.tsx runs with a fake React (as
   test-tag-input-remove-after-reorder.mjs), with no DOM.
   Usage:  node scripts/test-tag-pill-animation.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();

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
                export const useState = (v) => { const S = G(); const i = S.i++; if (!(i in S.v)) S.v[i] = typeof v === 'function' ? v() : v; return [S.v[i], (x) => { S.v[i] = typeof x === 'function' ? x(S.v[i]) : x; S.ridisegni++; }]; };
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
const pillole = (albero) => trova(albero, n => n.type === 'span' && n.key !== undefined && n.key !== null)
    .map(p => ({ testo: [].concat(p.props.children).find(c => typeof c === 'string'), anima: /\banimate-in\b/.test(p.props.className), fine: p.props.onAnimationEnd }));

// ITALIANO: una casella con i suoi tag; disegna() la ridisegna con lo stato tenuto dal React finto.
// ENGLISH: a box with its tags; disegna() re-renders it with the state kept by the fake React.
const casella = (iniziali, extra = {}) => {
    globalThis.__GANCI__ = { i: 0, v: {}, ridisegni: 0 };
    globalThis.document = { hasFocus: () => true, activeElement: null, body: {} };
    const stato = { tags: [...iniziali] };
    stato.disegna = () => { globalThis.__GANCI__.i = 0; return UI.TagInput({ tags: stato.tags, setTags: (n) => { stato.tags = n; }, lang: 'en', ...extra }); };
    return stato;
};

console.log('\n--- i tag che ci sono gia\' quando la card compare non si animano ---');
{
    const c = casella(['cat', 'sofa', 'cat']);
    const p = pillole(c.disegna());
    dice('tre pillole, nessuna con l\'animazione', [3, [false, false, false]], [p.length, p.map(x => x.anima)]);
    dice('...e nessuna aspetta la fine di un\'animazione', [undefined, undefined, undefined], p.map(x => x.fine));
    const ridisegnata = pillole(c.disegna());
    dice('ridisegnata (la card che rientra a schermo): ancora nessuna', [false, false, false], ridisegnata.map(x => x.anima));
}
{
    const c = casella(['a', 'b'], { readOnly: true });
    dice('anche nel cestino (sola lettura)', [false, false], pillole(c.disegna()).map(x => x.anima));
}

console.log('\n--- un tag aggiunto dall\'utente si anima una volta ---');
{
    const c = casella(['cat']);
    c.disegna();
    const input = () => trova(c.disegna(), n => n.type === 'input')[0];
    input().props.onChange({ target: { value: 'sofa' } });
    input().props.onKeyDown({ key: 'Enter', preventDefault() { } });
    dice('premessa: il tag e\' entrato', ['cat', 'sofa'], c.tags);
    let p = pillole(c.disegna());
    dice('solo la pillola nuova ha l\'animazione', [['cat', false], ['sofa', true]], p.map(x => [x.testo, x.anima]));
    dice('...e aspetta la sua fine', [false, true], p.map(x => typeof x.fine === 'function'));
    const prima = globalThis.__GANCI__.ridisegni;
    p[1].fine();
    dice('alla fine dell\'animazione la casella si ridisegna', prima + 1, globalThis.__GANCI__.ridisegni);
    p = pillole(c.disegna());
    dice('...e la pillola non ha piu\' l\'animazione', [false, false], p.map(x => x.anima));
}
{
    // ITALIANO: piu' tag insieme (incolla, AI): si animano tutti, una volta.
    // ENGLISH: several tags at once (paste, AI): they all animate, once.
    const c = casella(['cat']);
    c.disegna();
    c.tags = ['cat', 'dog', 'sofa'];
    const p = pillole(c.disegna());
    dice('tag arrivati da fuori (incolla, AI): si animano solo i nuovi', [false, true, true], p.map(x => x.anima));
}

console.log('\n--- le targhette sopra la foto non hanno lo sfocato dietro ---');
{
    const app = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
    const inizio = app.indexOf('const GalleryCard = React.memo(');
    const fine = app.indexOf('\n});', inizio);
    const card = app.slice(inizio, fine);
    dice('premessa: GalleryCard trovata', true, inizio > 0 && fine > inizio);
    dice('nessuna classe backdrop-blur nella card della galleria', false, /\bbackdrop-blur(-[a-z0-9[\]]+)?(?=[\s`'"$])/.test(card.replace(/\{\/\*[\s\S]*?\*\/\}|\/\/[^\n]*/g, '')));
    dice('il cerchio di selezione e il contatore dei tag ci sono ancora', [true, true],
        [/w-6 h-6 rounded-full border-2/.test(card), /absolute bottom-2 left-2 z-20/.test(card)]);
}

delete globalThis.document;
process.exit(esito());
