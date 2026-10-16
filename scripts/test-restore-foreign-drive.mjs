/* ITALIANO: PROVA DELL'ANNULLAMENTO DELLO SVUOTAMENTO CON UNA VOCE ESTRANEA SU UN'UNITA' CHE NON C'E'
   Lo script di ripristino scorre TUTTO il Cestino di Windows, anche le voci di altri programmi.
   Una sola voce la cui unita' d'origine non e' montata (un disco esterno che ha cambiato lettera)
   fermava lo script prima di qualsiasi risposta: Join-Path chiede a PowerShell se l'unita' esiste
   e, non trovandola, lancia un errore. Ogni foto tornava 'fallito' e ogni nuovo tentativo falliva
   allo stesso modo finche' quella voce restava nel Cestino. Ora il percorso si compone senza
   chiedere niente all'unita', e una voce estranea che da' errore viene saltata.
   Il Cestino e' un finto fatto di file in una cartella temporanea (vedi main-harness.mjs).
   Uso:  node scripts/test-restore-foreign-drive.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF UNDOING THE EMPTYING WITH A FOREIGN ENTRY ON A DRIVE THAT IS NOT THERE
   The restore script walks the WHOLE Windows Recycle Bin, other programs' entries included. A
   single entry whose original drive is not mounted (an external disk that changed letter) stopped
   the script before any answer: Join-Path asks PowerShell whether the drive exists and, not
   finding it, throws. Every photo came back 'fallito' and every retry failed the same way while
   that entry stayed in the bin. Now the path is built without asking the drive anything, and a
   foreign entry that errors is skipped.
   The bin is a fake made of files in a temporary folder (see main-harness.mjs).
   Usage:  node scripts/test-restore-foreign-drive.mjs      (exits with code 1 if anything is off) */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { caricaMain, creaControlli } from './main-harness.mjs';

if (process.platform !== 'win32') {
    console.log('SALTATA: il ripristino dal Cestino esiste solo su Windows');
    process.exit(0);
}

// ITALIANO: una lettera di unita' che su questo computer non e' montata adesso.
// ENGLISH: a drive letter that is not mounted on this computer right now.
const lettera = 'ZYXWVUTSRQPONMLKJIHG'.split('').find((l) => !fs.existsSync(l + ':\\'));
if (!lettera) {
    console.log('SALTATA: nessuna lettera di unita\' libera');
    process.exit(0);
}

const { handlers, impostaCestino } = caricaMain();
const { dice, esito } = creaControlli();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'itm-foreign-drive-'));
let codice = 1;
try {
    const cartella = path.join(tmp, 'dataset');
    const cestino = path.join(tmp, 'cestino-finto');
    fs.mkdirSync(cartella);
    fs.mkdirSync(cestino);
    const origine = path.join(cartella, '0001.png');
    const leggi = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '(no file)');
    const prova = async (titolo, estraneaPrima) => {
        fs.rmSync(origine, { force: true });
        for (const f of fs.readdirSync(cestino)) fs.rmSync(path.join(cestino, f), { force: true });
        const nostra = path.join(cestino, '$RNOS01.png');
        const estranea = path.join(cestino, '$RFOR01.jpg');
        fs.writeFileSync(nostra, 'NOSTRA');
        fs.writeFileSync(estranea, 'ESTRANEA');
        const voceNostra = { nome: '0001.png', interno: nostra, cartella, origine, giorni: 0 };
        const voceEstranea = { nome: 'vecchia.jpg', interno: estranea, cartella: lettera + ':\\Foto vecchie', origine: lettera + ':\\Foto vecchie\\vecchia.jpg', giorni: 10 };
        impostaCestino(estraneaPrima ? [voceEstranea, voceNostra] : [voceNostra, voceEstranea]);
        const res = await handlers.get('shell:restore-trashed')(null, [origine]);
        dice(titolo, [['ok'], 'NOSTRA'], [res.results.map((r) => r.esito), leggi(origine)]);
        dice('...e la voce estranea resta nel Cestino', ['$RFOR01.jpg'], fs.readdirSync(cestino));
    };

    console.log(`\n--- nel Cestino c'e' una voce di un altro programma da ${lettera}:\\ (non montata) ---`);
    await prova('la voce estranea elencata per prima: la foto torna lo stesso', true);
    await prova('la voce estranea elencata dopo: la foto torna lo stesso', false);

    codice = esito();
} finally {
    fs.rmSync(tmp, { recursive: true, force: true });
}
process.exit(codice);
