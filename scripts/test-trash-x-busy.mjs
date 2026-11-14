/* ITALIANO: PROVA DELLA X «ELIMINA DAL DISCO» MENTRE IL FILE SI STA ANCORA SPOSTANDO
   Su un disco lento (disco esterno che si risveglia, unita' di rete) lo spostamento nel Cestino di
   Windows dura qualche secondo. La X su una foto del cestino non accendeva nessuna spia: la scheda
   restava identica, con la X, «Ripristina» e «Svuota cestino» attivi. Una seconda X sulla stessa foto
   dava l'avviso rosso falso «Non e' stato possibile spostare i file nel Cestino di Windows.», e
   «Svuota cestino» premuto nel frattempo diceva «Non rimosse: 1» a cestino vuoto, lasciava aperta la
   finestra e la foto mancava da «Annulla lo svuotamento». Ora la X accende la stessa spia dello
   svuotamento (isEmptyingTrash, che spegne quei tasti e fa avvisare alla chiusura della finestra) e
   un secondo lavoro del cestino che arriva lo stesso non parte.
   Si esegue il codice VERO preso da src/App.tsx (vedi trash-harness.mjs), con un disco finto lento.
   Uso:  node scripts/test-trash-x-busy.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE "DELETE FROM DISK" X WHILE THE FILE IS STILL BEING MOVED
   On a slow drive (an external disk waking up, a network drive) the move to the Windows Recycle Bin
   takes a few seconds. The X on a photo of the trash turned on no flag: the card stayed the same,
   with the X, "Restore" and "Empty trash" live. A second X on the same photo gave the false red
   notice "The files could not be moved to the Windows Recycle Bin.", and "Empty trash" pressed
   meanwhile said "Not removed: 1" with the trash empty, left the window open and the photo was
   missing from "Undo the emptying". Now the X turns on the same flag as the emptying
   (isEmptyingTrash, which disables those buttons and warns when the window is closed) and a second
   trash job that gets through anyway does not start.
   The REAL code taken from src/App.tsx is run (see trash-harness.mjs), with a slow fake drive.
   Usage:  node scripts/test-trash-x-busy.mjs      (exits with code 1 if anything is off) */

import { creaApp, foto, cartellaFinta, percorsoImg, percorsoTxt, t } from './trash-harness.mjs';
import { creaControlli } from './main-harness.mjs';

const { dice, esito } = creaControlli();
const dorme = (ms) => new Promise(ok => setTimeout(ok, ms));

// ITALIANO: disco finto lento, come main.cjs: guarda se il file c'e', poi lo sposta (e ci mette un po');
//           un secondo spostamento dello stesso file lo trova gia' partito e fallisce.
// ENGLISH: slow fake drive, like main.cjs: checks the file is there, then moves it (taking a while);
//          a second move of the same file finds it already gone and fails.
const creaDisco = (ids, lentoMs) => {
    const disco = new Set();
    for (const id of ids) { disco.add(percorsoImg(id)); disco.add(percorsoTxt(id)); }
    const api = { spostati: [], chiamate: 0 };
    api.getPathForFile = (file) => file.percorso;
    api.trashFiles = async (percorsi) => {
        api.chiamate++;
        let trashed = 0;
        const results = [];
        for (const p of percorsi) {
            if (!disco.has(p)) { results.push('ok'); continue; }
            await dorme(lentoMs);
            if (!disco.has(p)) { results.push('errore'); continue; }
            disco.delete(p); api.spostati.push(p); trashed++; results.push('ok');
        }
        return { ok: results.every(x => x === 'ok'), trashed, failed: results.filter(x => x !== 'ok').length, results };
    };
    api.restoreTrashed = async (percorsi) => ({ results: percorsi.map(p => ({ percorso: p, esito: 'ok' })) });
    return api;
};

