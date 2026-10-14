/* ITALIANO: PROVA DI Ctrl+Z / Ctrl+Shift+Z SUL RIQUADRO DELLE TRIGGER WORD
   Scrivere una trigger nel riquadro "Trigger word globali" la mette su tutte le foto in un solo
   passo della cronologia, ma la cronologia ricordava solo le foto. Ctrl+Z toglieva la trigger
   dalle foto e il riquadro continuava a mostrarla: Salva diceva "niente da salvare" e le foto
   importate dopo la ricevevano. Al contrario, togliendo la trigger e premendo Ctrl+Z le foto la
   riavevano ma il riquadro restava vuoto, e il .txt la scriveva in ordine alfabetico invece che
   per prima (keep_tokens di Kohya). La regola: Ctrl+Z e Ctrl+Shift+Z rimettono anche il riquadro
   com'era in quel passo; tornando a una galleria vuota (prima dell'import) il riquadro resta com'e'.
   Si eseguono i testi VERI presi da src/App.tsx (vedi undo-harness.mjs).
   Uso:  node scripts/test-undo-restores-triggers.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF Ctrl+Z / Ctrl+Shift+Z ON THE TRIGGER WORD BOX
   Typing a trigger in the "Global trigger words" box puts it on every photo in one history step,
   but the history remembered only the photos. Ctrl+Z took the trigger off the photos while the box
   kept showing it: Save said "nothing to save" and photos imported later got it. The other way
   round, removing the trigger and pressing Ctrl+Z gave it back to the photos but left the box
   empty, and the .txt wrote it in alphabetical order instead of first (Kohya's keep_tokens). The
   rule: Ctrl+Z and Ctrl+Shift+Z also put the box back as it was at that step; going back to an
   empty gallery (before the import) leaves the box as it is.
   The REAL code taken from src/App.tsx is run (see undo-harness.mjs).
   Usage:  node scripts/test-undo-restores-triggers.mjs      (exits with code 1 if anything is off) */

import { creaApp, foto } from './undo-harness.mjs';
import { creaControlli } from './main-harness.mjs';

const { dice, esito } = creaControlli();

console.log('\n--- si aggiunge la trigger "ohwx", poi Ctrl+Z e Ctrl+Shift+Z ---');
{
    const app = creaApp([foto('A', ['smile']), foto('B', ['apple'])]);
    app.importa();
    await app.attendi();
    app.render().handleGlobalTagsChange(['ohwx']);
    await app.attendi();
    dice('la trigger e\' nel riquadro e davanti su ogni foto', [['ohwx'], ['ohwx', 'smile'], ['ohwx', 'apple']],
        [app.stato.globalTriggers, app.fotoCon('A').tags, app.fotoCon('B').tags]);
    app.render().handleUndo();
    await app.attendi();
    dice('Ctrl+Z: le foto non hanno piu\' la trigger...', [['smile'], ['apple']], [app.fotoCon('A').tags, app.fotoCon('B').tags]);
    dice('...e nemmeno il riquadro', [], app.stato.globalTriggers);
    app.render().handleRedo();
    await app.attendi();
    dice('Ctrl+Shift+Z: torna sulle foto e nel riquadro', [['ohwx'], ['ohwx', 'smile']], [app.stato.globalTriggers, app.fotoCon('A').tags]);
}

console.log('\n--- si toglie la trigger "ohwx", poi Ctrl+Z: resta la prima nel .txt ---');
{
    const app = creaApp([foto('A', ['ohwx', 'apple'])], { trigger: ['ohwx'] });
    app.importa();
    await app.attendi();
    app.render().handleGlobalTagsChange([]);
    await app.attendi();
    dice('tolta: dalle foto e dal riquadro', [[], ['apple']], [app.stato.globalTriggers, app.fotoCon('A').tags]);
    app.render().handleUndo();
    await app.attendi();
    dice('Ctrl+Z: la trigger torna sulla foto e nel riquadro', [['ohwx'], ['ohwx', 'apple']], [app.stato.globalTriggers, app.fotoCon('A').tags]);
    dice('...e nel .txt resta la prima', 'ohwx, apple,', app.render().getOrderedTagString(app.fotoCon('A').tags));
}

console.log('\n--- quello che NON deve cambiare: trigger scritta prima dell\'import, Ctrl+Z oltre l\'import ---');
{
    const app = creaApp([foto('A', ['ohwx', 'smile'])]);
    app.render().handleGlobalTagsChange(['ohwx']);
    await app.attendi();
    app.importa();
    await app.attendi();
    app.render().handleUndo();
    await app.attendi();
    dice('la galleria torna vuota', 0, app.stato.images.length);
    dice('il riquadro tiene la trigger scritta prima dell\'import', ['ohwx'], app.stato.globalTriggers);
}

process.exit(esito());
