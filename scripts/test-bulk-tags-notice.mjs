/* ITALIANO: PROVA DEL MESSAGGIO DEI TAG AGGIUNTI IN BLOCCO
   Selezionate 5 foto che hanno gia' tutte "1girl" (o "smile", e si mette "Smile", che per la regola
   delle maiuscole e' lo stesso tag), messo quel tag nel pannello in blocco e premuto Conferma, su
   nessuna foto cambiava niente, ma il messaggio verde diceva "Tag aggiunti: 1. Foto interessate: 5.".
   Con piu' tag, in parte gia' presenti, i numeri erano gonfiati allo stesso modo. La regola: si
   contano i tag che almeno una foto riceve davvero e le foto che cambiano davvero; se non cambia
   niente lo si dice con un messaggio neutro, senza suono di successo, e la cronologia non riceve un
   passo vuoto.
   Si esegue il testo VERO di applyBulkTags preso da src/App.tsx, con la regola vera di
   src/utils/tagCase.ts e i testi veri di src/constants.ts.
   Uso:  node scripts/test-bulk-tags-notice.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE BULK "TAGS ADDED" MESSAGE
   With 5 photos selected that all already have "1girl" (or "smile", and "Smile" is staged, which the
   case rule treats as the same tag), that tag staged in the bulk panel and Confirm pressed, no photo
   changed, yet the green message said "Tags added: 1. Photos affected: 5.". With several tags, part
   of them already there, the numbers were inflated the same way. The rule: count the tags at least
   one photo really gets and the photos that really change; if nothing changes say so with a
   neutral message, without the success chime, and the history gets no empty step.
   The REAL text of applyBulkTags taken from src/App.tsx is run, with the real rule of
   src/utils/tagCase.ts and the real strings of src/constants.ts.
   Usage:  node scripts/test-bulk-tags-notice.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const carica = async (rel) => {
    const u = await esbuild.build({ entryPoints: [path.join(radice, rel)], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
    return import('data:text/javascript;base64,' + Buffer.from(u.outputFiles[0].text).toString('base64'));
};
const C = await carica('src/utils/tagCase.ts');
const lingue = (await carica('src/constants.ts')).translations;

const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const i0 = sorgente.indexOf('    const applyBulkTags = () => {');
const fine = /\r?\n    \};\r?\n/g;
fine.lastIndex = Math.max(i0, 0);
const f0 = i0 < 0 ? null : fine.exec(sorgente);
if (!f0) { console.log('NO  applyBulkTags non trovato in src/App.tsx'); process.exit(1); }
const codice = (await esbuild.transform(sorgente.slice(i0, f0.index + f0[0].length), { loader: 'ts' })).code;
const fabbrica = new Function('images', 'selectedForBulk', 'stagedBulkTags', 'globalTriggers', 'setImages', 'setStagedBulkTags', 'setSelectedForBulk',
    'soundManager', 'showNotification', 't', 'uniqueTagsIgnoringCase', 'countNewTagsIgnoringCase', codice + '\nreturn applyBulkTags;');

// ITALIANO: preme Conferma nel pannello in blocco; restituisce foto dopo, messaggi, suoni e quante volte si e' chiamato setImages.
// ENGLISH: presses Confirm in the bulk panel; returns the photos afterwards, messages, chimes and how many times setImages ran.
const conferma = (t, foto, selezione, inPreparazione, trigger = []) => {
    const r = { foto, notifiche: [], suoni: 0, setImages: 0, inPreparazione: null, selezione: null };
    fabbrica(foto, selezione, inPreparazione, trigger, (fn) => { r.setImages++; r.foto = fn(r.foto); }, (v) => { r.inPreparazione = v; },
        (v) => { r.selezione = v; }, { chime() { r.suoni++; }, pop() { } }, (m, tipo) => r.notifiche.push([m, tipo]), t,
        C.uniqueTagsIgnoringCase, C.countNewTagsIgnoringCase)();
    return r;
};
const aggiunti = (t, tags, images) => [[t.bulkTagsAdded.replace('{tags}', String(tags)).replace('{images}', String(images)), 'success']];

for (const l of Object.keys(lingue)) {
    const t = lingue[l];
    console.log(`\n--- ${l} ---`);
    dice('la frase "niente di nuovo" esiste', 'string', typeof t.bulkTagsNothingNew);
    {
        const cinque = Array.from({ length: 5 }, (_, i) => ({ id: 'f' + i, isTrashed: false, tags: ['1girl', 'smile'] }));
        const r = conferma(t, cinque, cinque.map(f => f.id), ['Smile']);
        dice('5 foto che hanno gia\' "smile", in blocco "Smile": messaggio neutro, nessun suono', [[[t.bulkTagsNothingNew, 'info']], 0], [r.notifiche, r.suoni]);
        dice('...nessuna foto cambia e la cronologia non riceve un passo', [0, true], [r.setImages, r.foto === cinque]);
        dice('...e il pannello si chiude come sempre', [[], []], [r.inPreparazione, r.selezione]);
    }
    {
        const tre = [{ id: 'a', isTrashed: false, tags: ['1girl'] }, { id: 'b', isTrashed: false, tags: ['solo'] }, { id: 'c', isTrashed: false, tags: ['sky'] }];
        const r = conferma(t, tre, ['a', 'b', 'c'], ['1girl']);
        dice('3 foto, a 2 manca "1girl": "Tag aggiunti: 1. Foto interessate: 2."', aggiunti(t, 1, 2), r.notifiche);
        dice('...e le due foto lo ricevono', [['1girl'], ['1girl', 'solo'], ['1girl', 'sky']], r.foto.map(f => f.tags));
    }
    {
        const due = [{ id: 'a', isTrashed: false, tags: ['hat', 'smile'] }, { id: 'b', isTrashed: false, tags: ['smile'] }];
        const r = conferma(t, due, ['a', 'b'], ['smile', 'hat', 'red dress']);
        dice('3 tag, "smile" gia\' su tutte e "hat" su una: "Tag aggiunti: 2. Foto interessate: 2."', aggiunti(t, 2, 2), r.notifiche);
    }
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const t = lingue.en;
    const foto = [{ id: 'a', isTrashed: false, tags: ['smile'] }, { id: 'b', isTrashed: true, tags: [] }, { id: 'c', isTrashed: false, tags: [] }];
    const r = conferma(t, foto, ['a', 'b'], ['hat']);
    dice('foto cestinata nella selezione: non riceve niente e non si conta', [aggiunti(t, 1, 1), [['hat', 'smile'], [], []]], [r.notifiche, r.foto.map(f => f.tags)]);
    dice('...con il suono di successo', 1, r.suoni);
    const trigger = conferma(t, [{ id: 'a', isTrashed: false, tags: ['OHWX', 'smile'] }], ['a'], ['ohwx', 'hat'], ['OHWX']);
    dice('con la trigger "OHWX": "ohwx" non conta come nuovo, la trigger resta davanti', [aggiunti(t, 1, 1), [['OHWX', 'hat', 'smile']]],
        [trigger.notifiche, trigger.foto.map(f => f.tags)]);
}

process.exit(esito());
