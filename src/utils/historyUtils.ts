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
