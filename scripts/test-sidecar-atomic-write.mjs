/* ITALIANO: PROVA DEL SALVATAGGIO DEL .txt CHE SI INTERROMPE A META' ("Carica immagini" e trascinamento)
   Il canale 'images:write-sidecar-tags' riscriveva il .txt SUL POSTO: l'apertura in scrittura lo
   svuota subito, e se poi la scrittura falliva (rete che cade, chiavetta staccata, disco pieno) il
   .txt restava vuoto mentre la pagina diceva "non salvato". Scegliendo poi "Chiudi senza salvare"
   si perdevano anche i tag originali. Ora il testo va prima in un temporaneo nella stessa cartella
   (<nome>.txt.<casuale>.itm-tmp, creato in modo esclusivo) che poi prende il posto del .txt: se la
   scrittura fallisce, il .txt resta com'era e il temporaneo viene tolto.
   Si provano anche i casi vicini che devono restare come prima: .txt nuovo, .txt svuotato, foto
   senza tag e senza .txt (nessun file), sostituzione rifiutata (antivirus che tiene aperto il file:
   si scrive sul posto come prima), temporaneo che non si puo' creare (idem), .txt con un
   collegamento fisico (si scrive sul posto, il collegamento resta).
   Nessun guasto vero: il disco "pieno" e' un fs finto, in una cartella temporanea tolta alla fine.
   Uso:  node scripts/test-sidecar-atomic-write.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF A .txt SAVE THAT STOPS HALFWAY ("Load images" and drag and drop)
   The 'images:write-sidecar-tags' channel rewrote the .txt IN PLACE: opening it for writing empties
   it at once, and if the write then failed (network dropping, USB stick pulled, full disk) the .txt
   was left empty while the page said "not saved". Choosing "Close without saving" afterwards lost
   the original tags too. The text now goes first to a temporary file in the same folder
   (<name>.txt.<random>.itm-tmp, created exclusively) which then takes the .txt's place: if the
   write fails, the .txt stays as it was and the temporary file is removed.
   The neighbouring cases that must not change are tested too: new .txt, emptied .txt, photo with no
   tags and no .txt (no file), replacement refused (an antivirus holding the file open: written in
   place as before), temporary file that cannot be created (same), .txt with a hard link (written
   in place, the link stays).
   No real failure: the "full" disk is a fake fs, in a temporary folder removed at the end.
   Usage:  node scripts/test-sidecar-atomic-write.mjs      (exits with code 1 if anything is off) */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { caricaMain, creaControlli } from './main-harness.mjs';

const { handlers } = caricaMain();
const { dice, esito } = creaControlli();
const scrivi = handlers.get('images:write-sidecar-tags');
const cartella = fs.mkdtempSync(path.join(os.tmpdir(), 'itm-atomic-'));
const veri = { writeFileSync: fs.writeFileSync, renameSync: fs.renameSync, openSync: fs.openSync };
const ripristina = () => { for (const nome of Object.keys(veri)) fs[nome] = veri[nome]; };
const ORIGINALE = 'ohwx, woman, red hair';
const enospc = () => { const e = new Error('ENOSPC: no space left on device, write'); e.code = 'ENOSPC'; return e; };
// ITALIANO: disco che si riempie: chi apre un file della cartella per scriverci lo apre davvero
//           (con 'w' l'apertura svuota il file, come fa Node), poi la scrittura fallisce.
// ENGLISH: a disk that fills up: whoever opens a file of the folder to write it really opens it
//          (with 'w' opening empties the file, as Node does), then the write fails.
const discoPieno = () => {
    fs.writeFileSync = (p, dati, ...resto) => {
        if (typeof p === 'number') throw enospc();
        if (typeof p === 'string' && path.dirname(p) === sub) { fs.closeSync(veri.openSync(p, 'w')); throw enospc(); }
        return veri.writeFileSync(p, dati, ...resto);
    };
};
let sub = '';
let n = 0;
// ITALIANO: ogni caso nella sua sottocartella, con una foto e (se serve) il suo .txt.
// ENGLISH: every case in its own subfolder, with a photo and (when needed) its .txt.
const prepara = (txt) => {
    sub = path.join(cartella, 'c' + (++n));
    fs.mkdirSync(sub);
    const img = path.join(sub, 'a.png');
    veri.writeFileSync(img, Buffer.from([137, 80, 78, 71]));
    if (txt !== null) veri.writeFileSync(path.join(sub, 'a.txt'), txt, 'utf8');
    return img;
};
const txtDi = () => { try { return fs.readFileSync(path.join(sub, 'a.txt'), 'utf8'); } catch (_) { return null; } };
const elenco = () => fs.readdirSync(sub).sort();

