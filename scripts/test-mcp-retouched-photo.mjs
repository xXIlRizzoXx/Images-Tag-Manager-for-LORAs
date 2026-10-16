/* ITALIANO: PROVA: get_photo (MCP) MOSTRA ANCHE UNA FOTO RITOCCATA DOPO L'IMPORT
   Il File preso all'importazione e' un'istantanea: se la foto viene ritoccata in un altro programma,
   Chromium rifiuta di leggerlo (NotReadableError). La 2.0.1 rilegge la foto dalla sua cartella
   (fileDiAdesso) per Gemini e per l'esportazione; il ramo "immagine" del gestore MCP in App.tsx
   passava ancora l'istantanea, e get_photo rispondeva "cannot be shown (format not supported ...)".
   Qui si ritaglia dal VERO src/App.tsx il ramo "immagine" e lo si usa con i VERI eseguiStrumentoMcp,
   fotoPerMcp e fileDiAdesso; il disegno su tela e' finto (non c'e' Chromium) ma legge davvero i byte
   del file, cosi' l'istantanea illeggibile fallisce come nel programma. Casi vicini: senza cartella
   ("Carica immagini") la foto illeggibile da' ancora l'errore; una foto normale senza cartella si
   vede; un id che non c'e' non fa crollare niente.
   Uso:  node scripts/test-mcp-retouched-photo.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST: get_photo (MCP) ALSO SHOWS A PHOTO RETOUCHED AFTER THE IMPORT
   The File taken at import is a snapshot: if the photo is retouched in another program, Chromium
   refuses to read it (NotReadableError). 2.0.1 re-reads the photo from its folder (fileDiAdesso)
   for Gemini and the export; the "immagine" branch of the MCP handler in App.tsx still passed the
   snapshot, and get_photo answered "cannot be shown (format not supported ...)". This cuts the
   "immagine" branch out of the REAL src/App.tsx and runs it with the REAL eseguiStrumentoMcp,
   fotoPerMcp and fileDiAdesso; the canvas drawing is fake (no Chromium) but really reads the file's
   bytes, so the unreadable snapshot fails as in the program. Neighbouring cases: with no folder the
   unreadable photo still gives the error; a normal photo with no folder shows; a missing id does
   not crash anything.
   Usage:  node scripts/test-mcp-retouched-photo.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let guai = 0, fatti = 0;
const dice = (nome, atteso, avuto) => {
    fatti++;
    const ok = JSON.stringify(atteso) === JSON.stringify(avuto);
    if (!ok) guai++;
    console.log(`${ok ? 'OK ' : 'NO '} ${nome}${ok ? '' : `\n     atteso: ${JSON.stringify(atteso)}\n     avuto:  ${JSON.stringify(avuto)}`}`);
};
const carica = async (rel) => {
    const uscita = await esbuild.build({
        entryPoints: [path.join(radice, rel)],
        bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
    });
    return import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));
};
const B = await carica('src/utils/mcpBridge.ts');
const F = await carica('src/utils/freshFile.ts');

// ITALIANO: Chromium finto: createImageBitmap legge davvero i byte (l'istantanea rifiuta), la tela
//           restituisce gli stessi byte, cosi' si vede QUALE file e' stato mostrato.
// ENGLISH: fake Chromium: createImageBitmap really reads the bytes (the snapshot refuses), the canvas
//          gives back the same bytes, so WHICH file was shown is visible.
globalThis.createImageBitmap = async (blob) => {
    const byte = new Uint8Array(await blob.arrayBuffer());
    return { width: 10, height: 10, byte, close() { } };
};
globalThis.document = {
    createElement: () => {
        let disegnata = null;
        return {
            getContext: () => ({ fillRect() { }, drawImage(b) { disegnata = b; } }),
            toBlob: (fatto) => fatto(new Blob([disegnata.byte], { type: 'image/jpeg' })),
        };
    },
};

// ITALIANO: il ramo "immagine" del gestore MCP, preso dal VERO App.tsx.
// ENGLISH: the "immagine" branch of the MCP handler, taken from the REAL App.tsx.
const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const gestore = sorgente.indexOf('    mcpGestoreRef.current = async (r: McpRichiesta) => {');
const inizio = gestore < 0 ? -1 : sorgente.indexOf('immagine: async (id) =>', gestore);
// ITALIANO: il ramo finisce dove si chiude la chiamata a eseguiStrumentoMcp. ENGLISH: it ends where the eseguiStrumentoMcp call closes.
const fine = inizio < 0 ? -1 : (() => { const re = /\r?\n            \}\);\r?\n/g; re.lastIndex = inizio; const m = re.exec(sorgente); return m ? m.index : -1; })();
if (inizio < 0 || fine < 0) { console.log('NO  ramo "immagine" del gestore MCP non trovato in src/App.tsx'); process.exit(1); }
const testo = sorgente.slice(inizio + 'immagine:'.length, fine).trim().replace(/,$/, '');
const codice = (await esbuild.transform('const immagine = ' + testo + ';', { loader: 'ts' })).code;
const fabbrica = new Function('imagesRef', 'fotoPerMcp', 'fileDiAdesso', codice + '\nreturn immagine;');

class Istantanea extends File {
    arrayBuffer() { return Promise.reject(Object.assign(new Error('The requested file could not be read'), { name: 'NotReadableError' })); }
}
const cartellaCon = (nome, testoFile) => ({ getFileHandle: async (n) => {
    if (n !== nome) throw Object.assign(new Error('not found'), { name: 'NotFoundError' });
    return { getFile: async () => new File([testoFile], nome, { type: 'image/png' }) };
} });
const FOTO = [
    { id: 'r', isTrashed: false, tags: ['ohwx'], originalTags: ['ohwx'], file: new Istantanea(['vecchia'], 'r.png', { type: 'image/png' }), dirHandle: cartellaCon('r.png', 'ritoccata') },
    { id: 's', isTrashed: false, tags: [], originalTags: [], file: new Istantanea(['vecchia'], 's.png', { type: 'image/png' }), dirHandle: null },
    { id: 'n', isTrashed: false, tags: [], originalTags: [], file: new File(['normale'], 'n.png', { type: 'image/png' }), dirHandle: null },
    { id: 'v', isTrashed: false, tags: [], originalTags: [], file: new File(['istantanea'], 'v.png', { type: 'image/png' }), dirHandle: cartellaCon('altro.png', 'x') },
];
const imagesRef = { current: FOTO };
const immagine = fabbrica(imagesRef, B.fotoPerMcp, F.fileDiAdesso);
const ctx = { foto: () => imagesRef.current, trigger: () => ['ohwx'], applica: () => { }, immagine };
const testoDi = (r) => (r.immagine ? Buffer.from(r.immagine.data, 'base64').toString() : 'ERRORE: ' + (r.errore || ''));

const r = await B.eseguiStrumentoMcp('get_photo', { id: 'r' }, ctx);
dice('foto ritoccata dopo l\'import (con cartella): get_photo mostra la foto di adesso', 'ritoccata', testoDi(r));
const s = await B.eseguiStrumentoMcp('get_photo', { id: 's' }, ctx);
dice('senza cartella e illeggibile: resta l\'errore "cannot be shown"', true, /cannot be shown/.test(s.errore || ''));
const n = await B.eseguiStrumentoMcp('get_photo', { id: 'n' }, ctx);
dice('foto normale senza cartella: si vede', 'normale', testoDi(n));
const v = await B.eseguiStrumentoMcp('get_photo', { id: 'v' }, ctx);
dice('foto sparita dalla cartella: si usa l\'istantanea', 'istantanea', testoDi(v));
dice('id che non c\'e\': immagine null, niente eccezioni', null, await immagine('nessuna'));

console.log(`\n${guai === 0 ? 'TUTTO A POSTO' : 'PROBLEMI: ' + guai} (${fatti} controlli)`);
process.exit(guai === 0 ? 0 : 1);
