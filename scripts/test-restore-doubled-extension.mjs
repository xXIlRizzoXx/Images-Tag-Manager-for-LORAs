/* ITALIANO: PROVA DELL'ANNULLAMENTO DELLO SVUOTAMENTO PER UNA FOTO CON L'ESTENSIONE DOPPIA
   Windows nasconde le estensioni: chi rinomina una foto "x.png" da Esplora file ottiene x.png.png,
   e il Cestino la mostra come "x.png". Lo script vedeva che il nome finiva gia' con ".png", non
   aggiungeva l'estensione e cercava ...\x.png: la foto tornava "nonTrovato" ("forse e' stato
   svuotato") e usciva dall'annullamento, pur essendo ancora nel Cestino. Ora per un nome che finisce
   gia' con l'estensione si guardano tutte e due le possibilita' (x.png e x.png.png) e si prende
   quella chiesta. Se le chiede tutte e due (x.png e x.png.png svuotate insieme), prima si assegnano
   le voci senza dubbi, poi quella dubbia va al percorso rimasto libero: funziona sia con le
   estensioni nascoste sia con quelle visibili.
   Si prova il canale VERO di electron/main.cjs con un Cestino finto (vedi main-harness.mjs).
   Nessuna finestra: PowerShell parte nascosto.
   Uso:  node scripts/test-restore-doubled-extension.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE UNDO OF THE EMPTYING FOR A PHOTO WITH A DOUBLED EXTENSION
   Windows hides extensions: whoever renames a photo "x.png" in File Explorer gets x.png.png, and the
   Recycle Bin shows it as "x.png". The script saw the name already ending with ".png", did not add
   the extension and looked for ...\x.png: the photo came back "nonTrovato" ("it may have been
   emptied") and left the undo, although it was still in the Recycle Bin. Now for a name that
   already ends with the extension both possibilities (x.png and x.png.png) are considered and the
   requested one is taken. When both are requested (x.png and x.png.png emptied together), the
   entries without doubt are assigned first, then the doubtful one goes to the path still free: it
   works with extensions hidden and with extensions shown.
   The REAL channel of electron/main.cjs is exercised with a fake bin (see main-harness.mjs). No
   window: PowerShell starts hidden.
   Usage:  node scripts/test-restore-doubled-extension.mjs      (exits with code 1 if anything is off) */

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
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'itm-doubled-ext-'));
let codice = 1;
try {
    const cartella = path.join(tmp, 'dataset');
    const cestino = path.join(tmp, 'cestino-finto');
    fs.mkdirSync(cartella);
    fs.mkdirSync(cestino);
    const doppia = path.join(cartella, 'x.png.png');
    const semplice = path.join(cartella, 'x.png');
    const controllo = path.join(cartella, 'y.png');
    // ITALIANO: ogni caso riparte da zero. Una voce: [nome mostrato, nome interno, contenuto, origine,
    //           giorni dalla cancellazione (0 se manca)]
    // ENGLISH: each case starts over. One entry: [displayed name, internal name, content, origin,
    //          days since deletion (0 when missing)]
    const prepara = (voci) => {
        for (const p of [doppia, semplice, controllo]) fs.rmSync(p, { force: true });
        for (const f of fs.readdirSync(cestino)) fs.rmSync(path.join(cestino, f), { force: true });
        impostaCestino(voci.map(([nome, interno, contenuto, origine, giorni = 0]) => {
            const p = path.join(cestino, interno);
            fs.writeFileSync(p, contenuto);
            return { nome, interno: p, cartella, origine, giorni };
        }));
    };
    const leggi = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '(no file)');
    const ripristina = async (percorsi) => {
        const res = await handlers.get('shell:restore-trashed')(null, percorsi);
        const m = new Map(res.results.map((r) => [r.percorso, r.esito]));
        return percorsi.map((p) => m.get(p));
    };

    console.log('\n--- x.png.png mostrata come "x.png" (estensioni nascoste) ---');
    prepara([['x.png', '$RABC12.png', 'DOPPIA', doppia]]);
    dice('torna "ok" ed e\' sul disco col suo nome', [['ok'], 'DOPPIA'], [await ripristina([doppia]), leggi(doppia)]);
    dice('...e non nasce un x.png', false, fs.existsSync(semplice));

    console.log('\n--- i casi vicini non cambiano ---');
    prepara([['y', '$RCTL01.png', 'Y', controllo]]);
    dice('y.png mostrata come "y": "ok"', [['ok'], 'Y'], [await ripristina([controllo]), leggi(controllo)]);
    prepara([['x.png', '$RSEM01.png', 'SEMPLICE', semplice]]);
    dice('x.png mostrata come "x.png" (estensioni visibili): "ok"', [['ok'], 'SEMPLICE'], [await ripristina([semplice]), leggi(semplice)]);
    prepara([['x.png', '$RABC12.png', 'DOPPIA', doppia]]);
    fs.writeFileSync(doppia, 'OMONIMO');
    dice('x.png.png con un omonimo gia\' sul disco: "occupato", il file non viene toccato', [['occupato'], 'OMONIMO', 1], [await ripristina([doppia]), leggi(doppia), fs.readdirSync(cestino).length]);

    console.log('\n--- x.png e x.png.png svuotate insieme ---');
    prepara([['x.png', '$RDOP01.png', 'DOPPIA', doppia], ['x', '$RSEM01.png', 'SEMPLICE', semplice]]);
    dice('estensioni nascoste ("x" e "x.png"): tornano tutte e due, ognuna al suo posto',
        [['ok', 'ok'], 'SEMPLICE', 'DOPPIA'], [await ripristina([semplice, doppia]), leggi(semplice), leggi(doppia)]);
    prepara([['x.png', '$RSEM01.png', 'SEMPLICE', semplice], ['x.png.png', '$RDOP01.png', 'DOPPIA', doppia]]);
    dice('estensioni visibili ("x.png" e "x.png.png"): tornano tutte e due, ognuna al suo posto',
        [['ok', 'ok'], 'SEMPLICE', 'DOPPIA'], [await ripristina([semplice, doppia]), leggi(semplice), leggi(doppia)]);

    console.log('\n--- se ne chiede una sola, l\'altra resta nel Cestino ---');
    prepara([['x.png', '$RDOP01.png', 'DOPPIA', doppia], ['x', '$RSEM01.png', 'SEMPLICE', semplice]]);
    dice('chiesta x.png.png: torna lei, la voce di x.png resta', [['ok'], 'DOPPIA', '(no file)', ['$RSEM01.png']],
        [await ripristina([doppia]), leggi(doppia), leggi(semplice), fs.readdirSync(cestino)]);
    // ITALIANO: con le estensioni nascoste x.png.png ("x.png") potrebbe anche essere x.png: solo dal
    //           nome non si distingue. Svuotate insieme le chiede tutte e due (caso sopra); qui
    //           x.png.png e' stata cancellata prima, e vince la voce cancellata per ultima.
    // ENGLISH: with extensions hidden x.png.png ("x.png") could also be x.png: the name alone cannot
    //          tell. Emptied together both are requested (case above); here x.png.png was deleted
    //          earlier, and the entry deleted last wins.
    prepara([['x.png', '$RDOP01.png', 'DOPPIA', doppia, 3], ['x', '$RSEM01.png', 'SEMPLICE', semplice]]);
    dice('chiesta x.png: torna lei, la voce di x.png.png resta', [['ok'], 'SEMPLICE', '(no file)', ['$RDOP01.png']],
        [await ripristina([semplice]), leggi(semplice), leggi(doppia), fs.readdirSync(cestino)]);

    codice = esito();
} finally {
    fs.rmSync(tmp, { recursive: true, force: true });
}
process.exit(codice);
