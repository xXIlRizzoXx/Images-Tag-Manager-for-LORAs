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
// ITALIANO: il tasto fisico vale solo senza Alt. Su Windows AltGr arriva come Ctrl+Alt, e AltGr sul
//   tasto Z scrive un carattere (polacca "ż", ungherese ">"): prima diventava Annulla.
// ENGLISH: the physical key counts only without Alt. On Windows AltGr arrives as Ctrl+Alt, and AltGr
//   on the Z key types a character (Polish "ż", Hungarian ">"): it used to become Undo.
export const isLetterShortcut = (e: { key?: string; code?: string; altKey?: boolean }, letter: string): boolean => {
    const tasto = String(e.key || '').toLowerCase();
    if (/^[a-z]$/.test(tasto)) return tasto === letter.toLowerCase();
    return !e.altKey && e.code === 'Key' + letter.toUpperCase();
};

// ITALIANO: il fuoco e' in un campo dove si scrive testo? Li' Ctrl+Z annulla il testo e la scorciatoia
//   del progetto si fa da parte. Un <input> che non scrive testo (il cursore dello zoom "range", una
//   casella di spunta, un pulsante) non ha niente da annullare: dopo aver trascinato lo zoom Ctrl+Z
//   restava muto finche' non si cliccava altrove. Un <input> senza tipo vale come testo.
// ENGLISH: is the focus in a field where text is typed? There Ctrl+Z undoes the text and the
//   project's shortcut steps aside. An <input> that types no text (the "range" zoom slider, a
//   checkbox, a button) has nothing to undo: after dragging the zoom Ctrl+Z stayed silent until a
//   click elsewhere. An <input> with no type counts as text.
const INPUT_SENZA_TESTO = new Set(['range', 'checkbox', 'radio', 'button', 'submit', 'reset', 'color', 'file', 'image']);
export const isTextEditingElement = (el: { tagName?: string; type?: string; isContentEditable?: boolean } | null | undefined): boolean => {
    if (!el) return false;
    if (el.isContentEditable) return true;
    const tag = String(el.tagName || '').toUpperCase();
    if (tag === 'TEXTAREA') return true;
    if (tag !== 'INPUT') return false;
    return !INPUT_SENZA_TESTO.has(String(el.type || '').toLowerCase());
};

// ITALIANO: il fuoco e' in un campo di testo che ha del testo da annullare? Un <input> o una
//   <textarea> VUOTI no: dopo Invio la casella dei tag si svuota e tiene il fuoco, e Ctrl+Z restava
//   muto finche' non si cliccava altrove. Un elemento contenteditable conta sempre (per prudenza), e
//   anche un campo senza `value` di tipo testo. Limite noto: chi cancella tutto il testo con Backspace
//   e preme Ctrl+Z annulla l'ultima azione del progetto invece di riavere il testo.
// ENGLISH: is the focus in a text field that has text to undo? An EMPTY <input> or <textarea> does
//   not: after Enter the tag box empties and keeps the focus, and Ctrl+Z stayed silent until a click
//   elsewhere. A contenteditable element always counts (to be safe), and so does a field whose
//   `value` is not a string. Known limit: someone who deletes all the text with Backspace and presses
//   Ctrl+Z undoes the project's last action instead of getting the text back.
export const isTextEditingWithText = (el: { tagName?: string; type?: string; isContentEditable?: boolean; value?: unknown } | null | undefined): boolean => {
    if (!isTextEditingElement(el)) return false;
    if (el!.isContentEditable) return true;
    return !(typeof el!.value === 'string' && el!.value === '');
};
