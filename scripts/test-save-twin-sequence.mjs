/* ITALIANO: PROVA DEI GEMELLI SALVATI UNO DOPO L'ALTRO (a.png e a.jpg con lo stesso a.txt)
   Due foto con lo stesso nome nella stessa cartella (a.png e a.jpg) hanno un solo .txt, a.txt, e
   all'import ricevono tutte e due i suoi tag. Si aggiungeva "dog" ad a.png e si salvava: a.txt
   diventava "cat, dog," ma a.jpg restava in memoria con "cat" e risultava salvata. Poi "red" ad
   a.jpg e Salva: a.txt diventava "cat, red," con l'avviso verde, e "dog", gia' salvato, spariva
   dal disco mentre la card di a.png lo mostrava ancora come salvato. Lo stesso col "Salva file
   .txt" del visualizzatore (nessun gemello allineato) e con l'editor dei file di tag (si allineava
   solo la prima foto trovata). La regola: dopo ogni scrittura riuscita, le altre foto con lo
   stesso .txt prendono i tag scritti (tag e ricordo del disco), senza diventare un passo della
   cronologia; una gemella con modifiche proprie (anche la sola trigger non ancora salvata) le
   tiene sopra il file scritto, come fa l'editor dei file di tag.
   Si eseguono i testi VERI presi da src/App.tsx (vedi undo-harness.mjs).
   Uso:  node scripts/test-save-twin-sequence.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF TWINS SAVED ONE AFTER THE OTHER (a.png and a.jpg with the same a.txt)
   Two same-named photos in the same folder (a.png and a.jpg) have a single .txt, a.txt, and both
   get its tags at import. "dog" was added to a.png and saved: a.txt became "cat, dog," but a.jpg
   kept "cat" in memory and counted as saved. Then "red" on a.jpg and Save: a.txt became
   "cat, red," with the green notice, and "dog", already saved, left the disk while a.png's card
   still showed it as saved. The same with the viewer's "Save .txt file" (no twin synced) and with
   the tag file editor (only the first photo found was synced). The rule: after every successful
   write, the other photos with the same .txt take the written tags (tags and disk record),
   without becoming a history step; a twin with edits of its own (even just a trigger not saved
   yet) keeps them on top of the file written, as the tag file editor does.
   The REAL code taken from src/App.tsx is run (see undo-harness.mjs).
   Usage:  node scripts/test-save-twin-sequence.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import { fileURLToPath } from 'node:url';
import { creaApp, t, sorgenteApp } from './undo-harness.mjs';
import { creaControlli } from './main-harness.mjs';

const { dice, esito } = creaControlli();

// ITALIANO: una cartella finta con il suo nome: i file sanno in che cartella stanno, e isSameEntry
//           dice "stessa cartella" anche per un secondo handle della stessa (cartella aperta due volte).
// ENGLISH: a fake folder with its name: files know which folder they are in, and isSameEntry says
//          "same folder" also for a second handle of it (folder opened twice).
const cartella = (nome, scritti = new Map()) => {
    const c = { nome, scritti };
    c.getFileHandle = async (file) => ({
        nome: file.toLowerCase(), cartella: nome,
        createWritable: async () => ({ write: async (s) => { scritti.set(file.toLowerCase(), String(s)); }, close: async () => { } }),
    });
    c.isSameEntry = async (altra) => !!altra && altra.nome === nome;
    return c;
};
const foto = (id, nome, tags, dir) => ({
    id, file: { name: nome }, thumb: 'blob:finto/' + id, tags: [...tags], originalTags: [...tags],
    isTrashed: false, dirHandle: dir, width: 1024, height: 1024,
});
const conTag = (app, id, tags) => app.modifica(prev => prev.map(i => (i.id === id ? { ...i, tags: [...tags] } : i)));
// ITALIANO: l'utente aggiunge un tag a quelli che la card mostra adesso.
// ENGLISH: the user adds a tag to the ones the card shows now.
const aggiungi = (app, id, tag) => app.modifica(prev => prev.map(i => (i.id === id ? { ...i, tags: [...i.tags, tag] } : i)));
const salva = async (app) => { const ok = await app.render().handleSaveChanges(); await app.attendi(); return ok; };
const ultima = (app) => app.notifiche[app.notifiche.length - 1] || ['', ''];
const stato = (app, id) => { const f = app.fotoCon(id); return f ? [f.tags, f.originalTags] : null; };
const passi = (app) => [app.stato.history.length, app.stato.historyIndex];

const prepara = async (altre = []) => {
    const ds = cartella('ds');
    ds.scritti.set('a.txt', 'cat,');
    const app = creaApp([foto('A', 'a.png', ['cat'], ds), foto('B', 'a.jpg', ['cat'], ds), ...altre.map(f => f(ds))]);
    app.importa();
    await app.attendi();
    return { app, ds };
};

console.log('\n--- a.png poi a.jpg, due salvataggi di fila ---');
{
    const { app, ds } = await prepara();
    conTag(app, 'A', ['cat', 'dog']);
    await app.attendi();
    const prima = passi(app);
    dice('primo Salva riuscito', true, await salva(app));
    dice('a.txt = "cat, dog,"', 'cat, dog,', ds.scritti.get('a.txt'));
    dice('a.jpg prende i tag scritti in a.txt, come tag e come ricordo del disco', [['cat', 'dog'], ['cat', 'dog']], stato(app, 'B'));
    dice('allineare il gemello non aggiunge un passo alla cronologia', prima, passi(app));
    aggiungi(app, 'B', 'red');
    await app.attendi();
    dice('secondo Salva riuscito', true, await salva(app));
    dice('a.txt = "cat, dog, red," (prima: "cat, red,", e "dog" spariva)', 'cat, dog, red,', ds.scritti.get('a.txt'));
    dice('a.png segue a.txt anche lei', [['cat', 'dog', 'red'], ['cat', 'dog', 'red']], stato(app, 'A'));
    dice('avviso verde di salvataggio', [t.successSaveChanges, 'success'], ultima(app));
}

console.log('\n--- Ctrl+Z dopo il salvataggio del gemello ---');
{
    const { app } = await prepara();
    conTag(app, 'A', ['cat', 'dog']);
    await app.attendi();
    await salva(app);
    aggiungi(app, 'B', 'red');
    await app.attendi();
    app.render().handleUndo();
    await app.attendi();
    dice('un Ctrl+Z toglie solo "red" da a.jpg (non riporta indietro l\'allineamento)', [['cat', 'dog'], ['cat', 'dog']], stato(app, 'B'));
    dice('a.png resta "cat, dog"', ['cat', 'dog'], app.fotoCon('A').tags);
    app.render().handleUndo();
    await app.attendi();
    dice('un altro Ctrl+Z toglie "dog" da a.png, e a.jpg torna com\'era all\'import', [['cat'], ['cat']], [app.fotoCon('A').tags, app.fotoCon('B').tags]);
}

console.log('\n--- quello che non deve cambiare ---');
{
    // ITALIANO: tutte e due modificate in modo diverso nello stesso salvataggio: nessuna si scrive.
    // ENGLISH: both edited differently in the same save: neither is written.
    const { app, ds } = await prepara();
    conTag(app, 'A', ['cat', 'dog']);
    conTag(app, 'B', ['cat', 'red']);
    await app.attendi();
    dice('due gemelle con modifiche diverse: Salva non riesce', false, await salva(app));
    dice('a.txt resta "cat,"', 'cat,', ds.scritti.get('a.txt'));
    dice('l\'avviso e\' quello dei file condivisi', [true, 'error'], [ultima(app)[0].startsWith(t.saveSameFileTwice.split('{names}')[0]), ultima(app)[1]]);
    dice('le due restano con le loro modifiche', [['cat', 'dog'], ['cat', 'red']], [app.fotoCon('A').tags, app.fotoCon('B').tags]);
}
{
    // ITALIANO: una gemella nel cestino con modifiche proprie le tiene, sopra il file scritto, e resta nel cestino.
    // ENGLISH: a twin in the trash with edits of its own keeps them, on top of the file written, and stays in the trash.
    const { app, ds } = await prepara();
    app.modifica(prev => prev.map(i => (i.id === 'B' ? { ...i, tags: ['cat', 'red'], isTrashed: true } : i)));
    conTag(app, 'A', ['cat', 'dog']);
    await app.attendi();
    await salva(app);
    dice('a.txt = "cat, dog,"', 'cat, dog,', ds.scritti.get('a.txt'));
    dice('la gemella nel cestino tiene "red" sopra il file scritto', [['cat', 'dog', 'red'], ['cat', 'dog'], true], [...stato(app, 'B'), app.fotoCon('B').isTrashed]);
}
{
    // ITALIANO: una gemella nel cestino SENZA modifiche segue il disco: ripristinata, mostra il .txt vero.
    // ENGLISH: a twin in the trash WITHOUT edits follows the disk: restored, it shows the real .txt.
    const { app, ds } = await prepara();
    app.modifica(prev => prev.map(i => (i.id === 'B' ? { ...i, isTrashed: true } : i)));
    conTag(app, 'A', ['cat', 'dog']);
    await app.attendi();
    await salva(app);
    dice('a.txt = "cat, dog,"', 'cat, dog,', ds.scritti.get('a.txt'));
    dice('la gemella nel cestino senza modifiche prende "cat, dog" e resta nel cestino', [['cat', 'dog'], ['cat', 'dog'], true], [...stato(app, 'B'), app.fotoCon('B').isTrashed]);
}
{
    // ITALIANO: una foto con lo stesso nome in un'ALTRA cartella non e' una gemella.
    // ENGLISH: a same-named photo in ANOTHER folder is not a twin.
    const altra = cartella('altra');
    altra.scritti.set('a.txt', 'cat,');
    const { app, ds } = await prepara([() => foto('C', 'a.png', ['cat'], altra)]);
    conTag(app, 'A', ['cat', 'dog']);
    await app.attendi();
    await salva(app);
    dice('a.txt della cartella = "cat, dog,"', 'cat, dog,', ds.scritti.get('a.txt'));
    dice('a.png dell\'altra cartella resta "cat" e il suo a.txt non cambia', [['cat'], ['cat'], 'cat,'], [...stato(app, 'C'), altra.scritti.get('a.txt')]);
}
{
    // ITALIANO: la stessa cartella aperta due volte (un altro handle): la copia senza modifiche segue il disco.
    // ENGLISH: the same folder opened twice (another handle): the copy with no edits follows the disk.
    const scritti = new Map([['a.txt', 'cat,']]);
    const prima = cartella('ds', scritti);
    const seconda = cartella('ds', scritti);
    const app = creaApp([foto('A', 'a.png', ['cat'], prima), foto('D', 'a.png', ['cat'], seconda)]);
    app.importa();
    await app.attendi();
    conTag(app, 'A', ['cat', 'dog']);
    await app.attendi();
    await salva(app);
    dice('la copia dalla stessa cartella aperta due volte prende "cat, dog"', [['cat', 'dog'], ['cat', 'dog']], stato(app, 'D'));
}
{
    // ITALIANO: un salvataggio senza gemelle: niente cambia rispetto a prima.
    // ENGLISH: a save with no twins: nothing changes from before.
    const ds = cartella('ds');
    const app = creaApp([foto('A', 'a.png', ['cat'], ds), foto('E', 'e.png', ['cat'], ds)]);
    app.importa();
    await app.attendi();
    conTag(app, 'A', ['cat', 'dog']);
    await app.attendi();
    await salva(app);
    dice('e.png, con un altro .txt, resta com\'era', [['cat'], ['cat']], stato(app, 'E'));
}

console.log('\n--- "Salva file .txt" del visualizzatore ---');
{
    const { app, ds } = await prepara();
    conTag(app, 'A', ['cat', 'dog']);
    await app.attendi();
    const prima = passi(app);
    // ITALIANO: il visualizzatore scrive il file da se' e poi chiama updateOriginalTags.
    // ENGLISH: the viewer writes the file on its own and then calls updateOriginalTags.
    ds.scritti.set('a.txt', 'cat, dog,');
    app.render().updateOriginalTags('A', ['cat', 'dog']);
    await app.attendi();
    dice('a.jpg prende i tag scritti dal visualizzatore', [['cat', 'dog'], ['cat', 'dog']], stato(app, 'B'));
    dice('nessun passo nuovo nella cronologia', prima, passi(app));
    aggiungi(app, 'B', 'red');
    await app.attendi();
    await salva(app);
    dice('il Salva dopo, su a.jpg, scrive "cat, dog, red,"', 'cat, dog, red,', ds.scritti.get('a.txt'));
}
{
    // ITALIANO: una gemella con modifiche proprie tiene le sue modifiche, rimesse sopra il file scritto
    //           (come fa l'editor dei file di tag): prima restava com'era, e il Salva dopo riscriveva
    //           a.txt con "cat, red," togliendo "dog", gia' salvato.
    // ENGLISH: a twin with edits of its own keeps them, put back on top of the file written (as the
    //          tag file editor does): it used to stay as it was, and the next Save rewrote a.txt as
    //          "cat, red,", removing "dog", already saved.
    const { app, ds } = await prepara();
    conTag(app, 'A', ['cat', 'dog']);
    conTag(app, 'B', ['cat', 'red']);
    await app.attendi();
    ds.scritti.set('a.txt', 'cat, dog,');
    await app.render().updateOriginalTags('A', ['cat', 'dog']);
    await app.attendi();
    dice('a.jpg con modifiche proprie: il file scritto piu\' "red", ancora da salvare', [['cat', 'dog', 'red'], ['cat', 'dog']], stato(app, 'B'));
    dice('il Salva dopo scrive "cat, dog, red," (prima: "cat, red,")', [true, 'cat, dog, red,'], [await salva(app), ds.scritti.get('a.txt')]);
    dice('a.png segue a.txt e tiene "dog"', [['cat', 'dog', 'red'], ['cat', 'dog', 'red']], stato(app, 'A'));
}
{
    // ITALIANO: trigger "ohwx" non ancora nel .txt: all'import tutte e due le foto la hanno fuori da
    //           originalTags (risultano modificate senza che l'utente le tocchi). Il visualizzatore
    //           scrive a.png con "dog"; prima a.jpg non si allineava, il Salva dopo scriveva
    //           "ohwx, cat," con l'avviso verde e "dog" spariva dal disco e dalla card di a.png.
    // ENGLISH: trigger "ohwx" not in the .txt yet: at import both photos have it outside originalTags
    //          (they count as modified without the user touching them). The viewer writes a.png with
    //          "dog"; a.jpg used to stay out of sync, the next Save wrote "ohwx, cat," with the green
    //          notice and "dog" vanished from the disk and from a.png's card.
    const ds = cartella('ds');
    ds.scritti.set('a.txt', 'cat,');
    const conTrigger = (id, nome) => ({ ...foto(id, nome, ['ohwx', 'cat'], ds), originalTags: ['cat'] });
    const app = creaApp([conTrigger('A', 'a.png'), conTrigger('B', 'a.jpg')], { trigger: ['ohwx'] });
    app.importa();
    await app.attendi();
    aggiungi(app, 'A', 'dog');
    await app.attendi();
    ds.scritti.set('a.txt', 'ohwx, cat, dog,');
    await app.render().updateOriginalTags('A', ['ohwx', 'cat', 'dog']);
    await app.attendi();
    dice('trigger non salvata: a.jpg prende il file scritto dal visualizzatore', [['ohwx', 'cat', 'dog'], ['ohwx', 'cat', 'dog']], stato(app, 'B'));
    await salva(app);
    dice('trigger non salvata: il Salva dopo non toglie "dog" da a.txt', 'ohwx, cat, dog,', ds.scritti.get('a.txt'));
    dice('trigger non salvata: niente da salvare', [t.noChanges, 'info'], ultima(app));
    dice('trigger non salvata: la card di a.png tiene "dog"', ['ohwx', 'cat', 'dog'], app.fotoCon('A').tags);
}
{
    // ITALIANO: trigger non salvata e "Salva modifiche" su a.png: a.jpg, che aveva in piu' la sola
    //           trigger, prende i tag scritti come prima.
    // ENGLISH: unsaved trigger and "Save changes" on a.png: a.jpg, whose only extra was the trigger,
    //          takes the written tags as before.
    const ds = cartella('ds');
    ds.scritti.set('a.txt', 'cat,');
    const conTrigger = (id, nome) => ({ ...foto(id, nome, ['ohwx', 'cat'], ds), originalTags: ['cat'] });
    const app = creaApp([conTrigger('A', 'a.png'), conTrigger('B', 'a.jpg')], { trigger: ['ohwx'] });
    app.importa();
    await app.attendi();
    aggiungi(app, 'A', 'dog');
    aggiungi(app, 'B', 'dog');
    await app.attendi();
    dice('trigger non salvata, stesso Salva per le due: riuscito', true, await salva(app));
    dice('a.txt = "ohwx, cat, dog,"', 'ohwx, cat, dog,', ds.scritti.get('a.txt'));
    dice('le due gemelle risultano salvate', [[['ohwx', 'cat', 'dog'], ['ohwx', 'cat', 'dog']], [['ohwx', 'cat', 'dog'], ['ohwx', 'cat', 'dog']]], [stato(app, 'A'), stato(app, 'B')]);
}

console.log('\n--- editor dei file di tag ---');
{
    const { app, ds } = await prepara();
    ds.scritti.set('a.txt', 'cat, blue,');
    await app.render().handleTagEditorSaved('a.txt', ['cat', 'blue'], { isSameEntry: async (h) => !!h && h.nome === 'a.txt' && h.cartella === 'ds' });
    await app.attendi();
    dice('a.png prende il file salvato', [['cat', 'blue'], ['cat', 'blue']], stato(app, 'A'));
    dice('anche a.jpg (prima si allineava solo la prima foto trovata)', [['cat', 'blue'], ['cat', 'blue']], stato(app, 'B'));
}

// ITALIANO: foto senza cartella ("Carica immagini"): la gemella si riconosce dal .txt di arrivo
//           (cartella del percorso vero + nome del .txt), come fa performSave.
// ENGLISH: folder-less photos ("Load images"): the twin is recognised by the target .txt (folder of
//          the real path + .txt name), as performSave does.
console.log('\n--- foto senza cartella ---');
{
    const inizio = sorgenteApp.indexOf('    const gemelliDelTxt = async ');
    const re = /\r?\n    \};\r?\n/g;
    re.lastIndex = inizio;
    const fine = inizio < 0 ? null : re.exec(sorgenteApp);
    dice('gemelliDelTxt esiste in src/App.tsx', true, Boolean(fine));
    if (fine) {
        const js = (await esbuild.transform(sorgenteApp.slice(inizio, fine.index + fine[0].length), { loader: 'ts' })).code;
        const percorsi = new Map();
        const sciolta = (id, percorso, tags) => { const file = { name: percorso.split(/[\\/]/).pop() }; percorsi.set(file, percorso); return { id, file, tags: [...tags], originalTags: [...tags], dirHandle: null }; };
        let images = [sciolta('A', 'C:\\ds\\a.png', ['cat']), sciolta('B', 'C:\\ds\\A.JPG', ['cat']), sciolta('C', 'C:\\altra\\a.jpg', ['cat'])];
        const finestra = { electronAPI: { getPathForFile: (f) => percorsi.get(f) || '' } };
        const P = await import('data:text/javascript;base64,' + Buffer.from((await esbuild.build({ entryPoints: [fileURLToPath(new URL('../src/utils/pathUtils.ts', import.meta.url))], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' })).outputFiles[0].text).toString('base64'));
        const S = await import('data:text/javascript;base64,' + Buffer.from((await esbuild.build({ entryPoints: [fileURLToPath(new URL('../src/utils/sidecarTags.ts', import.meta.url))], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' })).outputFiles[0].text).toString('base64'));
        const gemelliDelTxt = new Function('imagesRef', 'window', 'sidecarTagFileName', 'isUndoRedoAction', 'setImages', 'setHistory', 'tagDopoEditor', 'globalTriggersRef', js + '\nreturn gemelliDelTxt;')(
            { current: images }, finestra, P.sidecarTagFileName, { current: false }, (f) => { images = f(images); }, () => { }, S.tagDopoEditor, { current: [] });
        (await gemelliDelTxt([{ id: 'A', tags: ['cat', 'dog'] }]))();
        dice('a.jpg (stessa cartella, maiuscole diverse) prende "cat, dog"; a.jpg di un\'altra cartella no', [['cat', 'dog'], ['cat']],
            [images.find(i => i.id === 'B').tags, images.find(i => i.id === 'C').tags]);
    }
}

process.exit(esito());
