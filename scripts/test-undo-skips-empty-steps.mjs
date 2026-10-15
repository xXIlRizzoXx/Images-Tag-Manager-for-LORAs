/* ITALIANO: PROVA DI Ctrl+Z / Ctrl+Shift+Z SENZA PASSI VUOTI DOPO CHE DELLE FOTO HANNO LASCIATO IL DISCO
   L'utente cambiava i tag di B, cestinava A (e C) e svuotava il cestino. Le foto uscite dal disco
   escono anche da ogni passo della cronologia, e cosi' il passo "A nel cestino" diventava identico
   a quello di prima: il primo Ctrl+Z mostrava "Azione annullata" e non cambiava niente, e solo il
   secondo (o il terzo, con due foto) annullava la modifica di B. Lo stesso con la X su una foto,
   con la cancellazione definitiva e, all'indietro, con Ctrl+Shift+Z. La regola: Ctrl+Z e
   Ctrl+Shift+Z saltano i passi identici a quello attuale; se non ne resta nessuno diverso non
   fanno niente e non dicono niente. Vale anche dopo "Ripristina tutte" e dopo il ricarico di una
   foto ritoccata fuori dal programma, che non devono copiare le foto che non cambiano.
   Si eseguono i testi VERI presi da src/App.tsx (vedi trash-harness.mjs) e la regola vera di
   src/utils/historyUtils.ts.
   Uso:  node scripts/test-undo-skips-empty-steps.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF Ctrl+Z / Ctrl+Shift+Z WITH NO EMPTY STEPS AFTER PHOTOS HAVE LEFT THE DISK
   The user edited B's tags, trashed A (and C) and emptied the trash. Photos that left the disk
   leave every history step too, so the step "A in the trash" became identical to the one before
   it: the first Ctrl+Z showed "Action undone" and changed nothing, and only the second (or the
   third, with two photos) undid B's edit. The same with the X on a photo, with the permanent
   delete and, backwards, with Ctrl+Shift+Z. The rule: Ctrl+Z and Ctrl+Shift+Z skip the steps
   identical to the current one; when no different one is left they do nothing and say nothing.
   It holds after "Restore all" and after reloading a photo retouched outside the program too,
   which must not copy the photos that do not change.
   The REAL code taken from src/App.tsx is run (see trash-harness.mjs), plus the real rule of
   src/utils/historyUtils.ts.
   Usage:  node scripts/test-undo-skips-empty-steps.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import { creaApp, apiFinta, foto, cartellaFinta, cronologia, sorgenteApp, t } from './trash-harness.mjs';
import { creaControlli } from './main-harness.mjs';

const { dice, esito } = creaControlli();
const tagDi = (app, id) => (app.stato.images.find(i => i.id === id) || {}).tags;

// ITALIANO: un tasto della cronologia; restituisce i messaggi comparsi.
// ENGLISH: one history key; returns the messages that appeared.
const premi = async (app, nome) => {
    const prima = app.notifiche.length;
    const f = app.render()[nome];
    if (typeof f !== 'function') return ['(' + nome + ' assente)'];
    f();
    await app.attendi();
    return app.notifiche.slice(prima).map(([m]) => m);
};

// ITALIANO: B ha i tag cambiati, poi A e C vanno nel cestino dell'app.
// ENGLISH: B gets its tags edited, then A and C go to the app's trash.
const preparaApp = async (opzioni, cartella = null) => {
    const app = creaApp(['A', 'B', 'C'].map(id => foto(id, { cestinata: false, cartella })), opzioni);
    app.modifica(prev => prev.map(i => (i.id === 'B' ? { ...i, tags: ['modificato'] } : i)));
    await app.attendi();
    for (const id of ['A', 'C']) { app.cestina(id); await app.attendi(); }
    return app;
};

const controllaUndoRedo = async (app) => {
    dice('prima di Ctrl+Z: si vede solo B, con la modifica', [['B'], ['modificato']], [app.vista(), tagDi(app, 'B')]);
    const primo = await premi(app, 'handleUndo');
    dice('UN Ctrl+Z riporta i tag di B a quelli di prima', ['tag B'], tagDi(app, 'B'));
    dice('e dice "Azione annullata" una volta sola', [t.undoSuccess], primo);
    const secondo = await premi(app, 'handleUndo');
    dice('un altro Ctrl+Z (niente di diverso prima) non dice niente', [], secondo);
    const r1 = await premi(app, 'handleRedo');
    dice('UN Ctrl+Shift+Z rimette la modifica di B', ['modificato'], tagDi(app, 'B'));
    dice('e dice "Azione ripristinata" una volta sola', [t.redoSuccess], r1);
    const r2 = await premi(app, 'handleRedo');
    dice('un altro Ctrl+Shift+Z (niente di diverso dopo) non dice niente', [], r2);
    dice('e la vista resta quella di adesso', [['B'], ['modificato']], [app.vista(), tagDi(app, 'B')]);
};

console.log('\n--- modifica B, cestina A e C, Svuota cestino, poi Ctrl+Z e Ctrl+Shift+Z ---');
{
    const app = await preparaApp({ api: apiFinta() });
    await app.render().handleEmptyTrash();
    await app.attendi();
    await controllaUndoRedo(app);
}

console.log('\n--- modifica B, cestina A e C, la X su ognuna, poi Ctrl+Z e Ctrl+Shift+Z ---');
{
    const app = await preparaApp({ api: apiFinta() });
    await app.render().handleDeletePermanently('A');
    await app.attendi();
    await app.render().handleDeletePermanently('C');
    await app.attendi();
    await controllaUndoRedo(app);
}

console.log('\n--- cancellazione definitiva (anteprima nel browser), poi Ctrl+Z e Ctrl+Shift+Z ---');
{
    const cartella = cartellaFinta();
    const app = await preparaApp({}, cartella);
    await app.render().handleEmptyTrash();
    await app.attendi();
    await app.stato.confirmDialog.onConfirm();
    await app.attendi();
    dice('A e C cancellate per sempre dalla cartella', ['A.png', 'C.png'], cartella.rimossi.filter(n => n.endsWith('.png')).sort());
    await controllaUndoRedo(app);
}

console.log('\n--- modifica B, cestina A, "Ripristina tutte", cestina di nuovo A, Svuota cestino, Ctrl+Z ---');
{
    // ITALIANO: "Ripristina tutte" copiava OGNI foto in un oggetto nuovo, anche B che non era nel
    //           cestino: tolta A, i passi prima e dopo restavano "diversi" (oggetti diversi con lo
    //           stesso contenuto) e il primo Ctrl+Z diceva "Azione annullata" senza cambiare niente.
    // ENGLISH: "Restore all" copied EVERY photo into a new object, B too, which was not in the trash:
    //          once A was removed, the steps before and after stayed "different" (different objects
    //          with the same content) and the first Ctrl+Z said "Action undone" changing nothing.
    const app = creaApp(['A', 'B'].map(id => foto(id, { cestinata: false })), { api: apiFinta() });
    app.modifica(prev => prev.map(i => (i.id === 'B' ? { ...i, tags: ['modificato'] } : i)));
    await app.attendi();
    app.cestina('A');
    await app.attendi();
    app.render().handleRestoreAll();
    await app.attendi();
    dice('premessa: "Ripristina tutte" rimette A in galleria', ['A', 'B'], app.vista());
    app.cestina('A');
    await app.attendi();
    await app.render().handleEmptyTrash();
    await app.attendi();
    const primo = await premi(app, 'handleUndo');
    dice('UN Ctrl+Z riporta i tag di B a quelli di prima', ['tag B'], tagDi(app, 'B'));
    dice('e dice "Azione annullata" una volta sola', [t.undoSuccess], primo);
}

console.log('\n--- ricarico di B dopo un ritocco esterno, poi A esce dal disco ---');
{
    // ITALIANO: il ricarico rifaceva B dentro OGNI passo con un oggetto suo: i passi che avevano lo
    //           stesso B non lo avevano piu', e dopo l'uscita di A comparivano passi vuoti. Si
    //           esegue il testo vero del ricarico (ricontrolla) preso da src/App.tsx.
    // ENGLISH: the reload rebuilt B inside EVERY step with an object of its own: steps that shared
    //          one B no longer did, and once A left empty steps appeared. The real text of the
    //          reload (ricontrolla) taken from src/App.tsx is run.
    const iR = sorgenteApp.indexOf('        const ricontrolla = async () => {');
    const fineR = /\r?\n        \};\r?\n/g;
    fineR.lastIndex = Math.max(iR, 0);
    const fR = iR < 0 ? null : fineR.exec(sorgenteApp);
    dice('il ricarico (ricontrolla) si trova in src/App.tsx', true, Boolean(fR));
    if (fR) {
        const js = (await esbuild.transform(sorgenteApp.slice(iR, fR.index + fR[0].length), { loader: 'ts' })).code;
        const NOMI_R = ['selectedImageId', 'reloadingRef', 'imagesRef', 'generateThumbnail', 'anteprimeProgettoRef', 'isUndoRedoAction',
            'setImages', 'setHistory', 'showNotification', 't'];
        const cartella = { getFileHandle: async () => ({ getFile: async () => ({ name: 'B.png', lastModified: 2 }) }) };
        const A0 = { id: 'A', tags: ['a'], isTrashed: false }, At = { ...A0, isTrashed: true };
        const B0 = { id: 'B', tags: ['b'], file: { name: 'B.png', lastModified: 1 }, dirHandle: cartella, thumb: 'blob:vecchia' };
        const B1 = { ...B0, tags: ['b', 'modificato'] };
        let cronologiaR = [[A0, B0], [A0, B1], [At, B1]];
        let immagini = [At, B1];
        const ricontrolla = new Function(...NOMI_R, js + '\nreturn ricontrolla;')(
            'B', { current: false }, { current: immagini }, async () => ({ url: 'blob:nuova', width: 10, height: 10 }), { current: new Set() },
            { current: false }, (f) => { immagini = f(immagini); }, (f) => { cronologiaR = f(cronologiaR); }, () => { }, t);
        await ricontrolla();
        dice('premessa: B ricaricato in ogni passo', ['blob:nuova', 'blob:nuova', 'blob:nuova'], cronologiaR.map(p => p[1].thumb));
        dice('i passi che avevano lo stesso B lo hanno ancora', true, cronologiaR[1][1] === cronologiaR[2][1]);
        dice('e la galleria mostra lo stesso B del passo attuale', true, immagini[1] === cronologiaR[2][1]);
        const N = cronologia.nearestDifferentStep;
        const senzaA = cronologia.purgeIdsFromHistory(cronologiaR, new Set(['A']));
        dice('tolta A, Ctrl+Z salta il passo identico e torna a prima della modifica di B', 0, N(senzaA, 2, -1));
    }
}

console.log('\n--- nessuna modifica vera: cestina A, svuota, Ctrl+Z ---');
{
    const app = creaApp(['A', 'B'].map(id => foto(id, { cestinata: false })), { api: apiFinta() });
    app.cestina('A');
    await app.attendi();
    await app.render().handleEmptyTrash();
    await app.attendi();
    const m = await premi(app, 'handleUndo');
    dice('Ctrl+Z non ha niente da annullare: nessun "Azione annullata"', [], m);
    dice('e B resta com\'era', [['B'], ['tag B']], [app.vista(), tagDi(app, 'B')]);
}

console.log('\n--- quello che NON deve cambiare: passi diversi, uno alla volta ---');
{
    const app = creaApp(['A', 'B'].map(id => foto(id, { cestinata: false })), { api: apiFinta() });
    app.modifica(prev => prev.map(i => (i.id === 'B' ? { ...i, tags: ['uno'] } : i)));
    await app.attendi();
    app.modifica(prev => prev.map(i => (i.id === 'B' ? { ...i, tags: ['due'] } : i)));
    await app.attendi();
    await premi(app, 'handleUndo');
    dice('il primo Ctrl+Z torna al passo subito prima', ['uno'], tagDi(app, 'B'));
    await premi(app, 'handleUndo');
    dice('il secondo all\'inizio', ['tag B'], tagDi(app, 'B'));
    await premi(app, 'handleRedo');
    dice('Ctrl+Shift+Z avanza di un passo', ['uno'], tagDi(app, 'B'));
}

console.log('\n--- la regola da sola (src/utils/historyUtils.ts) ---');
{
    const N = cronologia.nearestDifferentStep;
    dice('src/utils/historyUtils.ts esporta nearestDifferentStep', 'function', typeof N);
    if (typeof N === 'function') {
        const a = { id: 'A' }, b = { id: 'B' }, b2 = { id: 'B', tags: ['y'] };
        dice('indietro: salta i passi identici (stessi oggetti)', 0, N([[a, b], [a, b2], [a, b2]], 2, -1));
        dice('indietro: il passo subito prima se e\' diverso', 1, N([[a, b], [a, b2], [b2]], 2, -1));
        dice('indietro: nessun passo diverso = -1', -1, N([[b], [b]], 1, -1));
        dice('avanti: salta i passi identici', 2, N([[a, b], [a, b], [a, b2]], 0, 1));
        dice('avanti: nessun passo diverso = -1', -1, N([[b], [b], [b]], 0, 1));
        dice('stessi oggetti ma in numero diverso: passo diverso', 0, N([[a, b], [a]], 1, -1));
        // ITALIANO: si confronta quello che Ctrl+Z mostrerebbe: originalTags non conta (lo rimette
        //           withLiveOriginalTags dal ricordo del disco), ogni altro campo si'.
        // ENGLISH: what Ctrl+Z would show is compared: originalTags does not count (withLiveOriginalTags
        //          puts it back from the disk record), every other field does.
        dice('oggetti uguali nel contenuto ma non gli stessi: stesso passo', -1, N([[{ id: 'B' }], [b]], 1, -1));
        dice('stessi tag in un array nuovo, cambia solo originalTags (dopo "Salva"): stesso passo', -1,
            N([[{ id: 'B', tags: ['x'], originalTags: ['x'] }], [{ id: 'B', tags: ['x'], originalTags: [] }]], 1, -1));
        dice('tag diversi: passo diverso', 0, N([[{ id: 'B', tags: ['x'] }], [{ id: 'B', tags: ['y'] }]], 1, -1));
        dice('stessi tag in ordine diverso: passo diverso', 0, N([[{ id: 'B', tags: ['x', 'y'] }], [{ id: 'B', tags: ['y', 'x'] }]], 1, -1));
        dice('cestinata in un passo e non nell\'altro: passo diverso', 0, N([[{ id: 'B', tags: ['x'], isTrashed: true }], [{ id: 'B', tags: ['x'], isTrashed: false }]], 1, -1));
        dice('un altro campo diverso (anteprima): passo diverso', 0, N([[{ id: 'B', thumb: 'u1' }], [{ id: 'B', thumb: 'u2' }]], 1, -1));
        dice('un campo in piu\' in un passo: passo diverso', 0, N([[{ id: 'B' }], [{ id: 'B', isTrashed: false }]], 1, -1));
    }
}

console.log('\n--- modifica B, "Salva" (il visualizzatore), cestina A, Svuota cestino, poi Ctrl+Z ---');
{
    // ITALIANO: il salvataggio non e' un passo della cronologia, ma rifa' l'oggetto di B con il nuovo
    //           originalTags: il passo "A nel cestino" ha la B nuova, quello prima la B vecchia, e
    //           tolta A erano uguali a schermo ma non "gli stessi oggetti". Il primo Ctrl+Z diceva
    //           "Azione annullata" senza cambiare niente. Si esegue la riga VERA di updateOriginalTags.
    // ENGLISH: saving is not a history step, but it rebuilds B's object with the new originalTags:
    //          the step "A in the trash" holds the new B, the one before the old B, and with A
    //          removed they looked the same on screen but were not "the same objects". The first
    //          Ctrl+Z said "Action undone" without changing anything. The REAL line of
    //          updateOriginalTags is run.
    const riga = sorgenteApp.split('\n').find(r => r.startsWith('    const updateOriginalTags = '));
    dice('premessa: trovato updateOriginalTags in src/App.tsx', true, !!riga);
    const salvaB = (app) => new Function('isUndoRedoAction', 'setImages',
        esbuild.transformSync(riga || '', { loader: 'ts' }).code + '\nreturn updateOriginalTags;')(app.refs.isUndoRedoAction, app.modifica)('B', ['modificato']);
    const app = creaApp(['A', 'B'].map(id => foto(id, { cestinata: false })), { api: apiFinta() });
    app.modifica(prev => prev.map(i => (i.id === 'B' ? { ...i, tags: ['modificato'] } : i)));
    await app.attendi();
    salvaB(app);
    await app.attendi();
    app.cestina('A');
    await app.attendi();
    await app.render().handleEmptyTrash();
    await app.attendi();
    dice('prima di Ctrl+Z: si vede solo B, con la modifica salvata', [['B'], ['modificato']], [app.vista(), tagDi(app, 'B')]);
    const primo = await premi(app, 'handleUndo');
    dice('UN Ctrl+Z riporta i tag di B a quelli di prima, con un solo "Azione annullata"', [['tag B'], [t.undoSuccess]], [tagDi(app, 'B'), primo]);
    const r1 = await premi(app, 'handleRedo');
    dice('UN Ctrl+Shift+Z rimette la modifica', [['modificato'], [t.redoSuccess]], [tagDi(app, 'B'), r1]);
}

process.exit(esito());
