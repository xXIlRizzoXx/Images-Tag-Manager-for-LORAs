/* ITALIANO: PROVA DEL CESTINO PER UNA FOTO DI RETE GIA' CANCELLATA DA ESPLORA FILE
   Una foto caricata con "Carica immagini" (o trascinata) da \\server\condivisione\... non puo'
   andare nel Cestino di Windows: il canale risponde 'rifiutato' e l'app dice di cancellarla da
   Esplora file. Chi lo faceva e premeva di nuovo "Svuota cestino" riceveva ancora 'rifiutato',
   perche' il percorso di rete veniva scartato PRIMA di guardare se il file c'era ancora: la foto
   restava nel cestino dell'app per sempre, con lo stesso messaggio a ogni tentativo. Ora un file
   di rete che non c'e' piu' (e la cui condivisione risponde) torna 'ok', come un file locale
   assente: niente viene spostato ne' cancellato. Se il file c'e', o la condivisione non risponde,
   resta 'rifiutato'. Le forme \\?\, \\.\ e i segmenti '..' restano rifiutati senza guardare niente.
   Nessuna rete vera: fs.statSync e' finto per ogni percorso che comincia con due barre.
   Uso:  node scripts/test-trash-network-missing.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE TRASH FOR A NETWORK PHOTO ALREADY DELETED IN FILE EXPLORER
   A photo loaded with "Load images" (or dropped in) from \\server\share\... cannot go to the Windows
   Recycle Bin: the channel answers 'rifiutato' and the app says to delete it in File Explorer.
   Whoever did that and pressed "Empty Trash" again still got 'rifiutato', because the network path
   was refused BEFORE looking whether the file was still there: the photo stayed in the app's trash
   forever, with the same message on every try. Now a network file that is gone (on a share that
   answers) comes back 'ok', like a missing local file: nothing is moved or deleted. If the file is
   there, or the share does not answer, it stays 'rifiutato'. The \\?\ and \\.\ forms and '..'
   segments stay refused without looking at anything.
   No real network: fs.statSync is faked for every path that starts with two slashes.
   Usage:  node scripts/test-trash-network-missing.mjs      (exits with code 1 if anything is off) */

import fs from 'node:fs';
import { caricaMain, creaControlli } from './main-harness.mjs';

const { handlers, cestinati } = caricaMain();
const { dice, esito } = creaControlli();
const cestina = (percorsi) => handlers.get('shell:trash-files')(null, percorsi);
const B = String.fromCharCode(92);
const unc = (...pezzi) => B + B + pezzi.join(B);

// ITALIANO: cosa "c'e'" sulla rete finta: condivisioni che rispondono e file presenti.
// ENGLISH: what "exists" on the fake network: shares that answer and files that are there.
const condivisioni = new Set([unc('nas', 'dati') + B]);
const fileDiRete = new Set([unc('nas', 'dati', 'presente.png')]);
const guardati = [];
const statVero = fs.statSync;
fs.statSync = (p, ...resto) => {
    if (typeof p === 'string' && /^[\\/]{2}/.test(p)) {
        guardati.push(p);
        if (condivisioni.has(p)) return { isFile: () => false, isDirectory: () => true };
        if (fileDiRete.has(p)) return { isFile: () => true, isDirectory: () => false };
        throw Object.assign(new Error('ENOENT: no such file or directory'), { code: 'ENOENT' });
    }
    return statVero(p, ...resto);
};

let codice = 1;
try {
    console.log('\n--- la foto di rete cancellata da Esplora file puo\' uscire ---');
    let r = await cestina([unc('nas', 'dati', '0001.png')]);
    dice('file di rete che non c\'e\' piu\': "ok", niente spostato', [['ok'], true, 0, 0], [r.results, r.ok, r.trashed, r.failed]);
    dice('...e il Cestino di Windows non e\' stato chiamato', 0, cestinati.length);
    r = await cestina([unc('nas', 'dati', 'sotto', '0001.txt')]);
    dice('anche il suo .txt assente: "ok"', ['ok'], r.results);

    console.log('\n--- la decisione A non cambia: sulla rete non si cestina niente ---');
    r = await cestina([unc('nas', 'dati', 'presente.png')]);
    dice('file di rete presente: resta "rifiutato"', [['rifiutato'], true, 0, 0], [r.results, r.ok, r.trashed, r.failed]);
    dice('...e il Cestino di Windows non e\' stato chiamato', 0, cestinati.length);
    r = await cestina([unc('spento', 'dati', '0001.png')]);
    dice('condivisione che non risponde: "rifiutato", la foto non esce per finta', ['rifiutato'], r.results);
    guardati.length = 0;
    r = await cestina([
        B + B + '?' + B + 'C:' + B + 'x.png',
        B + B + '.' + B + 'x' + B + 'y.png',
        unc('nas', 'dati', '..', 'x.png'),
        '//nas/dati/x.png',
        unc('nas', 'dati', 'programma.exe'),
    ]);
    dice('\\\\?\\, \\\\.\\, "..", //host e un .exe di rete restano "rifiutato"', ['rifiutato', 'rifiutato', 'rifiutato', 'rifiutato', 'rifiutato'], r.results);
    dice('...senza guardare il disco o la rete', [], guardati);

    console.log('\n--- i percorsi locali non cambiano ---');
    r = await cestina(['C:' + B + 'questo-file-non-esiste-itm' + B + 'x.png']);
    dice('file locale assente: "ok" come prima', ['ok'], r.results);
    r = await cestina(['relativo' + B + 'x.png']);
    dice('percorso relativo: "rifiutato" come prima', ['rifiutato'], r.results);

    codice = esito();
} finally {
    fs.statSync = statVero;
}
process.exit(codice);
