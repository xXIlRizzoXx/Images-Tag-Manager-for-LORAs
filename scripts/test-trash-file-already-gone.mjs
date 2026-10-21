/* ITALIANO: PROVA DEL MESSAGGIO PER UNA FOTO IL CUI FILE NON C'ERA PIU' SUL DISCO
   Una foto caricata una per una da una chiavetta o da una rete, nel cestino dell'app: "Svuota
   Cestino" dice di cancellarla da Esplora file, che li' la cancella per sempre. Premendo di nuovo
   "Svuota Cestino" (o la X sulla foto) il processo principale risponde 'ok' senza spostare niente
   (trashed 0), perche' il file non c'e' piu', e la foto esce dal progetto (giusto). Ma il messaggio
   verde diceva "File spostati nel Cestino di Windows.": falso, li' non c'e' niente. Ora dice che la
   foto e' uscita perche' il suo file non c'era piu', e quando altre foto sono state spostate davvero
   lo dice insieme alla frase di prima.
   Si eseguono i testi VERI di handleEmptyTrash, handleDeletePermanently, chiediEliminazioneDefinitiva
   ed eliminaPerSempre (trash-harness.mjs) con un Cestino di Windows finto che risponde come il canale
   vero (vedi test-trash-network-missing.mjs).
   Casi vicini che non devono cambiare: le foto spostate davvero danno ancora "File spostati nel
   Cestino di Windows."; la foto sparita esce dal progetto e non entra nell'annullamento dello svuotamento.
   Uso:  node scripts/test-trash-file-already-gone.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE MESSAGE FOR A PHOTO WHOSE FILE WAS NO LONGER ON DISK
   A photo loaded one by one from a USB stick or a network drive, in the app's trash: "Empty Trash"
   says to delete it in File Explorer, which deletes it for good there. Pressing "Empty Trash" again
   (or the X on the photo) the main process answers 'ok' moving nothing (trashed 0), because the file
   is gone, and the photo leaves the project (right). But the green message said "Files moved to the
   Windows Recycle Bin.": false, nothing is there. Now it says the photo left because its file was no
   longer there, and when other photos were really moved it says so together with the earlier sentence.
   The REAL texts of handleEmptyTrash, handleDeletePermanently, chiediEliminazioneDefinitiva and
   eliminaPerSempre (trash-harness.mjs) run with a fake Windows Recycle Bin answering like the real
   channel (see test-trash-network-missing.mjs).
   Neighbouring cases that must not change: photos really moved still give "Files moved to the Windows
   Recycle Bin."; the vanished photo leaves the project and does not enter the undo of the emptying.
   Usage:  node scripts/test-trash-file-already-gone.mjs      (exits with code 1 if anything is off) */

import * as H from './trash-harness.mjs';
import { creaControlli } from './main-harness.mjs';

const { dice, esito } = creaControlli();
const t = H.t;
// ITALIANO: il canale vero: un file che non c'e' piu' risponde 'ok' senza contarlo fra gli spostati.
// ENGLISH: the real channel: a file that is gone answers 'ok' without counting it as moved.
const apiConSparite = (sparite) => {
    const api = H.apiFinta();
    api.trashFiles = async (percorsi) => {
        api.chiamate.push([...percorsi]);
        await new Promise(ok => setTimeout(ok, 0));
        const trashed = percorsi.filter(p => !sparite.some(id => p.includes('\\' + id + '.'))).length;
        return { ok: true, trashed, failed: 0, results: percorsi.map(() => 'ok') };
    };
    return api;
};
const gone = (n) => (n === 1 ? t.deleteAlreadyGoneOne : String(t.deleteAlreadyGone || '').replace('{n}', String(n)));

console.log('\n--- "Svuota Cestino", il file della foto non c\'era piu\' ---');
{
    const app = H.creaApp([H.foto('a'), H.foto('b', { cestinata: false })], { api: apiConSparite(['a']) });
    await app.render().handleEmptyTrash();
    await app.attendi(10);
    dice('la foto esce dal progetto (come prima)', ['b'], app.vista());
    dice('il messaggio NON dice "File spostati nel Cestino di Windows"', false, app.notifiche.some(([m]) => m.includes(t.deleteSuccess)));
    dice('il messaggio dice che il suo file non c\'era piu\'', true, app.notifiche.some(([m]) => m === gone(1)));
    dice('niente da annullare per quella foto', null, app.stato.ultimoSvuotamento);
}
{
    const app = H.creaApp([H.foto('a'), H.foto('c')], { api: apiConSparite(['a', 'c']) });
    await app.render().handleEmptyTrash();
    await app.attendi(10);
    dice('due foto sparite: la frase al plurale con il numero', true, app.notifiche.some(([m]) => m === gone(2)));
}

