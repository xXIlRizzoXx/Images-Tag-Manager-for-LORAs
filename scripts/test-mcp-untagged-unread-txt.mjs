/* ITALIANO: PROVA: list_photos(untagged_only) NON PROPONE LE FOTO CON IL .txt NON LETTO
   Una foto il cui .txt non si e' potuto leggere all'import (bloccato, oltre 1 MB, solo in rete)
   entra con le sole trigger e il segno baseTxtNonLetto (lo stesso array di originalTags). Il resto
   del programma la tratta come una foto con dei tag: "Salta foto gia' taggate" la salta e Salva
   non ci scrive sopra. Prima list_photos(untagged_only) la dava come "senza tag": l'AI la taggava,
   la finestra diceva "premi Salva" e Salva poi rifiutava il lavoro. Casi vicini che non devono
   cambiare: senza untagged_only resta elencata; con il .txt riscritto dopo (originalTags e' un
   array nuovo) torna fra le "senza tag"; una foto normale con le sole trigger resta "senza tag".
   Uso:  node scripts/test-mcp-untagged-unread-txt.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST: list_photos(untagged_only) DOES NOT OFFER PHOTOS WHOSE .txt WAS NOT READ
   A photo whose .txt could not be read at import (locked, over 1 MB, online-only) comes in with
   the triggers only and the baseTxtNonLetto mark (the same array as originalTags). The rest of the
   program treats it as a tagged photo: "Skip already-tagged photos" skips it and Save does not
   write over it. list_photos(untagged_only) used to call it "untagged": the AI tagged it, the
   window said "press Save" and Save then refused the work. Neighbouring cases that must not
   change: without untagged_only it is still listed; with the .txt rewritten later (originalTags is
   a new array) it is "untagged" again; a normal photo with only the triggers stays "untagged".
   Usage:  node scripts/test-mcp-untagged-unread-txt.mjs      (exits with code 1 if anything is off) */

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

// ITALIANO: le foto NON si copiano: l'identita' fra originalTags e baseTxtNonLetto conta.
// ENGLISH: photos are NOT copied: the identity between originalTags and baseTxtNonLetto matters.
const ctxDi = (foto, trigger) => ({ foto: () => foto, trigger: () => trigger, applica: () => {}, immagine: async () => null });

const T = ['ohwx'];
const base = ['ohwx'];
const nonLetta = { id: 'u', file: { name: 'u.png' }, tags: ['ohwx'], originalTags: base, baseTxtNonLetto: base };
const normale = { id: 'n', file: { name: 'n.png' }, tags: ['ohwx'], originalTags: [] };
const riscritta = { id: 'r', file: { name: 'r.png' }, tags: ['ohwx'], originalTags: ['ohwx'], baseTxtNonLetto: ['ohwx'] };
const nonLettaConTag = (() => { const b = ['ohwx', 'smile']; return { id: 't', file: { name: 't.png' }, tags: ['ohwx', 'smile'], originalTags: b, baseTxtNonLetto: b }; })();
const ctx = ctxDi([nonLetta, normale, riscritta, nonLettaConTag], T);

const u = (await B.eseguiStrumentoMcp('list_photos', { untagged_only: true }, ctx)).risultato;
dice('untagged_only: la foto col .txt non letto NON e\' "senza tag"', false, u.photos.some(p => p.id === 'u'));
dice('untagged_only: restano la foto normale e quella col .txt riscritto dopo', ['n', 'r'], u.photos.map(p => p.id));
dice('...e il totale le conta giuste', 2, u.total);
const tutte = (await B.eseguiStrumentoMcp('list_photos', {}, ctx)).risultato;
dice('senza untagged_only la foto col .txt non letto resta elencata', ['u', 'n', 'r', 't'], tutte.photos.map(p => p.id));
const conTag = (await B.eseguiStrumentoMcp('list_photos', { tags: ['smile'], untagged_only: true }, ctx)).risultato;
dice('una foto col .txt non letto e tag veri resta fuori come prima', 0, conTag.total);

console.log(`\n${guai === 0 ? 'TUTTO A POSTO' : 'PROBLEMI: ' + guai} (${fatti} controlli)`);
process.exit(guai === 0 ? 0 : 1);
