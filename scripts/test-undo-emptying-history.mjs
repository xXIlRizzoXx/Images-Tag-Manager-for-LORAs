/* ITALIANO: PROVA DI Ctrl+Z SUBITO DOPO "ANNULLA LO SVUOTAMENTO"
   Modifico B, cestino A, Svuota cestino, poi "Annulla lo svuotamento": A torna su disco e nel
   cestino dell'app. Il primo Ctrl+Z diceva "Azione annullata" e toglieva A dall'app, mentre la
   sua immagine e il suo .txt erano di nuovo nella cartella: A non si poteva piu' ne' vedere ne'
   svuotare. Se il .txt di A non era tornato, i suoi tag stavano solo in memoria e sparivano.
   L'uscita delle foto non e' un passo della cronologia (purgeIdsFromHistory): ora non lo e'
   nemmeno il loro ritorno, e Ctrl+Z annulla la modifica vera (i tag di B).
   Si eseguono i testi VERI presi da src/App.tsx (vedi trash-harness.mjs).
   Uso:  node scripts/test-undo-emptying-history.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF Ctrl+Z RIGHT AFTER "UNDO THE EMPTYING"
   Edit B, trash A, Empty trash, then "Undo the emptying": A is back on disk and in the app's
   trash. The first Ctrl+Z said "Action undone" and took A out of the app, while its image and its
   .txt were back in the folder: A could neither be seen nor emptied any more. If A's .txt had not
   come back, its tags existed only in memory and were lost. The photos leaving is not a history
   step (purgeIdsFromHistory): now their return is not one either, and Ctrl+Z undoes the real edit
   (B's tags).
   The REAL code taken from src/App.tsx is run (see trash-harness.mjs).
   Usage:  node scripts/test-undo-emptying-history.mjs      (exits with code 1 if anything is off) */

import { creaApp, apiFinta, foto, t, cronologia } from './trash-harness.mjs';
import { creaControlli } from './main-harness.mjs';

const { dice, esito } = creaControlli();
const tagDi = (app, id) => { const f = app.stato.images.find(i => i.id === id); return f ? f.tags : null; };
const annullate = (app, da) => app.notifiche.slice(da).filter(([m]) => m === t.undoSuccess).length;

// ITALIANO: modifico B (se richiesto), cestino A, svuoto il cestino e annullo lo svuotamento.
// ENGLISH: edit B (if asked), trash A, empty the trash and undo the emptying.
const prepara = async (opzioni, modificaB = true) => {
    const app = creaApp([foto('A', { cestinata: false }), foto('B', { cestinata: false })], opzioni);
    if (modificaB) {
        app.modifica(prev => prev.map(i => (i.id === 'B' ? { ...i, tags: [...i.tags, 'nuovo'] } : i)));
        await app.attendi();
    }
    app.cestina('A');
    await app.attendi();
    await app.render().handleEmptyTrash();
    await app.attendi();
    await app.render().annullaSvuotamento();
    await app.attendi();
    return app;
};

console.log('\n--- modifica B, cestina A, Svuota, Annulla lo svuotamento, Ctrl+Z ---');
{
    const app = await prepara({ api: apiFinta() });
    dice('dopo l\'annullamento A e\' nel cestino dell\'app', ['B', 'A(cestino)'], app.vista());
    const n = app.notifiche.length;
    app.render().handleUndo();
    await app.attendi();
    dice('Ctrl+Z NON toglie A dall\'app (i suoi file sono di nuovo nella cartella)', ['B', 'A(cestino)'], app.vista());
    dice('lo stesso Ctrl+Z annulla la modifica di B', ['tag B'], tagDi(app, 'B'));
    dice('un solo "Azione annullata"', 1, annullate(app, n));
    app.render().handleRedo();
    await app.attendi();
    dice('Ctrl+Shift+Z rimette la modifica di B, e A resta nel cestino dell\'app', [['B', 'A(cestino)'], ['tag B', 'nuovo']], [app.vista(), tagDi(app, 'B')]);
}

console.log('\n--- lo stesso, ma il .txt di A non e\' tornato ---');
{
    const api = apiFinta({ ripristino: (p) => ({ results: p.map(x => ({ percorso: x, esito: x.endsWith('.txt') ? 'fallito' : 'ok' })) }) });
    const app = await prepara({ api });
    dice('A torna da salvare (originalTags vuoto)', [], (app.stato.images.find(i => i.id === 'A') || {}).originalTags);
    app.render().handleUndo();
    await app.attendi();
    dice('Ctrl+Z NON toglie A: i suoi tag, che stanno solo in memoria, restano', [['B', 'A(cestino)'], ['tag A']], [app.vista(), tagDi(app, 'A')]);
    dice('...e A resta da salvare', [], (app.stato.images.find(i => i.id === 'A') || {}).originalTags);
}

