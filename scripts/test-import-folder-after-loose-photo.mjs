/* ITALIANO: PROVA DEL BACKUP ANTI-CRASH CON UNA FOTO DELLA CARTELLA APERTA PRIMA DA SOLA
   Una foto (a.png) caricata da sola o trascinata, poi la sua cartella F (a, b, c) con «Carica
   Cartella»: b e c entrano in un lotto a parte, perche' a.png sta nel lotto delle foto sciolte, e
   l'impronta del backup di quel lotto contava solo b e c («F|2|b.png|c.png»). Dopo un crash, la
   riapertura normale di F ha l'impronta della cartella intera («F|3|a.png|c.png»): il riepilogo non
   proponeva niente e la modifica di b.png si perdeva in silenzio. Al contrario (crash con F aperta
   normalmente, poi a.png da sola e la cartella) il riepilogo annunciava il recupero, ma l'import lo
   ricalcolava sulle sole foto nuove e non applicava niente. Ora il lotto delle foto nuove ha
   l'impronta della cartella intera: si contano anche le foto della cartella gia' aperte in un altro
   lotto (nomiImpronta), sia scrivendo il backup sia cercandolo all'import.
   Si eseguono i testi VERI di confermaImport e processImportData (scripts/import-harness.mjs) e le
   regole vere di src/utils/tagBackup.ts e src/utils/closeGuard.ts.
   Uso:  node scripts/test-import-folder-after-loose-photo.mjs   (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE CRASH BACKUP WITH A PHOTO OF THE FOLDER OPENED ALONE FIRST
   A photo (a.png) loaded alone or dropped, then its folder F (a, b, c) with "Load Folder": b and c
   go into a separate batch, because a.png is in the loose photos' batch, and that batch's backup
   fingerprint counted only b and c ("F|2|b.png|c.png"). After a crash, the normal reopening of F
   has the whole folder's fingerprint ("F|3|a.png|c.png"): the summary offered nothing and b.png's
   edit was lost silently. The other way round (crash with F opened normally, then a.png alone and
   the folder) the summary announced the recovery, but the import recomputed it on the new photos
   only and applied nothing. Now the new photos' batch has the whole folder's fingerprint: the
   folder's photos already open in another batch count too (nomiImpronta), both when writing the
   backup and when looking it up at import.
   The REAL texts of confermaImport and processImportData (scripts/import-harness.mjs) and the real
   rules of src/utils/tagBackup.ts and src/utils/closeGuard.ts are run.
   Usage:  node scripts/test-import-folder-after-loose-photo.mjs   (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';
import { creaApp, cartella, riepilogo } from './import-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const carica = async (rel) => import('data:text/javascript;base64,' + Buffer.from((await esbuild.build({
    entryPoints: [path.join(radice, rel)], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
})).outputFiles[0].text).toString('base64'));
const B = await carica('src/utils/tagBackup.ts');
const C = await carica('src/utils/closeGuard.ts');
const S = await carica('src/utils/sidecarTags.ts');
const { dice, esito } = creaControlli();

const BS = '\\';
const memoria = (iniziale = null) => {
    let v = iniziale;
    return { getItem: (k) => (k === 'tagBackup' ? v : null), setItem: (k, x) => { if (k === 'tagBackup') v = String(x); }, removeItem: (k) => { if (k === 'tagBackup') v = null; }, get valore() { return v; } };
};
// ITALIANO: foto sciolte («Carica immagini» o trascinamento) prese da una cartella del disco.
// ENGLISH: loose photos ("Load images" or drag and drop) taken from a folder on disk.
const sciolte = (dir, nomi) => {
    const imgFiles = nomi.map(n => ({ name: n, percorso: dir + BS + n, size: 10, lastModified: 1000 }));
    const folderOf = new Map(imgFiles.map(f => [f, S.cartellaImmagine(f.percorso)]));
    return { imgFiles, txtFiles: [], handle: null, folderOf, relPathOf: null, pathOf: null, cartellaRelOf: null };
};
// ITALIANO: un'altra sessione dopo il crash: i lotti di quella vecchia hanno un altro nome.
// ENGLISH: another session after the crash: the old one's batches have another name.
const dopoIlCrash = (grezzo) => grezzo.split('"lotto":"lotto').join('"lotto":"vecchio-lotto');
const modifica = (images, nome, tag) => images.map(i => (i.file.name === nome ? { ...i, tags: [...i.tags, tag] } : i));
const tagDi = (app, nome) => (app.images.find(i => i.file.name === nome) || { tags: null }).tags;
const F = () => cartella('discoF', 'F');
const TUTTE = ['a.png', 'b.png', 'c.png'];

console.log('\n--- verso 1: a.png da sola, poi la cartella F; modifica di b.png; crash; riapertura di F ---');
{
    const app1 = creaApp();
    await app1.conferma(sciolte('E:' + BS + 'F', ['a.png']));
    await app1.conferma(riepilogo(F(), TUTTE));
    dice('premessa: tre foto, a.png non aggiunta due volte', ['a.png', 'b.png', 'c.png'], app1.nomi());
    const st = memoria();
    C.scriviBackupSubito(st, modifica(app1.images, 'b.png', 'modifica'), [], 'F', [], new Set());
    const firme = JSON.parse(st.valore).sources.map(s => s.signature);
    dice('il backup ha l\'impronta della cartella intera', [B.folderSignature('F', TUTTE)], firme);
    const grezzo = dopoIlCrash(st.valore);
    const d2 = riepilogo(F(), TUTTE);
    const r = B.recuperoDellImport(grezzo, d2.handle, d2.imgFiles);
    dice('alla riapertura di F il riepilogo propone una foto da recuperare', 1, r && r.n);
    const app2 = creaApp({ backup: grezzo });
    await app2.conferma(d2, true);
    dice('b.png torna con la modifica non salvata', ['modifica'], tagDi(app2, 'b.png'));
    dice('l\'avviso di fine import lo dice', true, String((app2.ultimo() || [''])[0]).includes('recovered'));
}

console.log('\n--- verso 2: crash con F aperta normalmente; poi a.png da sola e la cartella F ---');
{
    const app1 = creaApp();
    await app1.conferma(riepilogo(F(), TUTTE));
    const st = memoria();
    C.scriviBackupSubito(st, modifica(app1.images, 'b.png', 'modifica'), [], 'F', [], new Set());
    const grezzo = dopoIlCrash(st.valore);
    const app2 = creaApp({ backup: grezzo });
    await app2.conferma(sciolte('E:' + BS + 'F', ['a.png']));
    const d2 = riepilogo(F(), TUTTE);
    const r = B.recuperoDellImport(grezzo, d2.handle, d2.imgFiles);
    dice('premessa: il riepilogo della cartella annuncia una foto', 1, r && r.n);
    await app2.conferma(d2, true);
    dice('dopo «Importa» b.png ha la modifica annunciata', ['modifica'], tagDi(app2, 'b.png'));
    dice('...e a.png (gia\' aperta) non e\' stata aggiunta di nuovo', ['a.png', 'b.png', 'c.png'], app2.nomi());
}

console.log('\n--- quello che NON deve cambiare ---');
{
    // ITALIANO: la cartella aperta normalmente: impronta e recupero come sempre.
    // ENGLISH: the folder opened normally: fingerprint and recovery as always.
    const app1 = creaApp();
    await app1.conferma(riepilogo(F(), TUTTE));
    const st = memoria();
    C.scriviBackupSubito(st, modifica(app1.images, 'c.png', 'altra'), [], 'F', [], new Set());
    dice('cartella aperta normalmente: l\'impronta e\' quella di sempre', [B.folderSignature('F', TUTTE)], JSON.parse(st.valore).sources.map(s => s.signature));
    const app2 = creaApp({ backup: dopoIlCrash(st.valore) });
    await app2.conferma(riepilogo(F(), TUTTE), true);
    dice('...e la riapertura recupera c.png', ['altra'], tagDi(app2, 'c.png'));
}
{
    // ITALIANO: la stessa cartella riaperta con una foto in piu' sul disco: le foto nuove entrano nel lotto
    //           di quelle gia' aperte (nessuna impronta in piu').
    // ENGLISH: the same folder reopened with one more photo on disk: the new photos join the batch of
    //          the ones already open (no extra fingerprint).
    const app1 = creaApp();
    await app1.conferma(riepilogo(F(), ['a.png', 'b.png']));
    await app1.conferma(riepilogo(F(), TUTTE));
    dice('premessa: c.png nello stesso lotto di a.png e b.png', 1, new Set(app1.images.map(i => i.lottoImport)).size);
    dice('...e senza nomi in piu\' per l\'impronta', [], app1.images.filter(i => Array.isArray(i.aperteImpronta) && i.aperteImpronta.length > 0).map(i => i.file.name));
    const st = memoria();
    C.scriviBackupSubito(st, modifica(app1.images, 'c.png', 'nuova'), [], 'F', [], new Set());
    dice('l\'impronta e\' quella della cartella intera', [B.folderSignature('F', TUTTE)], JSON.parse(st.valore).sources.map(s => s.signature));
}
{
    // ITALIANO: verso 1, la foto sciolta modificata: il suo lotto conserva la sua impronta (solo a.png), e la
    //           modifica entra anche nella sorgente della cartella intera (test-backup-already-open-photos).
    // ENGLISH: direction 1, the loose photo edited: its batch keeps its own fingerprint (a.png only), and the
    //          edit also goes into the whole folder's source (test-backup-already-open-photos).
    const app1 = creaApp();
    await app1.conferma(sciolte('E:' + BS + 'F', ['a.png']));
    await app1.conferma(riepilogo(F(), TUTTE));
    const st = memoria();
    C.scriviBackupSubito(st, modifica(app1.images, 'a.png', 'sciolta'), [], 'F', [], new Set());
    dice('la foto sciolta modificata: impronta della sola a.png, e quella della cartella intera', [B.folderSignature('', ['a.png']), B.folderSignature('F', TUTTE)].sort(),
        JSON.parse(st.valore).sources.map(s => s.signature).sort());
    const app2 = creaApp({ backup: dopoIlCrash(st.valore) });
    await app2.conferma(sciolte('E:' + BS + 'F', ['a.png']), true);
    dice('...e ricaricandola da sola torna la modifica', ['sciolta'], tagDi(app2, 'a.png'));
}
{
    // ITALIANO: verso 1, ma la foto sciolta poi esce dalla memoria (Ctrl+Z oltre il suo import): non si
    //           conta piu' nell'impronta del lotto della cartella, come prima.
    // ENGLISH: direction 1, but the loose photo then leaves memory (Ctrl+Z past its import): it no longer
    //          counts in the folder batch's fingerprint, as before.
    const app1 = creaApp();
    await app1.conferma(sciolte('E:' + BS + 'F', ['a.png']));
    await app1.conferma(riepilogo(F(), TUTTE));
    const st = memoria();
    const senzaA = modifica(app1.images, 'b.png', 'modifica').filter(i => i.file.name !== 'a.png');
    C.scriviBackupSubito(st, senzaA, [], 'F', [], new Set());
    dice('foto sciolta non piu\' in memoria: l\'impronta conta solo b e c', [B.folderSignature('F', ['b.png', 'c.png'])], JSON.parse(st.valore).sources.map(s => s.signature));
}

process.exit(esito());
