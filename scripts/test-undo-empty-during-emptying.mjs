/* ITALIANO: PROVA DI "ANNULLA LO SVUOTAMENTO" PREMUTO MENTRE UNO SVUOTAMENTO E' IN CORSO
   Dopo un primo svuotamento (foto X) l'utente cestina A e B e preme "Svuota cestino". Mentre i
   file si spostano preme Ctrl+Z: A e B tornano in galleria, il cestino dell'app resta vuoto e
   compare il riquadro "cestino vuoto" col suo tasto "Annulla lo svuotamento", che era spento solo
   durante un ripescaggio, non durante uno svuotamento (quello in alto li guardava tutti e due).
   Premuto, ripescava X; finito lo svuotamento, l'anteprima di X - che stava tornando - veniva
   liberata (immagine rotta), e finito l'annullamento il ricordo del nuovo svuotamento (A) veniva
   cancellato: A restava nel Cestino di Windows senza piu' un "Annulla". La regola: durante uno
   svuotamento "Annulla lo svuotamento" e' spento in tutti e due i posti, e se arriva lo stesso non
   fa niente.
   Si eseguono i testi VERI presi da src/App.tsx (vedi trash-harness.mjs).
   Uso:  node scripts/test-undo-empty-during-emptying.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF "UNDO THE EMPTYING" PRESSED WHILE AN EMPTYING IS RUNNING
   After a first emptying (photo X) the user trashes A and B and presses "Empty trash". While the
   files are moving they press Ctrl+Z: A and B go back to the gallery, the app's trash is empty and
   the "trash empty" block shows its own "Undo the emptying" button, which was disabled only during
   a restore, not during an emptying (the one at the top checked both). Pressed, it fished X back;
   when the emptying ended, the thumbnail of X - on its way back - was released (broken image), and
   when the undo ended the record of the new emptying (A) was erased: A stayed in the Windows
   Recycle Bin with no "Undo" any more. The rule: during an emptying "Undo the emptying" is
   disabled in both places, and if it gets through anyway it does nothing.
   The REAL code taken from src/App.tsx is run (see trash-harness.mjs).
   Usage:  node scripts/test-undo-empty-during-emptying.mjs      (exits with code 1 if anything is off) */

import { creaApp, apiFinta, foto, percorsoImg, sorgenteApp } from './trash-harness.mjs';
import { creaControlli } from './main-harness.mjs';

const { dice, esito } = creaControlli();
const ricordo = (app) => (app.stato.ultimoSvuotamento?.voci || []).map(v => v.img.id);

console.log('\n--- svuotamento in corso, Ctrl+Z, poi "Annulla lo svuotamento" (PowerShell lento) ---');
{
    let app = null;
    let fase = 0;
    let annulla = null;
    let libera = null;
    let ripristiniDurante = -1;
    const api = apiFinta({
        prima: async (p) => {
            if (fase === 1 && p === percorsoImg('A')) {
                fase = 2;
                app.render().handleUndo();
                await app.attendi(2);
                const prima = api.ripristini.length;
                annulla = app.render().annullaSvuotamento();
                await app.attendi(2);
                ripristiniDurante = api.ripristini.length - prima;
            }
        },
        ripristino: (ps) => {
            const r = { results: ps.map(p => ({ percorso: p, esito: 'ok' })) };
            if (fase < 2 || ps[0].endsWith('.txt')) return r;
            return new Promise(ok => { libera = () => ok(r); });
        },
    });
    app = creaApp([foto('X'), foto('A', { cestinata: false }), foto('B', { cestinata: false })], { api });
    await app.render().handleEmptyTrash();
    await app.attendi();
    dice('premessa: il primo svuotamento (X) si puo\' annullare', ['X'], ricordo(app));
    app.modifica(prev => prev.map(i => (i.id === 'A' || i.id === 'B') ? { ...i, isTrashed: true } : i));
    await app.attendi();
    fase = 1;
    await app.render().handleEmptyTrash();
    await app.attendi();
    if (libera) libera();
    if (annulla) await annulla;
    await app.attendi(10);
    dice('"Annulla lo svuotamento" durante lo svuotamento non chiede niente al Cestino di Windows', 0, ripristiniDurante);
    dice('il ricordo dello svuotamento nuovo (A, gia\' nel Cestino di Windows) resta', ['A'], ricordo(app));
    dice('nessuna foto del progetto ha un\'anteprima liberata', [],
        app.stato.images.filter(i => app.revocati.includes(i.thumb)).map(i => i.id));
}

console.log('\n--- src/App.tsx: i due tasti "Annulla lo svuotamento" ---');
{
    // ITALIANO: ogni <button> che chiama annullaSvuotamento, con la sua espressione `disabled`.
    // ENGLISH: every <button> that calls annullaSvuotamento, with its `disabled` expression.
    const tasti = [...sorgenteApp.matchAll(/onClick=\{annullaSvuotamento\}\s*disabled=\{([^}]*)\}/g)].map(m => m[1]);
    dice('ci sono due tasti, in alto e nel riquadro "cestino vuoto"', 2, tasti.length);
    dice('tutti e due sono spenti durante un ripescaggio E durante uno svuotamento', [true, true].slice(0, tasti.length),
        tasti.map(d => /\bripristinoInCorso\b/.test(d) && /\bisEmptyingTrash\b/.test(d)));
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const api = apiFinta();
    const app = creaApp([foto('A'), foto('B')], { api });
    await app.render().handleEmptyTrash();
    await app.attendi();
    await app.render().annullaSvuotamento();
    await app.attendi();
    dice('a svuotamento finito "Annulla lo svuotamento" funziona come sempre', ['A(cestino)', 'B(cestino)'], app.vista().sort());
    dice('e non resta niente da ripescare', [], ricordo(app));
}

process.exit(esito());
