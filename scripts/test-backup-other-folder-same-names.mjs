/* ITALIANO: PROVA DEL BACKUP ANTI-CRASH CON FOTO SCIOLTE DALLO STESSO NOME PRESE DA UN'ALTRA CARTELLA
   Il programma si chiude di colpo con una modifica non salvata su 2.png, caricata con «Carica
   immagini» dalla cartella A insieme a 1.png e 3.png. Alla riapertura l'utente carica tre foto con
   gli stessi nomi dalla cartella B (nomi numerati, tipici dei dataset): l'impronta e' la stessa
   (nessuna cartella, 3 foto, 1.png e 3.png). Il riepilogo proponeva «Recupera ... Foto con modifiche
   non salvate: 1», l'import non recuperava niente (le chiavi del backup portano il percorso di A) e
   un secondo dopo il backup veniva riscritto senza la sorgente di A: riaprendo A la modifica non
   c'era piu'. Ora il riepilogo e l'import guardano anche le chiavi delle foto, e una sorgente con
   l'impronta di una serie aperta cade solo se una sua chiave e' della cartella di una foto in memoria.
   Non coperto (resta com'era): due cartelle «img» aperte con «Carica cartella», stessi nomi e
   stesso numero di foto, hanno chiavi relative uguali e non si distinguono senza leggere i .txt.
   Si eseguono calculateImportSummary, makeBackupKeyer, confermaImport e processImportData VERI di
   src/App.tsx (vedi import-harness.mjs), con src/utils/tagBackup.ts e closeGuard.ts veri.
   Uso:  node scripts/test-backup-other-folder-same-names.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE CRASH BACKUP WITH SAME-NAMED LOOSE PHOTOS TAKEN FROM ANOTHER FOLDER
   The program dies with an unsaved edit on 2.png, loaded with "Load images" from folder A together
   with 1.png and 3.png. On reopening the user loads three photos with the same names from folder B
   (numbered names, typical of datasets): the fingerprint is the same (no folder, 3 photos, 1.png and
   3.png). The summary offered "Recover ... Photos with unsaved changes: 1", the import recovered
   nothing (the backup keys carry A's path) and a second later the backup was rewritten without A's
   source: reopening A the edit was gone. Now the summary and the import also look at the photos'
   keys, and a source with the fingerprint of an open set is dropped only when one of its keys is in
   the folder of a photo in memory.
   Not covered (stays as it was): two "img" folders opened with "Load folder", same names and same
   number of photos, have the same relative keys and cannot be told apart without reading the .txt.
   The REAL calculateImportSummary, makeBackupKeyer, confermaImport and processImportData of
   src/App.tsx run (see import-harness.mjs), with the real src/utils/tagBackup.ts and closeGuard.ts.
   Usage:  node scripts/test-backup-other-folder-same-names.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaApp } from './import-harness.mjs';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const carica = async (rel) => import('data:text/javascript;base64,' + Buffer.from((await esbuild.build({
    entryPoints: [path.join(radice, rel)], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
})).outputFiles[0].text).toString('base64'));
const B = await carica('src/utils/tagBackup.ts');
const C = await carica('src/utils/closeGuard.ts');
const S = await carica('src/utils/sidecarTags.ts');
const t = (await carica('src/constants.ts')).translations.en;
const { dice, esito } = creaControlli();

// ITALIANO: il riepilogo VERO (calculateImportSummary con makeBackupKeyer), come in test-backup-ask.mjs.
// ENGLISH: the REAL summary (calculateImportSummary with makeBackupKeyer), as in test-backup-ask.mjs.
const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const ritaglia = (intestazione, chiusura) => {
    const inizio = sorgente.indexOf(intestazione);
    chiusura.lastIndex = Math.max(inizio, 0);
    const fine = inizio < 0 ? null : chiusura.exec(sorgente);
    if (!fine) { console.log('NO  non trovato in src/App.tsx: ' + intestazione.trim()); process.exit(1); }
    return sorgente.slice(inizio, fine.index + fine[0].length);
};
const codice = (await esbuild.transform(ritaglia('const makeBackupKeyer = ', /\r?\n\};\r?\n/g) + '\n' +
    ritaglia('    const calculateImportSummary = (', /\r?\n    \};\r?\n/g), { loader: 'ts' })).code;
const riepilogo = (salvato, d) => {
    let stato = null;
    new Function('makeFolderKeyer', 'setImportSummary', 'recuperoDellImport', 'localStorage', 'BACKUP_KEY_SEP', codice + '\nreturn calculateImportSummary;')(
        S.makeFolderKeyer, (v) => { stato = v; }, B.recuperoDellImport, { getItem: (k) => (k === 'tagBackup' ? salvato : null) }, B.BACKUP_KEY_SEP,
    )(d.imgFiles, d.txtFiles, d.handle, d.folderOf, d.relPathOf, d.pathOf, d.cartellaRelOf);
    return stato && stato.summary ? stato.summary.recupero : 'nessun riepilogo';
};

const memoria = (iniziale = null) => {
    let v = iniziale;
    return { getItem: (k) => (k === 'tagBackup' ? v : null), setItem: (k, x) => { if (k === 'tagBackup') v = String(x); }, removeItem: (k) => { if (k === 'tagBackup') v = null; }, get valore() { return v; } };
};
// ITALIANO: nell'harness i lotti si chiamano lotto1, lotto2... in ogni app: la sessione di prima prende un nome suo.
// ENGLISH: in the harness the batches are called lotto1, lotto2... in every app: the earlier session gets a name of its own.
const rinomina = (grezzo, da, a) => grezzo.split('"lotto":"' + da + '"').join('"lotto":"' + a + '"');
// ITALIANO: foto sciolte («Carica immagini») dalla cartella `dir`, con i percorsi su disco come in Electron.
// ENGLISH: loose photos ("Load images") from folder `dir`, with the paths on disk as in Electron.
const sciolte = (dir, nomi = ['1.png', '2.png', '3.png']) => {
    const imgFiles = nomi.map(n => ({ name: n, percorso: dir + '\\' + n, size: 10, lastModified: 1000 }));
    const folderOf = new Map(imgFiles.map(f => [f, S.cartellaImmagine(f.percorso)]));
    return { imgFiles, txtFiles: [], handle: null, folderOf, relPathOf: null, pathOf: null, cartellaRelOf: null };
};
const conTag = (app, nome, tag) => app.images.map(i => (i.file.name === nome ? { ...i, tags: [...i.tags, tag] } : i));
const tagDi = (app, nome) => (app.images.find(i => i.file.name === nome) || { tags: null }).tags;

// ITALIANO: la sessione interrotta: foto sciolte di A, 2.png modificata e non salvata, poi il crash.
// ENGLISH: the interrupted session: loose photos of A, 2.png edited and unsaved, then the crash.
const st = memoria();
{
    const app = creaApp();
    await app.conferma(sciolte('E:\\A'));
    C.scriviBackupSubito(st, conTag(app, '2.png', 'modificaDiA'), [], '', [], new Set());
    st.setItem('tagBackup', rinomina(st.valore, 'lotto1', 'sessione-prima'));
}
dice('premessa: c\'e\' il backup della serie di A', true, st.valore !== null);

console.log('\n--- foto con gli stessi nomi da un\'altra cartella (B) ---');
{
    const dB = sciolte('E:\\B');
    dice('il riepilogo di B non propone nessun recupero', null, riepilogo(st.valore, dB));
    const app = creaApp({ backup: st.valore });
    await app.conferma(dB, true);
    dice('l\'import di B carica le foto, senza recuperi', [t.successImport.replace('{n}', '3'), 'success'], app.ultimo());
    dice('...e le foto di B non prendono la modifica di A', [], tagDi(app, '2.png'));
    C.scriviBackupSubito(st, app.images, [], '', [], new Set());
    dice('un secondo dopo il backup tiene ancora la modifica di A', { n: 1 }, (({ n }) => ({ n }))(riepilogo(st.valore, sciolte('E:\\A')) || { n: 0 }));
    // ITALIANO: poi l'utente modifica anche B: le due serie hanno la stessa impronta, e il backup le tiene tutte e due.
    // ENGLISH: then the user edits B too: the two sets share the fingerprint, and the backup keeps both.
    C.scriviBackupSubito(st, conTag(app, '2.png', 'modificaDiB'), [], '', [], new Set());
    st.setItem('tagBackup', rinomina(st.valore, 'lotto1', 'sessione-di-B'));
}

console.log('\n--- dopo un altro crash: ognuna riprende la sua ---');
for (const [dir, attesa] of [['E:\\A', 'modificaDiA'], ['E:\\B', 'modificaDiB']]) {
    const d = sciolte(dir);
    dice(dir + ': il riepilogo annuncia una foto', 1, (riepilogo(st.valore, d) || { n: 0 }).n);
    const app = creaApp({ backup: st.valore });
    await app.conferma(d, true);
    dice(dir + ': con la spunta torna la sua modifica, non quella dell\'altra', [attesa], tagDi(app, '2.png'));
}

console.log('\n--- quello che non deve cambiare ---');
{
    const d = sciolte('E:\\A');
    const app = creaApp({ backup: st.valore });
    await app.conferma(d, false);
    dice('A riaperta senza spunta: niente torna', [], tagDi(app, '2.png'));
    const copia = memoria(st.valore);
    C.scriviBackupSubito(copia, app.images, [], '', [], new Set());
    dice('...e la sua modifica viene scartata davvero (quella di B resta)', [null, 1],
        [riepilogo(copia.valore, sciolte('E:\\A')), (riepilogo(copia.valore, sciolte('E:\\B')) || { n: 0 }).n]);
}
{
    const d = sciolte('E:\\A');
    const app = creaApp({ backup: st.valore });
    await app.conferma(d, true);
    const copia = memoria(st.valore);
    C.scriviBackupSubito(copia, app.images, [], '', [], new Set());
    const appDopo = creaApp({ backup: copia.valore });
    await appDopo.conferma(sciolte('E:\\A'), true);
    dice('A recuperata e di nuovo in memoria: il backup ha la modifica una volta sola, e torna ancora', ['modificaDiA'], tagDi(appDopo, '2.png'));
    C.backupDopoChiusura(copia, app.images, []);
    dice('«Chiudi senza salvare» su A: la sua modifica cade, quella di B resta', [null, 1],
        [riepilogo(copia.valore, sciolte('E:\\A')), (riepilogo(copia.valore, sciolte('E:\\B')) || { n: 0 }).n]);
}

process.exit(esito());
