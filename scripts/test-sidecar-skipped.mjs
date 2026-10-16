/* ITALIANO: PROVA DEI .txt SALTATI CON "CARICA IMMAGINI" E COL TRASCINAMENTO
   Un .txt oltre 1 MB, o che in quel momento non si legge (bloccato da un altro programma, un file
   di OneDrive solo in rete), veniva scartato in silenzio dal processo principale: la foto arrivava
   senza tag, il riepilogo la contava "senza file di testo" e l'avviso dei .txt saltati non
   compariva, mentre "Carica cartella" con lo stesso file lo diceva. Un'aggiunta in blocco seguita
   da "Salva" riscriveva poi quel .txt coi soli tag nuovi.
   Ora il canale di lettura segnala ogni .txt che c'e' ma non ha letto ({ skipped: true }, senza
   testo) e la pagina lo conta fra i .txt saltati, come fa "Carica cartella". Un .txt che non c'e'
   resta normale: niente segnale.
   Si provano il canale vero di electron/main.cjs (cartella temporanea) e il pezzo vero di
   src/App.tsx che trasforma la risposta in file (compilato con esbuild).
   Uso:  node scripts/test-sidecar-skipped.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE .txt FILES SKIPPED WITH "LOAD IMAGES" AND DRAG AND DROP
   A .txt over 1 MB, or one that cannot be read at that moment (locked by another program, a
   OneDrive online-only file), was dropped silently by the main process: the photo arrived
   untagged, the summary counted it "without a text file" and the skipped-.txt notice never showed,
   while "Load Folder" with the same file said so. A bulk addition followed by "Save" then rewrote
   that .txt with the new tags alone.
   Now the read channel reports every .txt that exists but was not read ({ skipped: true }, no
   text) and the page counts it among the skipped .txt files, as "Load Folder" does. A .txt that is
   not there stays normal: no signal.
   The real channel of electron/main.cjs (temporary folder) and the real piece of src/App.tsx that
   turns the answer into files (compiled with esbuild) are exercised.
   Usage:  node scripts/test-sidecar-skipped.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { caricaMain, creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { handlers } = caricaMain();
const { dice, esito } = creaControlli();
const cartella = fs.mkdtempSync(path.join(os.tmpdir(), 'itm-sidecar-skipped-'));
const leggiVero = fs.readFileSync;
let codice = 1;
try {
    console.log('\n--- canale di lettura del processo principale ---');
    const img = (n) => path.join(cartella, n);
    for (const n of ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg']) fs.writeFileSync(img(n), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
    fs.writeFileSync(img('a.txt'), 'woman, red dress, ' + 'x'.repeat(1024 * 1024));
    fs.writeFileSync(img('b.txt'), 'sks, smile');
    fs.writeFileSync(img('d.txt'), 'sks, hat');
    // ITALIANO: d.txt c'e' ma un altro programma lo tiene bloccato.
    // ENGLISH: d.txt is there but another program keeps it locked.
    fs.readFileSync = (p, ...resto) => {
        if (p === img('d.txt')) throw Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' });
        return leggiVero(p, ...resto);
    };
    const letti = handlers.get('images:read-sidecar-tags')(null, ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg'].map(img));
    fs.readFileSync = leggiVero;
    const riassunto = letti.map((s) => [s.name, s.skipped === true ? 'saltato' : s.content]);
    dice('a.txt (oltre 1 MB) e d.txt (bloccato) segnalati come saltati, b.txt letto, c senza .txt non c\'e\'',
        [['a.txt', 'saltato'], ['b.txt', 'sks, smile'], ['d.txt', 'saltato']], riassunto);
    dice('un .txt saltato non porta testo, ma porta la sua cartella', [false, true],
        [letti.some((s) => s.skipped && 'content' in s), letti.filter((s) => s.skipped).every((s) => typeof s.dir === 'string' && s.dir.length > 0)]);

    console.log('\n--- la pagina li conta fra i .txt saltati ---');
    const costruisci = async (rel) => {
        const u = await esbuild.build({ entryPoints: [path.join(radice, rel)], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
        return import('data:text/javascript;base64,' + Buffer.from(u.outputFiles[0].text).toString('base64'));
    };
    const S = await costruisci('src/utils/sidecarTags.ts');
    const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
    const intestazione = '    const loadSidecarTxtFiles = async (';
    const inizio = sorgente.indexOf(intestazione);
    const chiusura = /\r?\n    \};\r?\n/g;
    chiusura.lastIndex = Math.max(inizio, 0);
    const fine = inizio < 0 ? null : chiusura.exec(sorgente);
    if (inizio < 0 || !fine) { console.log('NO  loadSidecarTxtFiles non trovato in src/App.tsx'); process.exit(1); }
    const js = (await esbuild.transform(sorgente.slice(inizio, fine.index + fine[0].length), { loader: 'ts' })).code;
    const finestra = {
        electronAPI: {
            getPathForFile: (f) => img(f.name),
            readSidecarTags: async () => letti,
        },
    };
    const fabbrica = new Function('window', 'File', 'cartellaImmagine', 'cartellaTesto', 'fileDaSidecar', 'console',
        js + '\nreturn loadSidecarTxtFiles;');
    const loadSidecarTxtFiles = fabbrica(finestra, File, S.cartellaImmagine, S.cartellaTesto, S.fileDaSidecar, { warn() {} });
    const { txtFiles } = await loadSidecarTxtFiles(['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg'].map((name) => ({ name })));
    dice('un file per ogni .txt, saltati compresi (come "Carica cartella")', ['a.txt', 'b.txt', 'd.txt'], txtFiles.map((f) => f.name));
    // ITALIANO: lo stesso giro di processImportData: oltre 1 MB o testo illeggibile -> saltato.
    // ENGLISH: the same loop as processImportData: over 1 MB or unreadable text -> skipped.
    const giro = async (files) => {
        let saltati = 0;
        const testi = [];
        for (const f of files) {
            if (f.size > 1024 * 1024) { saltati++; continue; }
            try { testi.push(await f.text()); } catch (_) { saltati++; }
        }
        return { saltati, testi };
    };
    dice('l\'import conta 2 .txt saltati e legge solo b.txt (nessun "undefined" come tag)',
        { saltati: 2, testi: ['sks, smile'] }, await giro(txtFiles));
    dice('processImportData conta ancora come saltato un .txt che non si legge', true,
        /catch \(e\) \{[\s\S]{0,400}?skippedTxtCount\+\+;/.test(sorgente.slice(sorgente.indexOf('    const processImportData = async ('))));

    codice = esito();
} finally {
    fs.readFileSync = leggiVero;
    fs.rmSync(cartella, { recursive: true, force: true });
}
process.exit(codice);
