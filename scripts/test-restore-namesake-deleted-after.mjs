/* ITALIANO: PROVA DI "ANNULLA LO SVUOTAMENTO" QUANDO L'OMONIMO FINISCE NEL CESTINO DOPO
   Dopo l'avviso "c'e' gia' un file con lo stesso nome" l'utente butta l'omonimo nel Cestino di
   Windows da Esplora file e riprova. Nel Cestino ci sono allora due voci con lo stesso percorso: la
   foto svuotata dal programma e l'omonimo, cancellato DOPO. Lo script teneva sempre la voce
   cancellata per ultima: tornava l'omonimo, con l'avviso verde, e la foto vera restava nel Cestino.
   Ora la pagina ricorda quando ha finito di svuotare (finoA) e lo passa al canale: le voci
   cancellate dopo quell'ora (piu' qualche secondo) non sono del programma e si saltano. L'ora di
   cancellazione si legge dal file $I della voce, scritto da Windows in UTC: niente fusi orari.
   Senza finoA, o senza il file $I, si fa come prima (test-restore-namesake).
   Si provano il canale VERO di electron/main.cjs con il Cestino finto di main-harness.mjs e le
   funzioni VERE di src/App.tsx con trash-harness.mjs. Nessuna finestra: PowerShell parte nascosto.
   Uso:  node scripts/test-restore-namesake-deleted-after.mjs   (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF "UNDO THE EMPTYING" WHEN THE NAMESAKE REACHES THE RECYCLE BIN AFTERWARDS
   After the "a file with the same name is already there" notice the user throws the namesake into
   the Windows Recycle Bin from Explorer and tries again. The bin then holds two entries with the
   same path: the photo the program emptied and the namesake, deleted AFTER it. The script always
   kept the entry deleted last: the namesake came back, with the green notice, and the real photo
   stayed in the bin. Now the page remembers when it finished emptying (finoA) and passes it to the
   channel: entries deleted after that time (plus a few seconds) are not the program's and are
   skipped. The deletion time is read from the entry's $I file, written by Windows in UTC: no time
   zones. Without finoA, or without the $I file, it behaves as before (test-restore-namesake).
   The REAL channel of electron/main.cjs is run with the fake bin of main-harness.mjs and the REAL
   functions of src/App.tsx with trash-harness.mjs. No window: PowerShell starts hidden.
   Usage:  node scripts/test-restore-namesake-deleted-after.mjs   (exits with code 1 if anything is off) */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { caricaMain, creaControlli } from './main-harness.mjs';
import { creaApp, apiFinta, foto } from './trash-harness.mjs';

const { dice, esito } = creaControlli();

console.log('\n--- la pagina ricorda quando ha svuotato e lo passa a tutte e due le chiamate ---');
{
    const api = apiFinta();
    const app = creaApp([foto('A', { cestinata: true }), foto('B', { cestinata: false })], { api });
    const prima = Date.now();
    await app.render().handleEmptyTrash();
    await app.attendi();
    const dopo = Date.now();
    const finoA = app.stato.ultimoSvuotamento && app.stato.ultimoSvuotamento.finoA;
    dice('il ricordo dello svuotamento ha l\'ora di fine', true, typeof finoA === 'number' && finoA >= prima && finoA <= dopo);
    await app.render().annullaSvuotamento();
    await app.attendi();
    dice('le chiamate al canale portano quell\'ora (immagini e .txt)', [true, true],
        [api.ripristiniFinoA.length >= 2, api.ripristiniFinoA.every((x) => typeof x === 'number' && x === finoA)]);
}

console.log('\n--- dopo l\'avviso dell\'omonimo il nuovo tentativo tiene l\'ora dello svuotamento ---');
{
    let giro = 0;
    const api = apiFinta({ ripristino: (percorsi) => ({ results: percorsi.map((p) => ({ percorso: p, esito: giro++ === 0 ? 'occupato' : 'ok' })) }) });
    const app = creaApp([foto('A', { cestinata: true })], { api });
    await app.render().handleEmptyTrash();
    await app.attendi();
    const finoA = app.stato.ultimoSvuotamento && app.stato.ultimoSvuotamento.finoA;
    await app.render().annullaSvuotamento();
    await app.attendi();
    dice('primo tentativo: omonimo, la foto resta riprovabile con la sua ora', [1, true, finoA],
        [app.stato.ultimoSvuotamento && app.stato.ultimoSvuotamento.voci.length, typeof finoA === 'number', app.stato.ultimoSvuotamento && app.stato.ultimoSvuotamento.finoA]);
    await app.render().annullaSvuotamento();
    await app.attendi();
    dice('secondo tentativo: la stessa ora arriva al canale', [true, finoA, finoA], [typeof finoA === 'number', ...api.ripristiniFinoA.slice(0, 2)]);
}

if (process.platform !== 'win32') {
    console.log('SALTATA la parte del canale: il ripristino dal Cestino esiste solo su Windows');
    process.exit(esito());
}

