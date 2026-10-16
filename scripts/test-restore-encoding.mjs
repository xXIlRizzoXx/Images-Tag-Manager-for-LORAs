/* ITALIANO: PROVA DELL'ANNULLAMENTO DELLO SVUOTAMENTO CON LETTERE ACCENTATE, CIRILLICHE, CINESI
   I percorsi vanno a PowerShell come JSON su stdin, in UTF-8. PowerShell 5.1 pero' leggeva stdin
   con la code page della console (850, 1252, 932...): una lettera accentata arrivava come due
   caratteri sbagliati, non combaciava mai col nome che dice il Cestino, e ogni foto di un dataset
   in una cartella con l'accento (o sotto un utente con un nome cirillico) tornava "non trovata"
   pur essendo nel Cestino.
   Si prova il canale VERO di electron/main.cjs (script, lancio di PowerShell, lettura della
   risposta); solo le due righe che aprono il Cestino vero sono sostituite da un Cestino finto
   fatto di file in una cartella temporanea (vedi main-harness.mjs). Nessuna finestra: PowerShell
   parte nascosto, come nell'app.
   Uso:  node scripts/test-restore-encoding.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE UNDO OF THE EMPTYING WITH ACCENTED, CYRILLIC, CHINESE LETTERS
   Paths reach PowerShell as JSON on stdin, in UTF-8. PowerShell 5.1 read stdin with the console
   code page (850, 1252, 932...) though: an accented letter arrived as two wrong characters, never
   matched the name the Recycle Bin reports, and every photo of a dataset in a folder with an
   accent (or under a user with a Cyrillic name) came back "not found" while sitting in the bin.
   The REAL channel of electron/main.cjs is exercised (script, PowerShell launch, reading of the
   answer); only the two lines opening the real Recycle Bin are swapped for a fake bin made of
   files in a temporary folder (see main-harness.mjs). No window: PowerShell starts hidden, as in
   the app.
   Usage:  node scripts/test-restore-encoding.mjs      (exits with code 1 if anything is off) */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { caricaMain, creaControlli } from './main-harness.mjs';

if (process.platform !== 'win32') {
    console.log('SALTATA: il ripristino dal Cestino esiste solo su Windows');
    process.exit(0);
}

const { handlers, lanci, impostaCestino } = caricaMain();
const { dice, esito } = creaControlli();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'itm-restore-'));
let codice = 1;
try {
    const cestino = path.join(tmp, 'cestino-finto');
    fs.mkdirSync(cestino);
    // ITALIANO: [cartella d'origine, nome del file, nome mostrato dal Cestino (a volte senza estensione)]
    // ENGLISH: [original folder, file name, name shown by the Recycle Bin (sometimes without extension)]
    const casi = [
        ['città', 'fotò.jpg', 'fotò'],
        ['città', 'photo.jpg', 'photo.jpg'],
        ['Владимир', 'снимок.txt', 'снимок'],
        ['太郎', '写真.png', '写真.png'],
        ['plain', 'plain-photo.jpg', 'plain-photo'],
    ];
    const voci = casi.map(([dir, file, mostrato], i) => {
        const cartella = path.join(tmp, 'originale', dir);
        fs.mkdirSync(cartella, { recursive: true });
        const interno = path.join(cestino, `$R000${i + 1}${path.extname(file)}`);
        fs.writeFileSync(interno, `contenuto ${i + 1}`);
        return { nome: mostrato, interno, cartella, origine: path.join(cartella, file), giorni: 0 };
    });
    impostaCestino(voci);

    const res = await handlers.get('shell:restore-trashed')(null, voci.map((v) => v.origine));
    const corto = (p) => path.relative(tmp, p);
    console.log('\n--- esito per ogni percorso ---');
    for (const v of voci) {
        const r = res.results.find((x) => x.percorso === v.origine);
        dice(`${corto(v.origine)} -> ok`, 'ok', r ? r.esito : '(no answer for this path)');
        dice(`${corto(v.origine)} e' tornato al suo posto`, true, fs.existsSync(v.origine));
    }
    dice('il canale conta tutte le foto come tornate', [true, voci.length], [res.ok, res.restored]);
    dice('PowerShell e\' partito nascosto (nessuna finestra)', true, lanci.length > 0 && lanci.every((l) => l.opzioni.windowsHide === true));

    codice = esito();
} finally {
    fs.rmSync(tmp, { recursive: true, force: true });
}
process.exit(codice);
