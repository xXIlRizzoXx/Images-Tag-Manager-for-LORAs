/* ITALIANO: PROVA DEL CESTINO SU UN'UNITA' SENZA CESTINO (chiavetta USB, scheda SD)
   Windows non ha un Cestino sulle unita' rimovibili. Una foto aperta da li' con "Carica cartella"
   e messa nel cestino dell'app non si poteva togliere mai: Windows rifiutava lo spostamento, il
   canale rispondeva 'errore' e la seconda conferma (cancellazione definitiva) non compariva:
   "Non rimosse: 1" a ogni tentativo. Ora, dopo un rifiuto, se il file e' ancora li' e alla radice
   della sua unita' non c'e' la cartella $RECYCLE.BIN, il canale risponde 'rifiutato', come per le
   cartelle di rete. Un file bloccato su un disco che il Cestino ce l'ha resta 'errore'.
   Il Cestino di Windows e' un finto; anche la cartella $RECYCLE.BIN e' finta (quella vera non si
   guarda mai).
   Uso:  node scripts/test-trash-no-recycle-bin.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE RECYCLE BIN ON A DRIVE WITHOUT ONE (USB stick, SD card)
   Windows has no Recycle Bin on removable drives. A photo opened from there with "Load Folder" and
   put in the app's trash could never be removed: Windows refused the move, the channel answered
   'errore' and the second confirmation (permanent delete) never showed: "Not removed: 1" on every
   try. Now, after a refusal, if the file is still there and the root of its drive has no
   $RECYCLE.BIN folder, the channel answers 'rifiutato', as for network folders. A locked file on a
   disk that has a Recycle Bin stays 'errore'.
   The Windows Recycle Bin is a fake; the $RECYCLE.BIN folder is fake too (the real one is never
   looked at).
   Usage:  node scripts/test-trash-no-recycle-bin.mjs      (exits with code 1 if anything is off) */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { caricaMain, creaControlli } from './main-harness.mjs';

const { handlers, cestinati, rifiutaCestino } = caricaMain();
const { dice, esito } = creaControlli();
const cestina = (percorsi) => handlers.get('shell:trash-files')(null, percorsi);
const cartella = fs.mkdtempSync(path.join(os.tmpdir(), 'itm-no-recycle-bin-'));
const statVero = fs.statSync;
// ITALIANO: la cartella $RECYCLE.BIN alla radice: c'e' o non c'e' a seconda del caso provato.
// ENGLISH: the $RECYCLE.BIN folder at the root: present or not depending on the case under test.
let cestinoSullUnita = false;
const guardate = [];
fs.statSync = (p, ...resto) => {
    if (typeof p === 'string' && path.basename(p).toLowerCase() === '$recycle.bin') {
        guardate.push(p);
        if (cestinoSullUnita) return { isFile: () => false, isDirectory: () => true };
        throw Object.assign(new Error('ENOENT: no such file or directory'), { code: 'ENOENT' });
    }
    return statVero(p, ...resto);
};
let codice = 1;
try {
    const foto = path.join(cartella, 'foto.png');
    const testo = path.join(cartella, 'foto.txt');
    const bloccata = path.join(cartella, 'bloccata.png');
    const libera = path.join(cartella, 'libera.png');
    for (const f of [foto, testo, bloccata, libera]) fs.writeFileSync(f, 'x');

    console.log('\n--- chiavetta USB: il Cestino non c\'e\' ---');
    rifiutaCestino.add(foto);
    rifiutaCestino.add(testo);
    let r = await cestina([foto, testo]);
    dice('rifiutate, cosi\' l\'app offre la seconda conferma', ['rifiutato', 'rifiutato'], r.results);
    dice('non conta come fallimento', [true, 0, 0], [r.ok, r.trashed, r.failed]);
    dice('i file restano sul disco', [true, true], [fs.existsSync(foto), fs.existsSync(testo)]);
    dice('si e\' guardata la radice dell\'unita\' giusta', path.parse(cartella).root.toLowerCase(), path.dirname(guardate[0] || '').toLowerCase());

    console.log('\n--- disco con il Cestino: un file bloccato resta un errore ---');
    cestinoSullUnita = true;
    rifiutaCestino.add(bloccata);
    r = await cestina([bloccata]);
    dice('"errore", nessuna offerta di cancellazione definitiva', [['errore'], false, 1], [r.results, r.ok, r.failed]);
    dice('il file resta sul disco', true, fs.existsSync(bloccata));

    console.log('\n--- i casi vicini non cambiano ---');
    cestinoSullUnita = false;
    guardate.length = 0;
    r = await cestina([libera]);
    dice('se il Cestino accetta, la foto va nel Cestino', [['ok'], ['libera.png']], [r.results, cestinati.map((p) => path.basename(p))]);
    dice('...e la radice non viene nemmeno guardata', [], guardate);
    r = await cestina([path.join(cartella, 'non-esiste.txt')]);
    dice('un file che non c\'e\' resta "niente da fare"', ['ok'], r.results);

    codice = esito();
} finally {
    fs.statSync = statVero;
    fs.rmSync(cartella, { recursive: true, force: true });
}
process.exit(codice);
