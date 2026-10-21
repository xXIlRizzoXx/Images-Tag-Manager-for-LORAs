/* ITALIANO: PROVA: add_tags / remove_tags CON LO STESSO ID RIPETUTO
   Un'AI puo' mandare un elenco di id con un doppione (["a","a"]): lo schema del server non lo
   vieta. La foto cambia una volta sola, ma la risposta contava gli id con il doppione e diceva
   {"changed":1,"unchanged":1}, come se le foto fossero due; un id inesistente ripetuto compariva
   due volte in not_found. Casi vicini che non devono cambiare: id diversi contano come prima,
   set_tags (un solo id) risponde con i tag nuovi, una foto gia' a posto resta "unchanged".
   Uso:  node scripts/test-mcp-duplicate-ids.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST: add_tags / remove_tags WITH THE SAME ID REPEATED
   An AI can send a list of ids with a duplicate (["a","a"]): the server schema does not forbid it.
   The photo changes once, but the answer counted the ids with the duplicate and said
   {"changed":1,"unchanged":1}, as if there were two photos; a missing id repeated showed up twice
   in not_found. Neighbouring cases that must not change: different ids count as before, set_tags
   (one id) answers with the new tags, a photo already in place stays "unchanged".
   Usage:  node scripts/test-mcp-duplicate-ids.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const uscita = await esbuild.build({
    entryPoints: [path.join(radice, 'src/utils/mcpBridge.ts')],
    bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
});
const B = await import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));

let guai = 0, fatti = 0;
const dice = (nome, atteso, avuto) => {
    fatti++;
    const ok = JSON.stringify(atteso) === JSON.stringify(avuto);
    if (!ok) guai++;
    console.log(`${ok ? 'OK ' : 'NO '} ${nome}${ok ? '' : `\n     atteso: ${JSON.stringify(atteso)}\n     avuto:  ${JSON.stringify(avuto)}`}`);
};

const ctxDi = (foto, trigger = []) => {
    const applicate = [];
    return {
        applicate,
        foto: () => foto,
        trigger: () => trigger,
        applica: (nuovi) => { applicate.push(nuovi); for (const [id, t] of nuovi) foto.find(f => f.id === id).tags = t; },
        immagine: async () => null,
    };
};
const fotoA = () => ({ id: 'a', file: { name: 'a.png' }, tags: ['cat'], originalTags: ['cat'] });
const fotoB = () => ({ id: 'b', file: { name: 'b.png' }, tags: ['cat', 'dog'], originalTags: ['cat', 'dog'] });

{
    const ctx = ctxDi([fotoA()]);
    const r = await B.eseguiStrumentoMcp('add_tags', { ids: ['a', 'a'], tags: ['dog'] }, ctx);
    dice('add_tags [a,a]: changed 1, unchanged 0', [1, 0], [r.risultato.changed, r.risultato.unchanged]);
    dice('...la foto cambia una volta sola', [['cat', 'dog']], [ctx.foto()[0].tags]);
    dice('...e la finestra conta una foto', 1, r.cambiate);
}
{
    const ctx = ctxDi([fotoB()]);
    const r = await B.eseguiStrumentoMcp('remove_tags', { ids: ['b', 'b'], tags: ['dog'] }, ctx);
    dice('remove_tags [b,b]: changed 1, unchanged 0', [1, 0], [r.risultato.changed, r.risultato.unchanged]);
    dice('...tag tolto', ['cat'], ctx.foto()[0].tags);
}
{
    const ctx = ctxDi([fotoA()]);
    const r = await B.eseguiStrumentoMcp('add_tags', { ids: ['x', 'x', 'a'], tags: ['dog'] }, ctx);
    dice('add_tags [x,x,a]: not_found ["x"] una volta sola', ['x'], r.risultato.not_found);
    dice('...changed 1, unchanged 0', [1, 0], [r.risultato.changed, r.risultato.unchanged]);
}
{
    // ITALIANO: casi vicini invariati.  ENGLISH: neighbouring cases unchanged.
    const ctx = ctxDi([fotoA(), fotoB()]);
    const r = await B.eseguiStrumentoMcp('add_tags', { ids: ['a', 'b', 'b'], tags: ['dog'] }, ctx);
    dice('add_tags [a,b,b] con b gia\' a posto: changed 1, unchanged 1', [1, 1], [r.risultato.changed, r.risultato.unchanged]);
    const s = await B.eseguiStrumentoMcp('set_tags', { id: 'a', tags: ['bird'] }, ctx);
    dice('set_tags: changed 1, unchanged 0, tag nuovi nella risposta', [1, 0, ['bird']], [s.risultato.changed, s.risultato.unchanged, s.risultato.tags]);
    const n = await B.eseguiStrumentoMcp('remove_tags', { ids: ['a', 'b'], tags: ['zzz'] }, ctx);
    dice('remove_tags senza effetto su due foto: changed 0, unchanged 2', [0, 2], [n.risultato.changed, n.risultato.unchanged]);
}

console.log(`\n${guai === 0 ? 'TUTTO A POSTO' : 'PROBLEMI: ' + guai} (${fatti} controlli)`);
process.exit(guai === 0 ? 0 : 1);
