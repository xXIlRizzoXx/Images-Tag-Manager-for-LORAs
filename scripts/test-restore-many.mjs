/* ITALIANO: PROVA DELL'ANNULLAMENTO DI UNO SVUOTAMENTO CON PIU' DI 5000 FOTO
   "Annulla lo svuotamento" manda tutte le foto svuotate in una sola chiamata. Il canale ne guardava
   solo le prime 5000 e per le altre non dava nessun esito: la pagina le contava "non rimesse a
   posto" senza che nessuno le avesse cercate, e bisognava premere di nuovo. Ora ogni percorso
   chiesto ha il suo esito, e quelli oltre il vecchio tetto vengono cercati come gli altri (il tempo
   massimo cresce gia' col numero di file).
   Si prova il canale VERO di electron/main.cjs con un Cestino finto (vedi main-harness.mjs).
   Nessuna finestra: PowerShell parte nascosto.
   Uso:  node scripts/test-restore-many.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE UNDO OF AN EMPTYING WITH MORE THAN 5000 PHOTOS
   "Undo the emptying" sends every emptied photo in one call. The channel looked only at the first
   5000 and gave no outcome at all for the rest: the page counted them "not put back" although
   nobody had looked for them, and the button had to be pressed again. Now every requested path has
   its outcome, and the ones beyond the old cap are looked for like the others (the time limit
   already grows with the number of files).
   The REAL channel of electron/main.cjs is exercised with a fake bin (see main-harness.mjs). No
   window: PowerShell starts hidden.
   Usage:  node scripts/test-restore-many.mjs      (exits with code 1 if anything is off) */

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
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'itm-restore-many-'));
let codice = 1;
try {
    const cartella = path.join(tmp, 'dataset');
    const cestino = path.join(tmp, 'cestino-finto');
    fs.mkdirSync(cartella);
    fs.mkdirSync(cestino);
    const N = 5003;
    const percorsi = Array.from({ length: N }, (_, i) => path.join(cartella, `${String(i + 1).padStart(5, '0')}.png`));
    // ITALIANO: nel Cestino finto c'e' una foto prima del vecchio tetto e due dopo.
    // ENGLISH: the fake bin holds one photo before the old cap and two after it.
    const nelCestino = [percorsi[10], percorsi[5000], percorsi[N - 1]];
    impostaCestino(nelCestino.map((orig, i) => {
        const interno = path.join(cestino, `$RMANY${i}.png`);
        fs.writeFileSync(interno, 'FOTO ' + i);
        return { nome: path.basename(orig), interno, cartella, origine: orig, giorni: 0 };
    }));

    const res = await handlers.get('shell:restore-trashed')(null, percorsi);
    const perPercorso = new Map(res.results.map((r) => [r.percorso, r.esito]));
    dice('un esito per ogni percorso chiesto, anche oltre 5000', N, res.results.length);
    dice('...e nessun percorso senza esito', [], percorsi.filter((p) => !perPercorso.has(p)).map((p) => path.basename(p)));
    dice('le foto nel Cestino tornano, anche quelle dopo la 5000a', ['ok', 'ok', 'ok'], nelCestino.map((p) => perPercorso.get(p)));
    dice('...e sono davvero sul disco', [true, true, true], nelCestino.map((p) => fs.existsSync(p)));
    dice('le altre restano "nonTrovato", senza inventare un esito', N - 3, res.results.filter((r) => r.esito === 'nonTrovato').length);
    dice('il conteggio dei rimessi a posto e\' giusto', [3, false], [res.restored, res.ok]);

    codice = esito();
} finally {
    fs.rmSync(tmp, { recursive: true, force: true });
}
process.exit(codice);
