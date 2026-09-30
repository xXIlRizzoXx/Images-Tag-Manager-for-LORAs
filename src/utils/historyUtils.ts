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

// ITALIANO: Il passo della cronologia da rimettere a schermo con Ctrl+Z / Ctrl+Shift+Z, ma con il
//   ricordo di cosa c'e' su disco (originalTags) preso dalle foto di ADESSO. originalTags non e' una
//   modifica dell'utente: e' il contenuto del .txt, e un Ctrl+Z non disfa un file gia' scritto.
//   Prima tornava anche lui indietro: dopo "Salva" e due Ctrl+Z la foto mostrava i tag vecchi ma
//   risultava "uguale al disco", quindi Salva rispondeva "Nessuna modifica da salvare." e Chiudi
//   progetto non avvisava, mentre il .txt conteneva ancora i tag annullati. Una foto che adesso non
//   c'e' (chiusa con la X e riportata da Ctrl+Z) tiene il valore del suo passo, che e' giusto
//   perche' dopo la chiusura non si puo' salvare. Le foto che non cambiano restano lo STESSO
//   oggetto, cosi' le card della galleria non si ridisegnano per niente.
// ENGLISH: The history step to put back on screen with Ctrl+Z / Ctrl+Shift+Z, but with the record
//   of what is on disk (originalTags) taken from the photos as they are NOW. originalTags is not a
//   user edit: it is the content of the .txt, and a Ctrl+Z does not undo a file already written.
//   It used to roll back too: after "Save" and two Ctrl+Z the photo showed the old tags yet counted
//   as "same as disk", so Save answered "No changes to save." and Close project gave no warning,
//   while the .txt still held the undone tags. A photo that is not there now (closed with the X and
//   brought back by Ctrl+Z) keeps the value of its step, which is right because a closed photo
//   cannot be saved. Photos that do not change stay the SAME object, so the gallery cards are not
//   redrawn for nothing.
export const withLiveOriginalTags = <T extends { id: string; originalTags?: unknown }>(step: T[], live: T[]): T[] => {
    const suDisco = new Map(live.map(foto => [foto.id, foto.originalTags]));
    return step.map(foto => (suDisco.has(foto.id) && suDisco.get(foto.id) !== foto.originalTags
        ? { ...foto, originalTags: suDisco.get(foto.id) }
        : foto));
};
