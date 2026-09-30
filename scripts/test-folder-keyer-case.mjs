/* ITALIANO: PROVA DELL'ABBINAMENTO FOTO / .txt SENZA MAIUSCOLE
   Windows non distingue le maiuscole nei nomi: IMG_001.JPG e img_001.txt per Windows, e per
   Kohya, sono una coppia. "Carica cartella" le confrontava invece lettera per lettera: la foto
   arrivava senza tag e, alla prima modifica, "Salva" scriveva IMG_001.txt, che su NTFS E'
   img_001.txt, sostituendo i tag veri coi soli tag nuovi.
   Si prova la regola VERA di src/utils/sidecarTags.ts (compilata al volo con esbuild): la
   stessa chiave usata dall'import e dal riepilogo "con testo / senza testo".
   Uso:  node scripts/test-folder-keyer-case.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF CASE-INSENSITIVE PHOTO / .txt PAIRING
   Windows does not tell upper from lower case in names: to Windows, and to Kohya, IMG_001.JPG
   and img_001.txt are a pair. "Load folder" compared them letter by letter instead: the photo
   arrived with no tags and, at the first edit, "Save" wrote IMG_001.txt, which on NTFS IS
   img_001.txt, replacing the real tags with the new ones alone.
   The REAL rule of src/utils/sidecarTags.ts is tested (compiled on the fly with esbuild): the
   same key used by the import and by the "with text / without text" summary.
   Usage:  node scripts/test-folder-keyer-case.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const uscita = await esbuild.build({
    entryPoints: [path.join(radice, 'src/utils/sidecarTags.ts')],
    bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
});
const S = await import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));
const { dice, esito } = creaControlli();

// ITALIANO: abbinati = stessa chiave, con la cartella data a ciascun file (handle, stringa o niente).
// ENGLISH: paired = same key, with the folder given to each file (handle, string or none).
const abbinati = (nomeFoto, cartellaFoto, nomeTxt, cartellaTxt) => {
    const foto = { name: nomeFoto };
    const txt = { name: nomeTxt };
    const k = S.makeFolderKeyer(new Map([[foto, cartellaFoto], [txt, cartellaTxt]]));
    return k(foto) === k(txt);
};
const cartella1 = { name: 'dataset' };
const cartella2 = { name: 'dataset' };

console.log('\n--- nomi che differiscono solo per le maiuscole ---');
dice('A.JPG si abbina ad a.txt (cartella scelta)', true, abbinati('A.JPG', cartella1, 'a.txt', cartella1));
dice('IMG_001.JPG si abbina a img_001.txt (cartella come percorso)', true, abbinati('IMG_001.JPG', 'E:\\dataset', 'img_001.txt', 'E:\\dataset'));
dice('Foto.Png si abbina a foto.txt (nessuna cartella)', true, abbinati('Foto.Png', null, 'foto.txt', null));

console.log('\n--- quello che NON deve cambiare ---');
dice('stesso nome e stesse maiuscole: si abbinano', true, abbinati('IMG_001.JPG', cartella1, 'IMG_001.TXT', cartella1));
dice('stesso nome in due sottocartelle: NON si abbinano', false, abbinati('img.png', cartella1, 'img.txt', cartella2));
dice('stesso nome in due percorsi: NON si abbinano', false, abbinati('img.png', 'E:\\10_face', 'img.txt', 'E:\\20_body'));
dice('nomi diversi: NON si abbinano', false, abbinati('img_001.png', cartella1, 'img_002.txt', cartella1));
dice('il punto interno resta nel nome-base', true, abbinati('my.photo.jpg', cartella1, 'my.photo.txt', cartella1));
dice('...e "my.jpg" non prende "my.photo.txt"', false, abbinati('my.jpg', cartella1, 'my.photo.txt', cartella1));

process.exit(esito());
