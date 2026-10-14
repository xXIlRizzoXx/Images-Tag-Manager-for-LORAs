/* ITALIANO: PROVA DEI TAG DOPPI CHE CAMBIANO SOLO PER LE MAIUSCOLE
   Su una foto con "smile", scrivere "Smile" (nella card, nel visualizzatore, nel pannello di
   selezione in blocco) aggiungeva un secondo tag, e il .txt usciva "smile, Smile,". Per i
   trainer e' lo stesso tag due volte (il tokenizer di CLIP abbassa le maiuscole). La regola: sulla
   stessa foto non entrano due tag che differiscono solo per maiuscole; resta la grafia che c'era
   gia' (quella della trigger word, se e' una trigger). Niente viene messo in minuscolo: un tag
   scritto "Eiffel Tower" o una trigger "OHWX" restano come sono.
   Si provano: la regola pura di src/utils/tagCase.ts; l'import di un .txt (tagDiImport di
   src/utils/sidecarTags.ts, anche con una trigger attiva scritta diversa); il TagInput VERO di src/components/ui.tsx e
   il Lightbox VERO di src/components/Lightbox.tsx (con un React finto, senza DOM); i testi VERI di
   updateImageTags, applyBulkTags e handleGlobalTagsChange presi da src/App.tsx.
   Uso:  node scripts/test-tag-case-duplicates.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF DUPLICATE TAGS THAT DIFFER ONLY IN CASE
   On a photo with "smile", typing "Smile" (in the card, in the viewer, in the bulk selection panel)
   added a second tag, and the .txt came out "smile, Smile,". For trainers it is the same tag twice
   (the CLIP tokenizer lowercases). The rule: two tags that differ only in case never land on the
   same photo; the spelling already there is kept (the trigger word's, if it is a trigger). Nothing
   is lowercased: a tag written "Eiffel Tower" or a trigger "OHWX" stays as it is.
   Tested: the pure rule of src/utils/tagCase.ts; the import of a .txt (tagDiImport of
   src/utils/sidecarTags.ts, also with an active trigger spelled differently); the REAL TagInput of src/components/ui.tsx and the
   REAL Lightbox of src/components/Lightbox.tsx (with a fake React, no DOM); the REAL text of
   updateImageTags, applyBulkTags and handleGlobalTagsChange taken from src/App.tsx.
   Usage:  node scripts/test-tag-case-duplicates.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();

// ITALIANO: tutte le icone importate dai componenti, per un lucide-react finto che le ha tutte.
// ENGLISH: every icon the components import, for a fake lucide-react that has them all.
const icone = new Set();
for (const f of fs.readdirSync(path.join(radice, 'src/components'))) {
    const testo = fs.readFileSync(path.join(radice, 'src/components', f), 'utf8');
    for (const m of testo.matchAll(/import\s*\{([^}]*)\}\s*from\s*'lucide-react'/g)) {
        m[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0]).filter(Boolean).forEach(n => icone.add(n));
    }
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
const carica = async (rel, plugins = []) => {
    const u = await esbuild.build({
        entryPoints: [path.join(radice, rel)], bundle: true, format: 'esm', platform: 'node', write: false,
        plugins, logLevel: 'silent', jsx: 'automatic', absWorkingDir: radice,
    });
    return import('data:text/javascript;base64,' + Buffer.from(u.outputFiles[0].text).toString('base64'));
};
globalThis.__GANCI__ = { i: 0, v: {} };
const nuoviGanci = () => { globalThis.__GANCI__ = { i: 0, v: {} }; };
const rendi = (f) => { globalThis.__GANCI__.i = 0; return f(); };
const trova = (nodo, prova, fuori = []) => {
    if (!nodo || typeof nodo !== 'object') return fuori;
    if (Array.isArray(nodo)) { nodo.forEach(n => trova(n, prova, fuori)); return fuori; }
    if (prova(nodo)) fuori.push(nodo);
    if (nodo.props) trova(nodo.props.children, prova, fuori);
    return fuori;
};

console.log('\n--- la regola pura (src/utils/tagCase.ts) ---');
let regola = null;
try { regola = await carica('src/utils/tagCase.ts'); } catch (_) { regola = null; }
dice('il modulo della regola esiste', true, Boolean(regola));
if (regola) {
    dice('"Smile" c\'e\' gia\' dove c\'e\' "smile"', true, regola.hasTagIgnoringCase(['smile'], 'Smile'));
    dice('"smiles" invece no', false, regola.hasTagIgnoringCase(['smile'], 'smiles'));
    dice('tiene la prima grafia di ogni tag', ['smile', 'OHWX', 'Blue Sky'], regola.uniqueTagsIgnoringCase(['smile', 'Smile', 'OHWX', 'ohwx', 'Blue Sky', 'SMILE']));
    dice('una grafia "preferita" (la trigger) vince sulle altre', ['OHWX', 'smile'], regola.uniqueTagsIgnoringCase(['ohwx', 'smile', 'OHWX'], ['OHWX']));
    dice('niente viene messo in minuscolo', ['Eiffel Tower', 'TOK'], regola.uniqueTagsIgnoringCase(['Eiffel Tower', 'TOK']));
}

// ITALIANO: aprendo una cartella con la trigger "OHWX" gia' attiva, un .txt con "ohwx" dava alla
//           foto sia "OHWX" sia "ohwx", e Salva scriveva "OHWX, ohwx, smile,".
// ENGLISH: opening a folder with the trigger "OHWX" already active, a .txt with "ohwx" gave the
//          photo both "OHWX" and "ohwx", and Save wrote "OHWX, ohwx, smile,".
console.log('\n--- import di un .txt (src/utils/sidecarTags.ts) ---');
{
    const I = await carica('src/utils/sidecarTags.ts');
    const daTxt = (testo) => I.parseSidecarText(testo).tags;
    const a = I.tagDiImport(['OHWX'], daTxt('ohwx, smile'));
    dice('trigger "OHWX" + .txt "ohwx, smile": un solo tag, con la grafia della trigger', ['OHWX', 'smile'], a.tags);
    dice('il ricordo del disco resta quello vero, quindi Salva riscrive il .txt pulito', ['ohwx', 'smile'], a.originalTags);
    const b = I.tagDiImport([], daTxt('smile, Smile, outdoors'));
    dice('un .txt con "smile, Smile" entra con un solo "smile"', ['smile', 'outdoors'], b.tags);
    dice('...e il ricordo del disco resta quello vero', ['smile', 'Smile', 'outdoors'], b.originalTags);
    const c = I.tagDiImport(['OHWX'], daTxt('OHWX, smile'));
    dice('stessa grafia: niente cambia e la foto non risulta modificata', [['OHWX', 'smile'], true], [c.tags, JSON.stringify(c.tags) === JSON.stringify(c.originalTags)]);
    dice('due trigger e un tag che ne ripete una: davanti le trigger, una volta sola', ['a', 'b', 'x'], I.tagDiImport(['a', 'b'], ['x', 'B']).tags);
}

console.log('\n--- TagInput (card della galleria e riquadro delle trigger) ---');
{
    const UI = await carica('src/components/ui.tsx', [finti]);
    const prova = (iniziali, azione) => {
        nuoviGanci();
        let tags = [...iniziali];
        const albero = () => rendi(() => UI.TagInput({ tags, setTags: (n) => { tags = n; }, lang: 'en' }));
        const campo = () => trova(albero(), n => n.type === 'input')[0];
        azione(campo);
        return tags;
    };
    const scrivi = (testo) => (campo) => { campo().props.onChange({ target: { value: testo } }); campo().props.onKeyDown({ key: 'Enter', preventDefault() { } }); };
    const incolla = (testo) => (campo) => campo().props.onPaste({ preventDefault() { }, clipboardData: { getData: () => testo } });
    dice('scrivere "Smile" + Invio su ["smile"] non aggiunge niente', ['smile'], prova(['smile'], scrivi('Smile')));
    dice('incollare "SMILE, Smile, blue sky" su ["smile"] aggiunge solo "blue sky"', ['smile', 'blue sky'], prova(['smile'], incolla('SMILE, Smile, blue sky')));
    dice('incollare "Hat, hat" aggiunge un solo "Hat"', ['smile', 'Hat'], prova(['smile'], incolla('Hat, hat')));
    dice('un tag nuovo entra come e\' stato scritto', ['smile', 'Eiffel Tower'], prova(['smile'], scrivi('Eiffel Tower')));
}

console.log('\n--- Lightbox (casella "cerca o aggiungi" e "altri tag del progetto") ---');
{
    const L = await carica('src/components/Lightbox.tsx', [finti]);
    nuoviGanci();
    const chiamate = [];
    const immagine = { id: 'P', tags: ['smile'], file: { name: 'P.png' }, width: 1024, height: 1024 };
    const albero = () => rendi(() => L.Lightbox({
        image: immagine, allTags: ['Smile', 'smile', 'hat'], updateTags: (id, tags) => chiamate.push(tags), t: {}, lang: 'en',
        onClose() { }, onNext() { }, onPrev() { }, showNotification() { }, updateOriginalTags() { }, globalTriggers: [],
    }));
    const campo = () => trova(albero(), n => n.type === 'input' && typeof n.props.onKeyDown === 'function' && 'value' in n.props)[0];
    dice('fra gli "altri tag del progetto" non compare "Smile" (la foto ha "smile")', ['avail-hat'],
        trova(albero(), n => typeof n.key === 'string' && n.key.startsWith('avail-')).map(n => n.key));
    campo().props.onChange({ target: { value: 'Smile' } });
    campo().props.onKeyDown({ key: 'Enter', preventDefault() { } });
    dice('scrivere "Smile" + Invio non aggiunge un secondo tag', [], chiamate);
    campo().props.onChange({ target: { value: 'Blue Sky' } });
    campo().props.onKeyDown({ key: 'Enter', preventDefault() { } });
    dice('un tag nuovo entra come e\' stato scritto', [['smile', 'Blue Sky']], chiamate);
}

console.log('\n--- src/App.tsx: dove i tag di una foto vengono scritti ---');
{
    const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
    const ritaglia = (intestazione, chiusura = /\r?\n    \};\r?\n/g) => {
        const inizio = sorgente.indexOf(intestazione);
        chiusura.lastIndex = Math.max(inizio, 0);
        const fine = inizio < 0 ? null : chiusura.exec(sorgente);
        if (inizio < 0 || !fine) { console.log('NO  non trovato in src/App.tsx: ' + intestazione.trim()); process.exit(1); }
        return sorgente.slice(inizio, fine.index + fine[0].length);
    };
    const testo = [
        ritaglia('    const updateImageTags = useCallback(', /\r?\n    \}, \[globalTriggers\]\);\r?\n/g),
        ritaglia('    const applyBulkTags = () => {'),
        ritaglia('    const handleGlobalTagsChange = '),
    ].join('\n');
    const js = (await esbuild.transform(testo, { loader: 'ts' })).code;
    const fabbrica = new Function('globalTriggers', 'images', 'selectedForBulk', 'stagedBulkTags', 'setImages', 'setGlobalTriggers',
        'setStagedBulkTags', 'setSelectedForBulk', 'soundManager', 'showNotification', 't', 'useCallback', 'uniqueTagsIgnoringCase',
        js + '\nreturn { updateImageTags, applyBulkTags, handleGlobalTagsChange };');
    const app = (immagini, { trigger = [], selezione = [], inPreparazione = [] } = {}) => {
        const s = { immagini, trigger };
        const f = fabbrica(trigger, immagini, selezione, inPreparazione, (fn) => { s.immagini = fn(s.immagini); }, (v) => { s.trigger = v; },
            () => { }, () => { }, { chime() { }, pop() { } }, () => { }, { bulkTagsAdded: '' }, (x) => x,
            regola ? regola.uniqueTagsIgnoringCase : undefined);
        return { s, f };
    };
    {
        const { s, f } = app([{ id: '1', tags: ['smile'] }]);
        f.updateImageTags('1', ['smile', 'Smile']);
        dice('updateImageTags(["smile","Smile"]) tiene un solo "smile"', ['smile'], s.immagini[0].tags);
    }
    {
        const { s, f } = app([{ id: '1', tags: ['OHWX', 'smile'] }], { trigger: ['OHWX'] });
        f.updateImageTags('1', ['ohwx', 'OHWX', 'smile', 'hat']);
        dice('con la trigger "OHWX" resta la grafia della trigger, davanti', ['OHWX', 'hat', 'smile'], s.immagini[0].tags);
    }
    {
        const { s, f } = app([{ id: '1', tags: ['smile'] }, { id: '2', tags: ['sky'] }], { selezione: ['1', '2'], inPreparazione: ['Smile', 'hat'] });
        f.applyBulkTags();
        dice('i tag in blocco non doppiano "smile" con "Smile"', [['hat', 'smile'], ['hat', 'sky', 'Smile']], s.immagini.map(i => i.tags));
    }
    {
        const { s, f } = app([{ id: '1', tags: ['ohwx', 'smile'] }]);
        f.handleGlobalTagsChange(['OHWX']);
        dice('aggiungendo la trigger "OHWX" a una foto con "ohwx" resta un tag solo, quello della trigger', ['OHWX', 'smile'], s.immagini[0].tags);
    }
}

process.exit(esito());
