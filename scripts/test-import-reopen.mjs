/* ITALIANO: PROVA DELLA RIAPERTURA DI UNA CARTELLA GIA' APERTA (QUATTRO CASI)
   Dalla 2.0.1 "Importa" lascia fuori le foto gia' aperte. Quattro casi restavano scoperti:
   1) Riaprire la stessa cartella per prendere una foto nuova: la nuova entrava in un LOTTO a parte, e
      il backup anti-crash (un'impronta per lotto) non aveva piu' l'impronta della cartella intera.
      Dopo un crash, riaprendo la cartella, le modifiche non salvate di TUTTE le sue foto sparivano.
      Lo stesso per una foto chiusa con la X e ripresa cosi': contava due volte nell'impronta.
   2) Cartella di rete \\server\condivisione: nessun percorso, quindi nessuna foto scartata, e
      riaprendo ogni foto entrava due volte.
   3) Un import ancora in corso (miniature) non contava: riaprendo la stessa cartella in quel momento
      tutte le foto entravano due volte.
   4) I .txt delle foto gia' aperte si rileggevano: un .txt oltre 1 MB o accorciato di una foto gia'
      aperta tornava nell'avviso (e un "accorciato" prendeva il posto di "N foto caricate", in rosso).
   Si eseguono i testi VERI di confermaImport e processImportData presi da src/App.tsx (compilati con
   esbuild) con le regole vere di src/utils, e il backup vero di src/utils/tagBackup.ts.
   Uso:  node scripts/test-import-reopen.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF REOPENING A FOLDER ALREADY OPEN (FOUR CASES)
   Since 2.0.1 "Import" leaves out the photos already open. Four cases were left uncovered:
   1) Reopening the same folder to take a new photo: the new one went into a separate BATCH, and the
      crash backup (one fingerprint per batch) no longer had the whole folder's fingerprint. After a
      crash, reopening the folder, the unsaved edits of ALL its photos vanished. The same for a
      photo closed with the X and taken back that way: it counted twice in the fingerprint.
   2) Network folder \\server\share: no paths, so no photo dropped, and every photo came in twice.
   3) An import still running (thumbnails) did not count: reopening the same folder then brought all
      photos in twice.
   4) The .txt files of the photos already open were read again: an over-1-MB or shortened .txt of a
      photo already open came back in the notice (a "shortened" replaced "N photos loaded", in red).
   The REAL texts of confermaImport and processImportData from src/App.tsx run (compiled with
   esbuild) with the real rules of src/utils and the real backup of src/utils/tagBackup.ts.
   Usage:  node scripts/test-import-reopen.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const carica = async (rel) => import('data:text/javascript;base64,' + Buffer.from((await esbuild.build({
    entryPoints: [path.join(radice, rel)], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
})).outputFiles[0].text).toString('base64'));
const A = await carica('src/utils/alreadyOpen.ts');
const S = await carica('src/utils/sidecarTags.ts');
const B = await carica('src/utils/tagBackup.ts');
const N = await carica('src/utils/importNotice.ts');
const t = (await carica('src/constants.ts')).translations.en;

const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const ritaglia = (inizioRe, chiusura) => {
    const m = inizioRe.exec(sorgente);
    if (!m) { console.log('NO  non trovato in src/App.tsx: ' + inizioRe); process.exit(1); }
    chiusura.lastIndex = m.index;
    const fine = chiusura.exec(sorgente);
    return sorgente.slice(m.index, fine.index + fine[0].length);
};
const dentro = () => /\r?\n    \};\r?\n/g;
const testo = [
    ritaglia(/const asDirHandle = /, /;\r?\n/g),
    ritaglia(/const makeBackupKeyer = /, /\r?\n\};\r?\n/g),
    ritaglia(/    const percorsiSuDisco = /, dentro()),
    ritaglia(/    const confermaImport = (async )?\([^)]*\) => \{/, dentro()),
    ritaglia(/    const processImportData = async \(/, dentro()),
].join('\n');
const codice = (await esbuild.transform(testo, { loader: 'ts' })).code;
const NOMI = ['importSummary', 'window', 'fotoGiaAperte', 'fileGiaAperti', 'imagesRef', 'setImportSummary', 'folderInputRef', 'showNotification', 't',
    'progettoGenRef', 'importInCorsoRef', 'nuovoIdFoto', 'makeFolderKeyer', 'BACKUP_KEY_SEP',
    'globalTriggersRef', 'setImages', 'setDirHandle', 'setIsImporting', 'setImportProgress', 'folderSignature', 'backupDellImport', 'localStorage',
    'TXT_MAX_BYTES', 'parseSidecarText', 'generateThumbnail', 'tagDiImport', 'tagDaRipristinare', 'anteprimeProgettoRef', 'soundManager',
    'avvisoImport', 'console', 'URL', 'leggiTestoSidecar', 'importAttiviRef',
    'ripristinoInCorsoRef', 'isUndoRedoAction', 'setHistory'];
const fabbrica = new Function(...NOMI, codice + '\nreturn { confermaImport, processImportData };');

/* ITALIANO: l'app finta. `percorsi` = Electron con i percorsi su disco (false = cartella di rete,
   nessun percorso); `backup` = cio' che il backup anti-crash ha salvato. render(d) = le funzioni vere
   con il riepilogo `d` aperto. Le miniature delle foto in `cancelli` finiscono solo quando li si apre.
   ENGLISH: the fake app. `percorsi` = Electron with paths on disk (false = network folder, no path);
   `backup` = what the crash backup saved. render(d) = the real functions with summary `d` open. The
   thumbnails of the photos in `cancelli` end only when they are opened. */
