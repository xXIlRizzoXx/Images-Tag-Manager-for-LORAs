/* ITALIANO: PROVA DEL VISUALIZZATORE QUANDO Ctrl+Z FA SPARIRE LA FOTO APERTA
   Si cestinava la foto X, la si ripristinava, la si apriva nel visualizzatore e si premeva Ctrl+Z:
   X tornava nel cestino e il visualizzatore spariva, ma l'app continuava a crederlo aperto su X.
   Da li' un clic su un tag suggerito, con altre foto selezionate, finiva in silenzio su X (nascosta
   nel cestino) invece di essere preparato per le foto scelte; Esc non faceva niente; e ripristinando
   X il visualizzatore si riapriva da solo. Lo stesso con Ctrl+Shift+Z e con Ctrl+Z oltre l'import.
   La regola: quando la foto aperta non c'e' piu' o e' nel cestino, il visualizzatore si chiude
   davvero, come fanno gia' "Sposta nel cestino" e la X.
   Si eseguono i testi VERI presi da src/App.tsx (vedi undo-harness.mjs).
   Uso:  node scripts/test-viewer-closes-on-undo.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE VIEWER WHEN Ctrl+Z MAKES THE OPEN PHOTO DISAPPEAR
   Photo X was trashed, restored, opened in the viewer, then Ctrl+Z was pressed: X went back to the
   trash and the viewer vanished, but the app still believed it open on X. From there a click on a
   suggested tag, with other photos selected, silently landed on X (hidden in the trash) instead of
   being staged for the chosen photos; Esc did nothing; and restoring X reopened the viewer by
   itself. The same with Ctrl+Shift+Z and with Ctrl+Z past the import. The rule: when the open photo
   is gone or in the trash, the viewer really closes, as "Move to trash" and the X already do.
   The REAL code taken from src/App.tsx is run (see undo-harness.mjs).
   Usage:  node scripts/test-viewer-closes-on-undo.mjs      (exits with code 1 if anything is off) */

import { creaApp, foto } from './undo-harness.mjs';
import { creaControlli } from './main-harness.mjs';

const { dice, esito } = creaControlli();
const cestina = (app, id, si = true) => app.modifica(prev => prev.map(i => (i.id === id ? { ...i, isTrashed: si } : i)));
const importa = async () => {
    const app = creaApp([foto('X', ['a']), foto('Y', ['b']), foto('Z', ['c'])]);
    app.importa();
    await app.attendi();
    return app;
};

console.log('\n--- cestina X, ripristinala, aprila, poi Ctrl+Z ---');
{
    const app = await importa();
    cestina(app, 'X'); await app.attendi();
    cestina(app, 'X', false); await app.attendi();
    app.apri('X'); await app.attendi();
    app.render().handleUndo(); await app.attendi();
    dice('X e\' tornata nel cestino', true, app.fotoCon('X').isTrashed);
    dice('il visualizzatore si chiude davvero', null, app.stato.selectedImageId);
    // ITALIANO: con Y e Z selezionate, un clic su un tag suggerito va preparato per loro.
    // ENGLISH: with Y and Z selected, a click on a suggested tag is staged for them.
    app.seleziona(['Y', 'Z']); await app.attendi();
    app.render().handleSuggestedTagClick('smile'); await app.attendi();
    dice('il tag suggerito e\' preparato per le foto selezionate', ['smile'], app.stato.stagedBulkTags);
    dice('e non finisce sulla foto nascosta nel cestino', [], app.tagSuFotoAperta);
    cestina(app, 'X', false); await app.attendi();
    dice('ripristinando X il visualizzatore non si riapre da solo', null, app.stato.selectedImageId);
}

console.log('\n--- annulla il cestino di X, aprila, poi Ctrl+Shift+Z ---');
{
    const app = await importa();
    cestina(app, 'X'); await app.attendi();
    app.render().handleUndo(); await app.attendi();
    app.apri('X'); await app.attendi();
    app.render().handleRedo(); await app.attendi();
    dice('X e\' di nuovo nel cestino e il visualizzatore si chiude', [true, null], [app.fotoCon('X').isTrashed, app.stato.selectedImageId]);
}

console.log('\n--- apri X subito dopo l\'import, poi Ctrl+Z oltre l\'import ---');
{
    const app = await importa();
    app.apri('X'); await app.attendi();
    app.render().handleUndo(); await app.attendi();
    dice('la galleria e\' vuota e il visualizzatore si chiude', [0, null], [app.stato.images.length, app.stato.selectedImageId]);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const app = await importa();
    app.apri('Y'); await app.attendi();
    app.modifica(prev => prev.map(i => (i.id === 'Y' ? { ...i, tags: ['b', 'nuovo'] } : i))); await app.attendi();
    dice('cambiare i tag della foto aperta non chiude il visualizzatore', 'Y', app.stato.selectedImageId);
    app.render().handleUndo(); await app.attendi();
    dice('Ctrl+Z su quella modifica non lo chiude (la foto c\'e\' ancora)', ['Y', ['b']], [app.stato.selectedImageId, app.fotoCon('Y').tags]);
    cestina(app, 'Z'); await app.attendi();
    dice('cestinare un\'altra foto non chiude il visualizzatore', 'Y', app.stato.selectedImageId);
    app.render().handleSuggestedTagClick('smile'); await app.attendi();
    dice('con il visualizzatore aperto il tag suggerito va sulla foto aperta', [['Y', ['b', 'smile']]], app.tagSuFotoAperta);
}

process.exit(esito());
