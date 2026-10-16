/* ITALIANO: PROVA DELL'ANNULLAMENTO DELLO SVUOTAMENTO CON UN OMONIMO GIA' NEL CESTINO
   Nel Cestino di Windows possono esserci DUE voci con lo stesso percorso d'origine: un vecchio
   0001.png cancellato giorni fa da Esplora risorse e il nuovo 0001.png appena mandato li' dall'app.
   Lo script prendeva la prima che incontrava, e l'ordine del Cestino e' casuale: poteva tornare la
   foto VECCHIA sotto la scheda (e i tag) di quella nuova, con esito "ok". Ora vince la voce
   cancellata per ULTIMA, cioe' quella dell'app; senza date si fa come prima.
   Si prova il canale VERO di electron/main.cjs con un Cestino finto fatto di file in una cartella
   temporanea (vedi main-harness.mjs). Nessuna finestra: PowerShell parte nascosto.
   Uso:  node scripts/test-restore-namesake.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE UNDO OF THE EMPTYING WITH A NAMESAKE ALREADY IN THE RECYCLE BIN
   The Windows Recycle Bin can hold TWO entries with the same original path: an old 0001.png deleted
   days ago from Explorer and the new 0001.png the app just sent there. The script took the first it
   met, and the Recycle Bin order is arbitrary: the OLD photo could come back under the new one's
   card (and tags), reported "ok". Now the entry deleted LAST wins, i.e. the app's; with no dates it
   behaves as before.
   The REAL channel of electron/main.cjs is exercised with a fake bin made of files in a temporary
   folder (see main-harness.mjs). No window: PowerShell starts hidden.
   Usage:  node scripts/test-restore-namesake.mjs      (exits with code 1 if anything is off) */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { caricaMain, creaControlli } from './main-harness.mjs';

if (process.platform !== 'win32') {
    console.log('SALTATA: il ripristino dal Cestino esiste solo su Windows');
    process.exit(0);
}

const { handlers, impostaCestino } = caricaMain();
const { dice, esito } = creaControlli();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'itm-namesake-'));
let codice = 1;
try {
    const cartella = path.join(tmp, 'dataset');
    const cestino = path.join(tmp, 'cestino-finto');
    fs.mkdirSync(cartella);
    fs.mkdirSync(cestino);
    const origine = path.join(cartella, '0001.png');
    const altra = path.join(cartella, '0002.png');
    // ITALIANO: ogni caso riparte da zero: la foto non e' sul disco, le voci sono nel Cestino.
    //           Una voce: [nome interno, contenuto, giorni dalla cancellazione (null = senza data), origine]
    // ENGLISH: each case starts over: the photo is not on disk, the entries are in the bin.
    //          One entry: [internal name, content, days since deletion (null = no date), origin]
    const prepara = (voci) => {
        for (const p of [origine, altra]) fs.rmSync(p, { force: true });
        for (const f of fs.readdirSync(cestino)) fs.rmSync(path.join(cestino, f), { force: true });
        impostaCestino(voci.map(([interno, contenuto, giorni, orig = origine]) => {
            const p = path.join(cestino, interno);
            fs.writeFileSync(p, contenuto);
            return { nome: path.basename(orig), interno: p, cartella, origine: orig, giorni };
        }));
    };
    const leggi = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '(no file)');
    const prova = async (titolo, voci, atteso) => {
        prepara(voci);
        const res = await handlers.get('shell:restore-trashed')(null, [origine]);
        const r = res.results[0] || {};
        dice(titolo, ['ok', atteso], [r.esito, leggi(origine)]);
        dice('...e l\'altra voce resta nel Cestino', voci.length - 1, fs.readdirSync(cestino).length);
    };

    console.log('\n--- due voci con lo stesso percorso d\'origine ---');
    await prova('la vecchia elencata per prima: torna la NUOVA', [['$RVEC01.png', 'VECCHIA', 30], ['$RNUO01.png', 'NUOVA', 0]], 'NUOVA');
    await prova('la nuova elencata per prima: torna la NUOVA', [['$RNUO01.png', 'NUOVA', 0], ['$RVEC01.png', 'VECCHIA', 30]], 'NUOVA');
    await prova('tre voci, la nuova in mezzo: torna la NUOVA', [['$RVEC01.png', 'VECCHIA', 30], ['$RNUO01.png', 'NUOVA', 0], ['$RMED01.png', 'MEDIA', 5]], 'NUOVA');
    await prova('una voce senza data non scavalca una con la data', [['$RSND01.png', 'SENZA DATA', null], ['$RNUO01.png', 'NUOVA', 0]], 'NUOVA');
    await prova('...nemmeno se viene dopo', [['$RNUO01.png', 'NUOVA', 0], ['$RSND01.png', 'SENZA DATA', null]], 'NUOVA');

    console.log('\n--- senza date si fa come prima (la prima incontrata) ---');
    await prova('nessuna data: torna la prima, esito ok', [['$RPRI01.png', 'PRIMA', null], ['$RSEC01.png', 'SECONDA', null]], 'PRIMA');

    console.log('\n--- i casi vicini non cambiano ---');
    prepara([['$RVEC01.png', 'VECCHIA', 30], ['$RNUO01.png', 'NUOVA', 0]]);
    fs.writeFileSync(origine, 'SUL DISCO');
    let res = await handlers.get('shell:restore-trashed')(null, [origine]);
    dice('omonimo gia\' sul disco: occupato, il file non viene toccato, il Cestino resta com\'era',
        ['occupato', 'SUL DISCO', 2], [res.results[0] && res.results[0].esito, leggi(origine), fs.readdirSync(cestino).length]);

    prepara([['$RUNO01.png', 'UNO', 0], ['$RDUE01.png', 'DUE', 0, altra]]);
    res = await handlers.get('shell:restore-trashed')(null, [origine, altra]);
    dice('due foto diverse tornano entrambe, ognuna al suo posto',
        [['ok', 'ok'], 'UNO', 'DUE'], [res.results.map((r) => r.esito), leggi(origine), leggi(altra)]);

    prepara([['$RALT01.png', 'ALTRA', 0, altra]]);
    res = await handlers.get('shell:restore-trashed')(null, [origine]);
    dice('una foto che non e\' nel Cestino resta "nonTrovato"', ['nonTrovato', '(no file)'], [res.results[0] && res.results[0].esito, leggi(origine)]);

    codice = esito();
} finally {
    fs.rmSync(tmp, { recursive: true, force: true });
}
process.exit(codice);
