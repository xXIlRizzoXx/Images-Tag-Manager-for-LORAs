/* ITALIANO: PROVA DEL BACKUP ANTI-CRASH CON UNA FOTO CHIUSA E POI RIPRESA RIAPRENDO LA CARTELLA
   Una foto chiusa con la X resta fra le foto chiuse (con il suo id) e conta ancora nell'impronta
   della sua cartella. Riaprendo la cartella per riprenderla, la copia riaperta entra nel lotto
   delle altre foto (lo stesso import) con un id nuovo: costruisciBackup contava sia la copia
   riaperta sia quella chiusa, l'impronta diventava "img|4|..." per una cartella di 3 foto e dopo un
   crash le modifiche non salvate di quella cartella non tornavano. La regola: una foto chiusa non
   conta quando nello stesso lotto c'e' gia' una foto in memoria con la stessa chiave (cartella +
   nome). Si usano le regole vere di src/utils/tagBackup.ts (compilato con esbuild).
   Uso:  node scripts/test-backup-closed-reopened.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE CRASH BACKUP WITH A PHOTO CLOSED AND THEN TAKEN BACK BY REOPENING THE FOLDER
   A photo closed with the X stays among the closed photos (with its id) and still counts in its
   folder's fingerprint. Reopening the folder to take it back, the reopened copy enters the other
   photos' batch (the same import) with a new id: costruisciBackup counted both the reopened copy
   and the closed one, the fingerprint became "img|4|..." for a folder of 3 photos and after a crash
   that folder's unsaved edits did not come back. The rule: a closed photo does not count when the
   same batch already holds a photo in memory with the same key (folder + name). The real rules of
   src/utils/tagBackup.ts are used (compiled with esbuild).
   Usage:  node scripts/test-backup-closed-reopened.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const B = await import('data:text/javascript;base64,' + Buffer.from((await esbuild.build({
    entryPoints: [path.join(radice, 'src/utils/tagBackup.ts')], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
})).outputFiles[0].text).toString('base64'));
const { dice, esito } = creaControlli();
const SEP = B.BACKUP_KEY_SEP;

// ITALIANO: una foto in memoria; `sotto` = la sottocartella nella chiave del backup.
// ENGLISH: a photo in memory; `sotto` = the subfolder in the backup key.
const foto = (id, nome, lotto, tags = [], originalTags = [], sotto = 'img') => ({
    id, file: { name: nome }, tags: [...tags], originalTags: [...originalTags], backupKey: sotto + SEP + nome,
    lottoImport: lotto, cartellaImport: 'img', isTrashed: false,
});
// ITALIANO: una foto chiusa come la registra handleCloseImage in src/App.tsx.
// ENGLISH: a closed photo as handleCloseImage in src/App.tsx records it.
const chiusa = (f) => ({ id: f.id, name: f.file.name, lotto: f.lottoImport, cartella: f.cartellaImport, foto: f });
const impronte = (r) => (r?.sources || []).map(s => s.signature);
const ritrovate = (r, nomi) => {
    const b = B.backupDellImport(r ? JSON.stringify({ ts: 1, ...r }) : null, 'img', B.folderSignature('img', nomi));
    return b ? Object.keys(b.voci).length : 0;
};

const a = foto('a1', 'a.png', 'A', ['x', 'nuovo a'], ['x']);
const c = foto('c1', 'c.png', 'A');
const bVecchia = foto('b1', 'b.png', 'A');
const bRiaperta = foto('b2', 'b.png', 'A');

console.log('\n--- foto chiusa e ripresa riaprendo la cartella (stesso lotto, id nuovo) ---');
{
    const r = B.costruisciBackup([a, c, bRiaperta], [chiusa(bVecchia)], 'img');
    dice('l\'impronta conta b.png una volta sola', ['img|3|a.png|c.png'], impronte(r));
    dice('dopo un crash la cartella di 3 foto ritrova la modifica di a.png', 1, ritrovate(r, ['a.png', 'b.png', 'c.png']));
}

console.log('\n--- foto chiusa, ripresa riaprendo la cartella e chiusa di nuovo ---');
{
    // ITALIANO: fra le chiuse ci sono due voci per b.png (id vecchio e id nuovo), stesso lotto e stessa chiave.
    // ENGLISH: the closed photos hold two entries for b.png (old id and new id), same batch and same key.
    const r = B.costruisciBackup([a, c], [chiusa(bVecchia), chiusa(bRiaperta)], 'img');
    dice('l\'impronta conta b.png una volta sola', ['img|3|a.png|c.png'], impronte(r));
    dice('dopo un crash la cartella di 3 foto ritrova la modifica di a.png', 1, ritrovate(r, ['a.png', 'b.png', 'c.png']));
}
{
    // ITALIANO: tre giri di chiudi e riprendi: sempre una volta sola.
    // ENGLISH: three rounds of close and take back: always once.
    const bTerza = foto('b3', 'b.png', 'A');
    const r = B.costruisciBackup([a, c], [chiusa(bVecchia), chiusa(bRiaperta), chiusa(bTerza)], 'img');
    dice('tre chiusure della stessa foto: conta una volta', ['img|3|a.png|c.png'], impronte(r));
}

console.log('\n--- quello che non deve cambiare ---');
{
    // ITALIANO: due foto omonime in sottocartelle diverse dello stesso lotto, chiuse tutte e due: contano due.
    // ENGLISH: two same-named photos in different subfolders of the same batch, both closed: they count two.
    const viso = foto('v1', 'img.png', 'A', [], [], 'ds/10_viso');
    const corpo = foto('k1', 'img.png', 'A', [], [], 'ds/20_corpo');
    const r = B.costruisciBackup([a], [chiusa(viso), chiusa(corpo)], 'img');
    dice('omonime in sottocartelle diverse, chiuse tutte e due: contano due', ['img|3|a.png|img.png'], impronte(r));
}
{
    const r = B.costruisciBackup([a, c], [chiusa(bVecchia)], 'img');
    dice('foto chiusa e non ripresa: conta ancora (la cartella su disco ne ha 3)', ['img|3|a.png|c.png'], impronte(r));
}
{
    const r = B.costruisciBackup([a, c, bVecchia], [chiusa(bVecchia)], 'img');
    dice('foto chiusa e riportata con Ctrl+Z (stesso id): conta una volta', ['img|3|a.png|c.png'], impronte(r));
}
{
    // ITALIANO: Ctrl+Z della chiusura DOPO averla ripresa: in memoria ci sono davvero due copie.
    // ENGLISH: Ctrl+Z of the close AFTER taking it back: memory really holds two copies.
    const r = B.costruisciBackup([a, c, bRiaperta, bVecchia], [chiusa(bVecchia)], 'img');
    dice('due copie in memoria contano due', ['img|4|a.png|c.png'], impronte(r));
}
{
    // ITALIANO: b.png ripresa con un import a parte (un altro lotto): la chiusa conta nel suo lotto.
    // ENGLISH: b.png taken back with a separate import (another batch): the closed one counts in its batch.
    const r = B.costruisciBackup([a, c, foto('b2', 'b.png', 'B')], [chiusa(bVecchia)], 'img');
    dice('ripresa in un altro lotto: il lotto A resta di 3 foto', ['img|3|a.png|c.png'], impronte(r));
}
{
    // ITALIANO: due foto omonime in sottocartelle diverse dello stesso lotto, una sola chiusa: contano tutte e due.
    // ENGLISH: two same-named photos in different subfolders of the same batch, only one closed: both count.
    const viso = foto('v1', 'img.png', 'A', ['x', 'nuovo'], ['x'], 'ds/10_viso');
    const corpo = foto('k1', 'img.png', 'A', [], [], 'ds/20_corpo');
    const r = B.costruisciBackup([viso], [chiusa(corpo)], 'img');
    dice('omonime in sottocartelle diverse: la chiusa conta', ['img|2|img.png|img.png'], impronte(r));
}

process.exit(esito());
