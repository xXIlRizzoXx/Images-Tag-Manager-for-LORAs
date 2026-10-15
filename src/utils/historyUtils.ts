/******************************************************************************
*******************************************************************************
**                                                                            **
**  ITALIANO: CRONOLOGIA DI Ctrl+Z / Ctrl+Shift+Z                             **
**  Regola pura, senza React. Sta fuori da App.tsx perche' le prove la        **
**  possano eseguire da sola.                                                 **
**                                                                            **
**  ENGLISH: Ctrl+Z / Ctrl+Shift+Z HISTORY                                    **
**  Pure rule, no React. It lives outside App.tsx so the tests can run it     **
**  on its own.                                                               **
**                                                                            **
*******************************************************************************
*******************************************************************************/

// ITALIANO: Toglie da OGNI passo della cronologia le foto con questi id. Si usa quando i loro file
//   hanno lasciato il disco (Cestino di Windows o cancellazione definitiva): prima la cronologia
//   conservava la fotografia di un momento prima, e un Ctrl+Z le rimetteva nel cestino dell'app
//   mentre i file non c'erano piu'. Il numero dei passi non cambia, quindi l'indice del passo
//   attuale resta valido; la cronologia di partenza non viene toccata.
// ENGLISH: Removes the photos with these ids from EVERY step of the history. Used when their files
//   have left the disk (Windows Recycle Bin or permanent delete): the history used to keep the
//   snapshot from a moment before, and one Ctrl+Z put them back in the app's trash while the files
//   were gone. The number of steps does not change, so the index of the current step stays valid;
//   the history passed in is left untouched.
export const purgeIdsFromHistory = <T extends { id: string }>(history: T[][], ids: Set<string>): T[][] =>
    history.map(passo => passo.filter(foto => !ids.has(foto.id)));

// ITALIANO: Il passo dove porta Ctrl+Z (verso -1) o Ctrl+Shift+Z (verso +1): il piu' vicino che sia
//   DIVERSO da quello attuale, -1 se non ce n'e'. Due passi sono uguali quando hanno le stesse foto,
//   nello stesso posto (vedi sotto). Serve dopo purgeIdsFromHistory: il passo "A nel cestino",
//   tolta A, diventa identico a quello di prima, e un Ctrl+Z ci si fermava mostrando "Azione
//   annullata" senza cambiare niente (uno per ogni foto cestinata e poi svuotata).
// ENGLISH: The step Ctrl+Z (direction -1) or Ctrl+Shift+Z (direction +1) leads to: the nearest one
//   that is DIFFERENT from the current one, -1 if there is none. Two steps are equal when they hold
//   the same photos in the same place (see below). Needed after purgeIdsFromHistory: the step
//   "A in the trash", once A is removed, becomes identical to the one before, and a Ctrl+Z stopped
//   there showing "Action undone" without changing anything (one per photo trashed then emptied).
// ITALIANO: Due foto "uguali" sono quelle che Ctrl+Z mostrerebbe uguali: lo stesso oggetto, oppure
//   gli stessi campi con gli stessi valori, i tag confrontati uno per uno e originalTags ignorato
//   (lo rimette withLiveOriginalTags dal ricordo del disco). "Salva", il visualizzatore e l'editor
//   dei file di tag rifanno l'oggetto con il nuovo originalTags senza un passo nuovo: dopo
//   "modifica B, Salva, cestina A, Svuota cestino" i due passi restavano "diversi" per il solo
//   oggetto, e il primo Ctrl+Z diceva "Azione annullata" senza cambiare niente.
// ENGLISH: Two photos are "equal" when Ctrl+Z would show them the same: the same object, or the
//   same fields with the same values, the tags compared one by one and originalTags ignored
//   (withLiveOriginalTags puts it back from the disk record). "Save", the viewer and the tag file
//   editor rebuild the object with the new originalTags without a new step: after "edit B, Save,
//   trash A, Empty trash" the two steps stayed "different" only by the object, and the first
//   Ctrl+Z said "Action undone" without changing anything.
const stessaFotoASchermo = (a: any, b: any): boolean => {
    if (a === b) return true;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
    const campi = Object.keys(a).filter(k => k !== 'originalTags');
    if (campi.length !== Object.keys(b).filter(k => k !== 'originalTags').length) return false;
    return campi.every(k => Object.prototype.hasOwnProperty.call(b, k) && (a[k] === b[k]
        || (k === 'tags' && Array.isArray(a[k]) && Array.isArray(b[k]) && a[k].length === b[k].length
            && a[k].every((tg: unknown, i: number) => tg === b[k][i]))));
};
export const nearestDifferentStep = <T>(history: T[][], index: number, direction: 1 | -1): number => {
    const attuale = history[index] || [];
    const uguale = (passo: T[]) => passo.length === attuale.length && passo.every((foto, k) => stessaFotoASchermo(foto, attuale[k]));
    for (let j = index + direction; j >= 0 && j < history.length; j += direction) {
        if (!uguale(history[j])) return j;
    }
    return -1;
};

// ITALIANO: Il passo della cronologia da rimettere a schermo con Ctrl+Z / Ctrl+Shift+Z, ma con il
//   ricordo di cosa c'e' su disco (originalTags) preso da `suDisco`: id -> l'ultimo originalTags
//   noto, tenuto da App.tsx FUORI dalla cronologia (discoNotoRef). originalTags non e' una
//   modifica dell'utente: e' il contenuto del .txt, e un Ctrl+Z non disfa un file gia' scritto.
//   Prima tornava anche lui indietro: dopo "Salva" e due Ctrl+Z la foto mostrava i tag vecchi ma
//   risultava "uguale al disco", quindi Salva rispondeva "Nessuna modifica da salvare." e Chiudi
//   progetto non avvisava, mentre il .txt conteneva ancora i tag annullati. Il ricordo veniva
//   dalle sole foto in galleria, quindi una foto che in quel momento non c'era (Ctrl+Z oltre
//   l'import e poi Ctrl+Shift+Z, o chiusa con la X e riportata da Ctrl+Z) tornava con il valore
//   del suo passo, fermo all'import: lo stesso errore. Una foto che `suDisco` non conosce tiene il
//   valore del suo passo. Le foto che non cambiano restano lo STESSO oggetto, cosi' le card della
//   galleria non si ridisegnano per niente.
// ENGLISH: The history step to put back on screen with Ctrl+Z / Ctrl+Shift+Z, but with the record
//   of what is on disk (originalTags) taken from `suDisco`: id -> the last known originalTags, kept
//   by App.tsx OUTSIDE the history (discoNotoRef). originalTags is not a user edit: it is the
//   content of the .txt, and a Ctrl+Z does not undo a file already written. It used to roll back
//   too: after "Save" and two Ctrl+Z the photo showed the old tags yet counted as "same as disk",
//   so Save answered "No changes to save." and Close project gave no warning, while the .txt still
//   held the undone tags. The record came from the gallery's photos only, so a photo that was not
//   there at that moment (Ctrl+Z past the import then Ctrl+Shift+Z, or closed with the X and
//   brought back by Ctrl+Z) came back with its step's value, stuck at the import: the same fault.
//   A photo `suDisco` does not know keeps its step's value. Photos that do not change stay the
//   SAME object, so the gallery cards are not redrawn for nothing.
export const withLiveOriginalTags = <T extends { id: string; originalTags?: unknown }>(step: T[], suDisco: Map<string, unknown>): T[] =>
    step.map(foto => (suDisco.has(foto.id) && suDisco.get(foto.id) !== foto.originalTags
        ? { ...foto, originalTags: suDisco.get(foto.id) }
        : foto));