const creaApp = ({ percorsi = true, backup = null } = {}) => {
    const app = { images: [], notifiche: [], cancelli: new Map() };
    const refs = { imagesRef: { current: [] }, importInCorsoRef: { current: [] }, progettoGenRef: { current: 0 }, importAttiviRef: { current: 0 } };
    let id = 0;
    const finestra = percorsi ? { electronAPI: { getPathForFile: (f) => f.percorso || '' } } : {};
    app.render = (d) => fabbrica({ isOpen: true, pendingData: d }, finestra, A.fotoGiaAperte, A.fileGiaAperti, refs.imagesRef, () => { }, { current: null },
        (m, tipo) => app.notifiche.push([m, tipo]), t, refs.progettoGenRef, refs.importInCorsoRef, () => 'lotto' + (++id), S.makeFolderKeyer, B.BACKUP_KEY_SEP,
        { current: [] }, (f) => { app.images = typeof f === 'function' ? f(app.images) : f; refs.imagesRef.current = app.images; }, () => { }, () => { }, () => { },
        B.folderSignature, B.backupDellImport, { getItem: () => backup }, 1024 * 1024, S.parseSidecarText,
        async (f) => { await app.cancelli.get(f.name); return { url: '', width: 1, height: 1 }; }, S.tagDiImport, B.tagDaRipristinare,
        { current: new Set() }, { chime() { } }, N.avvisoImport, { log() { }, warn() { }, error() { } }, { revokeObjectURL() { } }, S.leggiTestoSidecar,
        refs.importAttiviRef, { current: false }, { current: false }, () => { });
    app.refs = refs;
    // ITALIANO: "Importa" del riepilogo, fino alla fine dell'import che fa partire (se ne fa partire uno).
    // ENGLISH: the summary's "Import", until the end of the import it starts (when it starts one).
    app.conferma = async (d) => {
        const prima = refs.importAttiviRef.current;
        await app.render(d).confermaImport();
        for (let i = 0; i < 500 && refs.importAttiviRef.current > prima; i++) await new Promise(ok => setTimeout(ok, 10));
    };
    app.cancello = (nome) => { let apri; app.cancelli.set(nome, new Promise(ok => { apri = ok; })); return apri; };
    app.modifica = (nome, tags) => { app.images = app.images.map(i => (i.file.name === nome ? { ...i, tags } : i)); refs.imagesRef.current = app.images; };
    app.nomi = () => app.images.map(i => i.file.name);
    app.ultimo = () => app.notifiche[app.notifiche.length - 1];
    return app;
};
// ITALIANO: una cartella scelta col selettore: `disco` dice quale cartella vera e' (due scelte della
//           stessa cartella danno due oggetti diversi, che isSameEntry riconosce).
// ENGLISH: a folder picked with the picker: `disco` tells which real folder it is (two picks of the
//          same folder give two different objects, which isSameEntry recognises).
const cartella = (disco, nome, { rotta = false } = {}) => ({
    disco, name: nome, getFileHandle() { },
    async isSameEntry(o) { if (rotta) throw new Error('isSameEntry non riuscito'); return Boolean(o) && o.disco === this.disco; },
});
// ITALIANO: il riepilogo di "Carica cartella" su `h`: ogni volta oggetti File nuovi, come il selettore.
// ENGLISH: the "Load folder" summary on `h`: new File objects every time, as from the picker.
const riepilogo = (h, nomi, { percorsi = true, txt = {} } = {}) => {
    const imgFiles = nomi.map(n => ({ name: n, percorso: percorsi ? 'E:\\' + h.name + '\\' + n : '' }));
    const txtFiles = Object.entries(txt).map(([n, contenuto]) => new File([contenuto], n, { type: 'text/plain' }));
    const folderOf = new Map([...imgFiles, ...txtFiles].map(f => [f, h]));
    const pathOf = percorsi ? new Map(imgFiles.map(f => [f, f.percorso])) : null;
    return { imgFiles, txtFiles, handle: h, folderOf, relPathOf: null, pathOf, cartellaRelOf: null };
};
const attendi = (ms) => new Promise(ok => setTimeout(ok, ms));

