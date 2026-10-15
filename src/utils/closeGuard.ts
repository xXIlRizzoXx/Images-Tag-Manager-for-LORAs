/* ITALIANO: REGOLE PURE PER LA CHIUSURA DELLA FINESTRA (X, Alt+F4)
   Fuori da App.tsx perche' le prove (scripts/test-*.mjs) le possano eseguire da sole.
   ENGLISH: PURE RULES FOR CLOSING THE WINDOW (X, Alt+F4)
   Outside App.tsx so the tests (scripts/test-*.mjs) can run them on their own. */

import { costruisciBackup, type FotoChiusa } from './tagBackup';
import { fotoDaSalvare } from './sidecarTags';

// ITALIANO: la regola sta in sidecarTags.ts (la usa anche il backup anti-crash); qui la si ripete.
// ENGLISH: the rule lives in sidecarTags.ts (the crash backup uses it too); it is re-exported here.
export { fotoDaSalvare };

// ITALIANO: ci sono modifiche che "Salva" scriverebbe? Stessa regola di handleCloseProject e di
//           handleSaveChanges: le foto nel cestino non si salvano, quindi non contano.
// ENGLISH: are there edits "Save" would write? Same rule as handleCloseProject and
//          handleSaveChanges: trashed photos are never saved, so they do not count.
export const modificheNonSalvate = (images: any[], triggers: string[] = []): boolean =>
    images.some(img => !img.isTrashed && fotoDaSalvare(img, triggers));

// ITALIANO: scrive SUBITO il backup anti-crash, con le stesse regole dell'effetto che lo scrive
//           un secondo dopo l'ultima modifica. Serve alla chiusura della finestra: il timer di
//           quell'effetto muore con la pagina, e una modifica fatta meno di un secondo prima di
//           chiudere non finiva ne' nel .txt ne' nel backup.
// ENGLISH: writes the crash backup AT ONCE, with the same rules as the effect that writes it one
//          second after the last edit. Used when the window closes: that effect's timer dies with
//          the page, and an edit made less than a second before closing reached neither the .txt
//          nor the backup.
// ITALIANO: il backup gia' salvato entra nel calcolo: le sorgenti delle cartelle non ancora
//           riaperte dopo un crash restano (vedi costruisciBackup, punto 4).
// ENGLISH: the backup already stored goes into the computation: the sources of folders not yet
//          reopened after a crash stay (see costruisciBackup, point 4).
// ITALIANO: `triggers` = le trigger word attive: servono alla regola delle foto col .txt non letto
//           (vedi fotoDaSalvare), che non devono entrare nel backup per una trigger.
// ENGLISH: `triggers` = the active trigger words: needed by the rule for photos whose .txt was not
//          read (see fotoDaSalvare), which must not enter the backup because of a trigger.
// ITALIANO: `lottiSessione` = i lotti di import entrati in memoria in QUESTA sessione (App.tsx ne
//           tiene uno per tutta la vita della pagina): qui si aggiungono quelli delle foto di adesso.
//           Una sorgente salvata con uno di questi lotti, che in memoria non c'e' piu', l'ha buttata
//           via l'utente (Ctrl+Z oltre l'import), non un crash: cade (vedi sorgentiDaTenere).
// ENGLISH: `lottiSessione` = the import batches that entered memory in THIS session (App.tsx keeps
//          one for the page's whole life): the batches of the current photos are added here. A
//          stored source with one of these batches that is no longer in memory was thrown away by
//          the user (Ctrl+Z past the import), not by a crash: it is dropped (see sorgentiDaTenere).
export const scriviBackupSubito = (storage: Storage, images: any[], chiuse: Iterable<FotoChiusa>, cartella: string, triggers: string[] = [], lottiSessione: Set<string> | null = null): void => {
    try {
        const sessione = lottiSessione instanceof Set ? lottiSessione : null;
        if (sessione) for (const img of images) if (img && img.lottoImport) sessione.add(String(img.lottoImport));
        const backup = costruisciBackup(images, chiuse, cartella, storage.getItem('tagBackup'), triggers, sessione);
        if (!backup) storage.removeItem('tagBackup');
        else storage.setItem('tagBackup', JSON.stringify({ ts: Date.now(), ...backup }));
    } catch (_) { /* best-effort: quota piena o storage assente non devono rompere l'app */ }
};

// ITALIANO: il backup anti-crash quando si chiude il progetto (Chiudi progetto, Salva e chiudi,
//           Chiudi senza salvare). Le cartelle in memoria escono dal backup con tutte le loro
//           modifiche (salvate o buttate via: "Chiudi senza salvare" non le deve far tornare), ma le
//           sorgenti di cartelle mai riaperte dopo un crash restano. Prima il backup si cancellava
//           tutto: dopo un crash con due cartelle, riaprire e chiudere la prima cancellava in
//           silenzio le modifiche della seconda. I tag di ogni foto si guardano come se fossero
//           quelli del disco: cosi' le cartelle aperte non scrivono niente, e la loro impronta (foto
//           chiuse con la X comprese) toglie le loro vecchie sorgenti. Solo Reset cancella tutto.
// ENGLISH: the crash backup when the project is closed (Close project, Save and close, Close
//          without saving). The folders in memory leave the backup with all their edits (saved or
//          thrown away: "Close without saving" must not bring them back), but the sources of
//          folders never reopened after a crash stay. The whole backup used to be removed: after a
//          crash with two folders, reopening and closing the first silently deleted the second's
//          edits. Each photo's tags are looked at as if they were the disk's: so the open folders
//          write nothing, and their fingerprint (photos closed with the X included) drops their old
//          sources. Only Reset removes everything.
export const backupDopoChiusura = (storage: Storage, images: any[], chiuse: Iterable<FotoChiusa>): void => {
    scriviBackupSubito(storage, images.map(img => ({ ...img, tags: img.originalTags })), chiuse, '');
};
