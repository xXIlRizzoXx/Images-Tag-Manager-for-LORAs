/* ITALIANO: PROVA DI "ANNULLA LO SVUOTAMENTO" CON UN .TXT CONDIVISO CAMBIATO NEL FRATTEMPO
   a.png e a.jpg nella stessa cartella hanno un solo a.txt ("cat"). Si cestina e si svuota solo
   a.png: a.txt resta sul disco per a.jpg. Poi si aggiunge "dog" ad a.jpg e si salva: a.txt dice
   "cat, dog". "Annulla lo svuotamento" riportava a.png con i tag di allora ([cat]) come salvata,
   perche' guardava solo se a.txt c'era ancora e buttava via il suo contenuto; dopo "Ripristina",
   "red" su a.png e "Salva modifiche", a.txt diventava "cat, red," con l'avviso verde e "dog", gia'
   salvato, spariva dal disco e dallo schermo. La regola: se il .txt condiviso c'e' ma dice altro,
   la foto torna con il contenuto del disco (originalTags) e le sue modifiche sopra, come fa
   l'editor dei file di tag (tagDopoEditor). Un .txt uguale, illeggibile o sparito: come prima.
   Si eseguono i testi VERI presi da src/App.tsx (vedi trash-harness.mjs e undo-harness.mjs).
   Uso:  node scripts/test-undo-empty-shared-txt-content.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF "UNDO THE EMPTYING" WITH A SHARED .TXT CHANGED MEANWHILE
   a.png and a.jpg in the same folder have a single a.txt ("cat"). Only a.png is trashed and
   emptied: a.txt stays on disk for a.jpg. Then "dog" is added to a.jpg and saved: a.txt says
   "cat, dog". "Undo the emptying" brought a.png back with the tags of then ([cat]) as saved,
   since it only checked whether a.txt was still there and threw its content away; after
   "Restore", "red" on a.png and "Save changes", a.txt became "cat, red," with the green notice and
   "dog", already saved, vanished from the disk and from the screen. The rule: if the shared .txt
   is there but says something else, the photo comes back with the disk's content (originalTags)
   and its own edits on top, as the tag file editor does (tagDopoEditor). An equal, unreadable or
   missing .txt: as before.
   The REAL code taken from src/App.tsx is run (see trash-harness.mjs and undo-harness.mjs).
   Usage:  node scripts/test-undo-empty-shared-txt-content.mjs      (exits with code 1 if anything is off) */

import { creaApp, apiFinta, t } from './trash-harness.mjs';
import { creaApp as creaAppSalva } from './undo-harness.mjs';
import { creaControlli } from './main-harness.mjs';

const { dice, esito } = creaControlli();
const D = 'E:\\dataset\\';
const foto = (id, nome, { cestinata = true, tags = ['cat'], originalTags = ['cat'] } = {}) => ({
    id, file: { name: nome, percorso: D + nome }, thumb: 'blob:finto/' + id,
    tags: [...tags], originalTags: [...originalTags], isTrashed: cestinata, dirHandle: null,
});

/* ITALIANO: a.png nel cestino (con `png` come opzioni), a.jpg in galleria; svuota; poi `dopo(disco)`
   cambia il disco (per esempio il Salva di a.jpg); poi "Annulla lo svuotamento". Torna a.png com'e'
   rientrata, gli avvisi e il disco.
   ENGLISH: a.png in the trash (with `png` as options), a.jpg in the gallery; empty; then
   `dopo(disco)` changes the disk (e.g. a.jpg's Save); then "Undo the emptying". Returns a.png as it
   came back, the notices and the disk. */
const scenario = async ({ png = {}, dopo = () => { } } = {}) => {
    const disco = { [D + 'a.txt']: 'cat' };
    const api = apiFinta({ txtSulDisco: (p) => (p in disco ? disco[p] : false) });
    const app = creaApp([foto('P', 'a.png', png), foto('J', 'a.jpg', { cestinata: false })], { api });
    await app.attendi();
    await app.render().handleEmptyTrash();
    await app.attendi(10);
    const premessa = [app.vista(), api.chiamate];
    await dopo(disco, app);
    const n = app.notifiche.length;
    await app.render().annullaSvuotamento();
    await app.attendi(10);
    return { P: app.stato.images.find(i => i.id === 'P'), notifiche: app.notifiche.slice(n), disco, premessa };
};
// ITALIANO: il Salva di a.jpg con "dog": a.txt riscritto, a.jpg segnata salvata (fuori dalla cronologia).
// ENGLISH: a.jpg's Save with "dog": a.txt rewritten, a.jpg marked saved (outside the history).
const salvaJpgConDog = async (disco, app) => {
    app.modifica(prev => prev.map(i => (i.id === 'J' ? { ...i, tags: ['cat', 'dog'] } : i)));
    await app.attendi();
    disco[D + 'a.txt'] = 'cat, dog';
    app.refs.isUndoRedoAction.current = true;
    app.modifica(prev => prev.map(i => (i.id === 'J' ? { ...i, originalTags: ['cat', 'dog'] } : i)));
    await app.attendi();
};
const statoDi = (f) => (f ? [f.tags, f.originalTags, f.isTrashed] : null);