console.log('\n--- 1) riaprire la stessa cartella per una foto nuova, poi un crash ---');
{
    const app = creaApp();
    await app.conferma(riepilogo(cartella('E:img', 'img'), ['a.png', 'b.png', 'c.png']));
    app.modifica('a.png', ['x', 'nuovo a']);
    await app.conferma(riepilogo(cartella('E:img', 'img'), ['a.png', 'b.png', 'c.png', 'd.png']));
    dice('premessa: entra solo d.png', ['a.png', 'b.png', 'c.png', 'd.png'], app.nomi());
    app.modifica('d.png', ['nuovo d']);
    const lotto = (n) => app.images.find(i => i.file.name === n)?.lottoImport;
    dice('d.png entra nel lotto delle foto gia\' aperte', lotto('a.png'), lotto('d.png'));
    const salvato = B.costruisciBackup(app.images, [], 'img');
    dice('il backup ha UNA impronta: quella della cartella intera', ['img|4|a.png|d.png'], (salvato?.sources || []).map(s => s.signature));
    // ITALIANO: crash; si riapre la cartella intera in un'app nuova con quel backup.
    // ENGLISH: crash; the whole folder is reopened in a new app with that backup.
    const dopo = creaApp({ backup: JSON.stringify({ ts: 1, ...salvato }) });
    await dopo.conferma(riepilogo(cartella('E:img', 'img'), ['a.png', 'b.png', 'c.png', 'd.png']));
    dice('dopo il crash le modifiche di a.png e d.png tornano', [['x', 'nuovo a'], [], [], ['nuovo d']], dopo.images.map(i => i.tags));
}
{
    // ITALIANO: b.png chiusa con la X (resta fra le foto chiuse, con il suo id vecchio) e poi ripresa
    //           riaprendo la cartella: entra nel lotto riusato con un id nuovo. Prima contava due volte
    //           nell'impronta ("img|4|...") e dopo un crash la modifica di a.png non tornava.
    // ENGLISH: b.png closed with the X (it stays among the closed photos, with its old id) and then
    //          taken back by reopening the folder: it enters the reused batch with a new id. It used to
    //          count twice in the fingerprint ("img|4|...") and after a crash a.png's edit did not come back.
    const app = creaApp();
    await app.conferma(riepilogo(cartella('E:img', 'img'), ['a.png', 'b.png', 'c.png']));
    app.modifica('a.png', ['x', 'nuovo a']);
    const b = app.images.find(i => i.file.name === 'b.png');
    // ITALIANO: come handleCloseImage in src/App.tsx.
    // ENGLISH: as handleCloseImage in src/App.tsx.
    const chiuse = new Map([[b.id, { id: b.id, name: b.file.name, lotto: String(b.lottoImport || ''), cartella: String(b.cartellaImport || ''), foto: b }]]);
    app.images = app.images.filter(i => i.id !== b.id);
    app.refs.imagesRef.current = app.images;
    await app.conferma(riepilogo(cartella('E:img', 'img'), ['a.png', 'b.png', 'c.png']));
    dice('premessa: b.png rientra nel lotto delle altre, con un id nuovo', [true, true],
        [app.images.find(i => i.file.name === 'b.png').lottoImport === b.lottoImport, app.images.find(i => i.file.name === 'b.png').id !== b.id]);
    const salvato = B.costruisciBackup(app.images, chiuse.values(), 'img');
    dice('foto chiusa e ripresa: l\'impronta e\' quella della cartella di 3 foto', ['img|3|a.png|c.png'], (salvato?.sources || []).map(s => s.signature));
    const dopo = creaApp({ backup: salvato ? JSON.stringify({ ts: 1, ...salvato }) : null });
    await dopo.conferma(riepilogo(cartella('E:img', 'img'), ['a.png', 'b.png', 'c.png']));
    dice('dopo il crash la modifica di a.png torna', [['x', 'nuovo a'], [], []], dopo.images.map(i => i.tags));
}
{
    // ITALIANO: quello che NON deve cambiare: foto aperte da due cartelle diverse, o senza cartella.
    // ENGLISH: what must NOT change: open photos from two different folders, or with no folder.
    const app = creaApp();
    await app.conferma(riepilogo(cartella('E:img', 'img'), ['a.png']));
    await app.conferma(riepilogo(cartella('F:img', 'img'), ['b.png']));
    dice('due cartelle diverse con lo stesso nome restano due lotti', true, app.images[0].lottoImport !== app.images[1].lottoImport);
    // ITALIANO: una foto di "Carica cartella" e una di "Carica immagini" non finiscono mai nello stesso lotto.
    // ENGLISH: a photo from "Load folder" and one from "Load images" never end up in the same batch.
    const m = creaApp();
    await m.conferma(riepilogo(cartella('E:img', 'img'), ['a.png']));
    await m.conferma({ ...riepilogo(cartella('E:img', 'img'), ['a.png', 'e.png']), handle: null, folderOf: null });
    dice('foto aperta con "Carica cartella", poi "Carica immagini": la foto nuova ha un lotto suo', [['a.png', 'e.png'], true],
        [m.nomi(), m.images[0].lottoImport !== m.images[1].lottoImport]);
}

