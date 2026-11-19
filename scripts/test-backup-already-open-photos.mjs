/* ITALIANO: PROVA DEL BACKUP ANTI-CRASH CON LE FOTO DELLA CARTELLA GIA' APERTE IN UN ALTRO LOTTO
   Si apre prima una sottocartella (o una foto da sola) e poi la cartella madre: le foto gia' aperte
   restano nel loro lotto e quelle nuove entrano in un lotto a parte, la cui impronta deve essere
   quella della cartella intera. Tre difetti, tutti con la stessa radice (le foto gia' aperte
   riconosciute solo dal NOME):
   1) con gli stessi nomi in sottocartelle diverse (0001.png in 10_face e in 20_body) l'impronta
      scritta era «ds|2|...» invece di «ds|4|...»: dopo un crash la riapertura di ds non proponeva
      niente e le modifiche non salvate si perdevano in silenzio;
   2) le modifiche delle foto aperte PER PRIME restavano solo nella sorgente del loro lotto: riaprendo
      normalmente la cartella madre non venivano proposte;
   3) crash con la cartella madre aperta, poi alla ripartenza la sottocartella e la madre: il
      riepilogo annunciava 4 foto, l'import ne recuperava 2 e un secondo dopo le voci delle foto gia'
      aperte sparivano dal backup.
   Ora ogni foto gia' aperta si riconosce dal suo id e dalla chiave che ha in QUESTA cartella: conta
   una volta nell'impronta, la sua modifica entra anche nella sorgente della cartella madre, e con la
   casella spuntata la voce del backup torna anche sulla foto gia' aperta, se questa non ha modifiche
   sue e il suo .txt e' ancora quello del backup.
   Si eseguono i testi VERI di confermaImport e processImportData (scripts/import-harness.mjs) e le
   regole vere di src/utils/tagBackup.ts e src/utils/closeGuard.ts.
   Uso:  node scripts/test-backup-already-open-photos.mjs   (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE CRASH BACKUP WITH THE FOLDER'S PHOTOS ALREADY OPEN IN ANOTHER BATCH
   A subfolder (or a single photo) is opened first and then the parent folder: the photos already
   open stay in their batch and the new ones go into a separate batch, whose fingerprint must be the
   whole folder's. Three defects, all with the same root (the photos already open recognised by
   NAME only):
   1) with the same names in different subfolders (0001.png in 10_face and in 20_body) the written
      fingerprint was "ds|2|..." instead of "ds|4|...": after a crash reopening ds offered nothing
      and the unsaved edits were lost silently;
   2) the edits of the photos opened FIRST stayed only in their own batch's source: reopening the
      parent folder normally did not offer them;
   3) crash with the parent folder open, then on restart the subfolder and the parent: the summary
      announced 4 photos, the import recovered 2 and a second later the entries of the photos
      already open vanished from the backup.
   Now every photo already open is recognised by its id and by the key it has in THIS folder: it
   counts once in the fingerprint, its edit also goes into the parent folder's source, and with the
   box ticked the backup entry comes back on the photo already open too, when it has no edits of its
   own and its .txt is still the backup's.
   The REAL texts of confermaImport and processImportData (scripts/import-harness.mjs) and the real
   rules of src/utils/tagBackup.ts and src/utils/closeGuard.ts are run.
   Usage:  node scripts/test-backup-already-open-photos.mjs   (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';
import { creaApp, t } from './import-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const carica = async (rel) => import('data:text/javascript;base64,' + Buffer.from((await esbuild.build({
    entryPoints: [path.join(radice, rel)], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
})).outputFiles[0].text).toString('base64'));
const B = await carica('src/utils/tagBackup.ts');
const C = await carica('src/utils/closeGuard.ts');
const S = await carica('src/utils/sidecarTags.ts');
const { dice, esito } = creaControlli();

const BS = '\\';
const SEP = B.BACKUP_KEY_SEP;
const memoria = (iniziale = null) => {
    let v = iniziale;
    return { getItem: (k) => (k === 'tagBackup' ? v : null), setItem: (k, x) => { if (k === 'tagBackup') v = String(x); }, removeItem: (k) => { if (k === 'tagBackup') v = null; }, get valore() { return v; } };
};
// ITALIANO: le maniglie vere di «Carica cartella»: isSameEntry riconosce lo stesso file sul disco.
// ENGLISH: the real "Load folder" handles: isSameEntry recognises the same file on disk.
const maniglia = (disco, nome) => { const c = { disco, name: nome, getFileHandle() { } }; c.isSameEntry = async (o) => Boolean(o) && o.disco === c.disco; return c; };
const foto = (nome, ...cartelle) => ({ name: nome, percorso: ['E:', ...cartelle, nome].join(BS), size: 10, lastModified: 1000 });
// ITALIANO: «Carica cartella» su una sottocartella da sola: chiave relativa = il suo nome (come scanDirectoryHandle).
// ENGLISH: "Load folder" on a subfolder alone: relative key = its name (like scanDirectoryHandle).
const sotto = (sub, nomi) => {
    const h = maniglia('ds/' + sub, sub);
    const imgFiles = nomi.map(n => foto(n, 'ds', sub));
    return { imgFiles, txtFiles: [], handle: h, folderOf: new Map(imgFiles.map(f => [f, h])), relPathOf: new Map(imgFiles.map(f => [f, sub])),
        pathOf: new Map(imgFiles.map(f => [f, f.percorso])), cartellaRelOf: null };
};
// ITALIANO: «Carica cartella» sulla cartella madre ds: `parti` = { sottocartella: [nomi] }.
// ENGLISH: "Load folder" on the parent folder ds: `parti` = { subfolder: [names] }.
const madre = (parti) => {
    const h = maniglia('ds', 'ds');
    const imgFiles = [], folderOf = new Map(), relPathOf = new Map();
    for (const [sub, nomi] of Object.entries(parti)) {
        const hs = maniglia('ds/' + sub, sub);
        for (const n of nomi) { const f = foto(n, 'ds', sub); imgFiles.push(f); folderOf.set(f, hs); relPathOf.set(f, 'ds/' + sub); }
    }
    return { imgFiles, txtFiles: [], handle: h, folderOf, relPathOf, pathOf: new Map(imgFiles.map(f => [f, f.percorso])), cartellaRelOf: null };
};
// ITALIANO: foto sciolte («Carica immagini») e la loro cartella aperta dopo con «Carica cartella».
// ENGLISH: loose photos ("Load images") and their folder opened afterwards with "Load folder".
const sciolte = (nomi) => {
    const imgFiles = nomi.map(n => foto(n, 'F'));
    return { imgFiles, txtFiles: [], handle: null, folderOf: new Map(imgFiles.map(f => [f, S.cartellaImmagine(f.percorso)])), relPathOf: null, pathOf: null, cartellaRelOf: null };
};
const cartellaF = (nomi) => {
    const h = maniglia('F', 'F');
    const imgFiles = nomi.map(n => foto(n, 'F'));
    return { imgFiles, txtFiles: [], handle: h, folderOf: new Map(imgFiles.map(f => [f, h])), relPathOf: new Map(imgFiles.map(f => [f, 'F'])),
        pathOf: new Map(imgFiles.map(f => [f, f.percorso])), cartellaRelOf: null };
};
const riepilogoDi = (app, grezzo, d) => {
    const chiave = app.render(d).makeBackupKeyer;
    const cd = chiave(d.folderOf, d.relPathOf), fd = chiave(d.folderOf, null);
    return B.recuperoDellImport(grezzo, d.handle, d.imgFiles, d.imgFiles.flatMap(f => [cd(f), fd(f)]));
};
// ITALIANO: un'altra sessione dopo il crash: i lotti di quella vecchia hanno un altro nome.
// ENGLISH: another session after the crash: the old one's batches have another name.
const dopoIlCrash = (grezzo) => grezzo.split('"lotto":"lotto').join('"lotto":"vecchio-lotto');
const conTag = (images, chiaviDaCambiare, tag) => images.map(i => (chiaviDaCambiare.includes(i.backupKey) ? { ...i, tags: [...i.tags, tag] } : i));
const tagDi = (app, chiave) => (app.images.find(i => i.backupKey === chiave) || { tags: null }).tags;
const firme = (grezzo) => (grezzo ? JSON.parse(grezzo).sources.map(s => s.signature) : []);
const chiaviNelBackup = (grezzo) => (grezzo ? JSON.parse(grezzo).sources.flatMap(s => Object.keys(s.data)).sort() : []);

console.log('\n--- 1) gli stessi nomi in due sottocartelle: 10_face aperta prima, poi ds ---');
{
    const NOMI = ['0001.png', '0002.png'];
    const app1 = creaApp();
    await app1.conferma(sotto('10_face', NOMI));
    await app1.conferma(madre({ '10_face': NOMI, '20_body': NOMI }));
    dice('premessa: quattro foto aperte, in due lotti', [4, 2], [app1.images.length, new Set(app1.images.map(i => i.lottoImport)).size]);
    const st = memoria();
    C.scriviBackupSubito(st, conTag(app1.images, ['ds/20_body' + SEP + '0001.png'], 'modifica'), [], 'ds', [], new Set());
    const normale = B.folderSignature('ds', [...NOMI, ...NOMI]);
    dice('l\'impronta scritta e\' quella di una riapertura normale di ds (4 foto)', true, firme(st.valore).includes(normale));
    const grezzo = dopoIlCrash(st.valore);
    const app2 = creaApp({ backup: grezzo });
    const d = madre({ '10_face': NOMI, '20_body': NOMI });
    dice('riaprendo ds dopo il crash il riepilogo propone una foto', 1, (riepilogoDi(app2, grezzo, d) || {}).n);
    await app2.conferma(d, true);
    dice('...e 20_body/0001.png torna con la modifica', ['modifica'], tagDi(app2, 'ds/20_body' + SEP + '0001.png'));
}

console.log('\n--- 2) le modifiche delle foto aperte per prime tornano riaprendo la cartella madre ---');
{
    const app1 = creaApp();
    await app1.conferma(sotto('10_face', ['a.png']));
    await app1.conferma(madre({ '10_face': ['a.png'], '20_body': ['b.png'] }));
    const st = memoria();
    C.scriviBackupSubito(st, conTag(app1.images, ['10_face' + SEP + 'a.png', 'ds/20_body' + SEP + 'b.png'], 'modifica'), [], 'ds', [], new Set());
    const grezzo = dopoIlCrash(st.valore);
    const d = madre({ '10_face': ['a.png'], '20_body': ['b.png'] });
    const app2 = creaApp({ backup: grezzo });
    dice('riaprendo ds il riepilogo propone tutte e due le foto', 2, (riepilogoDi(app2, grezzo, d) || {}).n);
    await app2.conferma(d, true);
    dice('a.png (aperta per prima) torna con la modifica', ['modifica'], tagDi(app2, 'ds/10_face' + SEP + 'a.png'));
    dice('b.png torna con la modifica', ['modifica'], tagDi(app2, 'ds/20_body' + SEP + 'b.png'));
    // ITALIANO: la riapertura della sola sottocartella continua a recuperare la sua modifica.
    // ENGLISH: reopening the subfolder alone still recovers its edit.
    const app3 = creaApp({ backup: grezzo });
    await app3.conferma(sotto('10_face', ['a.png']), true);
    dice('riaprendo 10_face da sola a.png torna come prima', ['modifica'], tagDi(app3, '10_face' + SEP + 'a.png'));
}
{
    // ITALIANO: la stessa cosa con una foto caricata da sola e poi la sua cartella.
    // ENGLISH: the same with a photo loaded alone and then its folder.
    const app1 = creaApp();
    await app1.conferma(sciolte(['a.png']));
    await app1.conferma(cartellaF(['a.png', 'b.png', 'c.png']));
    const st = memoria();
    C.scriviBackupSubito(st, app1.images.map(i => (i.file.name === 'c.png' ? i : { ...i, tags: [...i.tags, 'modifica'] })), [], 'F', [], new Set());
    const grezzo = dopoIlCrash(st.valore);
    const app2 = creaApp({ backup: grezzo });
    await app2.conferma(cartellaF(['a.png', 'b.png', 'c.png']), true);
    dice('foto sciolta poi cartella: riaprendo F tornano a.png e b.png', [['modifica'], ['modifica'], []],
        [tagDi(app2, 'F' + SEP + 'a.png'), tagDi(app2, 'F' + SEP + 'b.png'), tagDi(app2, 'F' + SEP + 'c.png')]);
}

console.log('\n--- 3) crash con ds aperta; poi la sottocartella 10_face e la madre ds ---');
const PARTI = { '10_face': ['a1.png', 'a2.png'], '20_body': ['b1.png', 'b2.png'] };
const crash = async () => {
    const app = creaApp();
    await app.conferma(madre(PARTI));
    const st = memoria();
    C.scriviBackupSubito(st, app.images.map(i => ({ ...i, tags: [...i.tags, 'nuovo tag'] })), [], 'ds', [], new Set());
    return dopoIlCrash(st.valore);
};
{
    const grezzo = await crash();
    const app = creaApp({ backup: grezzo });
    await app.conferma(sotto('10_face', PARTI['10_face']), true);
    dice('premessa: la sottocartella da sola non propone niente (impronta diversa)', [[], []], [tagDi(app, '10_face' + SEP + 'a1.png'), tagDi(app, '10_face' + SEP + 'a2.png')]);
    const d = madre(PARTI);
    dice('premessa: il riepilogo di ds annuncia 4 foto', 4, (riepilogoDi(app, grezzo, d) || {}).n);
    await app.conferma(d, true);
    dice('a1, a2 (gia\' aperte), b1, b2: tutte con «nuovo tag»', [['nuovo tag'], ['nuovo tag'], ['nuovo tag'], ['nuovo tag']],
        [tagDi(app, '10_face' + SEP + 'a1.png'), tagDi(app, '10_face' + SEP + 'a2.png'), tagDi(app, 'ds/20_body' + SEP + 'b1.png'), tagDi(app, 'ds/20_body' + SEP + 'b2.png')]);
    dice('l\'avviso conta 4 foto recuperate', true, String((app.ultimo() || [''])[0]).includes(t.importRestoredFromBackup.replace('{n}', '4')));
    const dopo = memoria(grezzo);
    C.scriviBackupSubito(dopo, app.images, [], 'ds', [], new Set());
    dice('un secondo dopo il backup ha ancora le voci di a1 e a2', true,
        ['ds/10_face' + SEP + 'a1.png', 'ds/10_face' + SEP + 'a2.png'].every(k => chiaviNelBackup(dopo.valore).includes(k)));
    const app2 = creaApp({ backup: dopoIlCrash(dopo.valore) });
    await app2.conferma(madre(PARTI), true);
    dice('...e dopo un altro crash la riapertura di ds le recupera tutte', 4, app2.images.filter(i => i.tags.includes('nuovo tag')).length);
}
{
    // ITALIANO: a1 cambiata dall'utente prima di aprire ds: le sue modifiche restano, la voce non la copre.
    // ENGLISH: a1 changed by the user before opening ds: their edits stay, the entry does not cover them.
    const grezzo = await crash();
    const app = creaApp({ backup: grezzo });
    await app.conferma(sotto('10_face', PARTI['10_face']), true);
    app.images = app.images.map(i => (i.file.name === 'a1.png' ? { ...i, tags: ['mio tag'] } : i));
    app.refs.imagesRef.current = app.images;
    await app.conferma(madre(PARTI), true);
    dice('a1 con modifiche sue: restano; a2 recuperata', [['mio tag'], ['nuovo tag']], [tagDi(app, '10_face' + SEP + 'a1.png'), tagDi(app, '10_face' + SEP + 'a2.png')]);
}
{
    // ITALIANO: casella tolta: niente si applica, come per le foto nuove.
    // ENGLISH: box unticked: nothing is applied, as for the new photos.
    const grezzo = await crash();
    const app = creaApp({ backup: grezzo });
    await app.conferma(sotto('10_face', PARTI['10_face']), true);
    await app.conferma(madre(PARTI), false);
    dice('casella tolta: nessuna foto riceve il backup', 0, app.images.filter(i => i.tags.includes('nuovo tag')).length);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    // ITALIANO: foto sciolta chiusa con la X e ripresa riaprendo la cartella: conta una volta sola.
    // ENGLISH: loose photo closed with the X and taken back by reopening the folder: counted once.
    const app1 = creaApp();
    await app1.conferma(sciolte(['a.png']));
    await app1.conferma(cartellaF(['a.png', 'b.png', 'c.png']));
    const vecchia = app1.images.find(i => i.file.name === 'a.png');
    app1.images = app1.images.filter(i => i !== vecchia);
    app1.refs.imagesRef.current = app1.images;
    const chiuse = [{ id: vecchia.id, name: 'a.png', lotto: vecchia.lottoImport, cartella: vecchia.cartellaImport, foto: vecchia }];
    await app1.conferma(cartellaF(['a.png', 'b.png', 'c.png']));
    dice('premessa: a.png ripresa nel lotto della cartella', 1, new Set(app1.images.map(i => i.lottoImport)).size);
    const st = memoria();
    C.scriviBackupSubito(st, conTag(app1.images, ['F' + SEP + 'b.png'], 'modifica'), chiuse, 'F', [], new Set());
    dice('impronta di 3 foto, non 4', [B.folderSignature('F', ['a.png', 'b.png', 'c.png'])], firme(st.valore));
}
{
    // ITALIANO: nomi diversi, sottocartella poi madre, modifica solo su una foto entrata con la madre.
    // ENGLISH: different names, subfolder then parent, an edit only on a photo that came with the parent.
    const app1 = creaApp();
    await app1.conferma(sotto('10_face', ['a.png']));
    await app1.conferma(madre({ '10_face': ['a.png'], '20_body': ['b.png'] }));
    const st = memoria();
    C.scriviBackupSubito(st, conTag(app1.images, ['ds/20_body' + SEP + 'b.png'], 'modifica'), [], 'ds', [], new Set());
    dice('solo la sorgente di ds, con la sola voce di b.png', [[B.folderSignature('ds', ['a.png', 'b.png'])], ['ds/20_body' + SEP + 'b.png']],
        [firme(st.valore), chiaviNelBackup(st.valore)]);
}
{
    // ITALIANO: la sottocartella torna fuori dalla memoria (Ctrl+Z oltre il suo import): non conta piu'.
    // ENGLISH: the subfolder leaves memory (Ctrl+Z past its import): it no longer counts.
    const app1 = creaApp();
    await app1.conferma(sotto('10_face', ['a.png']));
    await app1.conferma(madre({ '10_face': ['a.png'], '20_body': ['b.png'] }));
    const senzaA = conTag(app1.images, ['ds/20_body' + SEP + 'b.png'], 'modifica').filter(i => i.file.name !== 'a.png');
    const st = memoria();
    C.scriviBackupSubito(st, senzaA, [], 'ds', [], new Set());
    dice('foto aperta per prima non piu\' in memoria: l\'impronta conta solo b.png', [B.folderSignature('ds', ['b.png'])], firme(st.valore));
}

process.exit(esito());
