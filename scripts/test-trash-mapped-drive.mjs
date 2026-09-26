/* ITALIANO: PROVA DEL CESTINO CON UNA LETTERA DI UNITA' COLLEGATA A UN NAS (es. Z:\)
   Windows non ha un Cestino per le cartelle di rete. Il canale del Cestino lo sapeva per i
   percorsi \\server\condivisione, ma una lettera collegata con "Connetti unita' di rete" ha
   l'aspetto di un disco locale e passava: Windows rifiutava lo spostamento, e la foto restava
   bloccata nel cestino dell'app con "errore", senza mai arrivare alla seconda conferma. Ora il
   canale guarda dove porta davvero il percorso (fs.realpathSync.native: per un'unita' di rete
   Windows risponde \\server\...) e risponde 'rifiutato', come per \\server\... scritto per esteso.
   Nessuna unita' di rete serve: per UN file temporaneo si finge che il percorso vero sia di rete.
   Il Cestino di Windows e' un finto che annota soltanto.
   Uso:  node scripts/test-trash-mapped-drive.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE RECYCLE BIN WITH A DRIVE LETTER MAPPED TO A NAS (e.g. Z:\)
   Windows has no Recycle Bin for network folders. The Recycle Bin channel knew that for
   \\server\share paths, but a letter mapped with "Map network drive" looks like a local disk and
   got through: Windows refused the move, and the photo stayed stuck in the app's trash with
   "errore", never reaching the second confirmation. The channel now looks at where the path really
   leads (fs.realpathSync.native: for a network drive Windows answers \\server\...) and answers
   'rifiutato', as for a \\server\... path spelled out.
   No network drive is needed: for ONE temporary file the real path is faked to be a network one.
   The Windows Recycle Bin is a fake that only records.
   Usage:  node scripts/test-trash-mapped-drive.mjs      (exits with code 1 if anything is off) */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { caricaMain, creaControlli } from './main-harness.mjs';

const { handlers, cestinati } = caricaMain();
const { dice, esito } = creaControlli();
const cestina = (percorsi) => handlers.get('shell:trash-files')(null, percorsi);
const cartella = fs.mkdtempSync(path.join(os.tmpdir(), 'itm-network-drive-'));
const realpathVero = fs.realpathSync.native;
let codice = 1;
try {
    const suRete = path.join(cartella, 'su-rete.jpg');
    const suReteTxt = path.join(cartella, 'su-rete.txt');
    const locale = path.join(cartella, 'locale.jpg');
    for (const f of [suRete, suReteTxt, locale]) fs.writeFileSync(f, 'x');
    // ITALIANO: quello che Windows risponde per un file su Z:\ quando Z: e' \\nas\dataset
    // ENGLISH: what Windows answers for a file on Z:\ when Z: is \\nas\dataset
    const diRete = { [suRete]: '\\\\nas\\dataset\\su-rete.jpg', [suReteTxt]: '\\\\nas\\dataset\\su-rete.txt' };
    fs.realpathSync.native = (p, ...resto) => (diRete[p] || realpathVero(p, ...resto));

    console.log('\n--- foto su una lettera collegata a una cartella di rete ---');
    let r = await cestina([suRete]);
    dice('rifiutata come le cartelle di rete, non "errore"', ['rifiutato'], r.results);
    dice('non conta come fallimento', [true, 0, 0], [r.ok, r.trashed, r.failed]);
    r = await cestina([suReteTxt]);
    dice('anche il suo .txt e\' rifiutato', ['rifiutato'], r.results);
    dice('il Cestino di Windows non viene nemmeno chiamato', [], cestinati.map((p) => path.basename(p)));
    dice('i file restano sul disco', [true, true], [fs.existsSync(suRete), fs.existsSync(suReteTxt)]);

    console.log('\n--- i casi vicini non cambiano ---');
    r = await cestina([locale]);
    dice('una foto su un disco locale va nel Cestino', ['ok'], r.results);
    dice('...e il Cestino la riceve', ['locale.jpg'], cestinati.map((p) => path.basename(p)));
    r = await cestina(['\\\\nas\\dataset\\a.jpg']);
    dice('un percorso \\\\server\\... resta rifiutato', ['rifiutato'], r.results);
    r = await cestina([path.join(cartella, 'non-esiste.txt')]);
    dice('un file che non c\'e\' resta "niente da fare"', ['ok'], r.results);

    // ITALIANO: se Windows non sa dire il percorso vero, o ne dice uno strano ma non di rete, si
    //           fa esattamente come prima: si prova il Cestino.
    // ENGLISH: if Windows cannot tell the real path, or tells an odd but non-network one, behave
    //          exactly as before: try the Recycle Bin.
    cestinati.length = 0;
    fs.realpathSync.native = () => { throw new Error('real path not readable'); };
    r = await cestina([locale]);
    dice('percorso vero non leggibile: si prova il Cestino come prima', [['ok'], ['locale.jpg']], [r.results, cestinati.map((p) => path.basename(p))]);
    cestinati.length = 0;
    fs.realpathSync.native = () => 'Volume{0000}\\locale.jpg';
    r = await cestina([locale]);
    dice('percorso vero strano ma non di rete: si prova il Cestino come prima', [['ok'], ['locale.jpg']], [r.results, cestinati.map((p) => path.basename(p))]);

    codice = esito();
} finally {
    fs.realpathSync.native = realpathVero;
    fs.rmSync(cartella, { recursive: true, force: true });
}
process.exit(codice);