let codice = 1;
try {
    console.log('\n--- la scrittura si interrompe a meta\' su un .txt che c\'era ---');
    let img = prepara(ORIGINALE);
    discoPieno();
    let r = scrivi(null, [{ imagePath: img, content: 'ohwx, woman, blue hair' }]);
    ripristina();
    dice('la foto risulta non salvata', { ok: false, written: 0, failed: 1, results: [false] }, r);
    dice('il .txt sul disco e\' ancora quello di prima, byte per byte', ORIGINALE, txtDi());
    dice('nella cartella non resta nessun temporaneo', ['a.png', 'a.txt'], elenco());

    console.log('\n--- la scrittura si interrompe a meta\' su una foto che non aveva il .txt ---');
    img = prepara(null);
    discoPieno();
    r = scrivi(null, [{ imagePath: img, content: 'ohwx, woman' }]);
    ripristina();
    dice('la foto risulta non salvata', [false], r.results);
    dice('non nasce un .txt vuoto o tagliato, e non resta il temporaneo', ['a.png'], elenco());

    console.log('\n--- casi normali: devono restare come prima ---');
    img = prepara(ORIGINALE);
    r = scrivi(null, [{ imagePath: img, content: 'ohwx, woman, blue hair' }]);
    dice('.txt che c\'era: salvato', { ok: true, written: 1, failed: 0, results: [true] }, r);
    dice('...con il testo nuovo', 'ohwx, woman, blue hair', txtDi());
    dice('...e nessun temporaneo rimasto', ['a.png', 'a.txt'], elenco());

    img = prepara(null);
    r = scrivi(null, [{ imagePath: img, content: 'ohwx, ragazza, città, 東京' }]);
    dice('.txt nuovo: salvato in UTF-8 senza BOM', [[true], 'ohwx, ragazza, città, 東京', ['a.png', 'a.txt']], [r.results, txtDi(), elenco()]);
    dice('...i byte sono esattamente quelli del testo', Buffer.from('ohwx, ragazza, città, 東京', 'utf8').toString('hex'), fs.readFileSync(path.join(sub, 'a.txt')).toString('hex'));

    img = prepara(ORIGINALE);
    r = scrivi(null, [{ imagePath: img, content: '' }]);
    dice('.txt che c\'era, foto senza piu\' tag: il .txt si svuota davvero', [[true], '', ['a.png', 'a.txt']], [r.results, txtDi(), elenco()]);

    img = prepara(null);
    r = scrivi(null, [{ imagePath: img, content: '' }]);
    dice('foto senza tag e senza .txt: nessun file nuovo', [{ ok: true, written: 0, failed: 0, results: [true] }, ['a.png']], [r, elenco()]);

    console.log('\n--- ripieghi: si scrive sul posto, come prima ---');
    img = prepara(ORIGINALE);
    fs.renameSync = (da, a, ...resto) => {
        if (path.dirname(String(da)) === sub) { const e = new Error('EPERM: operation not permitted, rename'); e.code = 'EPERM'; throw e; }
        return veri.renameSync(da, a, ...resto);
    };
    r = scrivi(null, [{ imagePath: img, content: 'ohwx, smile' }]);
    ripristina();
    dice('sostituzione rifiutata (antivirus): salvato lo stesso, sul posto', [[true], 'ohwx, smile'], [r.results, txtDi()]);
    dice('...e il temporaneo e\' stato tolto', ['a.png', 'a.txt'], elenco());

    img = prepara(ORIGINALE);
    fs.openSync = (p, ...resto) => {
        if (String(p).endsWith('.itm-tmp')) { const e = new Error('EACCES: permission denied, open'); e.code = 'EACCES'; throw e; }
        return veri.openSync(p, ...resto);
    };
    r = scrivi(null, [{ imagePath: img, content: 'ohwx, smile' }]);
    ripristina();
    dice('cartella dove non si possono creare file nuovi: salvato sul posto', [[true], 'ohwx, smile', ['a.png', 'a.txt']], [r.results, txtDi(), elenco()]);

    img = prepara(ORIGINALE);
    const gemello = path.join(cartella, 'gemello-' + n + '.txt');
    let collegato = true;
    try { fs.linkSync(path.join(sub, 'a.txt'), gemello); } catch (_) { collegato = false; }
    if (collegato) {
        r = scrivi(null, [{ imagePath: img, content: 'ohwx, linked' }]);
        dice('.txt con un collegamento fisico: salvato e il collegamento vede il testo nuovo',
            [[true], 'ohwx, linked', 'ohwx, linked'], [r.results, txtDi(), fs.readFileSync(gemello, 'utf8')]);
    } else {
        console.log('  (saltato: collegamenti fisici non disponibili qui)');
    }

    codice = esito();
} finally {
    ripristina();
    fs.rmSync(cartella, { recursive: true, force: true });
}
process.exit(codice);
