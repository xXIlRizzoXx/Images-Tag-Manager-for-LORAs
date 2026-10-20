/* ITALIANO: PROVA DEL COLLEGAMENTO DI UNA FOTO DEL CESTINO ALLA SUA CARTELLA E DI Ctrl+Z
   Chiavetta E:\img: a.png e b.png trascinate, a.png nel cestino, "Svuota Cestino" dice che li' il
   Cestino di Windows non c'e' e di aprire la cartella con "Carica Cartella". Aperta E:\img, a.png
   riceve la cartella (non e' un passo di Ctrl+Z), ma la cronologia restava senza: un ritocco su b.png
   annullato con Ctrl+Z rimetteva a.png senza cartella, e "Svuota Cestino" ripeteva lo stesso consiglio
   gia' seguito. Ora il collegamento entra anche in ogni passo della cronologia.
   Casi vicini che non devono cambiare: Ctrl+Y dopo Ctrl+Z, e Ctrl+Z di un import con foto nuove,
   lasciano a.png collegata; il ritocco annullato torna davvero indietro; una foto in galleria nei
   passi vecchi non riceve la cartella.
   Si eseguono i testi VERI di confermaImport (import-harness.mjs) e di handleUndo, handleRedo,
   handleEmptyTrash con l'effetto della cronologia (trash-harness.mjs).
   Uso:  node scripts/test-import-link-history.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF LINKING A TRASH PHOTO TO ITS FOLDER AND Ctrl+Z
   USB stick E:\img: a.png and b.png dropped, a.png in the trash, "Empty Trash" says there is no
   Windows Recycle Bin there and to open the folder with "Load Folder". Once E:\img is opened, a.png
   gets the folder (not a Ctrl+Z step), but the history stayed without it: a retouch on b.png undone
   with Ctrl+Z put a.png back without the folder, and "Empty Trash" repeated the advice already
   followed. Now the link also goes into every history step.
   Neighbouring cases that must not change: Ctrl+Y after Ctrl+Z, and Ctrl+Z of an import with new
   photos, leave a.png linked; the undone retouch really goes back; a gallery photo in the old steps
   does not get the folder.
   The REAL text of confermaImport (import-harness.mjs) and of handleUndo, handleRedo,
   handleEmptyTrash with the history effect (trash-harness.mjs) runs.
   Usage:  node scripts/test-import-link-history.mjs      (exits with code 1 if anything is off) */

import { creaControlli } from './main-harness.mjs';
import * as I from './import-harness.mjs';
import * as H from './trash-harness.mjs';

const { dice, esito } = creaControlli();
const B = String.fromCharCode(92);
const sciolta = (id, nome, cestinata) => ({ id, file: { name: nome, percorso: 'E:' + B + 'img' + B + nome, size: 10, lastModified: 1000 },
    thumb: '', tags: ['tag ' + id], originalTags: ['tag ' + id], isTrashed: cestinata, dirHandle: null, width: 1, height: 1 });

// ITALIANO: "Carica Cartella" di E:\img con il vero confermaImport, poi gli stessi cambiamenti (foto e
//           cronologia) portati nell'app del cestino, come li applicherebbe React.
// ENGLISH: "Load Folder" of E:\img with the real confermaImport, then the same changes (photos and
//          history) carried into the trash app, as React would apply them.
const apriCartella = async (app, nomi) => {
    const h = I.cartella('E:img', 'img');
    const imp = I.creaApp({ iniziali: app.stato.images });
    await imp.conferma(I.riepilogo(h, nomi));
    // ITALIANO: prima il collegamento (setImages con isUndoRedoAction, nessun passo), poi, in un altro
    //           giro, le foto nuove dell'import (un passo), come nell'app.
    // ENGLISH: first the link (setImages with isUndoRedoAction, no step), then, in another round, the
    //          import's new photos (one step), as in the app.
    const collegate = new Map(imp.images.filter(i => i.dirHandle).map(i => [i.id, i]));
    if (collegate.size > 0) {
        app.refs.isUndoRedoAction.current = true;
        app.modifica(prev => prev.map(i => collegate.get(i.id) || i));
    }
    for (const f of imp.cambiStoria) app.stato.history = f(app.stato.history);
    await app.attendi();
    if (imp.images.length > app.stato.images.length) {
        app.modifica(() => imp.images.map(i => i));
        await app.attendi();
    }
    return h;
};
const a = (app) => app.stato.images.find(i => i.id === 'a');

console.log('\n--- tutte le foto gia\' aperte, ritocco e Ctrl+Z ---');
{
    const app = H.creaApp([sciolta('a', 'a.png', true), sciolta('b', 'b.png', false)], { api: H.apiFinta({ esitoDi: () => 'rifiutato' }) });
    const h = await apriCartella(app, ['a.png', 'b.png']);
    dice('premessa: a.png collegata alla cartella', true, a(app).dirHandle === h);
    app.modifica(prev => prev.map(i => (i.id === 'b' ? { ...i, tags: ['tag b', 'smile'] } : i)));
    await app.attendi();
    app.render().handleUndo();
    await app.attendi();
    dice('Ctrl+Z annulla il ritocco su b.png', ['tag b'], app.stato.images.find(i => i.id === 'b').tags);
    dice('...e a.png resta collegata alla cartella', true, a(app).dirHandle === h);
    const r = app.render();
    if (r.handleRedo) {
        r.handleRedo();
        await app.attendi();
        dice('Ctrl+Y rimette il ritocco e a.png resta collegata', [['tag b', 'smile'], true], [app.stato.images.find(i => i.id === 'b').tags, a(app).dirHandle === h]);
        app.render().handleUndo();
        await app.attendi();
    }
    await app.render().handleEmptyTrash();
    await app.attendi(10);
    dice('"Svuota Cestino" arriva alla seconda conferma, senza ripetere "apri la cartella"', [true, false],
        [!!app.stato.confirmDialog.isOpen, app.notifiche.some(([m]) => String(m).includes('Load Folder'))]);
}

console.log('\n--- import con foto nuove, poi Ctrl+Z dell\'import ---');
{
    const app = H.creaApp([sciolta('a', 'a.png', true), sciolta('b', 'b.png', false)], { api: H.apiFinta({ esitoDi: () => 'rifiutato' }) });
    const h = await apriCartella(app, ['a.png', 'b.png', 'c.png']);
    dice('premessa: c.png entra e a.png e\' collegata', [true, true], [app.stato.images.some(i => i.file.name === 'c.png'), a(app).dirHandle === h]);
    app.render().handleUndo();
    await app.attendi();
    dice('Ctrl+Z dell\'import toglie c.png ma a.png resta collegata', [false, true], [app.stato.images.some(i => i.file.name === 'c.png'), a(app).dirHandle === h]);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    // ITALIANO: a.png in galleria nel primo passo, poi nel cestino: solo i passi col cestino la collegano.
    // ENGLISH: a.png in the gallery in the first step, then in the trash: only the trash steps link it.
    const app = H.creaApp([sciolta('a', 'a.png', false), sciolta('b', 'b.png', false)], { api: H.apiFinta({ esitoDi: () => 'rifiutato' }) });
    app.cestina('a');
    await app.attendi();
    const h = await apriCartella(app, ['a.png', 'b.png']);
    const passi = app.stato.history.map(p => { const x = p.find(i => i.id === 'a'); return [x.isTrashed, x.dirHandle === h]; });
    dice('nei passi vecchi a.png in galleria resta senza cartella, nel cestino la riceve', [[false, false], [true, true]], passi);
}

process.exit(esito());
