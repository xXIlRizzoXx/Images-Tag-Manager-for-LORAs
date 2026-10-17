/* ITALIANO: PROVA DI "ANNULLA LO SVUOTAMENTO" CON UNA GEMELLA E NESSUN .TXT SUL DISCO
   Dataset nuovo: a.png e a.jpg, nessun a.txt (i tag sono solo in memoria). Si cestina e si svuota
   a.png, poi "Annulla lo svuotamento". Nessun .txt e' mai andato nel Cestino di Windows, ma l'avviso
   diceva "File di tag non ripresi dal Cestino di Windows: 1" (azzurro): l'utente cercava un file
   mai esistito. Senza la gemella lo stesso giro dava gia' l'avviso verde giusto. La regola: un .txt
   condiviso che non si trova conta come "non ripreso" solo se la foto aveva un ricordo del disco
   (originalTags non vuoto) o un .txt non letto; una foto senza tag in memoria non ha niente da
   riscrivere. Si esegue il codice VERO preso da src/App.tsx (vedi trash-harness.mjs).
   Uso:  node scripts/test-undo-empty-twin-no-txt.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF "UNDO THE EMPTYING" WITH A TWIN AND NO .TXT ON DISK
   New dataset: a.png and a.jpg, no a.txt (the tags are only in memory). a.png is trashed and
   emptied, then "Undo the emptying". No .txt ever went to the Windows Recycle Bin, but the notice
   said "Tag files not taken back out of the Windows Recycle Bin: 1" (blue): the user looked for a
   file that never existed. Without the twin the same round already gave the right green notice.
   The rule: a shared .txt that is not found counts as "not taken back" only if the photo had a
   record of the disk (non-empty originalTags) or an unread .txt; a photo with no tags in memory has
   nothing to rewrite. The REAL code taken from src/App.tsx is run (see trash-harness.mjs).
   Usage:  node scripts/test-undo-empty-twin-no-txt.mjs      (exits with code 1 if anything is off) */

import { creaApp, apiFinta, t } from './trash-harness.mjs';
import { creaControlli } from './main-harness.mjs';

const { dice, esito } = creaControlli();
const D = 'E:\\dataset\\';
const foto = (id, nome, { tags = ['ohwx', 'cat'], originalTags = [] } = {}) => ({
    id, file: { name: nome, percorso: D + nome }, thumb: 'blob:finto/' + id,
    tags: [...tags], originalTags: [...originalTags], isTrashed: false, dirHandle: null,
});

/* ITALIANO: `altra` = la seconda foto (la gemella a.jpg o una b.png); a.png con le opzioni `png`.
   Si cestina e si svuota a.png, poi "Annulla lo svuotamento". `disco` = i .txt che ci sono.
   ENGLISH: `altra` = the second photo (the twin a.jpg or a b.png); a.png with the `png` options.
   a.png is trashed and emptied, then "Undo the emptying". `disco` = the .txt files that exist. */
const giro = async ({ altra = 'a.jpg', png = {}, disco = {} } = {}) => {
    const api0 = apiFinta({ txtSulDisco: (p) => (p in disco ? disco[p] : false) });
    // ITALIANO: il canale vero: spostare un .txt che non c'e' risponde 'ok' senza spostare niente.
    // ENGLISH: the real channel: moving a .txt that is not there answers 'ok' without moving anything.
    const api = { ...api0, chiamate: api0.chiamate, ripristini: api0.ripristini, trashFiles: async (percorsi) => {
        const r = await api0.trashFiles(percorsi);
        return percorsi[0].endsWith('.txt') && !(percorsi[0] in disco) ? { ok: true, trashed: 0, failed: 0, results: ['ok'] } : r;
    } };
    const app = creaApp([foto('P', 'a.png', png), foto('Q', altra)], { api });
    await app.attendi();
    app.cestina('P');
    await app.attendi();
    await app.render().handleEmptyTrash();
    await app.attendi(10);
    const n = app.notifiche.length;
    await app.render().annullaSvuotamento();
    await app.attendi(10);
    const P = app.stato.images.find(i => i.id === 'P');
    return { P: P ? [P.tags, P.originalTags, P.isTrashed] : null, notifiche: app.notifiche.slice(n) };
};
const verde = [[t.undoEmptyDone.replace('{n}', '1'), 'success']];
const parlaDiTxt = (r) => r.notifiche.length === 1 && r.notifiche[0][0].includes(t.undoEmptyTxtNotBack.replace('{n}', '1'));

console.log('\n--- gemella a.jpg, nessun a.txt sul disco ---');
{
    const r = await giro();
    dice('a.png torna nel cestino con i suoi tag, da salvare', [['ohwx', 'cat'], [], true], r.P);
    dice('avviso verde, niente "file di tag non ripresi" (nessun .txt e\' mai esistito)', verde, r.notifiche);
}
{
    // ITALIANO: senza nessun tag nemmeno in memoria: niente da dire.
    // ENGLISH: with no tags even in memory: nothing to say.
    const r = await giro({ png: { tags: [], originalTags: [] } });
    dice('foto senza tag e senza .txt: avviso verde', verde, r.notifiche);
}

console.log('\n--- quello che deve restare com\'era ---');
{
    const r = await giro({ altra: 'b.png' });
    dice('senza gemella: avviso verde', verde, r.notifiche);
}
{
    // ITALIANO: a.txt c'era (ricordo [cat]) e nel frattempo e' sparito: l'avviso resta.
    // ENGLISH: a.txt was there (record [cat]) and it vanished meanwhile: the notice stays.
    const r = await giro({ png: { tags: ['cat', 'red'], originalTags: ['cat'] } });
    dice('.txt c\'era e manca: a.png torna da salvare (originalTags vuoto)', [['cat', 'red'], [], true], r.P);
    dice('.txt c\'era e manca: l\'avviso lo dice', true, parlaDiTxt(r));
}
{
    // ITALIANO: a.txt c'e' ed e' uguale: tutto come prima.
    // ENGLISH: a.txt is there and equal: everything as before.
    const r = await giro({ png: { tags: ['cat'], originalTags: ['cat'] }, disco: { [D + 'a.txt']: 'cat' } });
    dice('.txt condiviso uguale: torna com\'era', [['cat'], ['cat'], true], r.P);
    dice('.txt condiviso uguale: avviso verde', verde, r.notifiche);
}

process.exit(esito());