console.log('\n--- "Svuota Cestino", una foto spostata davvero e una sparita ---');
{
    const app = H.creaApp([H.foto('a'), H.foto('d')], { api: apiConSparite(['a']) });
    await app.render().handleEmptyTrash();
    await app.attendi(10);
    const ultimo = app.notifiche[app.notifiche.length - 1] || ['', ''];
    dice('il messaggio dice tutte e due le cose', [true, true], [ultimo[0].includes(t.deleteSuccess), ultimo[0].includes(gone(1))]);
    dice('solo la foto spostata davvero si puo\' annullare', ['d'], app.stato.ultimoSvuotamento ? app.stato.ultimoSvuotamento.voci.map(v => v.img.id) : null);
}

console.log('\n--- la X sulla foto, il file non c\'era piu\' ---');
{
    const app = H.creaApp([H.foto('a')], { api: apiConSparite(['a']) });
    await app.render().handleDeletePermanently('a');
    await app.attendi(10);
    dice('la foto esce dal progetto (come prima)', [], app.vista());
    dice('il messaggio dice che il suo file non c\'era piu\', non "spostati nel Cestino"', [[gone(1), 'success']], app.notifiche);
}

console.log('\n--- seconda conferma (cartella senza Cestino) insieme a una foto sparita ---');
{
    // ITALIANO: a sparita, b nella cartella aperta su un disco senza Cestino: la seconda conferma si apre,
    //           e annullandola il messaggio dice com'e' andata la prima parte.
    // ENGLISH: a gone, b in the open folder on a drive without a Recycle Bin: the second confirmation
    //          opens, and cancelling it the message says how the first part went.
    const api = apiConSparite(['a']);
    const vera = api.trashFiles;
    api.trashFiles = async (percorsi) => (percorsi.some(p => p.includes('\\b.')) ? { ok: false, trashed: 0, failed: 1, results: ['rifiutato'] } : vera(percorsi));
    const app = H.creaApp([H.foto('a'), H.foto('b', { cartella: H.cartellaFinta() })], { api });
    await app.render().handleEmptyTrash();
    await app.attendi(10);
    dice('premessa: la seconda conferma si apre', true, app.stato.confirmDialog.isOpen);
    app.stato.confirmDialog.onCancel();
    await app.attendi(5);
    const ultimo = app.notifiche[app.notifiche.length - 1] || ['', ''];
    dice('annullando: nessun "File spostati nel Cestino di Windows", la frase della foto sparita', [false, true], [ultimo[0].includes(t.deleteSuccess), ultimo[0].includes(gone(1))]);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const app = H.creaApp([H.foto('a'), H.foto('b', { cestinata: false })], { api: H.apiFinta() });
    await app.render().handleEmptyTrash();
    await app.attendi(10);
    dice('foto spostata davvero: "File spostati nel Cestino di Windows."', [[t.deleteSuccess, 'success']], app.notifiche);
    const x = H.creaApp([H.foto('a')], { api: H.apiFinta() });
    await x.render().handleDeletePermanently('a');
    await x.attendi(10);
    dice('X, foto spostata davvero: "File spostati nel Cestino di Windows."', [[t.deleteSuccess, 'success']], x.notifiche);
}

console.log('\n--- le frasi esistono nelle nove lingue ---');
{
    const L = H.lingue || {};
    const codici = ['it', 'en', 'fr', 'es', 'de', 'zh', 'ja', 'pt', 'ru'];
    dice('deleteAlreadyGone con {n} e deleteAlreadyGoneOne senza, in ogni lingua', [],
        Object.keys(L).length === 0 ? ['lingue non disponibili'] : codici.filter(c => !L[c] || !String(L[c].deleteAlreadyGone || '').includes('{n}') || !L[c].deleteAlreadyGoneOne || L[c].deleteAlreadyGoneOne.includes('{n}')));
}

process.exit(esito());
