/* ITALIANO: PROVA: GLI STRUMENTI MCP NON CONTANO COME "CAMBIATA" UNA FOTO SOLO RIORDINATA
   L'import tiene l'ordine del .txt (un tagger scrive "ohwx, woman, blue eyes, smiling", non in ordine
   alfabetico). add_tags di un tag gia' presente, remove_tags di un tag che la foto non ha e set_tags
   con gli stessi tag letti da list_photos rimettevano i tag in ordine alfabetico e contavano la foto
   come cambiata: risposta "changed" sbagliata all'AI, avviso nella finestra, un passo nella
   cronologia e Salva Modifiche che riscriveva .txt con gli stessi tag in altro ordine.
   Casi vicini che non devono cambiare: un tag nuovo o tolto davvero cambia la foto (e la mette in
   ordine come prima); set_tags che cambia solo le maiuscole di un tag e' una modifica vera.
   Uso:  node scripts/test-mcp-reorder-only.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST: THE MCP TOOLS DO NOT COUNT A PHOTO THAT IS ONLY REORDERED AS "CHANGED"
   Import keeps the .txt order (a tagger writes "ohwx, woman, blue eyes, smiling", not alphabetical).
   add_tags of a tag already there, remove_tags of a tag the photo does not have and set_tags with
   the same tags read from list_photos put the tags in alphabetical order and counted the photo as
   changed: wrong "changed" answer to the AI, a notice in the window, a history step and Save Changes
   rewriting .txt files with the same tags in another order.
   Neighbouring cases that must not change: a tag really added or removed changes the photo (and
   orders it as before); set_tags changing only the case of a tag is a real change.
   Usage:  node scripts/test-mcp-reorder-only.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const uscita = await esbuild.build({
    stdin: {
        contents: "export * from './src/utils/mcpBridge.ts'; export { tagDiImport } from './src/utils/sidecarTags.ts';",
        resolveDir: radice, loader: 'ts',
    },
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

const TRIGGER = ['ohwx'];
const ctxDi = (foto) => {
    const applicate = [];
    return {
        applicate,
        foto: () => foto,
        trigger: () => TRIGGER,
        applica: (nuovi) => { applicate.push(nuovi); for (const [id, t] of nuovi) foto.find(f => f.id === id).tags = t; },
        immagine: async () => null,
    };
};
// ITALIANO: foto importata come fa l'app, da un .txt in ordine non alfabetico.
// ENGLISH: photo imported as the app does, from a .txt in non-alphabetical order.
const importata = (id, txt) => ({ id, file: { name: `${id}.png` }, ...B.tagDiImport(TRIGGER, txt) });
const TXT = ['ohwx', 'woman', 'blue eyes', 'smiling'];

dice('premessa: l\'import tiene l\'ordine del .txt', TXT, importata('a', TXT).tags);

{
    const a = importata('a', TXT);
    const b = importata('b', [...TXT, 'watermark']);
    const ctx = ctxDi([a, b]);
    const r = await B.eseguiStrumentoMcp('remove_tags', { ids: ['a', 'b'], tags: ['watermark'] }, ctx);
    dice('remove_tags "watermark" su due foto, una sola lo ha: changed 1, unchanged 1', [1, 1], [r.risultato.changed, r.risultato.unchanged]);
    dice('...la finestra conta una foto', 1, r.cambiate);
    dice('...la foto senza "watermark" non e\' toccata', TXT, a.tags);
    dice('...solo "b" passa da applica', [['b']], ctx.applicate.map(m => [...m.keys()]));
}
for (const tag of ['woman', 'Woman']) {
    const a = importata('a', TXT);
    const ctx = ctxDi([a]);
    const r = await B.eseguiStrumentoMcp('add_tags', { ids: ['a'], tags: [tag] }, ctx);
    dice(`add_tags "${tag}" gia' presente: changed 0, unchanged 1, cambiate 0`, [0, 1, 0], [r.risultato.changed, r.risultato.unchanged, r.cambiate]);
    dice('...applica non chiamata, tag invariati', [0, TXT], [ctx.applicate.length, a.tags]);
}
{
    const a = importata('a', TXT);
    const ctx = ctxDi([a]);
    const l = await B.eseguiStrumentoMcp('list_photos', {}, ctx);
    const letti = l.risultato.photos[0].tags;
    const r = await B.eseguiStrumentoMcp('set_tags', { id: 'a', tags: letti }, ctx);
    dice('set_tags con gli stessi tag di list_photos: changed 0', [0, 1, 0], [r.risultato.changed, r.risultato.unchanged, r.cambiate]);
    const s = await B.eseguiStrumentoMcp('set_tags', { id: 'a', tags: ['smiling', 'blue eyes', 'woman'] }, ctx);
    dice('set_tags con gli stessi tag in altro ordine, senza la trigger: changed 0', [0, 0], [s.risultato.changed, ctx.applicate.length]);
    const t = await B.eseguiStrumentoMcp('remove_tags', { ids: ['a'], tags: ['ohwx'] }, ctx);
    dice('remove_tags della trigger: changed 0, trigger tenuta', [0, ['ohwx']], [t.risultato.changed, t.risultato.trigger_words_kept]);
    dice('...tag ancora nell\'ordine del .txt', TXT, a.tags);
}
// ITALIANO: casi vicini: le modifiche vere restano modifiche, ordinate come prima.
// ENGLISH: neighbouring cases: real changes stay changes, ordered as before.
{
    const a = importata('a', TXT);
    const ctx = ctxDi([a]);
    const r = await B.eseguiStrumentoMcp('add_tags', { ids: ['a'], tags: ['zebra'] }, ctx);
    dice('add_tags "zebra": changed 1, tag ordinati', [1, ['ohwx', 'blue eyes', 'smiling', 'woman', 'zebra']], [r.risultato.changed, a.tags]);
}
{
    const a = importata('a', TXT);
    const ctx = ctxDi([a]);
    const r = await B.eseguiStrumentoMcp('remove_tags', { ids: ['a'], tags: ['WOMAN'] }, ctx);
    dice('remove_tags "WOMAN": changed 1, tag tolto', [1, ['ohwx', 'blue eyes', 'smiling']], [r.risultato.changed, a.tags]);
}
{
    const a = importata('a', TXT);
    const ctx = ctxDi([a]);
    const r = await B.eseguiStrumentoMcp('set_tags', { id: 'a', tags: ['Woman', 'blue eyes', 'smiling'] }, ctx);
    dice('set_tags che cambia solo le maiuscole: changed 1, grafia nuova', [1, ['ohwx', 'blue eyes', 'smiling', 'Woman']], [r.risultato.changed, r.risultato.tags]);
}
{
    // ITALIANO: un doppione nel .txt unito da ordinaTag e' una modifica (la foto perde una voce).
    // ENGLISH: a duplicate in the .txt merged by ordinaTag is a change (the photo loses an entry).
    const a = { id: 'a', file: { name: 'a.png' }, tags: ['ohwx', 'woman', 'woman'], originalTags: ['ohwx', 'woman', 'woman'] };
    const ctx = ctxDi([a]);
    const r = await B.eseguiStrumentoMcp('add_tags', { ids: ['a'], tags: ['woman'] }, ctx);
    dice('foto con un doppione esatto: add_tags la ripulisce (changed 1)', [1, ['ohwx', 'woman']], [r.risultato.changed, a.tags]);
}

console.log(`\n${guai === 0 ? 'TUTTO A POSTO' : 'PROBLEMI: ' + guai} (${fatti} controlli)`);
process.exit(guai === 0 ? 0 : 1);