console.log('\n--- 1 bis) "Carica immagini" o trascinamento: le stesse foto piu\' una nuova, poi un crash ---');
// ITALIANO: "Carica immagini" e il trascinamento non hanno una cartella scelta (handle null): la cartella
//           di ogni foto e' la stringa del suo percorso (come loadSidecarTxtFiles). Prima la foto nuova
//           prendeva SEMPRE un lotto a parte: il backup restava con l'impronta "|2|a.png|b.png" e, dopo un
//           crash, ricaricando a, b e c insieme la modifica di a.png si perdeva in silenzio.
// ENGLISH: "Load images" and drag and drop have no picked folder (handle null): each photo's folder is
//          the string of its path (as loadSidecarTxtFiles). The new photo used to ALWAYS take a separate
//          batch: the backup kept the fingerprint "|2|a.png|b.png" and, after a crash, reloading a, b and
//          c together lost a.png's edit silently.
const caricaImmagini = (nomi, dir = 'E:\\shoot') => {
    const imgFiles = nomi.map(n => ({ name: n, percorso: dir + '\\' + n }));
    return { imgFiles, txtFiles: [], handle: null, folderOf: new Map(imgFiles.map(f => [f, dir])), relPathOf: null, pathOf: null, cartellaRelOf: null };
};
{
    const app = creaApp();
    await app.conferma(caricaImmagini(['a.png', 'b.png']));
    await app.conferma(caricaImmagini(['a.png', 'b.png', 'c.png']));
    dice('premessa: entra solo c.png', ['a.png', 'b.png', 'c.png'], app.nomi());
    dice('c.png entra nel lotto delle foto gia\' aperte', 1, new Set(app.images.map(i => i.lottoImport)).size);
    app.modifica('a.png', ['nuovo a']);
    const salvato = B.costruisciBackup(app.images, [], '');
    dice('il backup ha UNA impronta: quella delle tre foto', ['|3|a.png|c.png'], (salvato?.sources || []).map(s => s.signature));
    const dopo = creaApp({ backup: salvato ? JSON.stringify({ ts: 1, ...salvato }) : null });
    await dopo.conferma(caricaImmagini(['a.png', 'b.png', 'c.png']));
    dice('dopo il crash, ricaricando a, b, c, la modifica di a.png torna', [['nuovo a'], [], []], dopo.images.map(i => i.tags));
}
{
    // ITALIANO: foto aperte da DUE caricamenti diversi: la foto nuova ha un lotto suo, come prima.
    // ENGLISH: photos open from TWO different loads: the new photo gets a batch of its own, as before.
    const app = creaApp();
    await app.conferma(caricaImmagini(['a.png']));
    await app.conferma(caricaImmagini(['b.png']));
    await app.conferma(caricaImmagini(['a.png', 'b.png', 'f.png']));
    dice('due lotti gia\' aperti: f.png non entra in nessuno dei due', 3, new Set(app.images.map(i => i.lottoImport)).size);
}

