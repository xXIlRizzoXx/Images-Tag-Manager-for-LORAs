/* ITALIANO: PROVA DI "SVUOTA CESTINO" QUANDO SERVE ANCHE LA SECONDA FINESTRA
   Se alcune foto non potevano andare nel Cestino di Windows (cartella di rete, anteprima nel
   browser), lo svuotamento apriva la seconda finestra ("la cancellazione e' definitiva") e si
   fermava li': le foto che non si erano potute spostare (file bloccato) non venivano mai
   nominate, quelle finite nel Cestino di Windows nemmeno, e confermando compariva "Foto
   eliminate per sempre: 1." in verde, con la finestra del cestino chiusa mentre la foto bloccata
   c'era ancora dentro. Annullando, le foto spostate sparivano senza una parola. La regola: il
   messaggio finale dice anche com'e' andata la prima parte, e la finestra si chiude solo se il
   cestino e' davvero vuoto (anche dopo la X su una sola foto).
   Si eseguono i testi VERI presi da src/App.tsx (vedi trash-harness.mjs).
   Uso:  node scripts/test-empty-trash-second-dialog.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF "EMPTY TRASH" WHEN THE SECOND DIALOG IS NEEDED TOO
   When some photos could not go to the Windows Recycle Bin (network folder, browser preview),
   emptying opened the second dialog ("the delete is final") and stopped there: the photos that
   could not be moved (locked file) were never named, the ones that reached the Windows Recycle
   Bin neither, and confirming showed "Photos deleted for good: 1." in green, with the trash window
   closed while the locked photo was still inside. On cancel, the moved photos vanished without a
   word. The rule: the final message also says how the first part went, and the window closes only
   when the trash is really empty (after the X on a single photo too).
   The REAL code taken from src/App.tsx is run (see trash-harness.mjs).
   Usage:  node scripts/test-empty-trash-second-dialog.mjs      (exits with code 1 if anything is off) */

import { creaApp, apiFinta, foto, cartellaFinta, percorsoImg, t } from './trash-harness.mjs';
import { creaControlli } from './main-harness.mjs';

const { dice, esito } = creaControlli();
const frase = (chiave, done, failed) => t[chiave].replace('{done}', String(done)).replace('{failed}', String(failed));

// ITALIANO: A su una cartella di rete (il Cestino di Windows la rifiuta, la cartella e' aperta),
//           B bloccata, C normale: si sceglie quali mettere nel cestino dell'app.
// ENGLISH: A on a network folder (the Windows Recycle Bin refuses it, the folder is open), B
//          locked, C normal: pick which ones go to the app's trash.
const prepara = async (quali) => {
    const cartella = cartellaFinta();
    const api = apiFinta({
        esitoDi: (p) => (p === percorsoImg('A') ? 'rifiutato' : p === percorsoImg('B') ? 'errore' : 'ok'),
    });
    const app = creaApp(quali.map(id => foto(id, { cartella: id === 'A' ? cartella : null })), { api });
    await app.render().handleEmptyTrash();
    await app.attendi();
    return { app, cartella };
};

console.log('\n--- A di rete + B bloccata: si conferma la cancellazione definitiva di A ---');
{
    const { app, cartella } = await prepara(['A', 'B']);
    dice('si apre la seconda finestra', true, app.stato.confirmDialog.isOpen);
    await app.stato.confirmDialog.onConfirm();
    await app.attendi();
    dice('A cancellata per sempre', true, cartella.rimossi.includes('A.png'));
    dice('B resta nel cestino dell\'app', ['B(cestino)'], app.vista());
    dice('la finestra del cestino resta aperta: B e\' ancora dentro', true, app.stato.isTrashOpen);
    dice('il messaggio dice anche di B, ed e\' un errore',
        [frase('deletePartial', 0, 1) + ' · ' + frase('deleteForGoodDone', 1, 0), 'error'], app.notifiche[app.notifiche.length - 1]);
}

console.log('\n--- A di rete + C spostata nel Cestino di Windows: si annulla la seconda finestra ---');
{
    const { app } = await prepara(['A', 'C']);
    app.stato.confirmDialog.onCancel();
    await app.attendi();
    dice('A resta nel cestino dell\'app', ['A(cestino)'], app.vista());
    dice('si dice che C e\' andata nel Cestino di Windows', [[t.deleteSuccess, 'success']], app.notifiche);
}

console.log('\n--- A di rete + C spostata nel Cestino di Windows: si conferma ---');
{
    const { app } = await prepara(['A', 'C']);
    await app.stato.confirmDialog.onConfirm();
    await app.attendi();
    dice('il cestino e\' vuoto', [], app.vista());
    dice('il messaggio dice le due cose', [[t.deleteSuccess + ' · ' + frase('deleteForGoodDone', 1, 0), 'success']], app.notifiche);
    dice('la finestra del cestino si chiude', false, app.stato.isTrashOpen);
}

console.log('\n--- la X su una foto di rete, con un\'altra foto ancora nel cestino ---');
{
    const cartella = cartellaFinta();
    const api = apiFinta({ esitoDi: () => 'rifiutato' });
    const app = creaApp([foto('A', { cartella }), foto('D')], { api });
    await app.render().handleDeletePermanently('A');
    await app.attendi();
    await app.stato.confirmDialog.onConfirm();
    await app.attendi();
    dice('A cancellata per sempre, D resta', ['D(cestino)'], app.vista());
    dice('la finestra del cestino resta aperta: D e\' ancora dentro', true, app.stato.isTrashOpen);
    dice('il messaggio dice solo di A', [[frase('deleteForGoodDone', 1, 0), 'success']], app.notifiche);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const { app } = await prepara(['B']);
    dice('solo B bloccata: nessuna seconda finestra, "Non rimosse: 1"', [false, [[frase('deletePartial', 0, 1), 'error']]], [app.stato.confirmDialog.isOpen, app.notifiche]);
    // ITALIANO: anteprima nel browser, tutte da una cartella aperta: seconda finestra e basta.
    // ENGLISH: browser preview, all from an open folder: the second dialog and nothing else.
    const cartella = cartellaFinta();
    const anteprima = creaApp([foto('A', { cartella }), foto('C', { cartella })]);
    await anteprima.render().handleEmptyTrash();
    await anteprima.attendi();
    await anteprima.stato.confirmDialog.onConfirm();
    await anteprima.attendi();
    dice('anteprima: tutte cancellate, "Foto eliminate per sempre: 2.", finestra chiusa',
        [[], [[frase('deleteForGoodDone', 2, 0), 'success']], false], [anteprima.vista(), anteprima.notifiche, anteprima.stato.isTrashOpen]);
}

process.exit(esito());
