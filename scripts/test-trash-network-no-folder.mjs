/* ITALIANO: PROVA DEL CESTINO PER LE FOTO SFUSE SU UN'UNITA' SENZA CESTINO DI WINDOWS
   Una foto aperta con "Carica immagini" (o trascinata) da una cartella di rete, una chiavetta o
   una scheda SD: Windows non ha il Cestino li', e il processo principale risponde 'rifiutato'.
   La seconda conferma (cancellazione definitiva) passa dalla cartella aperta, che queste foto non
   hanno. Svuotando il cestino compariva solo "Non rimosse: 1, ancora nel cestino del programma.",
   a ogni tentativo, senza dire perche' ne' cosa fare; la X sulla foto diceva solo che i file non
   si potevano spostare. Ora il messaggio lo spiega e dice di aprire la cartella con "Carica
   cartella" (che ha la seconda conferma) o di cancellarle da Esplora file.
   Si eseguono i testi VERI presi da src/App.tsx (vedi trash-harness.mjs).
   Uso:  node scripts/test-trash-network-no-folder.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE TRASH FOR LOOSE PHOTOS ON A DRIVE WITH NO WINDOWS RECYCLE BIN
   A photo opened with "Load images" (or dropped in) from a network folder, a USB stick or an SD
   card: Windows has no Recycle Bin there, and the main process answers 'rifiutato'. The second
   confirmation (permanent delete) goes through the open folder, which these photos lack. Emptying
   the trash showed only "Not removed: 1, still in the app's trash.", on every try, with no reason
   and nothing to do about it; the X on the photo only said the files could not be moved. Now the
   message explains it and says to open the folder with "Load Folder" (which has the second
   confirmation) or to delete them in File Explorer.
   The REAL code taken from src/App.tsx is run (see trash-harness.mjs).
   Usage:  node scripts/test-trash-network-no-folder.mjs      (exits with code 1 if anything is off) */

import { creaApp, apiFinta, foto, cartellaFinta, percorsoImg, t, lingue } from './trash-harness.mjs';
import { creaControlli } from './main-harness.mjs';

const { dice, esito } = creaControlli();
const frase = (chiave, done, failed) => t[chiave].replace('{done}', String(done)).replace('{failed}', String(failed));
const ultima = (app) => app.notifiche[app.notifiche.length - 1];

dice('la frase esiste in tutte e nove le lingue', [], Object.keys(lingue).filter(c => typeof lingue[c].deleteNoRecycleBin !== 'string' || !lingue[c].deleteNoRecycleBin.trim()));
dice('...e nomina il pulsante "Carica cartella" col suo nome vero', [], Object.keys(lingue).filter(c => !String(lingue[c].deleteNoRecycleBin || '').includes(lingue[c].loadFolder)));

console.log('\n--- "Svuota cestino": A caricata con "Carica immagini" da un\'unita\' di rete ---');
{
    const api = apiFinta({ esitoDi: (p) => (p === percorsoImg('A') ? 'rifiutato' : 'ok') });
    const app = creaApp([foto('A', { cartella: null })], { api });
    await app.render().handleEmptyTrash();
    await app.attendi();
    dice('nessuna seconda finestra: senza cartella aperta non si puo\' cancellare', false, app.stato.confirmDialog.isOpen);
    dice('A resta nel cestino dell\'app, il file non e\' toccato', ['A(cestino)'], app.vista());
    dice('il messaggio dice perche\' e cosa fare', [frase('deletePartial', 0, 1) + ' · ' + t.deleteNoRecycleBin, 'error'], ultima(app));
}

console.log('\n--- la X su A (stessa foto) ---');
{
    const api = apiFinta({ esitoDi: () => 'rifiutato' });
    const app = creaApp([foto('A', { cartella: null }), foto('D')], { api });
    await app.render().handleDeletePermanently('A');
    await app.attendi();
    dice('nessuna seconda finestra', false, app.stato.confirmDialog.isOpen);
    dice('A e D restano nel cestino dell\'app', ['A(cestino)', 'D(cestino)'], app.vista());
    dice('il messaggio spiega, non solo "non spostati"', [[t.deleteNoRecycleBin, 'error']], app.notifiche);
}

