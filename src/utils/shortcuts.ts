/******************************************************************************
*******************************************************************************
**                                                                            **
**  ITALIANO: SCORCIATOIE DA TASTIERA                                         **
**  Regola pura, senza React. Sta fuori da App.tsx perche' le prove la        **
**  possano eseguire da sola.                                                 **
**                                                                            **
**  ENGLISH: KEYBOARD SHORTCUTS                                               **
**  Pure rule, no React. It lives outside App.tsx so the tests can run it     **
**  on its own.                                                               **
**                                                                            **
*******************************************************************************
*******************************************************************************/

// ITALIANO: il tasto premuto e' la lettera `letter` di una scorciatoia (Ctrl+Z)? Vale la lettera
//   scritta sul tasto quando e' una lettera latina: cosi' su AZERTY e QWERTZ la Z resta dove la
//   tastiera la mette. Con una tastiera non latina (russa: Ctrl+Z manda "я") vale il tasto fisico
//   (`code`, "KeyZ"): prima Annulla e Ripeti non facevano niente, e non hanno un pulsante.
// ENGLISH: is the key pressed the letter `letter` of a shortcut (Ctrl+Z)? The letter printed on the
//   key counts when it is a Latin letter: so on AZERTY and QWERTZ Z stays where the keyboard puts
//   it. With a non-Latin keyboard (Russian: Ctrl+Z sends "я") the physical key (`code`, "KeyZ")
//   counts: Undo and Redo used to do nothing, and they have no button.
export const isLetterShortcut = (e: { key?: string; code?: string }, letter: string): boolean => {
    const tasto = String(e.key || '').toLowerCase();
    if (/^[a-z]$/.test(tasto)) return tasto === letter.toLowerCase();
    return e.code === 'Key' + letter.toUpperCase();
};
