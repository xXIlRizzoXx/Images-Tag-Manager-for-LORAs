/* ITALIANO: PROVA DELLA CHIUSURA DEL PROGRAMMA DURANTE "SALVA" (FILE .itm-tmp LASCIATI IN GIRO)
   I .txt delle foto caricate con "Carica immagini" si scrivono nel processo principale, uno dopo
   l'altro, passando da un temporaneo `<nome>.txt.<8 cifre>.itm-tmp`. Da quando la scrittura e'
   asincrona, la seconda X durante "Salva" chiudeva il programma a meta' di un file e il temporaneo
   restava per sempre nella cartella delle foto. Ora alla chiusura (before-quit) si ferma l'uscita,
   si finisce solo il file in corso, gli altri si saltano senza toccarli, e poi si esce davvero; con
   un tetto di qualche secondo per una cartella che non risponde.
   Si carica il main.cjs VERO con scripts/main-harness.mjs (Electron finto: app.quit non chiude
   niente, si annota quando viene chiamata). Nessuna finestra.
   Uso:  node scripts/test-quit-during-save.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF QUITTING THE PROGRAM DURING "SAVE" (.itm-tmp FILES LEFT BEHIND)
   The .txt files of photos loaded with "Load images" are written in the main process, one after the
   other, through a temporary `<name>.txt.<8 digits>.itm-tmp`. Since the writing became asynchronous,
   the second X during "Save" closed the program halfway through a file and the temporary file stayed
   forever in the photo folder. Now on quitting (before-quit) the exit is held, only the file in
   progress is finished, the others are skipped untouched, and then it really quits; with a cap of a
   few seconds for a folder that does not answer.
   The REAL main.cjs is loaded with scripts/main-harness.mjs (fake Electron: app.quit closes nothing,
   the call is recorded). No window.
   Usage:  node scripts/test-quit-during-save.mjs      (exits with code 1 if anything is off) */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { caricaMain, creaControlli } from './main-harness.mjs';

const require = createRequire(import.meta.url);
const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'itm-quit-save-'));
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
let codice = 1;

const preparaCartella = (nome, quante) => {
    const cartella = path.join(tmp, nome);
    fs.mkdirSync(cartella);
    const items = [];
    for (let i = 0; i < quante; i++) {
        const img = path.join(cartella, `foto${i}.png`);
        fs.writeFileSync(img, 'x');
        fs.writeFileSync(path.join(cartella, `foto${i}.txt`), 'vecchio');
        items.push({ imagePath: img, content: 'nuovo, tag' });
    }
    return { cartella, items };
};
const residui = (cartella) => fs.readdirSync(cartella).filter((f) => f.endsWith('.itm-tmp'));

try {
    let main = caricaMain();

    console.log('\n--- chiusura senza nessun salvataggio in corso ---');
    dice('la chiusura non viene fermata e non si richiama app.quit', [false, 0], [main.emettiApp('before-quit'), main.uscite.length]);

    console.log('\n--- seconda X durante un "Salva" lungo ---');
    {
        const N = 400;
        const { cartella, items } = preparaCartella('lotto', N);
        let residuiAllUscita = null;
        main.allUscita(() => { residuiAllUscita = residui(cartella); });
        let finito = false;
        const lavoro = main.handlers.get('images:write-sidecar-tags')(null, items).then((r) => { finito = true; return r; });
        // ITALIANO: si aspetta l'istante in cui un .txt e' a meta' (il suo temporaneo esiste).
        // ENGLISH: wait for the moment a .txt is halfway (its temporary file exists).
        while (!finito && residui(cartella).length === 0) await new Promise((r) => setImmediate(r));
        dice('premessa: la chiusura arriva a lotto non finito, con un temporaneo sul disco', [false, true], [finito, residui(cartella).length > 0]);
        const fermata = main.emettiApp('before-quit');
        // ITALIANO: senza la correzione nessuno ferma l'uscita: il processo finirebbe ADESSO.
        // ENGLISH: without the fix nobody holds the exit: the process would end NOW.
        if (!fermata) residuiAllUscita = residui(cartella);
        const secondaFermata = fermata ? main.emettiApp('before-quit') : false;
        const r = await lavoro;
        for (let i = 0; i < 100 && fermata && main.uscite.length === 0; i++) await pausa(20);
        dice('la chiusura viene trattenuta finche\' il file in corso e\' finito', true, fermata);
        dice('nel momento in cui si esce non resta nessun .itm-tmp', [], residuiAllUscita);
        dice('e non ne resta nessuno dopo', [], residui(cartella));
        const testi = items.map((_, i) => fs.readFileSync(path.join(cartella, `foto${i}.txt`), 'utf8'));
        dice('ogni .txt e\' o tutto vecchio o tutto nuovo', [], testi.filter((t) => t !== 'vecchio' && t !== 'nuovo, tag'));
        dice('il lotto si e\' fermato a meta\': i file non toccati tornano "non salvati"', [true, false], [r.written < N, r.ok]);
        dice('ogni esito dice il vero (true = .txt nuovo, false = .txt vecchio)', [], r.results.map((ok, i) => (ok === (testi[i] === 'nuovo, tag') ? null : i)).filter((x) => x !== null));
        dice('si esce una volta sola, anche con due X durante l\'attesa', [true, 1], [secondaFermata, main.uscite.length]);
        dice('la chiusura richiesta da main.cjs passa senza essere fermata', false, main.emettiApp('before-quit'));
    }

    console.log('\n--- una cartella che non risponde non tiene vivo il programma ---');
    {
        delete require.cache[require.resolve(path.join(radice, 'electron', 'main.cjs'))];
        main = caricaMain();
        const { cartella, items } = preparaCartella('ferma', 3);
        const apriVero = fs.promises.open;
        fs.promises.open = (p, ...resto) => (String(p).endsWith('.itm-tmp') ? new Promise(() => {}) : apriVero.call(fs.promises, p, ...resto));
        let fermata = false;
        try {
            main.handlers.get('images:write-sidecar-tags')(null, items);
            await pausa(100);
            const inizio = Date.now();
            fermata = main.emettiApp('before-quit');
            for (let i = 0; i < 400 && fermata && main.uscite.length === 0; i++) await pausa(20);
            const attesa = Date.now() - inizio;
            dice('la chiusura aspetta, ma al massimo qualche secondo', [true, 1, true], [fermata, main.uscite.length, attesa >= 2500 && attesa < 6000]);
        } finally {
            fs.promises.open = apriVero;
        }
        dice('i .txt restano com\'erano', ['vecchio', 'vecchio', 'vecchio'], items.map((_, i) => fs.readFileSync(path.join(cartella, `foto${i}.txt`), 'utf8')));
    }

    codice = esito();
} catch (e) {
    console.error(e);
    codice = 1;
} finally {
    fs.rmSync(tmp, { recursive: true, force: true });
}
process.exit(codice);
