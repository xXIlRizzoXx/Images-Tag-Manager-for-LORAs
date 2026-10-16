/* ITALIANO: PROVA: Ctrl+Z DOPO "ANNULLA LO SVUOTAMENTO" NON STACCA IL RIQUADRO DELLE TRIGGER DALLE FOTO
   Si scrive la trigger ohwx (entra in tutte le foto), si cestinano TUTTE le foto, si svuota il
   cestino e si preme "Annulla lo svuotamento": le foto tornano nel cestino dell'app con ohwx.
   addPhotosToHistory mette le foto tornate nei passi rimasti vuoti, ma il riquadro di quei passi
   restava quello di allora ([] prima di scrivere ohwx): Ctrl+Z diceva "Azione annullata", il
   riquadro diventava vuoto e le foto tenevano ohwx. Da li' ohwx era un tag qualsiasi.
   Casi vicini che non devono cambiare: con uno svuotamento parziale Ctrl+Z arriva ancora al passo
   di prima della trigger (riquadro vuoto, trigger tolta dalla foto rimasta); un passo vuoto in
   mezzo, riempito con la foto tornata, non rimette un riquadro che le foto non hanno; Ctrl+Z verso
   la galleria vuota di prima dell'import toglie le foto come sempre.
   Si eseguono i testi VERI presi da src/App.tsx (vedi trash-harness.mjs).
   Uso:  node scripts/test-undo-empty-trigger-box.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST: Ctrl+Z AFTER "UNDO THE EMPTYING" DOES NOT DETACH THE TRIGGER BOX FROM THE PHOTOS
   Type the trigger ohwx (it enters every photo), trash ALL the photos, empty the trash and press
   "Undo the emptying": the photos come back into the app's trash with ohwx. addPhotosToHistory
   puts the returned photos into the steps left empty, but those steps' box stayed as it was then
   ([] before typing ohwx): Ctrl+Z said "Action undone", the box became empty and the photos kept
   ohwx. From there ohwx was just another tag.
   Neighbouring cases that must not change: with a partial emptying Ctrl+Z still reaches the step
   before the trigger (empty box, trigger removed from the remaining photo); an empty step in the
   middle, filled with the returned photo, does not put back a box the photos do not have; Ctrl+Z to
   the empty gallery from before the import takes the photos out as always.
   The REAL code taken from src/App.tsx is run (see trash-harness.mjs).
   Usage:  node scripts/test-undo-empty-trigger-box.mjs      (exits with code 1 if anything is off) */

import { creaApp, apiFinta, foto, t } from './trash-harness.mjs';
import { creaControlli } from './main-harness.mjs';

const { dice, esito } = creaControlli();
const tagDi = (app, id) => { const f = app.stato.images.find(i => i.id === id); return f ? f.tags : null; };
const annullate = (app, da) => app.notifiche.slice(da).filter(([m]) => m === t.undoSuccess).length;
// ITALIANO: come handleGlobalTagsChange: riquadro e foto cambiano nello stesso aggiornamento.
// ENGLISH: like handleGlobalTagsChange: box and photos change in the same update.
const scriviTrigger = async (app, trigger) => {
    app.stato.globalTriggers = trigger;
    app.refs.globalTriggersRef.current = trigger;
    app.modifica(prev => prev.map(i => ({ ...i, tags: [...trigger, ...i.tags.filter(x => !trigger.includes(x))] })));
    await app.attendi();
};
const svuotaEAnnulla = async (app) => {
    await app.render().handleEmptyTrash();
    await app.attendi(10);
    await app.render().annullaSvuotamento();
    await app.attendi(10);
};

console.log('\n--- trigger, TUTTE nel cestino, Svuota, Annulla lo svuotamento, Ctrl+Z ---');
{
    const app = creaApp([foto('A', { cestinata: false }), foto('B', { cestinata: false })], { api: apiFinta({ txtSulDisco: () => true }) });
    await app.attendi();
    await scriviTrigger(app, ['ohwx']);
    app.modifica(prev => prev.map(i => ({ ...i, isTrashed: true })));
    await app.attendi();
    await svuotaEAnnulla(app);
    dice('dopo l\'annullamento A e B sono nel cestino dell\'app con ohwx', [['A(cestino)', 'B(cestino)'], true],
        [app.vista(), app.stato.images.every(i => i.tags.includes('ohwx'))]);
    const n = app.notifiche.length;
    app.render().handleUndo();
    await app.attendi(10);
    dice('Ctrl+Z: il riquadro delle trigger resta ["ohwx"]', ['ohwx'], app.stato.globalTriggers);
    dice('...e le foto tengono ohwx (riquadro e foto dicono la stessa cosa)', [true, true],
        [tagDi(app, 'A').includes('ohwx'), tagDi(app, 'B').includes('ohwx')]);
    dice('...e nessun "Azione annullata" senza niente da annullare', 0, annullate(app, n));
}

console.log('\n--- svuotamento PARZIALE: Ctrl+Z annulla ancora la trigger ---');
{
    const app = creaApp([foto('A', { cestinata: false }), foto('B', { cestinata: false })], { api: apiFinta({ txtSulDisco: () => true }) });
    await app.attendi();
    await scriviTrigger(app, ['ohwx']);
    app.cestina('A');
    await app.attendi();
    await svuotaEAnnulla(app);
    const n = app.notifiche.length;
    app.render().handleUndo();
    await app.attendi(10);
    dice('Ctrl+Z arriva al passo di prima della trigger: riquadro vuoto', [], app.stato.globalTriggers);
    dice('...e la trigger si toglie dalla foto rimasta', false, tagDi(app, 'B').includes('ohwx'));
    dice('...con un "Azione annullata"', 1, annullate(app, n));
}

console.log('\n--- passo vuoto in mezzo, riempito dalla foto tornata ---');
{
    // ITALIANO: galleria vuota, import di A, trigger, import di B, A nel cestino, Svuota, Annulla.
    // ENGLISH: empty gallery, import of A, trigger, import of B, A trashed, Empty, Undo.
    const app = creaApp([], { api: apiFinta({ txtSulDisco: () => true }) });
    await app.attendi();
    app.modifica(() => [foto('A', { cestinata: false })]);
    await app.attendi();
    await scriviTrigger(app, ['ohwx']);
    app.modifica(prev => [...prev, { ...foto('B', { cestinata: false }), tags: ['ohwx', 'tag B'] }]);
    await app.attendi();
    app.cestina('A');
    await app.attendi();
    await svuotaEAnnulla(app);
    dice('dopo l\'annullamento: B in galleria, A nel cestino dell\'app', ['B', 'A(cestino)'], app.vista());
    app.render().handleUndo();
    await app.attendi(10);
    dice('primo Ctrl+Z: annulla l\'import di B, A resta con ohwx e il riquadro con ohwx', [['A(cestino)'], ['ohwx'], true],
        [app.vista(), app.stato.globalTriggers, tagDi(app, 'A').includes('ohwx')]);
    app.render().handleUndo();
    await app.attendi(10);
    dice('secondo Ctrl+Z: nessun passo con il riquadro vuoto e A con ohwx; si torna alla galleria vuota',
        [[], ['ohwx']], [app.vista(), app.stato.globalTriggers]);
}

process.exit(esito());
