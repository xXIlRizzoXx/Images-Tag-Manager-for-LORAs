/* ITALIANO: PROVA DELLE FOTO ALLA RADICE DI UN'UNITA' ("Carica immagini", trascinamento)
   Per una foto alla radice di una chiavetta o di una scheda SD (E:\img_001.jpg con accanto
   E:\img_001.txt) il .txt veniva letto ma non abbinato: la pagina ricavava la cartella della foto
   come "E:", il processo principale mandava quella del .txt come "E:\" (path.dirname alla radice
   tiene il separatore). La foto arrivava senza tag e il primo salvataggio riscriveva il suo .txt
   coi soli tag nuovi, cancellando quelli veri.
   Si provano le regole VERE di src/utils/sidecarTags.ts (compilate al volo con esbuild) contro
   quello che calcola il processo principale; per una cartella vera si usa il canale vero di
   electron/main.cjs su una cartella temporanea (tolta alla fine).
   Uso:  node scripts/test-sidecar-drive-root.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF PHOTOS AT THE ROOT OF A DRIVE ("Load images", drag and drop)
   For a photo at the root of a USB stick or SD card (E:\img_001.jpg with E:\img_001.txt next to
   it) the .txt was read but not paired: the page took the photo's folder as "E:", the main
   process sent the .txt's folder as "E:\" (path.dirname keeps the separator at a root). The photo
   arrived with no tags and the first save rewrote its .txt with the new tags alone, wiping the
   real ones.
   The REAL rules of src/utils/sidecarTags.ts are tested (compiled on the fly with esbuild) against
   what the main process computes; for a real folder the real channel of electron/main.cjs is used
   on a temporary folder (removed at the end).
   Usage:  node scripts/test-sidecar-drive-root.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { caricaMain, creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const uscita = await esbuild.build({
    entryPoints: [path.join(radice, 'src/utils/sidecarTags.ts')],
    bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
});
const S = await import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));
const { dice, esito } = creaControlli();

// ITALIANO: come loadSidecarTxtFiles in App.tsx costruisce le due chiavi: la foto dal suo percorso,
//           il .txt dalla cartella che manda il processo principale.
// ENGLISH: how loadSidecarTxtFiles in App.tsx builds the two keys: the photo from its path, the
//          .txt from the folder the main process sends.
const chiavi = (percorsoFoto, cartellaDalMain) => {
    const foto = { name: path.win32.basename(percorsoFoto) };
    const txt = { name: path.win32.basename(percorsoFoto).replace(/\.[^.]+$/, '') + '.txt' };
    const folderOf = new Map([[foto, S.cartellaImmagine(percorsoFoto)], [txt, S.cartellaTesto(cartellaDalMain)]]);
    const k = S.makeFolderKeyer(folderOf);
    return [k(foto), k(txt)];
};
// ITALIANO: la cartella che electron/main.cjs manda per il .txt: path.dirname del percorso del .txt.
// ENGLISH: the folder electron/main.cjs sends for the .txt: path.dirname of the .txt's path.
const dalMain = (percorsoFoto) => path.win32.dirname(path.win32.join(path.win32.dirname(percorsoFoto), 'x.txt'));

console.log('\n--- foto alla radice di un\'unita\' (chiavetta, scheda SD, disco di rete collegato) ---');
for (const p of ['E:\\img_001.jpg', 'C:\\foto.png', 'E:/img_001.jpg', 'Z:\\img_001.jpg']) {
    const [kf, kt] = chiavi(p, dalMain(p));
    dice(`${p}: foto e .txt si abbinano`, kf, kt);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const [a, b] = chiavi('E:\\dataset\\img_001.jpg', dalMain('E:\\dataset\\img_001.jpg'));
    dice('sottocartella: si abbinano', a, b);
    const [c] = chiavi('E:\\dataset\\img_001.jpg', dalMain('E:\\dataset\\img_001.jpg'));
    const [d] = chiavi('E:\\altra\\img_001.jpg', dalMain('E:\\altra\\img_001.jpg'));
    dice('stesso nome in due cartelle: chiavi diverse', true, c !== d);
    const [r] = chiavi('E:\\img_001.jpg', dalMain('E:\\img_001.jpg'));
    dice('la radice non si confonde con una sottocartella omonima del nome', true, r !== c);
    dice('la cartella di una foto in sottocartella resta quella di prima', 'E:\\dataset', S.cartellaImmagine('E:\\dataset\\img_001.jpg'));
    dice('la cartella di una foto alla radice resta "E:" (le chiavi del backup non cambiano)', 'E:', S.cartellaImmagine('E:\\img_001.jpg'));
}

console.log('\n--- il canale vero del processo principale, su una cartella temporanea ---');
const { handlers } = caricaMain();
const cartella = fs.mkdtempSync(path.join(os.tmpdir(), 'itm-drive-root-'));
try {
    const img = path.join(cartella, 'img_001.jpg');
    fs.writeFileSync(img, 'x');
    fs.writeFileSync(path.join(cartella, 'img_001.txt'), '1girl, smile,');
    const letti = await handlers.get('images:read-sidecar-tags')(null, [img]);
    dice('il .txt viene letto', '1girl, smile,', letti.length === 1 ? letti[0].content : null);
    if (letti.length === 1) {
        const [kf, kt] = chiavi(img, letti[0].dir);
        dice('la cartella mandata dal processo principale si abbina alla foto', kf, kt);
    }
} finally {
    fs.rmSync(cartella, { recursive: true, force: true });
}

process.exit(esito());
