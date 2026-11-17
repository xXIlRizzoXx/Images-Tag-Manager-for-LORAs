/* ITALIANO: PROVA DI Ctrl+Z SULL'ELENCO DEI TAG DEL PROGETTO («Visualizza tutti i tag»)
   La cronologia ricordava solo le foto e il riquadro delle trigger, non l'elenco dei tag del
   progetto. La X su un tag che c'era solo nell'elenco creava un passo con le stesse foto: Ctrl+Z lo
   saltava e annullava la modifica di PRIMA (via «hat» dalla foto), mentre il tag tolto non tornava;
   «Pulisci tag inutilizzati» non creava nessun passo; dopo «Elimina tutti i tag» Ctrl+Z rimetteva i
   tag sulle foto ma l'elenco restava vuoto. Ora ogni passo ricorda anche l'elenco, ogni cambio
   dell'elenco e' un passo, e Ctrl+Z / Ctrl+Shift+Z lo rimettono come le trigger (non quando si torna
   alla galleria vuota di prima dell'import).
   Si eseguono i testi VERI di src/App.tsx con il banco di prova scripts/undo-harness.mjs.
   Uso:  node scripts/test-undo-project-tag-list.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF Ctrl+Z ON THE PROJECT TAG LIST ("View all tags")
   The history remembered only the photos and the trigger box, not the project tag list. The X on a
   tag that was only in the list made a step with the same photos: Ctrl+Z skipped it and undid the
   edit BEFORE it ("hat" off the photo), while the removed tag did not come back; "Clean unused tags"
   made no step at all; after "Delete all tags" Ctrl+Z put the tags back on the photos but the list
   stayed empty. Now every step remembers the list too, every list change is a step, and Ctrl+Z /
   Ctrl+Shift+Z put it back like the triggers (not when going back to the empty gallery before the
   import).
   The REAL texts of src/App.tsx run on the scripts/undo-harness.mjs bench.
   Usage:  node scripts/test-undo-project-tag-list.mjs      (exits with code 1 if anything is off) */

import { creaControlli } from './main-harness.mjs';
import { creaApp, foto } from './undo-harness.mjs';

const { dice, esito } = creaControlli();

// ITALIANO: una foto aperta con «ohwx», poi «hat» aggiunto (il passo da NON annullare per sbaglio).
// ENGLISH: a photo opened with "ohwx", then "hat" added (the step NOT to undo by mistake).
const avvia = async (elencoDopo = []) => {
    const r = creaApp([foto('a', ['ohwx'])]);
    r.importa(); await r.attendi();
    for (const tag of elencoDopo) { r.aggiungiAlProgetto(tag); await r.attendi(); }
    r.modifica(prev => prev.map(f => ({ ...f, tags: [...f.tags, 'hat'] }))); await r.attendi();
    return r;
};
const stato = (r) => ({ elenco: r.stato.customProjectTags, foto: r.fotoCon('a') ? r.fotoCon('a').tags : null });
const undo = async (r) => { r.render().handleUndo(); await r.attendi(); };
const redo = async (r) => { r.render().handleRedo(); await r.attendi(); };

console.log('\n--- X su «foo» (solo nell\'elenco), poi Ctrl+Z ---');
{
    const r = await avvia(['foo']);
    r.render().handleDeleteTagFromProject('foo'); await r.attendi();
    dice('premessa: «foo» tolto dall\'elenco, la foto ha ancora «hat»', { elenco: [], foto: ['ohwx', 'hat'] }, stato(r));
    await undo(r);
    dice('Ctrl+Z: «foo» torna nell\'elenco e la foto resta com\'era', { elenco: ['foo'], foto: ['ohwx', 'hat'] }, stato(r));
    await redo(r);
    dice('Ctrl+Shift+Z: «foo» se ne va di nuovo, «hat» resta', { elenco: [], foto: ['ohwx', 'hat'] }, stato(r));
}

console.log('\n--- «Pulisci tag inutilizzati», poi Ctrl+Z ---');
{
    const r = await avvia(['foo', 'bar']);
    r.render().handleCleanUnusedTags(); await r.attendi();
    dice('premessa: l\'elenco e\' vuoto', [], r.stato.customProjectTags);
    await undo(r);
    dice('Ctrl+Z: l\'elenco torna, la foto non cambia', { elenco: ['foo', 'bar'], foto: ['ohwx', 'hat'] }, stato(r));
}

console.log('\n--- «Elimina tutti i tag», poi Ctrl+Z e Ctrl+Shift+Z ---');
{
    const r = await avvia(['foo', 'bar']);
    r.render().handleDeleteAllTags(); await r.attendi();
    r.stato.confirmDialog.onConfirm(); await r.attendi();
    dice('premessa: foto ed elenco vuoti', { elenco: [], foto: [] }, stato(r));
    await undo(r);
    dice('Ctrl+Z: tornano i tag della foto E l\'elenco', { elenco: ['foo', 'bar'], foto: ['ohwx', 'hat'] }, stato(r));
    await redo(r);
    dice('Ctrl+Shift+Z: di nuovo tutto vuoto', { elenco: [], foto: [] }, stato(r));
}

console.log('\n--- quello che NON deve cambiare ---');
{
    // ITALIANO: un tag aggiunto all'elenco PRIMA di una modifica alla foto: Ctrl+Z annulla la modifica e
    //           il tag resta (prima di questa correzione restava, e deve restare).
    // ENGLISH: a tag added to the list BEFORE a photo edit: Ctrl+Z undoes the edit and the tag stays
    //          (before this fix it stayed, and it must stay).
    const r = await avvia(['foo']);
    await undo(r);
    dice('Ctrl+Z dopo «aggiungi foo, poi hat»: via «hat», «foo» resta', { elenco: ['foo'], foto: ['ohwx'] }, stato(r));
    await undo(r);
    dice('un altro Ctrl+Z annulla l\'aggiunta di «foo»', { elenco: [], foto: ['ohwx'] }, stato(r));
}
{
    // ITALIANO: tag del progetto importati PRIMA delle foto: tornare alla galleria vuota non li toglie.
    // ENGLISH: project tags imported BEFORE the photos: going back to the empty gallery does not drop them.
    const r = creaApp([foto('a', ['ohwx'])]);
    r.aggiungiAlProgetto('pre'); await r.attendi();
    r.importa(); await r.attendi();
    await undo(r);
    dice('Ctrl+Z fino a prima dell\'import: la galleria si svuota, l\'elenco resta', [[], ['pre']], [r.stato.images, r.stato.customProjectTags]);
}
{
    const r = await avvia();
    await undo(r);
    dice('solo modifiche alle foto: Ctrl+Z come sempre', { elenco: [], foto: ['ohwx'] }, stato(r));
    await redo(r);
    dice('...e Ctrl+Shift+Z', { elenco: [], foto: ['ohwx', 'hat'] }, stato(r));
}

process.exit(esito());
