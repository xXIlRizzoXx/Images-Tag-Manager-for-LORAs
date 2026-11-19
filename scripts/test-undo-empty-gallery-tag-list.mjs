/* ITALIANO: PROVA DELL'ELENCO DEI TAG DEL PROGETTO CAMBIATO A GALLERIA VUOTA
   Ogni cambio del solo elenco dei tag del progetto diventa un passo della cronologia. A galleria
   vuota quel passo era vuoto e inutile (Ctrl+Z non ci si ferma mai), ma faceva due danni:
   1) dopo un Ctrl+Z di troppo (galleria vuota, Ctrl+Shift+Z riporta tutto) un tag scritto
      nell'elenco, «Pulisci tag inutilizzati» o un file aperto nell'editor dei file di tag
      tagliavano i passi da rifare: le foto e le loro modifiche non salvate non tornavano piu';
   2) un tag aggiunto PRIMA di caricare le foto lasciava un passo vuoto fra la galleria iniziale e
      l'import, che «Annulla lo svuotamento» poi riempiva con la sola foto tornata.
   Ora a galleria vuota il cambio dell'elenco non crea un passo: l'import dopo lo registra nel suo.
   Si eseguono i testi VERI di src/App.tsx con il banco di prova scripts/undo-harness.mjs.
   Uso:  node scripts/test-undo-empty-gallery-tag-list.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE PROJECT TAG LIST CHANGED WITH AN EMPTY GALLERY
   Every change of the project tag list alone becomes a history step. With an empty gallery that
   step was empty and useless (Ctrl+Z never stops there), but it did two kinds of harm:
   1) after one Ctrl+Z too many (empty gallery, Ctrl+Shift+Z brings everything back) a tag typed in
      the list, "Clean unused tags" or a file opened in the tag file editor cut the steps to redo:
      the photos and their unsaved edits never came back;
   2) a tag added BEFORE loading the photos left an empty step between the initial gallery and the
      import, which "Undo the emptying" then filled with the returned photo alone.
   Now with an empty gallery the list change makes no step: the import after records it in its own.
   The REAL texts of src/App.tsx run on the scripts/undo-harness.mjs bench.
   Usage:  node scripts/test-undo-empty-gallery-tag-list.mjs      (exits with code 1 if anything is off) */

import { creaControlli } from './main-harness.mjs';
import { creaApp, foto } from './undo-harness.mjs';

const { dice, esito } = creaControlli();
const undo = async (r) => { r.render().handleUndo(); await r.attendi(); };
const redo = async (r) => { r.render().handleRedo(); await r.attendi(); };
const schermo = (r) => r.stato.images.map(f => f.id + ':' + f.tags.join('+'));

console.log('\n--- Ctrl+Z oltre l\'import, poi un tag nell\'elenco, poi Ctrl+Shift+Z ---');
{
    const r = creaApp([foto('a', ['ohwx']), foto('b', ['ohwx'])]);
    r.importa(); await r.attendi();
    r.modifica(prev => prev.map(f => f.id === 'a' ? { ...f, tags: [...f.tags, 'hat'] } : f)); await r.attendi();
    await undo(r); await undo(r);
    dice('premessa: due Ctrl+Z, galleria vuota', [], schermo(r));
    r.aggiungiAlProgetto('foo'); await r.attendi();
    dice('il tag scritto a galleria vuota non taglia i passi da rifare', 3, r.stato.history.length);
    await redo(r); await redo(r);
    dice('due Ctrl+Shift+Z: le foto tornano con la modifica non salvata', ['a:ohwx+hat', 'b:ohwx'], schermo(r));
    // ITALIANO: e «foo» resta nell'elenco: prima ogni Ctrl+Shift+Z rimetteva l'elenco salvato nel passo,
    //           che «foo» non l'aveva, e il tag spariva senza avviso.
    // ENGLISH: and "foo" stays in the list: every Ctrl+Shift+Z used to put back the list saved in the step,
    //          which did not have "foo", and the tag vanished with no notice.
    dice('due Ctrl+Shift+Z: «foo» resta nell\'elenco dei tag del progetto', ['foo'], r.stato.customProjectTags);
    await undo(r);
    dice('un Ctrl+Z dopo: «foo» resta ancora', ['foo'], r.stato.customProjectTags);
}

console.log('\n--- «Pulisci tag inutilizzati» a galleria vuota, un tag nuovo, poi Ctrl+Shift+Z ---');
{
    // ITALIANO: anche un tag TOLTO a galleria vuota resta tolto: l'elenco scritto dopo l'ultimo passo vale.
    // ENGLISH: a tag REMOVED with an empty gallery stays removed too: the list written after the last step wins.
    const r = creaApp([foto('a', ['ohwx'])]);
    r.aggiungiAlProgetto('vecchio'); await r.attendi();
    r.importa(); await r.attendi();
    r.modifica(prev => prev.map(f => ({ ...f, tags: [...f.tags, 'hat'] }))); await r.attendi();
    await undo(r); await undo(r);
    dice('premessa: galleria vuota, l\'elenco ha «vecchio»', [[], ['vecchio']], [schermo(r), r.stato.customProjectTags]);
    r.render().handleCleanUnusedTags(); await r.attendi();
    r.aggiungiAlProgetto('nuovo'); await r.attendi();
    dice('premessa: l\'elenco ora ha solo «nuovo»', ['nuovo'], r.stato.customProjectTags);
    await redo(r); await redo(r);
    dice('due Ctrl+Shift+Z: le foto tornano e l\'elenco resta quello scritto dopo', [['a:ohwx+hat'], ['nuovo']], [schermo(r), r.stato.customProjectTags]);
}

console.log('\n--- tag aggiunto all\'elenco PRIMA di caricare le foto ---');
{
    const r = creaApp([foto('a', ['ohwx'])]);
    r.aggiungiAlProgetto('pre'); await r.attendi();
    dice('nessun passo vuoto in piu\' prima dell\'import', 1, r.stato.history.length);
    r.importa(); await r.attendi();
    dice('cronologia: galleria vuota, poi l\'import', [[], ['a']], r.stato.history.map(p => p.map(f => f.id)));
    dice('il passo dell\'import ricorda l\'elenco con «pre»', ['pre'], r.refs.customTagsHistoryRef.current[r.stato.historyIndex]);
    await undo(r);
    dice('Ctrl+Z fino a prima dell\'import: la galleria si svuota, l\'elenco resta', [[], ['pre']], [r.stato.images, r.stato.customProjectTags]);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    // ITALIANO: a galleria piena il cambio del solo elenco resta un passo, e Ctrl+Z lo toglie.
    // ENGLISH: with photos in the gallery a list-only change is still a step, and Ctrl+Z removes it.
    const r = creaApp([foto('a', ['ohwx'])]);
    r.importa(); await r.attendi();
    const passi = r.stato.history.length;
    r.aggiungiAlProgetto('foo'); await r.attendi();
    dice('galleria piena: il tag dell\'elenco e\' un passo', passi + 1, r.stato.history.length);
    await undo(r);
    dice('Ctrl+Z toglie «foo», la foto resta', [['a:ohwx'], []], [schermo(r), r.stato.customProjectTags]);
}

process.exit(esito());
