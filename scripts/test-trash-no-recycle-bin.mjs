/* ITALIANO: PROVA DEL CESTINO SU UN'UNITA' SENZA CESTINO (chiavetta USB, scheda SD)
   Windows non ha un Cestino sulle unita' rimovibili. Una foto aperta da li' con "Carica cartella"
   e messa nel cestino dell'app non si poteva togliere mai: Windows rifiutava lo spostamento, il
   canale rispondeva 'errore' e la seconda conferma (cancellazione definitiva) non compariva:
   "Non rimosse: 1" a ogni tentativo. Ora, dopo un rifiuto, se il file e' ancora li' e alla radice
   della sua unita' non c'e' la cartella $RECYCLE.BIN, il canale risponde 'rifiutato', come per le
   cartelle di rete. Lo stesso su un disco che il Cestino ce l'ha ma spento ("non spostare i file
   nel Cestino") o troppo piccolo per quel file: Windows rifiuta, il file e' ancora li' e si puo'
   aprire, quindi non lo blocca nessuno e si risponde 'rifiutato' (prima era 'errore', e la foto
   non usciva mai dal cestino dell'app). Un file bloccato da un altro programma resta 'errore', anche
   quando il programma lascia leggere e scrivere ma non cancellare (Python open(), PIL); se il
   blocco era solo di un attimo, il secondo tentativo lo manda nel Cestino. Una foto con
   l'attributo "sola lettura" non si apre mai in scrittura: per lei decide solo la prova del
   permesso di cancellare (prima restava 'errore' a ogni tentativo).
   Il Cestino di Windows e' un finto; anche la cartella $RECYCLE.BIN e' finta (quella vera non si
   guarda mai).
   Uso:  node scripts/test-trash-no-recycle-bin.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE RECYCLE BIN ON A DRIVE WITHOUT ONE (USB stick, SD card)
   Windows has no Recycle Bin on removable drives. A photo opened from there with "Load Folder" and
   put in the app's trash could never be removed: Windows refused the move, the channel answered
   'errore' and the second confirmation (permanent delete) never showed: "Not removed: 1" on every
   try. Now, after a refusal, if the file is still there and the root of its drive has no
   $RECYCLE.BIN folder, the channel answers 'rifiutato', as for network folders. The same on a disk
   that has a Recycle Bin turned off ("don't move files to the Recycle Bin") or too small for that
   file: Windows refuses, the file is still there and can be opened, so nobody is locking it and the
   answer is 'rifiutato' (it used to be 'errore', and the photo never left the app's trash). A file
   locked by another program stays 'errore', also when that program allows read and write but not
   delete (Python open(), PIL); if the lock lasted only a moment, the second try sends it to the
   Recycle Bin. A photo with the "read-only" attribute never opens for writing: for it only the
   delete-access probe decides (it used to stay 'errore' on every try).
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
// ITALIANO: i file "bloccati da un altro programma": aprirli da' EBUSY, come su Windows. Un file in
//           `sblocca` e' bloccato solo per un attimo: aprirlo lo libera (il Cestino poi lo accetta).
// ENGLISH: the files "locked by another program": opening them gives EBUSY, as on Windows. A file in
//          `sblocca` is locked only for a moment: opening it frees it (the Recycle Bin then takes it).
const bloccati = new Set();
const sblocca = new Set();
const aperti = [];
const openVero = fs.openSync;
fs.openSync = (p, ...resto) => {
    if (typeof p === 'string') aperti.push(path.basename(p));
    if (bloccati.has(p)) throw Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' });
    if (sblocca.has(p)) rifiutaCestino.delete(p);
    return openVero(p, ...resto);
};
// ITALIANO: i file tenuti aperti da un programma che lascia leggere e scrivere ma non cancellare
//           (Python open(), PIL): si aprono, ma rinominarli (che chiede il permesso di cancellare)
//           da' EBUSY, come su Windows. Gli altri si rinominano davvero (su se' stessi: niente cambia).
// ENGLISH: the files held open by a program that allows read and write but not delete (Python
//          open(), PIL): they open, but renaming them (which needs delete access) gives EBUSY, as
//          on Windows. The others are really renamed (onto themselves: nothing changes).
const bloccatiCancellazione = new Set();
const rinominati = [];
const renameVero = fs.renameSync;
fs.renameSync = (da, a, ...resto) => {
    if (typeof da === 'string') rinominati.push(path.basename(da));
    if (bloccatiCancellazione.has(da)) throw Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' });
    return renameVero(da, a, ...resto);
};
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
    const spento = path.join(cartella, 'cestino-spento.png');
    const attimo = path.join(cartella, 'attimo.png');
    const altraLibera = path.join(cartella, 'altra-libera.txt');
    const soloCancellazione = path.join(cartella, 'tenuta-da-python.png');
    const soloLettura = path.join(cartella, 'sola-lettura.png');
    const soloLetturaTenuta = path.join(cartella, 'sola-lettura-tenuta.png');
    for (const f of [foto, testo, bloccata, libera, spento, attimo, altraLibera, soloCancellazione, soloLettura, soloLetturaTenuta]) fs.writeFileSync(f, 'x');
    // ITALIANO: l'attributo "sola lettura" di Windows (fotocamere con la protezione, file copiati da
    //           un CD): aprirli in scrittura da' EPERM anche se nessuno li blocca.
    // ENGLISH: the Windows "read-only" attribute (cameras with the protect flag, files copied from a
    //          CD): opening them for writing gives EPERM even though nobody is locking them.
    for (const f of [soloLettura, soloLetturaTenuta]) fs.chmodSync(f, 0o444);

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
    bloccati.add(bloccata);
    r = await cestina([bloccata]);
    dice('"errore", nessuna offerta di cancellazione definitiva', [['errore'], false, 1], [r.results, r.ok, r.failed]);
    dice('il file resta sul disco', true, fs.existsSync(bloccata));

    console.log('\n--- disco con il Cestino: un file che si apre ma non si puo\' cancellare (Python, PIL) ---');
    rifiutaCestino.add(soloCancellazione);
    bloccatiCancellazione.add(soloCancellazione);
    r = await cestina([soloCancellazione]);
    dice('"errore", nessuna offerta di cancellazione definitiva', [['errore'], false, 0, 1], [r.results, r.ok, r.trashed, r.failed]);
    dice('il file resta sul disco', true, fs.existsSync(soloCancellazione));

    console.log('\n--- disco con il Cestino spento (o file troppo grande per il Cestino) ---');
    rifiutaCestino.add(spento);
    rinominati.length = 0;
    r = await cestina([spento]);
    dice('Windows rifiuta, il file si apre: "rifiutato", cosi\' l\'app offre la seconda conferma', [['rifiutato'], true, 0, 0], [r.results, r.ok, r.trashed, r.failed]);
    dice('il file resta sul disco, con il suo contenuto', [true, 'x'], [fs.existsSync(spento), fs.readFileSync(spento, 'utf8')]);
    dice('...anche dopo la prova del permesso di cancellare (rinominato su se\' stesso, davvero)', ['cestino-spento.png'], rinominati);

    console.log('\n--- disco con il Cestino spento: una foto con l\'attributo "sola lettura" ---');
    rifiutaCestino.add(soloLettura);
    rinominati.length = 0;
    r = await cestina([soloLettura]);
    dice('nessuno la blocca: "rifiutato", cosi\' l\'app offre la seconda conferma (prima "errore" a ogni tentativo)', [['rifiutato'], true, 0, 0], [r.results, r.ok, r.trashed, r.failed]);
    dice('...la prova del permesso di cancellare c\'e\' stata (rinominata su se\' stessa, davvero)', ['sola-lettura.png'], rinominati);
    dice('il file resta sul disco, con il suo contenuto e ancora in sola lettura', [true, 'x', 0], [fs.existsSync(soloLettura), fs.readFileSync(soloLettura, 'utf8'), fs.statSync(soloLettura).mode & 0o200]);
    rifiutaCestino.add(soloLetturaTenuta);
    bloccatiCancellazione.add(soloLetturaTenuta);
    r = await cestina([soloLetturaTenuta]);
    dice('in sola lettura E tenuta aperta da un programma: resta "errore"', [['errore'], false, 0, 1], [r.results, r.ok, r.trashed, r.failed]);
    dice('il file resta sul disco', true, fs.existsSync(soloLetturaTenuta));

    console.log('\n--- un blocco di un attimo: il secondo tentativo va nel Cestino ---');
    rifiutaCestino.add(attimo);
    sblocca.add(attimo);
    r = await cestina([attimo]);
    dice('"ok", nel Cestino di Windows', [['ok'], true, 1, 0, true], [r.results, r.ok, r.trashed, r.failed, cestinati.includes(attimo)]);

    console.log('\n--- i casi vicini non cambiano ---');
    cestinoSullUnita = false;
    guardate.length = 0;
    r = await cestina([libera]);
    dice('se il Cestino accetta, la foto va nel Cestino', [['ok'], ['libera.png']], [r.results, cestinati.slice(-1).map((p) => path.basename(p))]);
    dice('...e la radice non viene nemmeno guardata', [], guardate);
    aperti.length = 0;
    r = await cestina([altraLibera]);
    dice('...e un file che il Cestino accetta non viene mai aperto', [['ok'], []], [r.results, aperti]);
    r = await cestina([path.join(cartella, 'non-esiste.txt')]);
    dice('un file che non c\'e\' resta "niente da fare"', ['ok'], r.results);

    codice = esito();
} finally {
    fs.statSync = statVero;
    fs.openSync = openVero;
    fs.renameSync = renameVero;
    for (const f of ['sola-lettura.png', 'sola-lettura-tenuta.png']) {
        try { fs.chmodSync(path.join(cartella, f), 0o666); } catch (_) { /* gia' tolto */ }
    }
    fs.rmSync(cartella, { recursive: true, force: true });
}
process.exit(codice);
