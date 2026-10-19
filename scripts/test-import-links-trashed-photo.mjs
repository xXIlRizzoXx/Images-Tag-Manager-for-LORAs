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
   Si collega solo con lo stesso percorso su disco: una cartella di rete \\server\condivisione (senza
   percorsi) non collega, perche' una copia identica in un'altra cartella omonima veniva cancellata.
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
   Only the same path on disk links: a network folder \\server\share (no paths) does not, because an
   identical copy in another folder with the same name used to be deleted.
   Usage:  node scripts/test-import-links-trashed-photo.mjs      (exits with code 1 if anything is off) */

import { creaApp, cartella, riepilogo, t } from './import-harness.mjs';
import * as Cestino from './trash-harness.mjs';
import { creaControlli } from './main-harness.mjs';
import * as esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { dice, esito } = creaControlli();
const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const B = await import('data:text/javascript;base64,' + Buffer.from((await esbuild.build({
    entryPoints: [path.join(radice, 'src/utils/tagBackup.ts')], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
})).outputFiles[0].text).toString('base64'));
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
    // ITALIANO: cartellaImport non cambia: la foto resta nel lotto di "Carica immagini" (vedi sotto).
    // ENGLISH: cartellaImport does not change: the photo stays in the "Load images" batch (see below).
    dice('la foto nel cestino dell\'app riceve la cartella aperta', [true, undefined, true], [x.dirHandle === h, x.cartellaImport, x.isTrashed]);
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

// ITALIANO: senza percorsi (cartella di rete \\server\condivisione) la foto e' "gia' aperta" solo per la
//           coppia mista (nome, dimensione, data, nome della cartella): un'ipotesi, non una prova. Una copia
//           identica in un'altra cartella con lo stesso nome combacia lo stesso, e collegandola "Svuota
//           Cestino" cancellava PER SEMPRE la copia (immagine e .txt) lasciando l'originale. Si collega solo
//           con lo stesso percorso su disco; qui la foto resta senza cartella e vale il messaggio di prima.
// ENGLISH: without paths (network folder \\server\share) the photo is "already open" only through the mixed
//          pair (name, size, date, folder name): a guess, not a proof. An identical copy in another folder
//          with the same name matches all the same, and once linked "Empty Trash" deleted the copy FOR GOOD
//          (image and .txt) and left the original. Only the same path on disk links; here the photo stays
//          folder-less and the earlier message applies.
console.log('\n--- cartella di rete senza percorsi (coppia mista): NON collega ---');
{
    const h = cartella('UNC:share/img', 'img');
    const app = creaApp({ iniziali: [sciolta('x', 'a.png', { percorso: '\\\\server\\share\\img\\a.png' })] });
    await app.conferma(riepilogo(h, ['a.png'], { percorsi: false }));
    dice('la foto resta gia\' aperta (non entra due volte)', [['a.png'], [t.importAlreadyOpen.replace('{n}', '1'), 'info']], [app.nomi(), app.ultimo()]);
    dice('la foto nel cestino NON riceve la cartella di rete', [null, undefined], [app.images[0].dirHandle, app.images[0].cartellaImport]);
    const dopo = await svuota([app.images[0]]);
    dice('Svuota non apre la seconda conferma e non cancella niente', [false, []], [dopo.stato.confirmDialog.isOpen, h.rimossi]);
    dice('...e ridice di cancellarla da Esplora file', true, dopo.notifiche.some(([m]) => m.includes(Cestino.t.deleteNoRecycleBin)));
}

console.log('\n--- copia identica in un\'ALTRA cartella di rete con lo stesso nome ---');
{
    const backup = cartella('UNC:nas/backup/dataset', 'dataset');
    const app = creaApp({ iniziali: [sciolta('x', 'a.png', { percorso: '\\\\nas\\lavoro\\dataset\\a.png' })] });
    await app.conferma(riepilogo(backup, ['a.png', 'b.png'], { percorsi: false }));
    const x = app.images.find(i => i.id === 'x');
    dice('la foto del cestino NON punta alla cartella backup', [null, undefined], [x.dirHandle, x.cartellaImport]);
    const dopo = await svuota([x]);
    if (dopo.stato.confirmDialog.isOpen) await dopo.stato.confirmDialog.onConfirm();
    await dopo.attendi();
    dice('nessun file cancellato per sempre dalla cartella backup', [], backup.rimossi);
    dice('...la foto resta nel cestino dell\'app', ['x(cestino)'], dopo.vista());
}

console.log('\n--- stessa cartella con i percorsi (chiavetta, scheda SD, lettera di rete): collega ancora ---');
{
    const h = cartella('E:dataset', 'dataset');
    const app = creaApp({ iniziali: [sciolta('x', 'a.png', { percorso: 'e:/DATASET/a.png' })] });
    await app.conferma(riepilogo(h, ['a.png'], { percorsi: true }));
    dice('lo stesso percorso (maiuscole e barre a parte) collega', true, app.images[0].dirHandle === h);
}

// ITALIANO: il collegamento metteva sulla foto del cestino cartellaImport = nome della cartella, ma
//           la foto resta nel lotto delle foto caricate una per una: il backup anti-crash dava a quel
//           lotto il nome della cartella ('img|3|...' invece di '|3|...'), e dopo un crash, ricaricando
//           le stesse foto una per una, le modifiche non salvate delle altre foto del lotto non tornavano.
// ENGLISH: the link put cartellaImport = the folder's name on the trashed photo, but the photo stays in
//          the batch of the photos loaded one by one: the crash backup gave that batch the folder's
//          name ('img|3|...' instead of '|3|...'), and after a crash, reloading the same photos one by
//          one, the unsaved edits of the batch's other photos did not come back.
console.log('\n--- il collegamento non cambia l\'impronta del backup del lotto "Carica immagini" ---');
{
    const lotto = (f) => ({ ...f, lottoImport: 'L0', backupKey: 'E:\\img' + B.BACKUP_KEY_SEP + f.file.name });
    const a = { ...lotto(sciolta('a', 'a.png', { cestinata: false })), tags: ['tag a', 'red hair'] };
    const app = creaApp({ iniziali: [a, lotto(sciolta('b', 'b.png', { cestinata: false })), lotto(sciolta('x', 'x.png'))] });
    await app.conferma(riepilogo(cartella('E:img', 'img'), ['a.png', 'b.png', 'x.png']));
    dice('premessa: la foto del cestino e\' collegata', true, !!app.images.find(i => i.id === 'x').dirHandle);
    const firma = B.folderSignature('', ['a.png', 'b.png', 'x.png']);
    const backup = B.costruisciBackup(app.images, [], '', null, [], null);
    dice('l\'impronta del lotto resta quella senza cartella', [firma], backup ? backup.sources.map(s => s.signature) : null);
    const ripreso = backup ? B.backupDellImport(JSON.stringify({ ts: Date.now(), ...backup }), '', firma) : null;
    dice('dopo un crash, ricaricando a.png b.png x.png una per una, la modifica di a.png torna', true,
        !!ripreso && Object.values(ripreso.voci).some(v => Array.isArray(v.tags) && v.tags.includes('red hair')));
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
