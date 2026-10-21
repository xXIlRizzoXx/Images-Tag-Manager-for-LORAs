/* ITALIANO: PROVA: "ANNULLA LO SVUOTAMENTO" METTE NEI PASSI RIEMPITI IL RIQUADRO CHE LE FOTO PORTANO DAVVERO
   I passi della cronologia rimasti vuoti, che ricevono le foto tornate, prendono anche un riquadro
   delle trigger. Era quello del momento dell'annullamento, ma le foto tornate portano i tag del
   momento dello svuotamento: a galleria vuota il riquadro si cambia senza toccare nessuna foto.
   Caso 1: A e B con ohwx, tutte nel cestino, Svuota, riquadro cambiato in sks a galleria vuota,
   Annulla lo svuotamento, Ctrl+Z: tutti i passi avevano ["sks"], Ctrl+Z non faceva niente e le
   foto tenevano ohwx come un tag qualsiasi. Ora Ctrl+Z riporta il riquadro a ["ohwx"].
   Caso 2: A importata da sola, nel cestino, Svuota, poi trigger ohwx e import di B, Annulla: i
   passi che ricevono A (senza trigger) prendevano il riquadro con ohwx. Ora prendono [].
   Casi vicini che non devono cambiare: senza cambiare il riquadro tutto resta come in
   test-undo-empty-trigger-box; un ricordo dello svuotamento senza riquadro salvato usa quello di
   adesso; un secondo "Annulla lo svuotamento" dopo uno parziale usa ancora il riquadro di allora.
   Si eseguono i testi VERI presi da src/App.tsx (vedi trash-harness.mjs).
   Uso:  node scripts/test-undo-empty-trigger-box-stale.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST: "UNDO THE EMPTYING" PUTS INTO THE FILLED STEPS THE BOX THE PHOTOS REALLY CARRY
   The history steps left empty that receive the returned photos also take a trigger box. It was
   the one of the moment of the undo, but the returned photos carry the tags of the moment of the
   emptying: with an empty gallery the box changes without touching any photo.
   Case 1: A and B with ohwx, all trashed, Empty, box changed to sks with the gallery empty, Undo
   the emptying, Ctrl+Z: every step had ["sks"], Ctrl+Z did nothing and the photos kept ohwx as an
   ordinary tag. Now Ctrl+Z brings the box back to ["ohwx"].
   Case 2: A imported alone, trashed, Empty, then trigger ohwx and import of B, Undo: the steps that
   receive A (with no trigger) took the box with ohwx. Now they take [].
   Neighbouring cases that must not change: without changing the box everything stays as in
   test-undo-empty-trigger-box; an emptying record with no saved box uses the current one; a second
   "Undo the emptying" after a partial one still uses the box of then.
   The REAL code taken from src/App.tsx is run (see trash-harness.mjs).
   Usage:  node scripts/test-undo-empty-trigger-box-stale.mjs      (exits with code 1 if anything is off) */

import { creaApp, apiFinta, foto, t } from './trash-harness.mjs';
import { creaControlli } from './main-harness.mjs';

const { dice, esito } = creaControlli();
const tagDi = (app, id) => { const f = app.stato.images.find(i => i.id === id); return f ? f.tags : null; };
const annullate = (app, da) => app.notifiche.slice(da).filter(([m]) => m === t.undoSuccess).length;
// ITALIANO: come handleGlobalTagsChange: riquadro e foto cambiano insieme, ma solo se ci sono foto.
// ENGLISH: like handleGlobalTagsChange: box and photos change together, but only if there are photos.
const scriviTrigger = async (app, trigger) => {
    app.stato.globalTriggers = trigger;
    app.refs.globalTriggersRef.current = trigger;
    if (app.stato.images.length > 0) app.modifica(prev => prev.map(i => ({ ...i, tags: [...trigger, ...i.tags.filter(x => !trigger.includes(x))] })));
    await app.attendi();
};

console.log('\n--- caso 1: riquadro cambiato a galleria vuota fra lo svuotamento e l\'annullamento ---');
{
    const app = creaApp([foto('A', { cestinata: false }), foto('B', { cestinata: false })], { api: apiFinta({ txtSulDisco: () => true }) });
    await app.attendi();
    await scriviTrigger(app, ['ohwx']);
    app.modifica(prev => prev.map(i => ({ ...i, isTrashed: true })));
    await app.attendi();
    await app.render().handleEmptyTrash();
    await app.attendi(10);
    dice('premessa: dopo lo svuotamento la galleria e\' vuota', [], app.vista());
    await scriviTrigger(app, ['sks']);
    await app.render().annullaSvuotamento();
    await app.attendi(10);
    dice('dopo l\'annullamento: le foto tornano con ohwx, il riquadro resta quello scelto (sks)', [['A(cestino)', 'B(cestino)'], ['ohwx', 'tag A'], ['sks']],
        [app.vista(), tagDi(app, 'A'), app.stato.globalTriggers]);
    const n = app.notifiche.length;
    app.render().handleUndo();
    await app.attendi(10);
    dice('Ctrl+Z: il riquadro torna ["ohwx"], come le foto', ['ohwx'], app.stato.globalTriggers);
    dice('...le foto restano con ohwx', [true, true], [tagDi(app, 'A').includes('ohwx'), tagDi(app, 'B').includes('ohwx')]);
    dice('...con un "Azione annullata"', 1, annullate(app, n));
}

