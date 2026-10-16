/* ITALIANO: PROVA DEL CESTINO QUANDO L'UNITA' DELLA FOTO NON C'E' PIU' (chiavetta staccata, NAS spento)
   Una foto aperta da una chiavetta USB, da una scheda SD o da un'unita' di rete (E:\dataset,
   Z:\dataset), messa nel cestino dell'app; poi la chiavetta si stacca o il NAS dietro Z: si spegne,
   e l'utente preme "Svuota cestino". Il canale guardava il file, non lo trovava e rispondeva 'ok'
   senza chiedersi perche': la foto usciva dal progetto con "File spostati nel Cestino di Windows",
   senza annullamento, ed era ancora nella cartella di addestramento quando l'unita' tornava. Ora
   "il file non c'e'" vale solo se Windows dice proprio che non c'e' (ENOENT/ENOTDIR) e la radice
   dell'unita' risponde, la stessa regola delle cartelle di rete: altrimenti 'errore', e la foto
   resta nel cestino dell'app finche' l'unita' non torna.
   Nessuna unita' vera: fs.statSync e' finto per le lettere Q: e R:.
   Uso:  node scripts/test-trash-missing-drive.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE TRASH WHEN THE PHOTO'S DRIVE IS GONE (USB stick unplugged, NAS off)
   A photo opened from a USB stick, an SD card or a network drive (E:\dataset, Z:\dataset) is put in
   the app's trash; then the stick is unplugged or the NAS behind Z: goes off, and the user presses
   "Empty Trash". The channel looked at the file, did not find it and answered 'ok' without asking
   why: the photo left the project with "Files moved to the Windows Recycle Bin", with no undo, and
   was still in the training folder when the drive came back. Now "the file is not there" holds
   only when Windows says exactly that (ENOENT/ENOTDIR) and the drive's root answers, the same rule
   as for network folders: otherwise 'errore', and the photo stays in the app's trash until the
   drive is back.
   No real drive: fs.statSync is faked for the letters Q: and R:.
   Usage:  node scripts/test-trash-missing-drive.mjs      (exits with code 1 if anything is off) */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { caricaMain, creaControlli } from './main-harness.mjs';

const { handlers, cestinati } = caricaMain();
const { dice, esito } = creaControlli();
const cestina = (percorsi) => handlers.get('shell:trash-files')(null, percorsi);
const B = String.fromCharCode(92);

// ITALIANO: Q: e' la chiavetta (staccata o attaccata), R: un'unita' che risponde ma da' un errore
//           di lettura (EIO) sul file.
// ENGLISH: Q: is the USB stick (unplugged or plugged in), R: a drive that answers but gives a read
//          error (EIO) on the file.
let chiavettaAttaccata = false;
const fileSullaChiavetta = new Set(['q:' + B + 'dataset' + B + '0001.png']);
const errore = (code) => Object.assign(new Error(code), { code });
const statVero = fs.statSync;
fs.statSync = (p, ...resto) => {
    if (typeof p === 'string' && /^q:/i.test(p)) {
        if (!chiavettaAttaccata) throw errore('ENOENT');
        if (p.toLowerCase() === 'q:' + B) return { isFile: () => false, isDirectory: () => true };
        if (fileSullaChiavetta.has(p.toLowerCase())) return { isFile: () => true, isDirectory: () => false };
        throw errore('ENOENT');
    }
    if (typeof p === 'string' && /^r:/i.test(p)) {
        if (p.toLowerCase() === 'r:' + B) return { isFile: () => false, isDirectory: () => true };
        throw errore('EIO');
    }
    return statVero(p, ...resto);
};

const cartella = fs.mkdtempSync(path.join(os.tmpdir(), 'itm-missing-drive-'));
let codice = 1;
try {
    console.log('\n--- la chiavetta e\' stata staccata: la foto non esce per finta ---');
    let r = await cestina(['Q:' + B + 'dataset' + B + '0001.png']);
    dice('"errore", la foto resta nel cestino dell\'app', [['errore'], false, 0, 1], [r.results, r.ok, r.trashed, r.failed]);
    dice('...e il Cestino di Windows non e\' stato chiamato', 0, cestinati.length);
    r = await cestina(['Q:' + B + 'dataset' + B + '0002.txt']);
    dice('anche un .txt sull\'unita\' staccata: "errore", non "niente da fare"', ['errore'], r.results);

    console.log('\n--- un errore di lettura che non dice "non c\'e\'" ---');
    r = await cestina(['R:' + B + 'dataset' + B + '0001.png']);
    dice('EIO su un\'unita\' che risponde: "errore"', [['errore'], 1], [r.results, r.failed]);

    console.log('\n--- la chiavetta torna: tutto come prima ---');
    chiavettaAttaccata = true;
    r = await cestina(['Q:' + B + 'dataset' + B + '0001.png']);
    dice('la foto va nel Cestino di Windows', [['ok'], true, 1, 0], [r.results, r.ok, r.trashed, r.failed]);
    dice('...proprio quella', ['Q:' + B + 'dataset' + B + '0001.png'], cestinati);
    r = await cestina(['Q:' + B + 'dataset' + B + '0001.txt']);
    dice('il suo .txt che non c\'e\' (foto senza tag): "ok", niente spostato', [['ok'], true, 0, 0], [r.results, r.ok, r.trashed, r.failed]);

    console.log('\n--- i casi vicini non cambiano ---');
    r = await cestina([path.join(cartella, 'non-esiste.png'), path.join(cartella, 'non-esiste.txt')]);
    dice('file assenti in una cartella che c\'e\': "ok" come prima', [['ok', 'ok'], true, 0], [r.results, r.ok, r.failed]);
    r = await cestina(['C:' + B + 'questo-file-non-esiste-itm' + B + 'x.png']);
    dice('file assente su un disco che c\'e\', cartella assente: "ok" come prima', ['ok'], r.results);
    const vera = path.join(cartella, 'vera.png');
    fs.writeFileSync(vera, 'x');
    r = await cestina([vera]);
    dice('un file che c\'e\' va nel Cestino come prima', [['ok'], 1], [r.results, r.trashed]);

    codice = esito();
} finally {
    fs.statSync = statVero;
    fs.rmSync(cartella, { recursive: true, force: true });
}
process.exit(codice);
