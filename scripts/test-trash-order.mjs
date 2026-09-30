/* ITALIANO: PROVA DELL'ORDINE IN CUI IMMAGINE E .txt VANNO NEL CESTINO DI WINDOWS
   Con un'immagine bloccata (aperta in esclusiva da un altro programma, permessi negati) lo
   svuotamento diceva giustamente "Non rimosse: 1, ancora nel cestino dell'app" e teneva la foto,
   ma il suo .txt era gia' stato mandato nel Cestino di Windows: il .txt partiva comunque, prima
   ancora di guardare com'era andata l'immagine. Ripristinando la foto, i tag in memoria erano
   uguali a quelli "salvati", quindi Salva diceva "Nessuna modifica" e sul disco restava
   l'immagine senza il suo .txt. La regola: il .txt segue l'immagine, mai il contrario.
   Si eseguono i testi VERI del cestino presi da src/App.tsx (vedi trash-harness.mjs).
   Uso:  node scripts/test-trash-order.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE ORDER IN WHICH IMAGE AND .txt GO TO THE WINDOWS RECYCLE BIN
   With a locked image (held open exclusively by another program, permission denied) emptying
   rightly said "Not removed: 1, still in the app's trash" and kept the photo, but its .txt had
   already been sent to the Windows Recycle Bin: the .txt went regardless, before the image's
   outcome was even looked at. Restoring the photo, the tags in memory equalled the "saved" ones,
   so Save said "No changes" and the disk kept the image without its .txt. The rule: the .txt
   follows the image, never the other way round.
   The REAL trash code taken from src/App.tsx is run (see trash-harness.mjs).
   Usage:  node scripts/test-trash-order.mjs      (exits with code 1 if anything is off) */

import { creaApp, apiFinta, foto, percorsoImg, percorsoTxt, t } from './trash-harness.mjs';
import { creaControlli } from './main-harness.mjs';

const { dice, esito } = creaControlli();
const percorsi = (api) => api.chiamate.flat();

console.log('\n--- Svuota cestino, immagine bloccata ---');
{
    const api = apiFinta({ esitoDi: (p) => (p === percorsoImg('A') ? 'errore' : 'ok') });
    const app = creaApp([foto('A'), foto('B', { cestinata: false })], { api });
    await app.render().handleEmptyTrash();
    await app.attendi();
    dice('il .txt della foto bloccata NON va nel Cestino di Windows', false, percorsi(api).includes(percorsoTxt('A')));
    dice('la foto resta nel cestino dell\'app', ['A(cestino)', 'B'], app.vista());
    dice('e lo si dice', [[t.deletePartial.replace('{done}', '0').replace('{failed}', '1'), 'error']], app.notifiche);
}

console.log('\n--- la X su una foto, immagine bloccata ---');
{
    const api = apiFinta({ esitoDi: (p) => (p === percorsoImg('A') ? 'errore' : 'ok') });
    const app = creaApp([foto('A')], { api });
    await app.render().handleDeletePermanently('A');
    await app.attendi();
    dice('il .txt NON va nel Cestino di Windows', false, percorsi(api).includes(percorsoTxt('A')));
    dice('la foto resta nel cestino dell\'app', ['A(cestino)'], app.vista());
}

console.log('\n--- immagine rifiutata dal Cestino di Windows (cartella di rete, senza cartella aperta) ---');
{
    const api = apiFinta({ esitoDi: () => 'rifiutato' });
    const app = creaApp([foto('A')], { api });
    await app.render().handleEmptyTrash();
    await app.attendi();
    dice('il .txt NON va nel Cestino di Windows', false, percorsi(api).includes(percorsoTxt('A')));
    dice('la foto resta nel cestino dell\'app', ['A(cestino)'], app.vista());
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const api = apiFinta();
    const app = creaApp([foto('A')], { api });
    await app.render().handleEmptyTrash();
    await app.attendi();
    dice('immagine spostata: il .txt la segue, dopo di lei', [[percorsoImg('A')], [percorsoTxt('A')]], api.chiamate);
    dice('la foto esce dal progetto', [], app.vista());

    const api2 = apiFinta({ esitoDi: (p) => (p === percorsoTxt('A') ? 'errore' : 'ok') });
    const app2 = creaApp([foto('A')], { api: api2 });
    await app2.render().handleEmptyTrash();
    await app2.attendi();
    dice('un .txt bloccato non trattiene la foto, la cui immagine e\' gia\' nel Cestino di Windows', [[], [[t.deleteSuccess, 'success']]], [app2.vista(), app2.notifiche]);
}

process.exit(esito());