console.log('\n--- caso 2: passo vuoto in mezzo, trigger scritta dopo lo svuotamento ---');
{
    const app = creaApp([], { api: apiFinta({ txtSulDisco: () => true }) });
    await app.attendi();
    app.modifica(() => [foto('A', { cestinata: false })]);
    await app.attendi();
    app.cestina('A');
    await app.attendi();
    await app.render().handleEmptyTrash();
    await app.attendi(10);
    await scriviTrigger(app, ['ohwx']);
    app.modifica(prev => [...prev, { ...foto('B', { cestinata: false }), tags: ['ohwx', 'tag B'] }]);
    await app.attendi();
    await app.render().annullaSvuotamento();
    await app.attendi(10);
    dice('dopo l\'annullamento: B in galleria con ohwx, A nel cestino senza ohwx', [['B', 'A(cestino)'], false, ['ohwx']],
        [app.vista(), tagDi(app, 'A').includes('ohwx'), app.stato.globalTriggers]);
    // ITALIANO: ogni passo che contiene A senza B (A non ha mai avuto la trigger) ha il riquadro vuoto.
    // ENGLISH: every step holding A without B (A never had the trigger) has an empty box.
    const passiSoloA = app.stato.history.map((p, j) => [p, j]).filter(([p]) => p.length > 0 && p.every(i => i.id === 'A')).map(([, j]) => j);
    dice('premessa: ci sono passi con la sola A', true, passiSoloA.length > 0);
    dice('...e il loro riquadro e\' [] (quello dello svuotamento), non ["ohwx"]', passiSoloA.map(() => []),
        passiSoloA.map(j => app.refs.triggerHistoryRef.current[j]));
    app.render().handleUndo();
    await app.attendi(10);
    dice('Ctrl+Z: annulla l\'import di B; riquadro e foto A dicono la stessa cosa', [['A(cestino)'], [], false],
        [app.vista(), app.stato.globalTriggers, tagDi(app, 'A').includes('ohwx')]);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    // ITALIANO: ricordo senza riquadro salvato (come uno fatto a mano dalle prove): si usa quello di adesso.
    // ENGLISH: record with no saved box (like one built by hand in the tests): the current one is used.
    const app = creaApp([foto('A', { cestinata: false }), foto('B', { cestinata: false })], { api: apiFinta({ txtSulDisco: () => true }) });
    await app.attendi();
    await scriviTrigger(app, ['ohwx']);
    app.modifica(prev => prev.map(i => ({ ...i, isTrashed: true })));
    await app.attendi();
    await app.render().handleEmptyTrash();
    await app.attendi(10);
    app.stato.ultimoSvuotamento = { voci: app.stato.ultimoSvuotamento.voci };
    await app.render().annullaSvuotamento();
    await app.attendi(10);
    const n = app.notifiche.length;
    app.render().handleUndo();
    await app.attendi(10);
    dice('ricordo senza riquadro: Ctrl+Z tiene ["ohwx"] e non annulla niente, come prima', [['ohwx'], 0], [app.stato.globalTriggers, annullate(app, n)]);
}
{
    // ITALIANO: annullamento parziale e poi un secondo: il ricordo che resta tiene il riquadro di allora.
    // ENGLISH: a partial undo and then a second one: the record that stays keeps the box of then.
    // ITALIANO: B non riesce a tornare ('fallito'): resta nel ricordo, da riprovare.
    // ENGLISH: B fails to come back ('fallito'): it stays in the record, to retry.
    const api = apiFinta({ txtSulDisco: () => true,
        ripristino: (percorsi) => ({ results: percorsi.map(p => ({ percorso: p, esito: /B\.png$/i.test(p) ? 'fallito' : 'ok' })) }) });
    const app = creaApp([foto('A', { cestinata: false }), foto('B', { cestinata: false })], { api });
    await app.attendi();
    await scriviTrigger(app, ['ohwx']);
    app.modifica(prev => prev.map(i => ({ ...i, isTrashed: true })));
    await app.attendi();
    await app.render().handleEmptyTrash();
    await app.attendi(10);
    await scriviTrigger(app, ['sks']);
    await app.render().annullaSvuotamento();
    await app.attendi(10);
    dice('premessa: torna solo A, B resta da riprovare', [['A(cestino)'], ['B']], [app.vista(), (app.stato.ultimoSvuotamento?.voci || []).map(v => v.img.id)]);
    dice('...il ricordo che resta tiene il riquadro dello svuotamento', ['ohwx'], app.stato.ultimoSvuotamento?.trigger);
}

process.exit(esito());
