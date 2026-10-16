/* ITALIANO: PROVA DEL BACKUP ANTI-CRASH DOPO UN Ctrl+Z OLTRE L'IMPORT
   Il backup tiene le sorgenti delle cartelle che non sono in memoria: dopo un crash sono quelle
   ancora da riaprire. Ma anche un Ctrl+Z oltre l'import toglie una cartella dalla memoria, e la
   sua sorgente restava: con la trigger 'ohwx' nel riquadro all'import (tutte le foto da salvare),
   o con una modifica annullata e subito dopo l'import annullato entro il secondo del backup,
   riaprendo la cartella giorni dopo l'avviso diceva "recuperate" e le foto tornavano con 'ohwx'
   come tag normale, o con la modifica annullata, pronte per Salva. Ora una sorgente scritta da un
   import di QUESTA sessione che in memoria non c'e' piu' cade; quelle di una sessione prima (il
   recupero dopo un crash) restano.
   Si eseguono le regole VERE di src/utils (closeGuard, tagBackup, sidecarTags) con un
   localStorage finto, e si controlla che App.tsx passi i lotti della sessione alle due scritture.
   Uso:  node scripts/test-backup-undo-import.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE CRASH BACKUP AFTER A Ctrl+Z PAST THE IMPORT
   The backup keeps the sources of the folders not in memory: after a crash they are the ones still
   to reopen. But a Ctrl+Z past the import also takes a folder out of memory, and its source stayed:
   with the trigger 'ohwx' in the box at import (every photo unsaved), or with an edit undone and
   right after the import undone within the backup's second, reopening the folder days later the
   notice said "recovered" and the photos came back with 'ohwx' as a plain tag, or with the undone
   edit, ready for Save. Now a source written by an import of THIS session that is no longer in
   memory is dropped; those of an earlier session (the recovery after a crash) stay.
   The REAL rules of src/utils (closeGuard, tagBackup, sidecarTags) run with a fake localStorage,
   and App.tsx is checked to pass the session's batches to both writes.
   Usage:  node scripts/test-backup-undo-import.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
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
const DISCO = { 'a.png': ['girl', 'smile'], 'b.png': ['girl', 'hat'] };
const NOMI = Object.keys(DISCO);
// ITALIANO: l'import come lo fa processImportData: tagDiImport con le trigger attive, un lotto per import.
// ENGLISH: the import as processImportData does it: tagDiImport with the active triggers, one batch per import.
const importa = (lotto, trigger = [], cartella = 'dataset') => NOMI.map(nome => {
    const { tags, originalTags } = S.tagDiImport(trigger, DISCO[nome]);
    return { id: lotto + nome, file: { name: nome }, tags, originalTags, backupKey: 'E:\\' + cartella + SEP + nome, lottoImport: lotto, cartellaImport: cartella };
});
// ITALIANO: la riapertura della cartella, in una sessione dopo, senza trigger: i tag che tornerebbero.
// ENGLISH: reopening the folder, in a later session, with no trigger: the tags that would come back.
const riapri = (memoria, nome, cartella = 'dataset') => {
    const letto = B.backupDellImport(memoria.getItem('tagBackup'), cartella, B.folderSignature(cartella, NOMI));
    const { tags, originalTags } = S.tagDiImport([], DISCO[nome]);
    return B.tagDaRipristinare(letto ? letto.voci['E:\\' + cartella + SEP + nome] : undefined, tags, originalTags, [], undefined, letto ? letto.ts : null);
};

console.log('\n--- caso A: trigger nel riquadro, Carica cartella, poi un Ctrl+Z oltre l\'import ---');
{
    const memoria = memoriaFinta();
    const sessione = new Set();
    G.scriviBackupSubito(memoria, importa('L1', ['ohwx']), [], 'dataset', ['ohwx'], sessione);
    dice('premessa: dopo l\'import il backup c\'e\' (la trigger rende ogni foto da salvare)', true, memoria.getItem('tagBackup') !== null);
    G.scriviBackupSubito(memoria, [], [], 'dataset', ['ohwx'], sessione);
    dice('dopo il Ctrl+Z oltre l\'import il backup non tiene piu\' quella cartella', null, memoria.getItem('tagBackup'));
    dice('riaprendo la cartella senza trigger: niente "recuperato", resta il .txt', [null, null], [riapri(memoria, 'a.png'), riapri(memoria, 'b.png')]);
}

console.log('\n--- caso B: una modifica, poi due Ctrl+Z in fretta (modifica e import annullati) ---');
{
    const memoria = memoriaFinta();
    const sessione = new Set();
    const foto = importa('L1');
    G.scriviBackupSubito(memoria, foto.map(f => (f.file.name === 'a.png' ? { ...f, tags: [...f.tags, 'EDIT'] } : f)), [], 'dataset', [], sessione);
    dice('premessa: la modifica e\' nel backup', ['girl', 'smile', 'EDIT'], riapri(memoria, 'a.png'));
    G.scriviBackupSubito(memoria, [], [], 'dataset', [], sessione);
    dice('dopo i due Ctrl+Z la modifica annullata non torna', null, riapri(memoria, 'a.png'));
}

console.log('\n--- quello che NON deve cambiare ---');
{
    // ITALIANO: il crash vero: la sessione dopo parte con un insieme vuoto, e la sorgente resta.
    // ENGLISH: the real crash: the next session starts with an empty set, and the source stays.
    const memoria = memoriaFinta();
    G.scriviBackupSubito(memoria, importa('L1').map(f => (f.file.name === 'a.png' ? { ...f, tags: [...f.tags, 'EDIT'] } : f)), [], 'dataset', [], new Set());
    G.scriviBackupSubito(memoria, [], [], '', [], new Set());
    dice('dopo un crash la sessione nuova (lotti suoi vuoti) tiene la sorgente', ['girl', 'smile', 'EDIT'], riapri(memoria, 'a.png'));
    // ITALIANO: in quella sessione si lavora su un'altra cartella: la sorgente del crash resta.
    // ENGLISH: in that session another folder is worked on: the crash source stays.
    const sessione = new Set();
    G.scriviBackupSubito(memoria, importa('L2', [], 'altra').map(f => ({ ...f, tags: [...f.tags, 'x'] })), [], 'altra', [], sessione);
    G.scriviBackupSubito(memoria, [], [], 'altra', [], sessione);
    dice('...anche se nella sessione si apre e si toglie un\'altra cartella', ['girl', 'smile', 'EDIT'], riapri(memoria, 'a.png'));
    dice('...mentre l\'altra cartella, tolta con Ctrl+Z, non resta', null, riapri(memoria, 'a.png', 'altra'));
}
{
    // ITALIANO: due cartelle aperte, Ctrl+Z toglie solo la seconda: la prima resta con le sue modifiche.
    // ENGLISH: two folders open, Ctrl+Z removes only the second: the first stays with its edits.
    const memoria = memoriaFinta();
    const sessione = new Set();
    const prima = importa('L1', [], 'uno').map(f => (f.file.name === 'a.png' ? { ...f, tags: [...f.tags, 'EDIT1'] } : f));
    const seconda = importa('L2', [], 'due').map(f => (f.file.name === 'a.png' ? { ...f, tags: [...f.tags, 'EDIT2'] } : f));
    G.scriviBackupSubito(memoria, [...prima, ...seconda], [], 'due', [], sessione);
    G.scriviBackupSubito(memoria, prima, [], 'uno', [], sessione);
    dice('la prima cartella, ancora in memoria, resta nel backup', ['girl', 'smile', 'EDIT1'], riapri(memoria, 'a.png', 'uno'));
    dice('la seconda, tolta con Ctrl+Z, no', null, riapri(memoria, 'a.png', 'due'));
}
{
    // ITALIANO: senza l'insieme (chi chiama come prima, per esempio backupDopoChiusura) non cambia niente.
    // ENGLISH: without the set (callers as before, e.g. backupDopoChiusura) nothing changes.
    const memoria = memoriaFinta();
    G.scriviBackupSubito(memoria, importa('L1', ['ohwx']), [], 'dataset', ['ohwx']);
    G.scriviBackupSubito(memoria, [], [], 'dataset', ['ohwx']);
    dice('senza l\'insieme dei lotti la sorgente resta, come prima', true, memoria.getItem('tagBackup') !== null);
}

console.log('\n--- App.tsx passa i lotti della sessione alle due scritture del backup ---');
{
    const app = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
    dice('un insieme per tutta la sessione (useRef(new Set))', true, /const lottiSessioneRef = useRef<Set<string>>\(new Set\(\)\);/.test(app));
    const righe = app.split('\n').filter(r => r.includes('scriviBackupSubito(localStorage,'));
    dice('le due scritture (effetto e chiusura della finestra) lo passano', [2, true], [righe.length, righe.every(r => r.includes(', lottiSessioneRef.current);'))]);
}

process.exit(esito());
