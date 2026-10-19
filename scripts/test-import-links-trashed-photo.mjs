/* ITALIANO: PROVA: RIAPRIRE LA CARTELLA DI UNA FOTO NEL CESTINO DELL'APP LE DA' LA CARTELLA
   Una foto caricata con "Carica immagini" (o trascinata) da una chiavetta, una scheda SD o una
   cartella di rete, messa nel cestino: "Svuota Cestino" dice "Cestino di Windows non disponibile...
   Apri la loro cartella con Carica Cartella ... ed eliminale da li'". Riaprendo la cartella, la foto
   contava come "gia' aperta" e restava senza cartella: Svuota ridava lo stesso messaggio, per sempre,
   e la seconda conferma (la cancellazione dalla cartella) non arrivava mai. Ora la foto nel cestino
   dell'app riceve la cartella appena aperta (solo lei: le foto in galleria non cambiano), e Svuota
   arriva alla seconda conferma. Si eseguono i testi VERI di confermaImport (import-harness.mjs) e di
   "Svuota Cestino" (trash-harness.mjs), con cartelle e Cestino di Windows finti.
   Casi vicini che non devono cambiare: le foto nuove della cartella entrano, quelle gia' aperte non
   entrano due volte (lo stesso avviso), una foto in galleria senza cartella non cambia, una foto nel
   cestino che ha gia' una cartella non cambia, il collegamento non diventa un passo di Ctrl+Z.
   Uso:  node scripts/test-import-links-trashed-photo.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST: REOPENING THE FOLDER OF A PHOTO IN THE APP'S TRASH GIVES IT THE FOLDER
   A photo loaded with "Load images" (or dropped) from a USB stick, an SD card or a network folder, put
   in the trash: "Empty Trash" says "Windows Recycle Bin not available... Open their folder with Load
   Folder ... and delete them from there". Reopening the folder, the photo counted as "already open"
   and stayed folder-less: Empty gave the same message again, for ever, and the second confirmation
   (deleting from the folder) never came. Now the photo in the app's trash gets the folder just opened
   (only it: gallery photos do not change), and Empty reaches the second confirmation. The REAL texts
   of confermaImport (import-harness.mjs) and "Empty Trash" (trash-harness.mjs) run, with fake folders
   and a fake Windows Recycle Bin.
   Neighbouring cases that must not change: the folder's new photos come in, those already open do not
   come in twice (same notice), a folder-less gallery photo does not change, a trashed photo that already
   has a folder does not change, the link does not become a Ctrl+Z step.
   Usage:  node scripts/test-import-links-trashed-photo.mjs      (exits with code 1 if anything is off) */

import { creaApp, cartella, riepilogo, t } from './import-harness.mjs';
import * as Cestino from './trash-harness.mjs';
import { creaControlli } from './main-harness.mjs';

const { dice, esito } = creaControlli();
// ITALIANO: una foto senza cartella (Carica immagini / trascinata), con il suo percorso su disco.
// ENGLISH: a folder-less photo (Load images / dropped), with its path on disk.
const sciolta = (id, nome, { cestinata = true, dirHandle = null, percorso = 'E:\\img\\' + nome } = {}) => ({
    id, file: { name: nome, percorso, size: 10, lastModified: 1000 }, thumb: '', tags: ['tag ' + id], originalTags: ['tag ' + id],
    isTrashed: cestinata, dirHandle, width: 1, height: 1,
});
// ITALIANO: "Svuota Cestino" con il Cestino di Windows che rifiuta il disco (chiavetta, rete).
// ENGLISH: "Empty Trash" with the Windows Recycle Bin refusing the drive (USB stick, network).
const svuota = async (immagini) => {
    const api = Cestino.apiFinta({ esitoDi: () => 'rifiutato' });
    const app = Cestino.creaApp(immagini, { api });
    await app.render().handleEmptyTrash();
    await app.attendi();
    return app;
};

