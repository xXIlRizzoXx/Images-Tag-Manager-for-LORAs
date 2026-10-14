/* ITALIANO: PROVA DEL RECUPERO DOPO UN CRASH CON CARTELLE DALLO STESSO NOME
   Con "Carica cartella" la chiave di ogni foto nel backup anti-crash e' il NOME della cartella piu'
   il nome del file ("img" + "0001.png"), mai il percorso intero. Riscrivendo il backup, una voce di
   una cartella non ancora riaperta cadeva se la sua chiave era quella di una foto in memoria: con
   due cartelle chiamate entrambe "img" (char1\img e char2\img, la disposizione tipica di Kohya) e i
   soliti nomi 0001.png..., riaprire char1 cancellava in silenzio le modifiche di char2; aprire per
   primo un altro "dataset" con 0001..0003 cancellava le voci di quei nomi del "dataset" vero. La
   regola: una sorgente del backup lascia il posto alle foto in memoria solo se ha la stessa
   impronta di una cartella aperta, o se l'ha scritta un import ancora in memoria (per esempio la
   stessa cartella, la cui impronta cambia quando si svuota il cestino).
   Si provano le regole VERE di src/utils/tagBackup.ts e src/utils/closeGuard.ts (compilate con
   esbuild), con un localStorage finto.
   Uso:  node scripts/test-backup-same-name-folders.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE RECOVERY AFTER A CRASH WITH FOLDERS OF THE SAME NAME
   With "Load folder" each photo's key in the crash backup is the folder's NAME plus the file name
   ("img" + "0001.png"), never the full path. When the backup was rewritten, an entry of a folder not
   reopened yet was dropped if its key was that of a photo in memory: with two folders both called
   "img" (char1\img and char2\img, the usual Kohya layout) and the usual names 0001.png..., reopening
   char1 silently deleted char2's edits; opening another "dataset" with 0001..0003 first deleted the
   entries of those names of the real "dataset". The rule: a backup source gives way to the photos
   in memory only if it has the same fingerprint as an open folder, or if an import still in memory
   wrote it (for example the same folder, whose fingerprint changes when the trash is emptied).
   The REAL rules of src/utils/tagBackup.ts and src/utils/closeGuard.ts are tested (compiled with
   esbuild), with a fake localStorage.
   Usage:  node scripts/test-backup-same-name-folders.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const carica = async (rel) => {
    const u = await esbuild.build({ entryPoints: [path.join(radice, rel)], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
    return import('data:text/javascript;base64,' + Buffer.from(u.outputFiles[0].text).toString('base64'));
};
const B = await carica('src/utils/tagBackup.ts');
const G = await carica('src/utils/closeGuard.ts');
const { dice, esito } = creaControlli();

const SEP = '\x1f';
const archivio = () => {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};
// ITALIANO: la chiave di "Carica cartella": nome della cartella + SEP + nome del file (makeBackupKeyer).
// ENGLISH: the "Load folder" key: folder name + SEP + file name (makeBackupKeyer).
const foto = (cartella, lotto, nome, tags, originalTags) => ({
    id: lotto + '/' + nome, file: { name: nome }, tags, originalTags, backupKey: cartella + SEP + nome,
    lottoImport: lotto, cartellaImport: cartella,
});
const recupero = (s, cartella, nomi, nome, disco) => {
    const letto = B.backupDellImport(s.getItem('tagBackup'), cartella, B.folderSignature(cartella, nomi));
    return B.tagDaRipristinare(letto && letto.voci[cartella + SEP + nome], disco, disco, [], undefined, letto ? letto.ts : null);
};
const N4 = ['0001.png', '0002.png', '0003.png', '0004.png'];
const N3 = ['0001.png', '0002.png', '0003.png'];
const N5 = ['0001.png', '0002.png', '0003.png', '0004.png', '0005.png'];

console.log('\n--- crash con due cartelle chiamate "img" (char1\\img e char2\\img), si riapre char1 ---');
{
    const s = archivio();
    G.scriviBackupSubito(s, [
        ...N4.map(n => foto('img', 'L1', n, ['char1', ...(n === '0004.png' ? ['EDIT1'] : [])], ['char1'])),
        ...N3.map(n => foto('img', 'L2', n, ['char2', ...(n === '0002.png' ? ['EDIT2'] : [])], ['char2'])),
    ], [], 'img');
    dice('premessa: char1 ritrova la sua modifica', ['char1', 'EDIT1'], recupero(s, 'img', N4, '0004.png', ['char1']));
    // ITALIANO: char1 riaperta (lotto nuovo, modifica ritrovata), poi l'effetto del backup un secondo dopo.
    // ENGLISH: char1 reopened (new batch, edit recovered), then the backup effect one second later.
    G.scriviBackupSubito(s, N4.map(n => foto('img', 'L3', n, n === '0004.png' ? ['char1', 'EDIT1'] : ['char1'], ['char1'])), [], 'img');
    dice('dopo la riscrittura char2 ritrova ancora la sua modifica', ['char2', 'EDIT2'], recupero(s, 'img', N3, '0002.png', ['char2']));
    dice('...e char1, ancora non salvata, resta nel backup', ['char1', 'EDIT1'], recupero(s, 'img', N4, '0004.png', ['char1']));
    // ITALIANO: anche Chiudi progetto (con char1 ancora in memoria) non tocca char2.
    // ENGLISH: Close project too (with char1 still in memory) leaves char2 alone.
    G.backupDopoChiusura(s, N4.map(n => foto('img', 'L3', n, n === '0004.png' ? ['char1', 'EDIT1'] : ['char1'], ['char1'])), []);
    dice('Chiudi progetto su char1: char2 si recupera ancora', ['char2', 'EDIT2'], recupero(s, 'img', N3, '0002.png', ['char2']));
}

console.log('\n--- crash in "dataset", poi si apre per primo un ALTRO "dataset" con 0001..0003 ---');
{
    const s = archivio();
    G.scriviBackupSubito(s, N5.map(n => foto('dataset', 'L1', n, ['girl', ...(n === '0001.png' || n === '0004.png' ? ['EDIT ' + n] : [])], ['girl'])), [], 'dataset');
    G.scriviBackupSubito(s, N3.map(n => foto('dataset', 'L2', n, ['boy'], ['boy'])), [], 'dataset');
    dice('il "dataset" vero ritrova la modifica di 0001.png', ['girl', 'EDIT 0001.png'], recupero(s, 'dataset', N5, '0001.png', ['girl']));
    dice('...e quella di 0004.png', ['girl', 'EDIT 0004.png'], recupero(s, 'dataset', N5, '0004.png', ['girl']));
    dice('l\'altro "dataset" non riceve niente', null, recupero(s, 'dataset', N3, '0001.png', ['boy']));
}

console.log('\n--- quello che NON deve cambiare ---');
{
    // ITALIANO: la stessa cartella, cestino svuotato (impronta cambiata), poi "Chiudi senza salvare":
    //           le modifiche buttate via non tornano, ne' con la vecchia impronta ne' con la nuova.
    // ENGLISH: the same folder, trash emptied (fingerprint changed), then "Close without saving": the
    //          discarded edits do not come back, with neither the old fingerprint nor the new one.
    const s = archivio();
    let images = N4.map(n => foto('dataset', 'L1', n, n === '0001.png' ? ['x', 'nuovo'] : ['x'], ['x']));
    G.scriviBackupSubito(s, images, [], 'dataset');
    images = images.filter(i => i.file.name !== '0004.png');
    G.scriviBackupSubito(s, images, [], 'dataset');
    G.backupDopoChiusura(s, images, []);
    dice('cestino svuotato, poi Chiudi senza salvare: il backup non c\'e\' piu\'', null, s.getItem('tagBackup'));
}
{
    // ITALIANO: la stessa cartella riaperta dopo il crash e salvata: la sua sorgente esce.
    // ENGLISH: the same folder reopened after the crash and saved: its source goes.
    const s = archivio();
    G.scriviBackupSubito(s, N3.map(n => foto('img', 'L1', n, n === '0002.png' ? ['a', 'b'] : ['a'], ['a'])), [], 'img');
    G.scriviBackupSubito(s, N3.map(n => foto('img', 'L9', n, n === '0002.png' ? ['a', 'b'] : ['a'], n === '0002.png' ? ['a', 'b'] : ['a'])), [], 'img');
    dice('riaperta e salvata: niente da recuperare', null, s.getItem('tagBackup'));
}

process.exit(esito());