console.log('\n--- A sfusa di rete + B di rete da "Carica cartella" + C normale: si annulla la seconda finestra ---');
{
    const cartella = cartellaFinta();
    const api = apiFinta({ esitoDi: (p) => (p === percorsoImg('C') ? 'ok' : 'rifiutato') });
    const app = creaApp([foto('A', { cartella: null }), foto('B', { cartella }), foto('C')], { api });
    await app.render().handleEmptyTrash();
    await app.attendi();
    dice('la seconda finestra c\'e\', per B soltanto', [true, t.confirmHardDelete.replace('{n}', '1')], [app.stato.confirmDialog.isOpen, app.stato.confirmDialog.message]);
    app.stato.confirmDialog.onCancel();
    await app.attendi();
    dice('A e B restano nel cestino dell\'app, C e\' uscita', ['A(cestino)', 'B(cestino)'], app.vista());
    dice('annullando, il messaggio dice anche di A', [[frase('deletePartial', 1, 1) + ' · ' + t.deleteNoRecycleBin, 'error']], app.notifiche);
}

console.log('\n--- stesso caso, si conferma: B cancellata per sempre ---');
{
    const cartella = cartellaFinta();
    const api = apiFinta({ esitoDi: (p) => (p === percorsoImg('C') ? 'ok' : 'rifiutato') });
    const app = creaApp([foto('A', { cartella: null }), foto('B', { cartella }), foto('C')], { api });
    await app.render().handleEmptyTrash();
    await app.attendi();
    await app.stato.confirmDialog.onConfirm();
    await app.attendi();
    dice('B cancellata per sempre, A resta', [true, false, ['A(cestino)']], [cartella.rimossi.includes('B.png'), cartella.rimossi.includes('A.png'), app.vista()]);
    dice('un solo messaggio con le tre parti, ed e\' un errore',
        [frase('deletePartial', 1, 1) + ' · ' + t.deleteNoRecycleBin + ' · ' + frase('deleteForGoodDone', 1, 0), 'error'], ultima(app));
}

console.log('\n--- quello che NON deve cambiare ---');
{
    // ITALIANO: un file bloccato ('errore') resta "Non rimosse: 1" e basta: non e' un problema di rete.
    // ENGLISH: a locked file ('errore') stays "Not removed: 1" and nothing else: not a network issue.
    const bloccata = creaApp([foto('B')], { api: apiFinta({ esitoDi: () => 'errore' }) });
    await bloccata.render().handleEmptyTrash();
    await bloccata.attendi();
    dice('file bloccato: solo "Non rimosse: 1"', [[frase('deletePartial', 0, 1), 'error']], bloccata.notifiche);
    const xBloccata = creaApp([foto('B')], { api: apiFinta({ esitoDi: () => 'errore' }) });
    await xBloccata.render().handleDeletePermanently('B');
    await xBloccata.attendi();
    dice('la X su un file bloccato: il messaggio di prima', [[t.deleteError, 'error']], xBloccata.notifiche);
    // ITALIANO: una foto di rete aperta con "Carica cartella" ha ancora la seconda conferma.
    // ENGLISH: a network photo opened with "Load Folder" still gets the second confirmation.
    const cartella = cartellaFinta();
    const conCartella = creaApp([foto('A', { cartella })], { api: apiFinta({ esitoDi: () => 'rifiutato' }) });
    await conCartella.render().handleEmptyTrash();
    await conCartella.attendi();
    dice('con la cartella aperta: seconda finestra, nessun messaggio', [true, []], [conCartella.stato.confirmDialog.isOpen, conCartella.notifiche]);
    // ITALIANO: anteprima nel browser senza cartella: come prima, "Non rimosse".
    // ENGLISH: browser preview with no folder: as before, "Not removed".
    const anteprima = creaApp([foto('A', { cartella: null })]);
    await anteprima.render().handleEmptyTrash();
    await anteprima.attendi();
    dice('anteprima nel browser: "Non rimosse: 1" come prima', [[frase('deletePartial', 0, 1), 'error']], anteprima.notifiche);
}

process.exit(esito());