console.log('\n--- a.txt condiviso cambiato fra lo svuotamento e l\'annullamento ---');
let tornata = null;
{
    const r = await scenario({ dopo: salvaJpgConDog });
    dice('premessa: svuotata solo a.png, a.txt resta per a.jpg', [['J'], [[D + 'a.png']]], r.premessa);
    dice('a.png torna nel cestino con il contenuto di a.txt di adesso, salvata', [['cat', 'dog'], ['cat', 'dog'], true], statoDi(r.P));
    dice('avviso verde: tornata, nessun .txt mancante', [[t.undoEmptyDone.replace('{n}', '1'), 'success']], r.notifiche);
    tornata = r.P;
}
{
    // ITALIANO: dopo "Ripristina", "red" su a.png e "Salva modifiche" (il Salva vero, con le gemelle).
    // ENGLISH: after "Restore", "red" on a.png and "Save changes" (the real Save, with the twins).
    const scritti = new Map([['a.txt', 'cat, dog,']]);
    const ds = { nome: 'ds', scritti };
    ds.getFileHandle = async (file) => ({
        nome: file.toLowerCase(), cartella: 'ds',
        createWritable: async () => ({ write: async (s) => { scritti.set(file.toLowerCase(), String(s)); }, close: async () => { } }),
    });
    ds.isSameEntry = async (altra) => !!altra && altra.nome === 'ds';
    const conCartella = (id, nome, f) => ({ id, file: { name: nome }, thumb: 'blob:finto/' + id, tags: [...f.tags], originalTags: [...f.originalTags], isTrashed: false, dirHandle: ds, width: 1, height: 1 });
    const app = creaAppSalva([conCartella('A', 'a.png', tornata || { tags: [], originalTags: [] }), conCartella('B', 'a.jpg', { tags: ['cat', 'dog'], originalTags: ['cat', 'dog'] })]);
    app.importa();
    await app.attendi();
    app.modifica(prev => prev.map(i => (i.id === 'A' ? { ...i, tags: [...i.tags, 'red'] } : i)));
    await app.attendi();
    dice('il Salva dopo riesce', true, await app.render().handleSaveChanges());
    await app.attendi();
    dice('a.txt = "cat, dog, red," (prima: "cat, red,", e "dog" spariva)', 'cat, dog, red,', scritti.get('a.txt'));
    dice('a.jpg tiene "dog"', ['cat', 'dog', 'red'], app.fotoCon('B').tags);
}

console.log('\n--- quello che deve restare com\'era ---');
{
    // ITALIANO: a.png con una modifica sua non salvata ("red"): la tiene, sopra il disco, e resta da salvare.
    // ENGLISH: a.png with an unsaved edit of its own ("red"): it keeps it, on top of the disk, and stays to be saved.
    const r = await scenario({ png: { tags: ['cat', 'red'], originalTags: ['cat'] }, dopo: salvaJpgConDog });
    dice('modifica propria: disco piu\' "red", da salvare', [['cat', 'dog', 'red'], ['cat', 'dog'], true], statoDi(r.P));
}
{
    // ITALIANO: a.png con TUTTI i tag tolti a mano (tags [], non salvata): anche lei si confronta con
    //           a.txt. Prima restava con il ricordo vecchio ([cat]) e il Salva dopo "Ripristina"
    //           scriveva a.txt vuoto: "dog", salvato da a.jpg, spariva dal disco.
    // ENGLISH: a.png with ALL its tags removed by hand (tags [], unsaved): it is compared with a.txt
    //          too. It used to keep the old record ([cat]) and the Save after "Restore" wrote an
    //          empty a.txt: "dog", saved by a.jpg, vanished from the disk.
    const r = await scenario({ png: { tags: [], originalTags: ['cat'] }, dopo: salvaJpgConDog });
    dice('tag tutti tolti: "cat" resta tolto, "dog" del disco resta, da salvare', [['dog'], ['cat', 'dog'], true], statoDi(r.P));
    dice('tag tutti tolti: avviso verde', [[t.undoEmptyDone.replace('{n}', '1'), 'success']], r.notifiche);
}
{
    // ITALIANO: tag tutti tolti e a.txt sparito: torna com'era (da salvare), senza l'avviso dei .txt.
    // ENGLISH: all tags removed and a.txt gone: it comes back as it was (to be saved), without the .txt notice.
    const r = await scenario({ png: { tags: [], originalTags: ['cat'] }, dopo: (disco) => { delete disco[D + 'a.txt']; } });
    dice('tag tutti tolti, a.txt sparito: torna com\'era', [[], ['cat'], true], statoDi(r.P));
    dice('tag tutti tolti, a.txt sparito: avviso verde', [[t.undoEmptyDone.replace('{n}', '1'), 'success']], r.notifiche);
}
{
    const r = await scenario();
    dice('a.txt non cambiato: a.png torna com\'era', [['cat'], ['cat'], true], statoDi(r.P));
    dice('a.txt non cambiato: avviso verde', [[t.undoEmptyDone.replace('{n}', '1'), 'success']], r.notifiche);
}
{
    // ITALIANO: a.txt c'e' ma non si legge (oltre 1 MB, bloccato): non si tocca niente, come prima.
    // ENGLISH: a.txt is there but cannot be read (over 1 MB, locked): nothing is touched, as before.
    const r = await scenario({ dopo: (disco) => { disco[D + 'a.txt'] = 'saltato'; } });
    dice('a.txt illeggibile: a.png torna com\'era, non "senza .txt"', [['cat'], ['cat'], true], statoDi(r.P));
}
{
    // ITALIANO: a.txt sparito (andato via con a.jpg): la foto resta da salvare, come prima.
    // ENGLISH: a.txt gone (it left with a.jpg): the photo stays to be saved, as before.
    const r = await scenario({ dopo: (disco) => { delete disco[D + 'a.txt']; } });
    dice('a.txt sparito: a.png torna da salvare (originalTags vuoto)', [['cat'], [], true], statoDi(r.P));
    dice('a.txt sparito: l\'avviso lo dice', true, r.notifiche.length === 1 && r.notifiche[0][0].includes(t.undoEmptyTxtNotBack.replace('{n}', '1')));
}

process.exit(esito());
