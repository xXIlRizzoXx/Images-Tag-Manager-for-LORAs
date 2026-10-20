/* ITALIANO: PROVA DEL TESTO PER LE FOTO SFUSE DI UNA CARTELLA DI RETE \\server\condivisione
   Una foto caricata una per una o trascinata da una cartella di rete scritta \\server\... non si
   puo' eliminare dal programma, e il messaggio deleteNoRecycleBin diceva di aprire la sua cartella
   con "Carica Cartella" (o di trascinarla) ed eliminarla da li'. Per quelle cartelle non funziona:
   il processo principale non restituisce mai il percorso di una cartella \\server, la foto del
   cestino non si collega (vedi test-import-links-trashed-photo.mjs, sezione rete), esce "Foto gia'
   aperte" e "Svuota Cestino" ridice lo stesso messaggio. Ora il testo, in tutte e nove le lingue,
   dice che per una cartella \\server l'unica strada e' Esplora file; lo stesso fa il README.
   Uso:  node scripts/test-no-recycle-bin-network-text.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE TEXT FOR LOOSE PHOTOS FROM A \\server\share NETWORK FOLDER
   A photo loaded one by one or dropped from a network folder written \\server\... cannot be deleted
   by the program, and the deleteNoRecycleBin message said to open its folder with "Load Folder" (or
   drop it) and delete it from there. For those folders it does not work: the main process never
   returns a \\server folder's path, the trashed photo is not linked (see
   test-import-links-trashed-photo.mjs, network section), "Photos already open" comes up and "Empty
   Trash" repeats the same message. Now the text, in all nine languages, says that for a \\server
   folder File Explorer is the only way; so does the README.
   Usage:  node scripts/test-no-recycle-bin-network-text.mjs      (exits with code 1 if anything is off) */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();

const lingue = (await (async () => {
    const u = await esbuild.build({ entryPoints: [path.join(radice, 'src/constants.ts')], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
    return import('data:text/javascript;base64,' + Buffer.from(u.outputFiles[0].text).toString('base64'));
})()).translations;

// ITALIANO: il nome di Esplora file come lo scrive gia' la stessa frase in ogni lingua.
// ENGLISH: File Explorer's name as the same sentence already writes it in each language.
const ESPLORA = {
    it: 'Esplora file', en: 'File Explorer', fr: 'Explorateur de fichiers', es: 'Explorador de archivos',
    de: 'Datei-Explorer', zh: '文件资源管理器', ja: 'エクスプローラー', pt: 'Explorador de Arquivos', ru: 'Проводник',
};
const B = String.fromCharCode(92);
const INDIRIZZO_RETE = new RegExp(B + B + B + B + '[A-Za-z]+' + B + B + '[A-Za-z]+');

console.log('\n--- deleteNoRecycleBin: la cartella di rete \\\\server ha la sua strada ---');
dice('le nove lingue ci sono', 9, Object.keys(ESPLORA).filter(l => lingue[l]).length);
for (const l of Object.keys(ESPLORA)) {
    const testo = String((lingue[l] || {}).deleteNoRecycleBin || '');
    const da = testo.indexOf(B + B);
    const coda = da >= 0 ? testo.slice(da) : '';
    dice(`${l}: nomina un indirizzo di rete scritto \\\\server\\...`, true, INDIRIZZO_RETE.test(testo));
    dice(`${l}: per quell'indirizzo dice Esplora file ("${ESPLORA[l]}")`, true, coda.includes(ESPLORA[l]));
    dice(`${l}: e per quell'indirizzo non promette "${lingue[l] && lingue[l].loadFolder}"`, false, !coda || coda.includes(lingue[l].loadFolder));
    // ITALIANO: casi vicini: chiavette, schede SD e lettere di unita' tengono la strada di "Carica Cartella".
    // ENGLISH: neighbouring cases: USB sticks, SD cards and drive letters keep the "Load Folder" road.
    dice(`${l}: per le altre unita' propone ancora "${lingue[l] && lingue[l].loadFolder}"`, true, da > 0 && testo.slice(0, da).includes(lingue[l].loadFolder));
}

console.log('\n--- README, Privacy: la stessa distinzione ---');
const readme = fs.readFileSync(path.join(radice, 'README.md'), 'utf8');
const riga = readme.split(/\r?\n/).find(r => r.includes('tells you to open their folder with **Load Folder**')) || '';
dice('la riga del secondo passo c\'e\' ancora', true, riga !== '');
const daR = riga.indexOf('`' + B + B);
dice('nomina una cartella di rete scritta `\\\\server\\...` (in codice, cosi\' le barre si vedono)', true, daR >= 0);
dice('...e per quella dice File Explorer', true, daR >= 0 && riga.slice(daR).includes('File Explorer'));

process.exit(esito());
