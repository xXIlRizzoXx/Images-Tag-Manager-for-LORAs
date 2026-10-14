/* ITALIANO: REGOLE PURE PER LA CHIUSURA DELLA FINESTRA (X, Alt+F4)
   Fuori da App.tsx perche' le prove (scripts/test-*.mjs) le possano eseguire da sole.
   ENGLISH: PURE RULES FOR CLOSING THE WINDOW (X, Alt+F4)
   Outside App.tsx so the tests (scripts/test-*.mjs) can run them on their own. */

import { costruisciBackup, type FotoChiusa } from './tagBackup';

// ITALIANO: ci sono modifiche che "Salva" scriverebbe? Stessa regola di handleCloseProject e di
//           handleSaveChanges: le foto nel cestino non si salvano, quindi non contano.
// ENGLISH: are there edits "Save" would write? Same rule as handleCloseProject and
//          handleSaveChanges: trashed photos are never saved, so they do not count.
export const modificheNonSalvate = (images: any[]): boolean =>
    images.some(img => !img.isTrashed && JSON.stringify(img.tags) !== JSON.stringify(img.originalTags));

// ITALIANO: scrive SUBITO il backup anti-crash, con le stesse regole dell'effetto che lo scrive
//           un secondo dopo l'ultima modifica. Serve alla chiusura della finestra: il timer di
//           quell'effetto muore con la pagina, e una modifica fatta meno di un secondo prima di
//           chiudere non finiva ne' nel .txt ne' nel backup.
// ENGLISH: writes the crash backup AT ONCE, with the same rules as the effect that writes it one
//          second after the last edit. Used when the window closes: that effect's timer dies with
//          the page, and an edit made less than a second before closing reached neither the .txt
//          nor the backup.
export const scriviBackupSubito = (storage: Storage, images: any[], chiuse: Iterable<FotoChiusa>, cartella: string): void => {
    try {
        const backup = costruisciBackup(images, chiuse, cartella);
        if (!backup) storage.removeItem('tagBackup');
        else storage.setItem('tagBackup', JSON.stringify({ ts: Date.now(), ...backup }));
    } catch (_) { /* best-effort: quota piena o storage assente non devono rompere l'app */ }
};