console.log('\n--- premessa: senza cartella, Svuota da\' "Cestino di Windows non disponibile" ---');
{
    const app = await svuota([sciolta('x', 'a.png')]);
    dice('nessuna seconda conferma', false, app.stato.confirmDialog.isOpen);
    dice('l\'avviso consiglia di aprire la cartella', true, app.notifiche.some(([m]) => m.includes(Cestino.t.deleteNoRecycleBin)));
}

console.log('\n--- la cartella riaperta con "Carica Cartella" ---');
{
    const h = cartella('E:img', 'img');
    const app = creaApp({ iniziali: [sciolta('x', 'a.png'), sciolta('g', 'b.png', { cestinata: false })] });
    await app.conferma(riepilogo(h, ['a.png', 'b.png', 'c.png']));
    const x = app.images.find(i => i.id === 'x');
    const g = app.images.find(i => i.id === 'g');
    dice('entra solo la foto nuova c.png', ['a.png', 'b.png', 'c.png'], app.nomi());
    dice('la foto nel cestino dell\'app riceve la cartella aperta', [true, 'img', true], [x.dirHandle === h, x.cartellaImport, x.isTrashed]);
    dice('...e tiene i suoi tag', [['tag x'], ['tag x']], [x.tags, x.originalTags]);
    dice('la foto in galleria senza cartella NON cambia', [null, undefined], [g.dirHandle, g.cartellaImport]);
    const dopo = await svuota([x]);
    dice('Svuota arriva alla seconda conferma (cancellazione dalla cartella)', true, dopo.stato.confirmDialog.isOpen);
    if (dopo.stato.confirmDialog.isOpen) await dopo.stato.confirmDialog.onConfirm();
    await dopo.attendi();
    dice('...e confermando la foto si toglie dalla sua cartella', [['a.png'], []], [h.rimossi.filter(n => n === 'a.png'), dopo.vista()]);
}

console.log('\n--- tutte le foto gia\' aperte ---');
{
    const h = cartella('E:img', 'img');
    const app = creaApp({ iniziali: [sciolta('x', 'a.png')] });
    await app.conferma(riepilogo(h, ['a.png']));
    dice('non entra niente e l\'avviso resta quello di prima', [['a.png'], [t.importAlreadyOpen.replace('{n}', '1'), 'info']], [app.nomi(), app.ultimo()]);
    dice('la foto nel cestino riceve comunque la cartella', true, app.images[0].dirHandle === h);
    dice('il collegamento non e\' un passo di Ctrl+Z', 1, app.passiSaltati);
}

console.log('\n--- cartella di rete senza percorsi (coppia mista: nome, dimensione, data, nome della cartella) ---');
{
    const h = cartella('UNC:share/img', 'img');
    const app = creaApp({ iniziali: [sciolta('x', 'a.png', { percorso: '\\\\server\\share\\img\\a.png' })] });
    await app.conferma(riepilogo(h, ['a.png'], { percorsi: false }));
    dice('la foto nel cestino riceve la cartella di rete', true, app.images[0].dirHandle === h);
    const dopo = await svuota([app.images[0]]);
    dice('Svuota arriva alla seconda conferma', true, dopo.stato.confirmDialog.isOpen);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const vecchia = cartella('E:img', 'img');
    const h = cartella('E:img', 'img');
    const app = creaApp({ iniziali: [sciolta('x', 'a.png', { dirHandle: vecchia })] });
    await app.conferma(riepilogo(h, ['a.png']));
    dice('una foto nel cestino che ha gia\' la sua cartella la tiene', true, app.images[0].dirHandle === vecchia);
    const altra = cartella('E:altro', 'altro');
    const app2 = creaApp({ iniziali: [sciolta('x', 'a.png')] });
    await app2.conferma(riepilogo(altra, ['a.png']));
    dice('una cartella diversa con una foto omonima: entra come foto nuova, la foto nel cestino non cambia',
        [['a.png', 'a.png'], null], [app2.nomi(), app2.images[0].dirHandle]);
}

process.exit(esito());
