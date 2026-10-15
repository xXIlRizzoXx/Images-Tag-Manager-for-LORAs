/* ITALIANO: PROVA DELLE CHIAVI DEL BACKUP ANTI-CRASH PER LE FOTO TRASCINATE
   Foto trascinate nella finestra senza nessun .txt accanto: il percorso vero di ogni foto, che
   Electron conosceva, veniva buttato via e la chiave del backup restava il solo nome ("" + nome).
   Due serie di foto senza tag con gli stessi nomi di fotocamera (IMG_0001..IMG_0020) avevano
   allora la stessa impronta, le stesse chiavi e la stessa impronta dei tag su disco (nessun tag):
   le modifiche non salvate della prima finivano sulla seconda, e "Salva" le scriveva accanto alle
   foto sbagliate. E al contrario, trascinando di nuovo le stesse foto dopo averne salvate alcune
   (ora con i .txt), le chiavi diventavano percorso + nome e le modifiche non salvate non tornavano.
   Ora la chiave porta sempre il percorso vero quando Electron lo conosce, e una chiave senza
   cartella (solo nel browser) non entra nel backup e non si applica.
   Si eseguono i testi VERI di src/App.tsx (makeBackupKeyer, loadSidecarTxtFiles,
   handleDroppedFiles) e le regole vere di src/utils/tagBackup.ts, con un electronAPI finto.
   Uso:  node scripts/test-backup-drop-keys.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE CRASH BACKUP KEYS FOR DROPPED PHOTOS
   Photos dropped on the window with no .txt beside them: each photo's real path, known to
   Electron, was thrown away and the backup key stayed the bare name ("" + name). Two sets of
   untagged photos with the same camera names (IMG_0001..IMG_0020) then had the same fingerprint,
   the same keys and the same fingerprint of the tags on disk (no tags): the first set's unsaved
   edits landed on the second, and "Save" wrote them next to the wrong photos. Conversely,
   dropping the same photos again after saving some of them (now with .txt files) turned the keys
   into path + name and the unsaved edits did not come back.
   Now the key always carries the real path when Electron knows it, and a key with no folder
   (browser only) does not enter the backup and is not applied.
   The REAL text of src/App.tsx (makeBackupKeyer, loadSidecarTxtFiles, handleDroppedFiles) and the
   real rules of src/utils/tagBackup.ts are run, with a fake electronAPI.
   Usage:  node scripts/test-backup-drop-keys.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const carica = async (rel) => {
    const uscita = await esbuild.build({
        entryPoints: [path.join(radice, rel)],
        bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
    });
    return import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));
};
const B = await carica('src/utils/tagBackup.ts');
const S = await carica('src/utils/sidecarTags.ts');
const { dice, esito } = creaControlli();

const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const ritaglia = (intestazione, chiusura) => {
    const inizio = sorgente.indexOf(intestazione);
    if (inizio < 0) { console.log('NO  non trovato in src/App.tsx: ' + intestazione); process.exit(1); }
    chiusura.lastIndex = inizio;
    const fine = chiusura.exec(sorgente);
    if (!fine) { console.log('NO  fine non trovata: ' + intestazione); process.exit(1); }
    return sorgente.slice(inizio, fine.index + fine[0].length);
};
const testi = [
    ritaglia('const makeBackupKeyer = ', /\r?\n\};\r?\n/g),
    ritaglia('    const loadSidecarTxtFiles = async ', /\r?\n    \};\r?\n/g),
    ritaglia('    const handleDroppedFiles = useCallback(', /\r?\n    \}, \[[^\]\r\n]*\]\);\r?\n/g),
];
const codice = (await esbuild.transform(testi.join('\n'), { loader: 'ts' })).code;
const NOMI = ['BACKUP_KEY_SEP', 'window', 'cartellaImmagine', 'cartellaTesto', 'fileDaSidecar', 'useCallback', 'showNotification', 't', 'calculateImportSummary', 'console', 'isTagEditorOpen', 'isApiKeyDialogOpen', 'fileDiMac'];
const fabbricaVera = new Function(...NOMI, codice + '\nreturn { makeBackupKeyer, handleDroppedFiles };');
const { fileDiMac } = await carica('src/utils/folderScan.ts');
// ITALIANO: gli ultimi tre: nessuna finestra aperta sopra, e la regola vera dei file nascosti del Mac.
// ENGLISH: the last three: no window open on top, and the real rule for the Mac hidden files.
const fabbrica = (...a) => fabbricaVera(...a.slice(0, 10), false, false, fileDiMac);

const SEP = B.BACKUP_KEY_SEP;
const NOMI_FOTO = Array.from({ length: 10 }, (_, i) => `IMG_${String(i + 1).padStart(4, '0')}.JPG`);
// ITALIANO: un trascinamento in Electron: `txt` = i .txt che il processo principale trova accanto.
// ENGLISH: a drop in Electron: `txt` = the .txt files the main process finds beside the photos.
const trascina = async (cartella, txt = []) => {
    const foto = NOMI_FOTO.map(n => ({ name: n, type: 'image/jpeg', percorso: cartella + '\\' + n }));
    const api = {
        getPathForFile: (f) => f.percorso || '',
        readSidecarTags: async () => txt.map(n => ({ name: n.replace(/\.JPG$/, '.txt'), dir: cartella + '\\', content: 'x' })),
    };
    let preso = null;
    const f = fabbrica(SEP, { electronAPI: api }, S.cartellaImmagine, S.cartellaTesto, S.fileDaSidecar, (fn) => fn,
        () => {}, {}, (imgFiles, txtFiles, handle, folderOf, relPathOf) => { preso = { imgFiles, txtFiles, handle, folderOf, relPathOf }; }, { warn() {} });
    await f.handleDroppedFiles(foto);
    // ITALIANO: le chiavi come le calcola processImportData (backupKeyOf).
    // ENGLISH: the keys as processImportData works them out (backupKeyOf).
    const chiaveDi = f.makeBackupKeyer(preso.folderOf, preso.relPathOf);
    return preso.imgFiles.map(chiaveDi);
};

console.log('\n--- stesse foto trascinate di nuovo dopo averne salvate 8 (ora con i .txt) ---');
{
    const prima = await trascina('F:\\servizio_a');
    const dopo = await trascina('F:\\servizio_a', NOMI_FOTO.slice(0, 8));
    dice('le chiavi portano il percorso vero anche senza .txt', 'F:\\servizio_a' + SEP + 'IMG_0001.JPG', prima[0]);
    dice('e sono le stesse al secondo trascinamento', prima, dopo);
    // ITALIANO: il giro intero: backup scritto dal primo, riletto dal secondo.
    // ENGLISH: the whole loop: backup written by the first, read back by the second.
    const images = prima.map((k, i) => ({
        id: 'L1/' + i, file: { name: NOMI_FOTO[i] }, backupKey: k, lottoImport: 'L1', cartellaImport: '',
        tags: i >= 8 ? ['anna', 'nuovo'] : [], originalTags: [],
    }));
    const salvato = JSON.stringify({ ts: 1, ...B.costruisciBackup(images, [], '') });
    const letto = B.backupDellImport(salvato, '', B.folderSignature('', NOMI_FOTO));
    const tornate = dopo.filter((k, i) => letto && letto.voci[k] && B.tagDaRipristinare(letto.voci[k], [], [], [], undefined, letto.ts));
    dice('le 2 modifiche non salvate tornano', 2, tornate.length);
}

console.log('\n--- un\'ALTRA serie senza tag con gli stessi nomi, trascinata dopo ---');
{
    const a = await trascina('F:\\servizio_a');
    const b = await trascina('E:\\servizio_b');
    const images = a.map((k, i) => ({
        id: 'L1/' + i, file: { name: NOMI_FOTO[i] }, backupKey: k, lottoImport: 'L1', cartellaImport: '',
        tags: i === 2 ? ['anna', 'red dress'] : [], originalTags: [],
    }));
    const salvato = JSON.stringify({ ts: 1, ...B.costruisciBackup(images, [], '') });
    const letto = B.backupDellImport(salvato, '', B.folderSignature('', NOMI_FOTO));
    const finite = b.filter(k => letto && letto.voci[k] && B.tagDaRipristinare(letto.voci[k], [], [], [], undefined, letto.ts));
    dice('la seconda serie non riceve i tag della prima', 0, finite.length);
}

console.log('\n--- chiavi senza cartella (solo nel browser): restano fuori ---');
{
    const images = NOMI_FOTO.map((n, i) => ({
        id: 'L1/' + i, file: { name: n }, backupKey: SEP + n, lottoImport: 'L1', cartellaImport: '',
        tags: i === 2 ? ['anna'] : [], originalTags: [],
    }));
    dice('una chiave col solo nome non entra nel backup', null, B.costruisciBackup(images, [], ''));
    // ITALIANO: un backup gia' scritto con chiavi senza cartella non si applica a nessuna serie.
    // ENGLISH: a backup already written with folder-less keys is applied to no set.
    const vecchio = JSON.stringify({ ts: 1, folder: '', sources: [{ signature: B.folderSignature('', NOMI_FOTO), data: { [SEP + 'IMG_0003.JPG']: { tags: ['anna'], base: B.improntaTag([]) } } }] });
    const letto = B.backupDellImport(vecchio, '', B.folderSignature('', NOMI_FOTO));
    dice('una voce gia\' salvata col solo nome non si applica', [], letto ? Object.keys(letto.voci) : []);
    // ITALIANO: e il backup della versione 1.2.0 (impronta unica) non si applica senza cartella, come allora.
    // ENGLISH: and the 1.2.0 backup (single fingerprint) does not apply with no folder, as back then.
    const v120 = JSON.stringify({ ts: 1, folder: '', signature: B.folderSignature('', NOMI_FOTO), data: { [SEP + 'IMG_0003.JPG']: { tags: ['anna'] } } });
    dice('backup 1.2.0 e import senza cartella: niente', null, B.backupDellImport(v120, '', B.folderSignature('', NOMI_FOTO)));
}

console.log('\n--- quello che NON deve cambiare ---');
{
    // ITALIANO: una cartella scelta: chiave cartella + nome, backup scritto e riletto.
    // ENGLISH: a picked folder: folder + name key, backup written and read back.
    const images = [{ id: 'a', file: { name: 'a.png' }, backupKey: 'dataset' + SEP + 'a.png', lottoImport: 'L1', cartellaImport: 'dataset', tags: ['x', 'y'], originalTags: ['x'] }];
    const salvato = JSON.stringify({ ts: 1, ...B.costruisciBackup(images, [], 'dataset') });
    const letto = B.backupDellImport(salvato, 'dataset', B.folderSignature('dataset', ['a.png']));
    dice('cartella scelta: la modifica si ritrova', ['dataset' + SEP + 'a.png'], letto ? Object.keys(letto.voci) : null);
    const v120 = JSON.stringify({ ts: 1, folder: 'dataset', signature: B.folderSignature('dataset', ['a.png']), data: { ['dataset' + SEP + 'a.png']: { tags: ['x', 'y'] } } });
    dice('backup 1.2.0 di una cartella scelta: si legge ancora', ['dataset' + SEP + 'a.png'], Object.keys((B.backupDellImport(v120, 'dataset', B.folderSignature('dataset', ['a.png'])) || { voci: {} }).voci));
    // ITALIANO: nel browser i .txt trascinati insieme alle foto si abbinano ancora per nome.
    // ENGLISH: in the browser the .txt files dropped along with the photos still pair by name.
    let preso = null;
    const f = fabbrica(SEP, {}, S.cartellaImmagine, S.cartellaTesto, S.fileDaSidecar, (fn) => fn, () => {}, {},
        (imgFiles, txtFiles, handle, folderOf, relPathOf) => { preso = { imgFiles, txtFiles, folderOf, relPathOf }; }, { warn() {} });
    await f.handleDroppedFiles([{ name: 'a.png', type: 'image/png' }, { name: 'a.txt', type: 'text/plain' }]);
    const k = S.makeFolderKeyer(preso.folderOf);
    dice('browser: il .txt trascinato si abbina alla foto', k(preso.imgFiles[0]), k(preso.txtFiles[0]));
}

process.exit(esito());
