/* ITALIANO: PROVA DI Ctrl+Z DOPO CHE DELLE FOTO HANNO LASCIATO IL DISCO
   Svuotato il cestino, un Ctrl+Z (il riflesso piu' comune dopo un'azione che spaventa) rimetteva
   nel cestino dell'app le foto appena mandate nel Cestino di Windows: la cronologia conservava la
   fotografia di prima dello svuotamento. Da li': "Ripristina" le portava in galleria e Salva
   scriveva un .txt accanto a un'immagine che nella cartella non c'era piu'; "Annulla lo
   svuotamento" le aggiungeva una seconda volta, con lo stesso id; e il secondo svuotamento
   liberava anteprime che la cronologia mostrava ancora. Stessa cosa con la X su una foto e con la
   cancellazione definitiva. La regola: una foto il cui file ha lasciato il disco esce anche dalla
   cronologia, e l'annullamento dello svuotamento non la aggiunge mai due volte.
   Si eseguono i testi VERI presi da src/App.tsx (vedi trash-harness.mjs) e la regola vera di
   src/utils/historyUtils.ts.
   Uso:  node scripts/test-undo-after-empty.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF Ctrl+Z AFTER PHOTOS HAVE LEFT THE DISK
   After emptying the trash, one Ctrl+Z (the most common reflex after a scary action) put back in
   the app's trash the photos just sent to the Windows Recycle Bin: the history kept the snapshot
   from before the emptying. From there: "Restore" brought them to the gallery and Save wrote a
   .txt beside an image no longer in the folder; "Undo the emptying" added them a second time, with
   the same id; and the second emptying released thumbnails the history still showed. The same
   with the X on a photo and with the permanent delete. The rule: a photo whose file has left the
   disk leaves the history too, and undoing the emptying never adds it twice.
   The REAL code taken from src/App.tsx is run (see trash-harness.mjs), plus the real rule of
   src/utils/historyUtils.ts.
   Usage:  node scripts/test-undo-after-empty.mjs      (exits with code 1 if anything is off) */

import { creaApp, apiFinta, foto, cartellaFinta, cronologia } from './trash-harness.mjs';
import { creaControlli } from './main-harness.mjs';

const { dice, esito } = creaControlli();
const conId = (elenco, id) => elenco.filter(i => i.id === id).length;
const nellaCronologia = (app, id) => app.stato.history.filter(s => conId(s, id) > 0).length;
const ids = (elenco) => elenco.map(i => i.id);

// ITALIANO: B ha i tag cambiati, poi A va nel cestino dell'app: due passi nella cronologia.
// ENGLISH: B gets its tags edited, then A goes to the app's trash: two steps in the history.
const preparaApp = async (opzioni, cartella = null) => {
    const app = creaApp([foto('A', { cestinata: false, cartella }), foto('B', { cestinata: false, cartella })], opzioni);
    app.modifica(prev => prev.map(i => (i.id === 'B' ? { ...i, tags: [...i.tags, 'nuovo'] } : i)));
    await app.attendi();
    app.cestina('A');
    await app.attendi();
    return app;
};

console.log('\n--- Svuota cestino, poi Ctrl+Z ---');
{
    const app = await preparaApp({ api: apiFinta() });
    await app.render().handleEmptyTrash();
    await app.attendi();
    dice('dopo lo svuotamento A non c\'e\' piu\'', ['B'], app.vista());
    dice('la cronologia non conserva A in nessun passo', 0, nellaCronologia(app, 'A'));
    dice('il passo attuale della cronologia e\' quello che si vede', ids(app.stato.images), ids(app.stato.history[app.stato.historyIndex] || []));
    app.render().handleUndo();
    await app.attendi();
    dice('Ctrl+Z NON rimette A nel cestino dell\'app (il suo file e\' nel Cestino di Windows)', ['B'], app.vista());
    dice('lo stesso Ctrl+Z annulla la modifica vera: i tag di B tornano quelli di prima', ['tag B'], app.stato.images.find(i => i.id === 'B').tags);

    // ITALIANO: "Annulla lo svuotamento" rimette A una volta sola, nel cestino dell'app.
    // ENGLISH: "Undo the emptying" puts A back once, in the app's trash.
    await app.render().annullaSvuotamento();
    await app.attendi();
    dice('Annulla lo svuotamento: A torna una volta sola, nel cestino dell\'app', 1, conId(app.stato.images, 'A'));
}

console.log('\n--- Annulla lo svuotamento con A gia\' presente (per qualunque strada ci sia tornata) ---');
{
    const app = await preparaApp({ api: apiFinta() });
    await app.render().handleEmptyTrash();
    await app.attendi();
    const vecchia = app.stato.ultimoSvuotamento.voci[0].img;
    app.modifica(prev => [...prev, { ...vecchia, isTrashed: true }]);
    await app.attendi();
    await app.render().annullaSvuotamento();
    await app.attendi();
    dice('nessun id doppio in galleria', 1, conId(app.stato.images, 'A'));
}

console.log('\n--- due svuotamenti di fila: le anteprime liberate non restano nella cronologia ---');
{
    const app = await preparaApp({ api: apiFinta() });
    await app.render().handleEmptyTrash();
    await app.attendi();
    app.cestina('B');
    await app.attendi();
    await app.render().handleEmptyTrash();
    await app.attendi();
    dice('la prima anteprima e\' stata liberata (nessuno la mostra piu\')', ['blob:finto/A'], app.revocati);
    const morte = app.stato.history.filter(s => s.some(i => app.revocati.includes(i.thumb))).length;
    dice('nessun passo della cronologia mostra un\'anteprima liberata', 0, morte);
}

console.log('\n--- la X su una foto, poi Ctrl+Z ---');
{
    const app = await preparaApp({ api: apiFinta() });
    await app.render().handleDeletePermanently('A');
    await app.attendi();
    app.render().handleUndo();
    await app.attendi();
    dice('Ctrl+Z NON rimette A', ['B'], app.vista());
    dice('la cronologia non conserva A', 0, nellaCronologia(app, 'A'));
}

console.log('\n--- cancellazione definitiva (anteprima nel browser), poi Ctrl+Z ---');
{
    const cartella = cartellaFinta();
    const app = await preparaApp({}, cartella);
    await app.render().handleEmptyTrash();
    await app.attendi();
    await app.stato.confirmDialog.onConfirm();
    await app.attendi();
    dice('A cancellata per sempre dalla cartella', true, cartella.rimossi.includes('A.png'));
    app.render().handleUndo();
    await app.attendi();
    dice('Ctrl+Z NON rimette A', ['B'], app.vista());
    dice('la cronologia non conserva A', 0, nellaCronologia(app, 'A'));
}

console.log('\n--- la regola della cronologia, da sola ---');
{
    const P = cronologia.purgeIdsFromHistory;
    dice('src/utils/historyUtils.ts esporta purgeIdsFromHistory', 'function', typeof P);
    if (typeof P === 'function') {
        const a = { id: 'A' }, a2 = { id: 'A', isTrashed: true }, b = { id: 'B' };
        const storia = [[a, b], [a2, b], [b]];
        const pulita = P(storia, new Set(['A']));
        dice('A esce da ogni passo, B resta al suo posto, stesso numero di passi', [['B'], ['B'], ['B']], pulita.map(ids));
        dice('l\'originale non si tocca', [['A', 'B'], ['A', 'B'], ['B']], storia.map(ids));
        dice('un insieme vuoto lascia tutto com\'era', storia.map(ids), P(storia, new Set()).map(ids));
    }
}

process.exit(esito());