console.log('\n--- 2) cartella di rete \\\\server\\condivisione (nessun percorso) riaperta ---');
{
    const app = creaApp({ percorsi: false });
    await app.conferma(riepilogo(cartella('NAS', 'dataset'), ['a.png', 'b.png'], { percorsi: false }));
    await app.conferma(riepilogo(cartella('NAS', 'dataset'), ['a.png', 'b.png'], { percorsi: false }));
    dice('riaprendo, nessuna foto entra due volte', ['a.png', 'b.png'], app.nomi());
    dice('...e l\'avviso dice che erano gia\' aperte', [t.importAlreadyOpen.replace('{n}', '2'), 'info'], app.ultimo());
    await app.conferma(riepilogo(cartella('NAS', 'dataset'), ['A.PNG', 'c.png'], { percorsi: false }));
    dice('stesso file scritto con altre maiuscole: gia\' aperto; c.png entra', ['a.png', 'b.png', 'c.png'], app.nomi());
    await app.conferma(riepilogo(cartella('NAS2', 'dataset'), ['a.png'], { percorsi: false }));
    dice('una cartella DIVERSA con lo stesso nome e la stessa foto: entra', ['a.png', 'a.png', 'b.png', 'c.png'], app.nomi());
    const r = creaApp({ percorsi: false });
    await r.conferma(riepilogo(cartella('NAS', 'dataset', { rotta: true }), ['a.png'], { percorsi: false }));
    await r.conferma(riepilogo(cartella('NAS', 'dataset', { rotta: true }), ['a.png'], { percorsi: false }));
    dice('se isSameEntry non risponde si importa, come prima', ['a.png', 'a.png'], r.nomi());
}

