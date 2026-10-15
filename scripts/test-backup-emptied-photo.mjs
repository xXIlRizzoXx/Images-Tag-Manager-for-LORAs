/* ITALIANO: PROVA DEL RECUPERO DOPO UN CRASH DI UNA FOTO A CUI SONO STATI TOLTI TUTTI I TAG
   Il backup anti-crash contiene solo le foto con modifiche non salvate: una voce con la lista
   vuota e' quindi una modifica voluta (tutti i tag tolti, per esempio per togliere tag spazzatura
   prima di ritaggare con l'AI). Al recupero non si applicava: la regola "lista vuota = niente da
   rimettere" veniva dalla 1.2.0, quando il backup conteneva TUTTE le foto. La foto tornava con i
   suoi vecchi tag senza una parola, e un secondo dopo il backup riscritto dalla memoria perdeva
   anche la voce. Ora una voce di questa versione (con `base`) torna anche vuota; quelle della
   versione precedente (senza `base`) no, come prima.
   Si eseguono le regole VERE di src/utils (tagBackup, closeGuard, sidecarTags) con un localStorage finto.
   Uso:  node scripts/test-backup-emptied-photo.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE CRASH RECOVERY OF A PHOTO WHOSE TAGS WERE ALL REMOVED
   The crash backup holds only the photos with unsaved edits: an entry with an empty list is
   therefore a deliberate edit (every tag removed, for example to drop junk tags before re-tagging
   with the AI). On recovery it was not applied: the rule "empty list = nothing to put back" came
   from 1.2.0, when the backup held EVERY photo. The photo came back with its old tags without a
   word, and a second later the backup rewritten from memory lost the entry too. Now an entry of
   this version (with `base`) comes back even when empty; the previous version's ones (no `base`)
   do not, as before.
   The REAL rules of src/utils (tagBackup, closeGuard, sidecarTags) run with a fake localStorage.
   Usage:  node scripts/test-backup-emptied-photo.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const carica = async (rel) => {
    const uscita = await esbuild.build({
        entryPoints: [path.join(radice, rel)],
        bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
    });
    return import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));
};
const B = await carica('src/utils/tagBackup.ts');
const G = await carica('src/utils/closeGuard.ts');
const S = await carica('src/utils/sidecarTags.ts');
const { dice, esito } = creaControlli();

const SEP = '\x1f';
const memoriaFinta = () => {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } };
};
const foto = (nome, tags, originalTags) => ({ id: nome, file: { name: nome }, tags, originalTags, backupKey: 'E:\\dataset' + SEP + nome, lottoImport: 'L1', cartellaImport: 'dataset' });
const NOMI = ['a.png', 'b.png'];
// ITALIANO: la riapertura come la fa processImportData: tagDiImport, poi tagDaRipristinare.
// ENGLISH: the reopening as processImportData does it: tagDiImport, then tagDaRipristinare.
const riapri = (memoria, nome, disco, trigger = []) => {
    const letto = B.backupDellImport(memoria.getItem('tagBackup'), 'dataset', B.folderSignature('dataset', NOMI));
    const { tags, originalTags } = S.tagDiImport(trigger, disco);
    return B.tagDaRipristinare(letto ? letto.voci['E:\\dataset' + SEP + nome] : undefined, tags, originalTags, trigger, undefined, letto ? letto.ts : null);
};

console.log('\n--- a.png con tutti i tag tolti, b.png con un tag aggiunto, poi crash ---');
const memoria = memoriaFinta();
G.scriviBackupSubito(memoria, [foto('a.png', [], ['blurry', 'watermark']), foto('b.png', ['cat', 'dog'], ['cat'])], [], 'dataset');
dice('premessa: nel backup a.png ha la lista vuota', [], (JSON.parse(memoria.getItem('tagBackup')).sources[0].data['E:\\dataset' + SEP + 'a.png'] || {}).tags);
dice('riaprendo, a.png torna senza tag (la modifica voluta)', [], riapri(memoria, 'a.png', ['blurry', 'watermark']));
dice('...con una trigger attiva torna con la sola trigger', ['ohwx'], riapri(memoria, 'a.png', ['blurry', 'watermark'], ['ohwx']));
dice('b.png torna come prima', ['cat', 'dog'], riapri(memoria, 'b.png', ['cat']));

console.log('\n--- quello che NON deve cambiare ---');
dice('il .txt di a.png e\' cambiato dopo il backup (base diversa): vince il .txt', null, riapri(memoria, 'a.png', ['blurry', 'watermark', 'new']));
// ITALIANO: la voce della versione precedente (senza `base`, backup con TUTTE le foto): lista vuota = foto senza tag.
// ENGLISH: the previous version's entry (no `base`, backup with EVERY photo): empty list = untagged photo.
dice('voce della versione precedente con la lista vuota: non si applica', null, B.tagDaRipristinare({ tags: [] }, ['blurry'], ['blurry'], [], undefined, null));
dice('una voce uguale al disco non e\' un recupero', null, B.tagDaRipristinare({ tags: [], base: B.improntaTag([]) }, [], [], [], undefined, null));

process.exit(esito());