console.log('\n--- il cestino svuotato aveva TUTTE le foto del progetto: Annulla lo svuotamento, Ripristina tutto, Ctrl+Z ---');
{
    // ITALIANO: si parte dalla galleria vuota di prima dell'import, poi l'import di A e B. Svuotato
    //           il cestino, ogni passo della cronologia era vuoto e le foto tornate non entravano in
    //           nessuno: dopo "Ripristina tutto" un Ctrl+Z svuotava la galleria, con i loro file
    //           di nuovo nella cartella.
    // ENGLISH: it starts from the empty gallery before the import, then the import of A and B. With
    //          the trash emptied, every history step was empty and the returned photos entered none:
    //          after "Restore all" a Ctrl+Z emptied the gallery, with their files back in the folder.
    const app = creaApp([], { api: apiFinta() });
    app.modifica(() => [foto('A', { cestinata: false }), foto('B', { cestinata: false })]);
    await app.attendi();
    app.cestina('A');
    await app.attendi();
    app.cestina('B');
    await app.attendi();
    await app.render().handleEmptyTrash();
    await app.attendi();
    dice('premessa: svuotato il cestino la galleria e\' vuota', [], app.vista());
    await app.render().annullaSvuotamento();
    await app.attendi();
    dice('dopo l\'annullamento A e B sono nel cestino dell\'app', ['A(cestino)', 'B(cestino)'], app.vista());
    dice('il passo a schermo descrive lo schermo (A e B nel cestino dell\'app)', ['A', 'B'],
        (app.stato.history[app.stato.historyIndex] || []).map(i => i.id));
    app.render().handleRestoreAll();
    await app.attendi();
    dice('"Ripristina tutto" le riporta in galleria', ['A', 'B'], app.vista());
    app.render().handleUndo();
    await app.attendi();
    dice('Ctrl+Z annulla "Ripristina tutto": tornano nel cestino dell\'app, la galleria NON si svuota', ['A(cestino)', 'B(cestino)'], app.vista());
    app.render().handleRedo();
    await app.attendi();
    dice('Ctrl+Shift+Z rifa\' "Ripristina tutto"', ['A', 'B'], app.vista());
    // ITALIANO: i passi "cestina A" e "cestina B" li ha tolti lo svuotamento, che aveva tolto TUTTE le
    //           foto: le foto tornate sono entrate in ogni passo, anche nel primo (2.0.1). Andando
    //           ancora indietro non si arriva piu' a una galleria vuota: un Ctrl+Z non toglie dall'app
    //           foto i cui file sono di nuovo nella cartella (e i tag che c'erano solo in memoria).
    // ENGLISH: the "trash A" and "trash B" steps were removed by the emptying, which had taken out EVERY
    //          photo: the returned photos entered every step, the first one too (2.0.1). Going further
    //          back no longer reaches an empty gallery: a Ctrl+Z does not take out of the app photos
    //          whose files are back in the folder (and the tags that existed only in memory).
    app.render().handleUndo();
    await app.attendi();
    app.render().handleUndo();
    await app.attendi();
    dice('due Ctrl+Z: le foto restano nel cestino dell\'app, la galleria non si svuota', ['A(cestino)', 'B(cestino)'], app.vista());
}
{
    // ITALIANO: la regola pura: i passi vuoti dal secondo fino a quello attuale ricevono le foto; il
    //           primo (la galleria di prima dell'import) e quelli dopo l'attuale restano vuoti; quelli
    //           pieni le ricevono come prima.
    // ENGLISH: the pure rule: the empty steps from the second up to the current one receive the
    //          photos; the first one (the gallery before the import) and those after the current one
    //          stay empty; the non-empty ones receive them as before.
    const P = { id: 'P' };
    const X = { id: 'X' };
    const h = [[], [X], [], []];
    const dopo = cronologia.addPhotosToHistory(h, [P], 2);
    dice('passo attuale vuoto: riceve la foto; il passo 0 e quello dopo restano vuoti; il passo pieno la riceve',
        [[], ['X', 'P'], ['P'], []], dopo.map(s => s.map(f => f.id)));
    dice('tutti i passi vuoti (cestino con tutte le foto): ricevono la foto tutti, anche il primo', [['P'], ['P'], ['P'], ['P']],
        cronologia.addPhotosToHistory([[], [], [], []], [P], 3).map(s => s.map(f => f.id)));
    dice('senza indice del passo attuale: i passi vuoti restano vuoti, come prima', [[], ['X', 'P'], [], []],
        cronologia.addPhotosToHistory(h, [P]).map(s => s.map(f => f.id)));
    dice('la cronologia passata non si tocca', [[], ['X'], [], []], h.map(s => s.map(f => f.id)));
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const app = await prepara({ api: apiFinta() }, false);
    const n = app.notifiche.length;
    app.render().handleUndo();
    await app.attendi();
    dice('senza altre modifiche, Ctrl+Z dopo l\'annullamento non cambia niente e non dice niente', [['B', 'A(cestino)'], 0], [app.vista(), annullate(app, n)]);
    dice('la cronologia ha lo stesso numero di passi e A in ognuno, una volta sola', true,
        app.stato.history.length > 0 && app.stato.history.every(s => s.filter(i => i.id === 'A').length === 1));
    // ITALIANO: dopo, una modifica vera e' un passo normale che Ctrl+Z annulla.
    // ENGLISH: afterwards a real edit is a normal step that Ctrl+Z undoes.
    app.modifica(prev => prev.map(i => (i.id === 'B' ? { ...i, tags: [...i.tags, 'dopo'] } : i)));
    await app.attendi();
    app.render().handleUndo();
    await app.attendi();
    dice('una modifica fatta dopo si annulla con Ctrl+Z, e A resta', [['B', 'A(cestino)'], ['tag B']], [app.vista(), tagDi(app, 'B')]);

    // ITALIANO: lo svuotamento stesso resta fuori dalla cronologia: Ctrl+Z non rimette A.
    // ENGLISH: the emptying itself stays out of the history: Ctrl+Z does not put A back.
    const b = creaApp([foto('A', { cestinata: false }), foto('B', { cestinata: false })], { api: apiFinta() });
    b.cestina('A');
    await b.attendi();
    await b.render().handleEmptyTrash();
    await b.attendi();
    b.render().handleUndo();
    await b.attendi();
    dice('dopo lo svuotamento (senza annullarlo) Ctrl+Z non rimette A', ['B'], b.vista());
}

process.exit(esito());
