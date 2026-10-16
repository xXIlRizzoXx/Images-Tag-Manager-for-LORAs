/* ITALIANO: PROVA DELLA DURATA DEL RECUPERO DI UNA CARTELLA NON RIAPERTA DOPO UN CRASH
   Dopo un crash il backup anti-crash tiene le modifiche delle cartelle non ancora riaperte, anche
   attraverso le sessioni dopo (riscritture del backup, Chiudi progetto). Non avevano una scadenza:
   il crash in una cartella "dataset" (0001..0003, senza tag) restava nel backup per sempre, e
   settimane dopo un'ALTRA cartella "dataset" con gli stessi nomi e senza tag riceveva la vecchia
   modifica come "recuperata", e "Salva" la scriveva nel suo .txt. La data generale del backup non
   serve: ogni scrittura la rinnova. La regola: ogni sorgente ricorda quando e' stata scritta dalle
   foto in memoria l'ultima volta; passati 14 giorni senza che la sua cartella venga riaperta, esce.
   Si provano le regole VERE di src/utils/tagBackup.ts e src/utils/closeGuard.ts (compilate con
   esbuild), con un localStorage finto e un orologio finto (Date.now).
   Uso:  node scripts/test-backup-sources-expire.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF HOW LONG THE RECOVERY OF A FOLDER NOT REOPENED AFTER A CRASH LIVES
   After a crash the crash backup keeps the edits of folders not reopened yet, across the later
   sessions too (backup rewrites, Close project). They had no end: a crash in a folder "dataset"
   (0001..0003, untagged) stayed in the backup forever, and weeks later ANOTHER folder "dataset" with
   the same names and no tags received the old edit as "recovered", and "Save" wrote it into its
   .txt. The backup's top-level date cannot be used: every write refreshes it. The rule: each source
   remembers when it was last written from the photos in memory; after 14 days without its folder
   being reopened, it goes.
   The REAL rules of src/utils/tagBackup.ts and src/utils/closeGuard.ts are tested (compiled with
   esbuild), with a fake localStorage and a fake clock (Date.now).
   Usage:  node scripts/test-backup-sources-expire.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const carica = async (rel) => {
    const u = await esbuild.build({ entryPoints: [path.join(radice, rel)], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
    return import('data:text/javascript;base64,' + Buffer.from(u.outputFiles[0].text).toString('base64'));
};
const B = await carica('src/utils/tagBackup.ts');
const G = await carica('src/utils/closeGuard.ts');
const { dice, esito } = creaControlli();

// ITALIANO: l'orologio finto: il backup non ha altro orologio che Date.now.
// ENGLISH: the fake clock: the backup has no other clock than Date.now.
const GIORNO = 24 * 60 * 60 * 1000;
const T0 = Date.UTC(2026, 0, 10);
let adesso = T0;
Date.now = () => adesso;
const a = (giorni) => { adesso = T0 + giorni * GIORNO; };

const SEP = '\x1f';
const archivio = () => {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};
const foto = (cartella, nome, tags, originalTags, lotto) => ({
    id: lotto + '/' + nome, file: { name: nome }, tags, originalTags, backupKey: cartella + SEP + nome,
    lottoImport: lotto, cartellaImport: cartella,
});
const NOMI = ['0001.png', '0002.png', '0003.png'];
// ITALIANO: il crash: "dataset" senza tag, 0002.png modificata e non salvata.
// ENGLISH: the crash: untagged "dataset", 0002.png edited and unsaved.
const crash = () => {
    const s = archivio();
    a(0);
    G.scriviBackupSubito(s, NOMI.map(n => foto('dataset', n, n === '0002.png' ? ['old edit'] : [], [], 'L-crash')), [], 'dataset');
    return s;
};
// ITALIANO: una sessione che apre un'altra cartella, senza modifiche, e preme Chiudi progetto
//           (closeProjectNow, poi l'effetto del backup con la lista vuota).
// ENGLISH: a session that opens another folder, with no edits, and presses Close project
//          (closeProjectNow, then the backup effect with the empty list).
const altraSessione = (s, lotto = 'L-other') => {
    const altre = [{ ...foto('other', 'a.png', ['x'], ['x'], lotto) }];
    G.scriviBackupSubito(s, altre, [], 'other');
    G.backupDopoChiusura(s, altre, []);
    G.scriviBackupSubito(s, [], [], '');
};
// ITALIANO: cosa riceverebbe 0002.png di un "dataset" senza tag aperto adesso (null = niente).
// ENGLISH: what 0002.png of an untagged "dataset" opened now would receive (null = nothing).
const recupero = (s) => {
    const letto = B.backupDellImport(s.getItem('tagBackup'), 'dataset', B.folderSignature('dataset', NOMI));
    const voce = letto ? letto.voci['dataset' + SEP + '0002.png'] : undefined;
    return B.tagDaRipristinare(voce, [], [], [], undefined, letto ? letto.ts : null);
};

console.log('\n--- crash, poi un\'altra cartella chiusa con Chiudi progetto, poi settimane dopo un "dataset" estraneo ---');
{
    const s = crash();
    a(1);
    altraSessione(s);
    a(30);
    dice('30 giorni dopo: la vecchia modifica non finisce sul "dataset" estraneo', null, recupero(s));
}
{
    const s = crash();
    a(1);
    altraSessione(s);
    a(30);
    altraSessione(s, 'L-other-2');
    dice('30 giorni dopo, alla prima riscrittura del backup la sorgente scaduta esce', null, s.getItem('tagBackup'));
}
{
    const s = crash();
    a(30);
    dice('30 giorni dopo il crash, senza nessuna riscrittura in mezzo: non si applica', null, recupero(s));
}
{
    const s = crash();
    a(5);
    altraSessione(s);
    a(15);
    dice('il conto parte dal crash, non dall\'ultima riscrittura: al giorno 15 e\' scaduta', null, recupero(s));
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const s = crash();
    a(1);
    altraSessione(s);
    a(2);
    dice('due giorni dopo il crash la cartella si recupera ancora', ['old edit'], recupero(s));
    a(13);
    altraSessione(s, 'L-other-2');
    dice('...e anche al giorno 13, dopo un\'altra sessione', ['old edit'], recupero(s));
}
{
    // ITALIANO: una cartella aperta e modificata da settimane, mai chiusa: ogni scrittura la rinnova.
    // ENGLISH: a folder open and edited for weeks, never closed: every write renews it.
    const s = archivio();
    const aperte = NOMI.map(n => foto('dataset', n, n === '0002.png' ? ['old edit'] : [], [], 'L-aperto'));
    a(0);
    G.scriviBackupSubito(s, aperte, [], 'dataset');
    a(20);
    G.scriviBackupSubito(s, aperte, [], 'dataset');
    dice('cartella ancora aperta e modificata al giorno 20: si recupera', ['old edit'], recupero(s));
}
{
    // ITALIANO: crash con due cartelle; tre giorni dopo si riapre char1: char2 si recupera ancora.
    // ENGLISH: crash with two folders; three days later char1 is reopened: char2 still recovers.
    const s = archivio();
    a(0);
    const prima = [
        foto('char1', '0001.png', ['disco', 'modifica char1'], ['disco'], 'L1'),
        foto('char2', 'q1.png', ['disco', 'modifica char2'], ['disco'], 'L2'),
    ];
    G.scriviBackupSubito(s, prima, [], 'char2');
    a(3);
    G.scriviBackupSubito(s, [foto('char1', '0001.png', ['disco', 'modifica char1'], ['disco'], 'L3')], [], 'char1');
    const letto = B.backupDellImport(s.getItem('tagBackup'), 'char2', B.folderSignature('char2', ['q1.png']));
    dice('tre giorni dopo il crash char2 si recupera ancora', ['disco', 'modifica char2'],
        B.tagDaRipristinare(letto && letto.voci['char2' + SEP + 'q1.png'], ['disco'], ['disco'], [], undefined, letto ? letto.ts : null));
}
{
    // ITALIANO: un backup scritto prima di questa regola (sorgenti senza data): il conto parte dalla
    //           prima riscrittura, e intanto si legge come prima.
    // ENGLISH: a backup written before this rule (sources with no date): the count starts at the
    //          first rewrite, and meanwhile it is read as before.
    const s = archivio();
    const firma = B.folderSignature('dataset', NOMI);
    s.setItem('tagBackup', JSON.stringify({ ts: 1, folder: 'dataset', sources: [{ signature: firma, data: { ['dataset' + SEP + '0002.png']: { tags: ['old edit'], base: B.improntaTag([]) } } }] }));
    a(0);
    dice('backup senza date: si legge ancora', ['old edit'], recupero(s));
    altraSessione(s);
    dice('...e alla prima riscrittura resta', ['old edit'], recupero(s));
    a(15);
    dice('...poi scade come gli altri', null, recupero(s));
}

process.exit(esito());