const { handlers, impostaCestino } = caricaMain();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'itm-namesake-after-'));
let codice = 1;
try {
    const cartella = path.join(tmp, 'dataset');
    const cestino = path.join(tmp, 'cestino-finto');
    fs.mkdirSync(cartella);
    fs.mkdirSync(cestino);
    const origine = path.join(cartella, '0001.png');
    const ADESSO = Date.now();
    // ITALIANO: come Windows: accanto a $Rxxx.png c'e' $Ixxx.png, con all'offset 16 l'ora della
    //           cancellazione (FILETIME UTC). minutiFa = null: nessun file $I.
    // ENGLISH: as Windows does: beside $Rxxx.png sits $Ixxx.png, holding at offset 16 the deletion time
    //          (UTC FILETIME). minutiFa = null: no $I file.
    const scriviI = (interno, quando) => {
        const b = Buffer.alloc(40);
        b.writeBigInt64LE(2n, 0);
        b.writeBigInt64LE(10n, 8);
        b.writeBigInt64LE(BigInt(quando) * 10000n + 116444736000000000n, 16);
        fs.writeFileSync(path.join(cestino, '$I' + interno.slice(2)), b);
    };
    const prepara = (voci) => {
        fs.rmSync(origine, { force: true });
        for (const f of fs.readdirSync(cestino)) fs.rmSync(path.join(cestino, f), { force: true });
        impostaCestino(voci.map(([interno, contenuto, minutiFa]) => {
            const p = path.join(cestino, interno);
            fs.writeFileSync(p, contenuto);
            if (minutiFa !== null) scriviI(interno, ADESSO - minutiFa * 60000);
            // ITALIANO: la data che mostra il Cestino (ExtendedProperty) segue quella del file $I.
            // ENGLISH: the date the bin shows (ExtendedProperty) follows the $I file's one.
            return { nome: '0001.png', interno: p, cartella, origine, giorni: minutiFa === null ? 0 : minutiFa / 1440 };
        }));
    };
    const leggi = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '(no file)');
    const voceR = () => fs.readdirSync(cestino).filter((f) => f.startsWith('$R')).map((f) => fs.readFileSync(path.join(cestino, f), 'utf8')).sort();
    const ripristina = async (finoA) => {
        const res = await handlers.get('shell:restore-trashed')(null, [origine], finoA);
        return (res.results[0] || {}).esito;
    };
    const SVUOTATO = ADESSO - 5 * 60000;

    console.log('\n--- l\'omonimo e\' stato buttato nel Cestino DOPO lo svuotamento ---');
    prepara([['$RNOS01.png', 'FOTO SVUOTATA', 10], ['$ROMO01.png', 'OMONIMO', 0]]);
    dice('con l\'ora dello svuotamento torna la foto svuotata, l\'omonimo resta nel Cestino', ['ok', 'FOTO SVUOTATA', ['OMONIMO']],
        [await ripristina(SVUOTATO), leggi(origine), voceR()]);
    prepara([['$ROMO01.png', 'OMONIMO', 0], ['$RNOS01.png', 'FOTO SVUOTATA', 10]]);
    dice('...anche se l\'omonimo e\' elencato per primo', ['ok', 'FOTO SVUOTATA'], [await ripristina(SVUOTATO), leggi(origine)]);
    prepara([['$RNOS01.png', 'FOTO SVUOTATA', 5.02], ['$ROMO01.png', 'OMONIMO', 0]]);
    dice('la foto cancellata un attimo prima della fine dello svuotamento conta come nostra', ['ok', 'FOTO SVUOTATA'], [await ripristina(SVUOTATO), leggi(origine)]);
    prepara([['$RNOS01.png', 'FOTO SVUOTATA', 4.97], ['$ROMO01.png', 'OMONIMO', 0]]);
    dice('margine: 2 secondi dopo l\'ora della pagina (orologi diversi) conta ancora come nostra', ['ok', 'FOTO SVUOTATA'], [await ripristina(SVUOTATO), leggi(origine)]);

    console.log('\n--- fra le voci di prima dello svuotamento vale ancora la piu\' recente ---');
    prepara([['$RVEC01.png', 'VECCHIA', 3000], ['$RNOS01.png', 'FOTO SVUOTATA', 10], ['$ROMO01.png', 'OMONIMO', 0]]);
    dice('vecchia, nostra e omonimo: torna la nostra', ['ok', 'FOTO SVUOTATA', ['OMONIMO', 'VECCHIA']], [await ripristina(SVUOTATO), leggi(origine), voceR()]);

    console.log('\n--- solo voci cancellate dopo: non e\' roba del programma ---');
    prepara([['$ROMO01.png', 'OMONIMO', 0]]);
    dice('nonTrovato, niente rimesso, l\'omonimo resta nel Cestino', ['nonTrovato', '(no file)', ['OMONIMO']], [await ripristina(SVUOTATO), leggi(origine), voceR()]);

    console.log('\n--- i casi vicini restano come prima ---');
    prepara([['$RNOS01.png', 'FOTO SVUOTATA', 10], ['$ROMO01.png', 'OMONIMO', 0]]);
    dice('senza l\'ora (chiamata vecchia): vale la piu\' recente, come test-restore-namesake', ['ok', 'OMONIMO'], [await ripristina(undefined), leggi(origine)]);
    prepara([['$RNOS01.png', 'FOTO SVUOTATA', 10], ['$ROMO01.png', 'OMONIMO', 0]]);
    dice('un\'ora non valida si ignora', ['ok', 'OMONIMO'], [await ripristina('ieri'), leggi(origine)]);
    prepara([['$RNOS01.png', 'FOTO SVUOTATA', null], ['$ROMO01.png', 'OMONIMO', null]]);
    dice('voci senza file $I: nessun filtro, si fa come prima (la prima incontrata a parita\' di data)', 'ok', await ripristina(SVUOTATO));
    prepara([['$RNOS01.png', 'FOTO SVUOTATA', 10]]);
    fs.writeFileSync(origine, 'SUL DISCO');
    dice('omonimo ancora sul disco: occupato, nessun file toccato', ['occupato', 'SUL DISCO'], [await ripristina(SVUOTATO), leggi(origine)]);

    codice = esito();
} finally {
    fs.rmSync(tmp, { recursive: true, force: true });
}
process.exit(codice);
