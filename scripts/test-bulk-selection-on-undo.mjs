/* ITALIANO: PROVA DELLA SELEZIONE IN BLOCCO DOPO Ctrl+Z / Ctrl+Shift+Z
   Ogni strada che manda una foto nel cestino o la toglie dal progetto la toglie anche dalla
   selezione in blocco; Ctrl+Z e Ctrl+Shift+Z no. Una foto rimandata nel cestino da Ctrl+Z restava
   selezionata: il pannello diceva "foto selezionate: 2" con una sola foto visibile, le pillole
   "presenti su alcune" contavano i suoi tag e Conferma diceva "Foto interessate: 1". Dopo un
   Ctrl+Z oltre l'import il pannello restava aperto sopra una galleria vuota. La regola: la
   selezione contiene solo foto che ci sono e non stanno nel cestino.
   Si eseguono i testi VERI presi da src/App.tsx (vedi undo-harness.mjs).
   Uso:  node scripts/test-bulk-selection-on-undo.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE BULK SELECTION AFTER Ctrl+Z / Ctrl+Shift+Z
   Every road that sends a photo to the trash or removes it from the project also drops it from
   the bulk selection; Ctrl+Z and Ctrl+Shift+Z did not. A photo sent back to the trash by Ctrl+Z
   stayed selected: the panel said "selected photos: 2" with one photo in view, the "on some" pills
   counted its tags and Confirm said "Photos affected: 1". After a Ctrl+Z past the import the panel
   stayed open over an empty gallery. The rule: the selection holds only photos that exist and are
   not in the trash.
   The REAL code taken from src/App.tsx is run (see undo-harness.mjs).
   Usage:  node scripts/test-bulk-selection-on-undo.mjs      (exits with code 1 if anything is off) */

import { creaApp, foto } from './undo-harness.mjs';
import { creaControlli } from './main-harness.mjs';

const { dice, esito } = creaControlli();
const nelCestino = (app, id) => Boolean(app.fotoCon(id)?.isTrashed);
const cestina = (app, id, si = true) => app.modifica(prev => prev.map(i => (i.id === id ? { ...i, isTrashed: si } : i)));

const importate = async () => {
    const app = creaApp([foto('A', ['red hair']), foto('B', ['blue eyes'])]);
    app.importa();
    await app.attendi();
    return app;
};

console.log('\n--- A cestinata, ripristinata, A e B selezionate, poi Ctrl+Z ---');
{
    const app = await importate();
    cestina(app, 'A');
    await app.attendi();
    cestina(app, 'A', false);
    await app.attendi();
    app.seleziona(['A', 'B']);
    await app.attendi();
    app.render().handleUndo();
    await app.attendi();
    dice('Ctrl+Z rimette A nel cestino', true, nelCestino(app, 'A'));
    dice('...e A esce dalla selezione', ['B'], app.stato.selectedForBulk);
}

console.log('\n--- A cestinata, Ctrl+Z (A torna), A e B selezionate, poi Ctrl+Shift+Z ---');
{
    const app = await importate();
    cestina(app, 'A');
    await app.attendi();
    app.render().handleUndo();
    await app.attendi();
    dice('A e\' tornata in galleria', false, nelCestino(app, 'A'));
    app.seleziona(['A', 'B']);
    await app.attendi();
    app.render().handleRedo();
    await app.attendi();
    dice('Ctrl+Shift+Z rimette A nel cestino', true, nelCestino(app, 'A'));
    dice('...e A esce dalla selezione', ['B'], app.stato.selectedForBulk);
}

console.log('\n--- A e B selezionate subito dopo l\'import, poi Ctrl+Z oltre l\'import ---');
{
    const app = await importate();
    app.seleziona(['A', 'B']);
    await app.attendi();
    app.render().handleUndo();
    await app.attendi();
    dice('la galleria e\' vuota', 0, app.stato.images.length);
    dice('...e la selezione pure: il pannello si chiude', [], app.stato.selectedForBulk);
}

console.log('\n--- quello che NON deve cambiare: un Ctrl+Z che cambia solo dei tag ---');
{
    const app = await importate();
    app.modifica(prev => prev.map(i => (i.id === 'B' ? { ...i, tags: [...i.tags, 'smile'] } : i)));
    await app.attendi();
    const scelta = ['A', 'B'];
    app.seleziona(scelta);
    await app.attendi();
    app.render().handleUndo();
    await app.attendi();
    dice('i tag di B tornano quelli di prima', ['blue eyes'], app.fotoCon('B').tags);
    dice('la selezione resta la stessa, lo stesso elenco', true, app.stato.selectedForBulk === scelta);
}

process.exit(esito());
