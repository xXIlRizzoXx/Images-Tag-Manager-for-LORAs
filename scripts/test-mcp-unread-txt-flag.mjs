/* ITALIANO: PROVA: L'AI ESTERNA SA QUALI FOTO HANNO IL .txt NON LETTO
   Una foto il cui .txt non si e' potuto leggere all'import (bloccato, oltre 1 MB, solo in rete)
   entra con le sole trigger e il segno baseTxtNonLetto (lo stesso array di originalTags). Salva
   Modifiche non la scrive, per non coprire il .txt vero. Prima list_photos la mostrava uguale a una
   foto senza tag e add/set/remove_tags rispondevano solo "premi Save Changes": l'AI non poteva
   sapere che il suo lavoro su quella foto non sarebbe andato su disco. Ora list_photos la segna con
   txt_unreadable: true e le risposte delle modifiche la elencano in txt_unreadable con una frase.
   Casi vicini che non devono cambiare: una foto normale non ha il campo; una foto col .txt
   riscritto dopo (originalTags e' un array nuovo) non e' piu' segnata; la modifica resta fatta in
   memoria (il visualizzatore la puo' salvare apposta); una foto non cambiata non viene elencata.
   Uso:  node scripts/test-mcp-unread-txt-flag.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST: THE EXTERNAL AI KNOWS WHICH PHOTOS HAVE AN UNREAD .txt
   A photo whose .txt could not be read at import (locked, over 1 MB, online-only) comes in with
   the triggers only and the baseTxtNonLetto mark (the same array as originalTags). Save Changes
   does not write it, so as not to cover the real .txt. list_photos used to show it like an
   untagged photo and add/set/remove_tags only answered "press Save Changes": the AI could not know
   that its work on that photo would not reach the disk. Now list_photos marks it with
   txt_unreadable: true and the change answers list it in txt_unreadable with a sentence.
   Neighbouring cases that must not change: a normal photo has no such field; a photo whose .txt was
   rewritten later (originalTags is a new array) is no longer marked; the change is still made in
   memory (the viewer can save it on purpose); a photo that did not change is not listed.
   Usage:  node scripts/test-mcp-unread-txt-flag.mjs      (exits with code 1 if anything is off) */

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
const T = ['ohwx'];
const crea = () => {
    const base = ['ohwx'];
    const foto = [
        { id: 'u', file: { name: 'u.png' }, tags: ['ohwx'], originalTags: base, baseTxtNonLetto: base },
        { id: 'n', file: { name: 'n.png' }, tags: ['ohwx'], originalTags: [] },
        { id: 'r', file: { name: 'r.png' }, tags: ['ohwx'], originalTags: ['ohwx'], baseTxtNonLetto: ['ohwx'] },
    ];
    return {
        foto: () => foto,
        trigger: () => T,
        applica: (nuovi) => { for (const [id, t] of nuovi) foto.find(f => f.id === id).tags = t; },
        immagine: async () => null,
    };
};

{
    const ctx = crea();
    const r = (await B.eseguiStrumentoMcp('list_photos', {}, ctx)).risultato;
    const di = id => r.photos.find(p => p.id === id);
    dice('list_photos: la foto col .txt non letto ha txt_unreadable true', true, di('u').txt_unreadable);
    dice('...la foto normale non ha il campo', false, 'txt_unreadable' in di('n'));
    dice('...quella col .txt riscritto dopo non ha il campo', false, 'txt_unreadable' in di('r'));
    dice('...le altre voci della foto non cambiano', { id: 'u', name: 'u.png', folder: '', tags: ['ohwx'], unsaved: false },
        { id: di('u').id, name: di('u').name, folder: di('u').folder, tags: di('u').tags, unsaved: di('u').unsaved });
}
for (const strumento of ['add_tags', 'set_tags']) {
    const ctx = crea();
    const args = strumento === 'set_tags' ? { id: 'u', tags: ['cat'] } : { ids: ['u', 'n'], tags: ['cat'] };
    const r = await B.eseguiStrumentoMcp(strumento, args, ctx);
    dice(`${strumento}: la foto col .txt non letto e' elencata in txt_unreadable`, ['u'], r.risultato.txt_unreadable);
    dice(`${strumento}: la nota dice che Save Changes non la scrive`, true,
        /could not be read/.test(r.risultato.note) && /Save Changes/.test(r.risultato.note) && /not write/.test(r.risultato.note));
    dice(`${strumento}: la modifica resta fatta in memoria`, ['ohwx', 'cat'], ctx.foto()[0].tags);
}
{
    const ctx = crea();
    const r = await B.eseguiStrumentoMcp('add_tags', { ids: ['n', 'r'], tags: ['cat'] }, ctx);
    dice('add_tags senza foto col .txt non letto: nessun campo txt_unreadable', false, 'txt_unreadable' in r.risultato);
    dice('...e la nota resta quella di sempre', 'Changed in the program only, not saved to disk yet: the user reviews them and presses "Save Changes".', r.risultato.note);
    const s = await B.eseguiStrumentoMcp('remove_tags', { ids: ['u'], tags: ['zzz'] }, ctx);
    dice('remove_tags che non cambia la foto col .txt non letto: non la elenca', false, 'txt_unreadable' in s.risultato);
}

console.log(`\n${guai === 0 ? 'TUTTO A POSTO' : 'PROBLEMI: ' + guai} (${fatti} controlli)`);
process.exit(guai === 0 ? 0 : 1);
