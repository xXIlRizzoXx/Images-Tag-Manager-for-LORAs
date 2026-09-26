/* ITALIANO: PROVA DELLE ESTENSIONI JPEG "ALTERNATIVE" (.jfif, .jpe, .pjpeg, .pjp)
   Windows salva molti JPEG scaricati come .jfif, e l'app li accetta (il browser li chiama
   image/jpeg). Il processo principale pero' li rifiutava: il .txt accanto non veniva letto, il
   salvataggio falliva e lo svuotamento del cestino li lasciava bloccati. Si provano i tre canali
   veri di electron/main.cjs (lettura, scrittura, Cestino) su file in una cartella temporanea; il
   Cestino di Windows e' un finto che annota soltanto. Un .svg deve restare rifiutato.
   Uso:  node scripts/test-sidecar-extensions.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE "ALTERNATIVE" JPEG EXTENSIONS (.jfif, .jpe, .pjpeg, .pjp)
   Windows saves many downloaded JPEGs as .jfif, and the app accepts them (the browser calls them
   image/jpeg). The main process refused them though: the .txt beside them was not read, saving
   failed and emptying the trash left them stuck. The three real channels of electron/main.cjs
   (read, write, Recycle Bin) are exercised on files in a temporary folder; the Recycle Bin is a
   fake that only records. An .svg must stay refused.
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
    const nomi = ['foto.jfif', 'altra.jpe', 'terza.pjpeg', 'quarta.pjp', 'maiuscola.JFIF', 'normale.jpg'];
    const immagini = nomi.map((n) => path.join(cartella, n));
    for (const img of immagini) {
        fs.writeFileSync(img, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
        fs.writeFileSync(img.replace(/\.[^.]+$/, '.txt'), 'vecchio,');
    }
    const vettoriale = path.join(cartella, 'disegno.svg');
    fs.writeFileSync(vettoriale, '<svg/>');
    fs.writeFileSync(path.join(cartella, 'disegno.txt'), 'vecchio,');
    const tutte = [...immagini, vettoriale];

    console.log('\n--- lettura dei .txt accanto alle foto ---');
    const letti = handlers.get('images:read-sidecar-tags')(null, tutte);
    dice('un .txt per ogni JPEG, nessuno per lo .svg', ['foto.txt', 'altra.txt', 'terza.txt', 'quarta.txt', 'maiuscola.txt', 'normale.txt'], letti.map((s) => s.name));

    console.log('\n--- scrittura dei .txt ---');
    const scritti = handlers.get('images:write-sidecar-tags')(null, tutte.map((p) => ({ imagePath: p, content: 'nuovo,' })));
    dice('scritti i sei JPEG, rifiutato lo .svg', [true, true, true, true, true, true, false], scritti.results);
    dice('il .txt del .jfif contiene davvero il testo nuovo', 'nuovo,', fs.readFileSync(path.join(cartella, 'foto.txt'), 'utf8'));
    dice('il .txt dello .svg NON e\' stato toccato', 'vecchio,', fs.readFileSync(path.join(cartella, 'disegno.txt'), 'utf8'));

    console.log('\n--- Cestino di Windows (finto) ---');
    const cestino = await handlers.get('shell:trash-files')(null, tutte);
    dice('i sei JPEG vanno nel Cestino, lo .svg e\' rifiutato', ['ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'rifiutato'], cestino.results);
    dice('il Cestino ha ricevuto proprio le sei foto', nomi, cestinati.map((p) => path.basename(p)));

    codice = esito();
} finally {
    fs.rmSync(cartella, { recursive: true, force: true });
}
process.exit(codice);
