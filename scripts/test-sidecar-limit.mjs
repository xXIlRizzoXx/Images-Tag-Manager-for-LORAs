/* ITALIANO: PROVA OLTRE LE 5000 FOTO ("Carica immagini" e trascinamento)
   Il processo principale leggeva e scriveva i .txt solo delle prime 5000 foto di ogni richiesta,
   senza dirlo: dalla 5001esima in poi la foto arrivava senza tag, e un'aggiunta in blocco seguita
   da "Salva" sostituiva il suo .txt con la sola parola chiave, cancellando i tag originali.
   Si provano i due canali veri di electron/main.cjs con 5001 foto finte (file minuscoli in una
   cartella temporanea, tolta alla fine): ogni foto deve avere il suo .txt letto e riscritto.
   Uso:  node scripts/test-sidecar-limit.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST BEYOND 5000 PHOTOS ("Load images" and drag and drop)
   The main process read and wrote the .txt of the first 5000 photos of each request only, without
   saying so: from the 5001st on the photo arrived without tags, and a bulk addition followed by
   "Save" replaced its .txt with the trigger word alone, wiping the original tags.
   The two real channels of electron/main.cjs are exercised with 5001 fake photos (tiny files in a
   temporary folder, removed at the end): every photo must have its .txt read and rewritten.
   Usage:  node scripts/test-sidecar-limit.mjs      (exits with code 1 if anything is off) */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { caricaMain, creaControlli } from './main-harness.mjs';

const QUANTE = 5001;
const { handlers } = caricaMain();
const { dice, esito } = creaControlli();
const cartella = fs.mkdtempSync(path.join(os.tmpdir(), 'itm-over5000-'));
let codice = 1;
try {
    const immagini = [];
    for (let i = 1; i <= QUANTE; i++) {
        const img = path.join(cartella, `img${i}.jpg`);
        fs.writeFileSync(img, 'x');
        fs.writeFileSync(path.join(cartella, `img${i}.txt`), `orig_${i},`);
        immagini.push(img);
    }

    console.log(`\n--- lettura dei .txt di ${QUANTE} foto ---`);
    const letti = handlers.get('images:read-sidecar-tags')(null, immagini);
    dice('un .txt per ogni foto', QUANTE, letti.length);
    const ultimo = letti.find((s) => s.name === `img${QUANTE}.txt`);
    dice(`letto anche il .txt della foto numero ${QUANTE}`, `orig_${QUANTE},`, ultimo ? ultimo.content : null);

    console.log(`\n--- scrittura dei .txt di ${QUANTE} foto ---`);
    const res = handlers.get('images:write-sidecar-tags')(null, immagini.map((p, i) => ({ imagePath: p, content: `trig, orig_${i + 1},` })));
    dice('un esito per ogni foto, nello stesso ordine', QUANTE, res.results.length);
    dice('tutte scritte, nessuna fallita', [true, QUANTE, 0], [res.ok, res.written, res.failed]);
    dice(`l'esito della foto numero ${QUANTE} e' "scritto"`, true, res.results[QUANTE - 1]);
    dice(`il .txt della foto numero ${QUANTE} contiene il testo nuovo`, `trig, orig_${QUANTE},`, fs.readFileSync(path.join(cartella, `img${QUANTE}.txt`), 'utf8'));

    codice = esito();
} finally {
    fs.rmSync(cartella, { recursive: true, force: true });
}
process.exit(codice);
