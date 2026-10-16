/* ITALIANO: PROVA DI Ctrl+Z DURANTE "ELIMINA PER SEMPRE"
   Foto su una cartella di rete (il Cestino di Windows la rifiuta): "Svuota cestino" apre la
   seconda finestra, l'utente conferma, e mentre le foto si cancellano una per una ci ripensa e
   preme Ctrl+Z. Le foto tornavano in galleria come se niente fosse, ma il giro continuava sulla
   lista presa all'apertura della finestra: venivano cancellate PER SEMPRE lo stesso (niente
   Cestino di Windows), sparivano dalla galleria e il messaggio diceva "Foto eliminate per sempre:
   2.". La regola, la stessa di "Svuota cestino": ogni foto si guarda com'e' ADESSO, e una foto
   tornata in galleria non si tocca.
   Si eseguono i testi VERI presi da src/App.tsx (vedi trash-harness.mjs).
   Uso:  node scripts/test-delete-forever-undo.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF Ctrl+Z DURING "DELETE FOR GOOD"
   Photos on a network folder (the Windows Recycle Bin refuses it): "Empty trash" opens the second
   dialog, the user confirms, and while the photos are being deleted one by one they think again
   and press Ctrl+Z. The photos came back to the gallery as if nothing happened, but the loop went
   on over the list taken when the dialog opened: they were deleted FOR GOOD anyway (no Windows
   Recycle Bin), vanished from the gallery and the message said "Photos deleted for good: 2.". The
   rule, the same as "Empty trash": every photo is looked at as it is NOW, and a photo back in the
   gallery is not touched.
   The REAL code taken from src/App.tsx is run (see trash-harness.mjs).
   Usage:  node scripts/test-delete-forever-undo.mjs      (exits with code 1 if anything is off) */

import { creaApp, apiFinta, foto, cartellaFinta, t } from './trash-harness.mjs';
import { creaControlli } from './main-harness.mjs';

const { dice, esito } = creaControlli();

// ITALIANO: A e B su una cartella di rete, messe nel cestino dell'app; "Svuota" apre la seconda
//           finestra. `undo` = quanti Ctrl+Z premere dopo il primo file cancellato (0 = nessuno).
// ENGLISH: A and B on a network folder, put in the app's trash; "Empty" opens the second dialog.
//          `undo` = how many Ctrl+Z to press after the first file deleted (0 = none).
const prova = async (undo, { primaDiConfermare = 0 } = {}) => {
    const cart = cartellaFinta();
    const api = apiFinta({ esitoDi: () => 'rifiutato' });
    const app = creaApp([foto('A', { cestinata: false, cartella: cart }), foto('B', { cestinata: false, cartella: cart })], { api });
    app.cestina('A'); await app.attendi();
    app.cestina('B'); await app.attendi();
    await app.render().handleEmptyTrash(); await app.attendi();
    const finestra = app.stato.confirmDialog.isOpen;
    for (let i = 0; i < primaDiConfermare; i++) { app.render().handleUndo(); await app.attendi(); }
    const orig = cart.removeEntry;
    let fatto = false;
    cart.removeEntry = async (n) => {
        await orig(n);
        if (!fatto && undo > 0) {
            fatto = true;
            for (let i = 0; i < undo; i++) { app.render().handleUndo(); await app.attendi(); }
        }
    };
    await app.stato.confirmDialog.onConfirm(); await app.attendi();
    return { finestra, rimossi: [...cart.rimossi].sort(), vista: app.vista(), notifiche: app.notifiche.filter(([, tipo]) => tipo !== 'info') };
};

console.log('\n--- due Ctrl+Z mentre le foto si cancellano per sempre ---');
{
    const r = await prova(2);
    dice('la seconda finestra si era aperta', true, r.finestra);
    dice('B, tornata in galleria, non perde i suoi file', [], r.rimossi.filter(n => n.startsWith('B.')));
    dice('B resta in galleria, fuori dal cestino', true, r.vista.includes('B'));
    dice('il messaggio conta solo le foto cancellate davvero', [], r.notifiche.filter(([m]) => m.includes(t.deleteForGoodDone.replace('{done}', '2'))));
}

console.log('\n--- tutte e due tornate in galleria prima di confermare ---');
{
    const r = await prova(0, { primaDiConfermare: 2 });
    dice('nessun file cancellato', [], r.rimossi);
    dice('le due foto restano in galleria', ['A', 'B'], r.vista);
    dice('nessun "Foto eliminate per sempre: 0."', [], r.notifiche.filter(([m]) => m.includes(t.deleteForGoodDone.replace('{done}', '0'))));
}

console.log('\n--- quello che NON deve cambiare: nessun Ctrl+Z ---');
{
    const r = await prova(0);
    dice('le due foto si cancellano per sempre', ['A.png', 'A.txt', 'B.png', 'B.txt'], r.rimossi);
    dice('spariscono dalla galleria', [], r.vista);
    dice('il messaggio dice 2', [[t.deleteForGoodDone.replace('{done}', '2'), 'success']], r.notifiche);
}

process.exit(esito());