console.log('\n--- una seconda X sulla stessa foto mentre la prima sta ancora spostando ---');
{
    const api = creaDisco(['A', 'B'], 60);
    const app = creaApp([foto('A'), foto('B')], { api });
    await app.attendi();
    const prima = app.render().handleDeletePermanently('A');
    await dorme(20);
    dice('durante lo spostamento la spia di lavoro del cestino e\' accesa (X, Ripristina e Svuota spenti)', true, app.stato.isEmptyingTrash);
    const seconda = app.render().handleDeletePermanently('A');
    await Promise.all([prima, seconda]);
    await app.attendi(10);
    dice('il file e il suo .txt si spostano una volta sola', [percorsoImg('A'), percorsoTxt('A')], api.spostati);
    dice('un solo avviso, quello verde (nessun rosso falso)', [[t.deleteSuccess, 'success']], app.notifiche);
    dice('A esce dal progetto, B resta nel cestino', ['B(cestino)'], app.vista());
    dice('alla fine la spia e\' spenta', false, app.stato.isEmptyingTrash);
}

console.log('\n--- «Svuota cestino» mentre la X sposta ancora A ---');
{
    const api = creaDisco(['A', 'B'], 60);
    const app = creaApp([foto('A'), foto('B')], { api });
    await app.attendi();
    const prima = app.render().handleDeletePermanently('A');
    await dorme(20);
    const svuota = app.render().handleEmptyTrash();
    await Promise.all([prima, svuota]);
    await app.attendi(10);
    dice('nessun «Non rimosse» falso: solo l\'avviso verde della X', [[t.deleteSuccess, 'success']], app.notifiche);
    dice('A e\' nel Cestino di Windows, B resta nel cestino del programma (lo svuotamento non e\' partito)',
        [[percorsoImg('A'), percorsoTxt('A')], ['B(cestino)']], [api.spostati, app.vista()]);
    dice('nessun ricordo di «Annulla lo svuotamento» monco', null, app.stato.ultimoSvuotamento);
    dice('la spia e\' spenta', false, app.stato.isEmptyingTrash);
    await app.render().handleEmptyTrash();
    await app.attendi(10);
    dice('dopo, «Svuota cestino» funziona e B entra nel ricordo', [['B'], []], [(app.stato.ultimoSvuotamento?.voci || []).map(v => v.img.id), app.vista()]);
}

console.log('\n--- quello che non deve cambiare ---');
{
    const api = creaDisco(['A'], 0);
    const app = creaApp([foto('A')], { api });
    await app.render().handleDeletePermanently('A');
    await app.attendi();
    dice('una X sola: foto tolta e avviso verde', [[], [[t.deleteSuccess, 'success']], false], [app.vista(), app.notifiche, app.stato.isEmptyingTrash]);
}
{
    // ITALIANO: Cestino di Windows rifiutato con la cartella aperta: la seconda conferma, poi la
    //           cancellazione definitiva (che riaccende la spia da sola) funziona.
    // ENGLISH: Windows Recycle Bin refused with the folder open: the second confirmation, then the
    //          permanent delete (which turns the flag on by itself) works.
    const cartella = cartellaFinta();
    const api = creaDisco([], 0);
    api.trashFiles = async (percorsi) => ({ ok: false, trashed: 0, failed: percorsi.length, results: percorsi.map(() => 'rifiutato') });
    const app = creaApp([foto('A', { cartella })], { api });
    await app.render().handleDeletePermanently('A');
    await app.attendi();
    dice('seconda conferma aperta e spia spenta mentre si aspetta la risposta', [true, false], [app.stato.confirmDialog.isOpen, app.stato.isEmptyingTrash]);
    await app.stato.confirmDialog.onConfirm();
    await app.attendi();
    dice('confermata: la foto e\' cancellata e la spia torna spenta', [['A.png', 'A.txt'], [], false], [cartella.rimossi, app.vista(), app.stato.isEmptyingTrash]);
}
{
    const api = creaDisco(['A'], 0);
    api.trashFiles = async () => { throw new Error('canale rotto'); };
    const app = creaApp([foto('A')], { api });
    await app.render().handleDeletePermanently('A');
    await app.attendi();
    dice('un errore del canale: avviso rosso, foto nel cestino, spia spenta', [[[t.deleteError, 'error']], ['A(cestino)'], false],
        [app.notifiche, app.vista(), app.stato.isEmptyingTrash]);
}

process.exit(esito());