console.log('\n--- 3) riaprire la stessa cartella mentre il primo import fa le miniature ---');
{
    const app = creaApp();
    const apri = app.cancello('a.png');
    const primo = app.conferma(riepilogo(cartella('E:img', 'img'), ['a.png', 'b.png']));
    await attendi(400);
    await app.conferma(riepilogo(cartella('E:img', 'img'), ['a.png', 'b.png']));
    dice('il secondo Importa non fa entrare di nuovo le stesse foto', [t.importAlreadyOpen.replace('{n}', '2'), 'info'], app.ultimo());
    await app.conferma(riepilogo(cartella('E:altra', 'altra'), ['c.png']));
    dice('una cartella diversa intanto entra', ['c.png'], app.nomi());
    apri();
    await primo;
    dice('finito il primo: ogni foto una volta sola', ['a.png', 'b.png', 'c.png'], app.nomi());
    dice('...e non resta niente "in arrivo"', 0, (app.refs.importInCorsoRef.current || []).length);
}
{
    // ITALIANO: Reset durante il primo import: le sue foto non entrano, e nel progetto nuovo la stessa
    //           cartella si apre normalmente.
    // ENGLISH: Reset during the first import: its photos do not enter, and in the new project the same
    //          folder opens normally.
    const app = creaApp();
    const apri = app.cancello('x.png');
    const primo = app.conferma(riepilogo(cartella('E:img', 'img'), ['x.png']));
    await attendi(400);
    app.refs.progettoGenRef.current++;
    const secondo = app.conferma(riepilogo(cartella('E:img', 'img'), ['x.png']));
    apri();
    await primo;
    await secondo;
    dice('dopo Reset la stessa cartella entra nel progetto nuovo, una volta', ['x.png'], app.nomi());
}

console.log('\n--- 4) i .txt delle foto gia\' aperte non tornano nell\'avviso ---');
const enorme = 'woman, ' + 'x'.repeat(1024 * 1024);
const lungo = Array.from({ length: 2500 }, (_, i) => 'tag' + i).join(', ');
{
    const app = creaApp();
    await app.conferma(riepilogo(cartella('E:img', 'img'), ['a.png'], { txt: { 'a.txt': 'cat,' } }));
    await app.conferma(riepilogo(cartella('E:img', 'img'), ['a.png', 'b.png'], { txt: { 'a.txt': enorme, 'b.txt': 'dog,' } }));
    dice('a.txt oltre 1 MB di una foto gia\' aperta: avviso verde, senza .txt saltati',
        [[t.successImport.replace('{n}', '1'), t.importAlreadyOpen.replace('{n}', '1')].join(' · '), 'success'], app.ultimo());
    await app.conferma(riepilogo(cartella('E:img', 'img'), ['a.png', 'b.png', 'c.png'], { txt: { 'a.txt': lungo, 'c.txt': 'sun,' } }));
    dice('a.txt accorciato di una foto gia\' aperta: avviso verde, non l\'errore "accorciati"',
        [[t.successImport.replace('{n}', '1'), t.importAlreadyOpen.replace('{n}', '2')].join(' · '), 'success'], app.ultimo());
    dice('...e le foto nuove hanno i loro tag', [['dog'], ['sun']], app.images.filter(i => i.file.name !== 'a.png').map(i => i.tags));
}
{
    // ITALIANO: a.png aperta e a.jpg nuova con lo stesso a.txt: il .txt serve ad a.jpg e si legge.
    // ENGLISH: a.png open and a.jpg new with the same a.txt: the .txt is needed by a.jpg and is read.
    const app = creaApp();
    await app.conferma(riepilogo(cartella('E:img', 'img'), ['a.png'], { txt: { 'a.txt': 'cat,' } }));
    await app.conferma(riepilogo(cartella('E:img', 'img'), ['a.png', 'a.jpg'], { txt: { 'a.txt': enorme } }));
    dice('a.txt condiviso con la foto nuova a.jpg: il .txt oltre 1 MB si segnala ancora',
        [N.avvisoImport(t, { caricate: 1, ripristinate: 0, saltati: 1, accorciati: 0, nomiSaltati: ['a.txt'], giaAperte: 1 }).testo, 'info'], app.ultimo());
    await app.conferma(riepilogo(cartella('E:img', 'img'), ['a.png', 'z.png'], { txt: { 'orfano.txt': enorme } }));
    // ITALIANO: un .txt senza foto non si legge e non entra nell'avviso (vedi test-import-orphan-txt.mjs).
    // ENGLISH: a .txt with no photo is not read and stays out of the notice (see test-import-orphan-txt.mjs).
    dice('un .txt senza foto non entra nell\'avviso',
        [N.avvisoImport(t, { caricate: 1, ripristinate: 0, saltati: 0, accorciati: 0, nomiSaltati: [], giaAperte: 1 }).testo, 'success'], app.ultimo());
}

process.exit(esito());
