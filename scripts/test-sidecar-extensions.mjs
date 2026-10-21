/* ITALIANO: PROVA DELLE ESTENSIONI JPEG "ALTERNATIVE" (.jfif, .jpe, .pjpeg, .pjp)
   Windows salva molti JPEG scaricati come .jfif, e l'app li accetta (il browser li chiama
   image/jpeg). Il processo principale pero' li rifiutava: il .txt accanto non veniva letto, il
   salvataggio falliva e lo svuotamento del cestino li lasciava bloccati. Si provano i tre canali
   veri di electron/main.cjs (lettura, scrittura, Cestino) su file in una cartella temporanea; il
   Cestino di Windows e' un finto che annota soltanto.
   Lo stesso valeva per gli altri file che il browser chiama image/... (.apng, .ico, .svg, .svgz,
   .xbm): la pagina li carica, quindi i tre canali li accettano. Un file che non e' un'immagine
   (.html) deve restare rifiutato.
   Uso:  node scripts/test-sidecar-extensions.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE "ALTERNATIVE" JPEG EXTENSIONS (.jfif, .jpe, .pjpeg, .pjp)
   Windows saves many downloaded JPEGs as .jfif, and the app accepts them (the browser calls them
   image/jpeg). The main process refused them though: the .txt beside them was not read, saving
   failed and emptying the trash left them stuck. The three real channels of electron/main.cjs
   (read, write, Recycle Bin) are exercised on files in a temporary folder; the Recycle Bin is a
   fake that only records.
   The same held for the other files the browser calls image/... (.apng, .ico, .svg, .svgz, .xbm):
   the page loads them, so the three channels accept them. A file that is not an image (.html) must
   stay refused.
   Usage:  node scripts/test-sidecar-extensions.mjs      (exits with code 1 if anything is off) */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { caricaMain, creaControlli } from './main-harness.mjs';

const { handlers, cestinati } = caricaMain();
const { dice, esito } = creaControlli();
const cartella = fs.mkdtempSync(path.join(os.tmpdir(), 'itm-extensions-'));
let codice = 1;
try {
    const nomi = ['foto.jfif', 'altra.jpe', 'terza.pjpeg', 'quarta.pjp', 'maiuscola.JFIF', 'normale.jpg',
        'animata.apng', 'icona.ico', 'disegno.svg', 'compresso.svgz', 'bitmap.xbm',
        // ITALIANO: le foto dell'iPhone (2.0.1): la pagina le carica e l'AI le tagga, ma i canali le rifiutavano.
        // ENGLISH: iPhone photos (2.0.1): the page loads them and the AI tags them, but the channels refused them.
        'iphone.heic', 'seconda.HEIF'];
    const immagini = nomi.map((n) => path.join(cartella, n));
    for (const img of immagini) {
        fs.writeFileSync(img, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
        fs.writeFileSync(img.replace(/\.[^.]+$/, '.txt'), 'vecchio,');
    }
    const pagina = path.join(cartella, 'pagina.html');
    fs.writeFileSync(pagina, '<p></p>');
    fs.writeFileSync(path.join(cartella, 'pagina.txt'), 'vecchio,');
    const tutte = [...immagini, pagina];
    const txtDi = (n) => n.replace(/\.[^.]+$/, '.txt');

    console.log('\n--- lettura dei .txt accanto alle foto ---');
    const letti = await handlers.get('images:read-sidecar-tags')(null, tutte);
    dice('un .txt per ogni immagine, nessuno per la pagina .html', nomi.map(txtDi), letti.map((s) => s.name));

    console.log('\n--- scrittura dei .txt ---');
    const scritti = await handlers.get('images:write-sidecar-tags')(null, tutte.map((p) => ({ imagePath: p, content: 'nuovo,' })));
    dice('scritte tutte le immagini, rifiutata la pagina .html', [...nomi.map(() => true), false], scritti.results);
    dice('il .txt del .jfif contiene davvero il testo nuovo', 'nuovo,', fs.readFileSync(path.join(cartella, 'foto.txt'), 'utf8'));
    dice('anche quello dello .svg', 'nuovo,', fs.readFileSync(path.join(cartella, 'disegno.txt'), 'utf8'));
    dice('il .txt della pagina .html NON e\' stato toccato', 'vecchio,', fs.readFileSync(path.join(cartella, 'pagina.txt'), 'utf8'));

    console.log('\n--- Cestino di Windows (finto) ---');
    const cestino = await handlers.get('shell:trash-files')(null, tutte);
    dice('le immagini vanno nel Cestino, la pagina .html e\' rifiutata', [...nomi.map(() => 'ok'), 'rifiutato'], cestino.results);
    dice('il Cestino ha ricevuto proprio le immagini', nomi, cestinati.map((p) => path.basename(p)));

    codice = esito();
} finally {
    fs.rmSync(cartella, { recursive: true, force: true });
}
process.exit(codice);
