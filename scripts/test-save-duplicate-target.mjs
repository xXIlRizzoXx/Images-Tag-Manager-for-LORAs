/* ITALIANO: PROVA DEL SALVATAGGIO DI DUE COPIE DELLA STESSA FOTO (CARTELLA APERTA DUE VOLTE)
   Riaprendo la stessa cartella ogni foto c'e' due volte (copie A e B, stesso .txt). Se le due copie
   hanno tag diversi (una modifica su A salvata, poi una trigger o un'aggiunta in blocco che tocca
   tutte e due), "Salva" scriveva A e poi B nello stesso .txt: vinceva l'ultima, il .txt perdeva la
   modifica di A e la card di A la mostrava come salvata. Ora due copie con tag diversi che finiscono
   nello stesso .txt non si scrivono: restano da salvare e l'avviso dice di chiuderne una. Due copie
   con gli stessi tag si salvano come sempre. Vale per le foto con la cartella (stessa cartella anche
   da due handle diversi, isSameEntry) e per quelle caricate con "Carica immagini" (stesso percorso).
   Si esegue il testo VERO di performSave preso da src/App.tsx, con le regole vere di
   src/utils/pathUtils.ts e i testi veri di src/constants.ts (compilati con esbuild).
   Uso:  node scripts/test-save-duplicate-target.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF SAVING TWO COPIES OF THE SAME PHOTO (FOLDER OPENED TWICE)
   Reopening the same folder puts every photo in twice (copies A and B, same .txt). When the two
   copies have different tags (an edit on A saved, then a trigger or a bulk addition touching both),
   "Save" wrote A and then B into the same .txt: the last one won, the .txt lost A's edit and A's
   card showed it as saved. Now two copies with different tags that end in the same .txt are not
   written: they stay to be saved and the notice says to close one. Two copies with the same tags are
   saved as always. It holds for photos with a folder (same folder even from two different handles,
   isSameEntry) and for those loaded with "Load images" (same path).
   The REAL text of performSave taken from src/App.tsx is run, with the real rules of
   src/utils/pathUtils.ts and the real strings of src/constants.ts (compiled with esbuild).
   Usage:  node scripts/test-save-duplicate-target.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const carica = async (rel) => {
    const uscita = await esbuild.build({ entryPoints: [path.join(radice, rel)], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
    return import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));
};
const P = await carica('src/utils/pathUtils.ts');
const lingue = (await carica('src/constants.ts')).translations;
const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const inizio = sorgente.indexOf('    const performSave = async (imagesToSave: any[]');
const chiusura = /\r?\n    \};\r?\n/g;
chiusura.lastIndex = Math.max(inizio, 0);
const fine = inizio < 0 ? null : chiusura.exec(sorgente);
if (inizio < 0 || !fine) { console.log('NO  performSave non trovato in src/App.tsx'); process.exit(1); }
const jsSalva = (await esbuild.transform(sorgente.slice(inizio, fine.index + fine[0].length), { loader: 'tsx' })).code;
const muto = { log() { }, warn() { }, error() { } };

// ITALIANO: il disco finto: una cartella e' un id; due handle della stessa cartella hanno lo stesso id.
// ENGLISH: the fake disk: a folder is an id; two handles of the same folder share the id.
const creaDisco = () => {
    const d = { file: new Map(), scritture: [] };
    d.cartella = (id) => {
        const h = {
            _id: id,
            isSameEntry: async (altro) => !!altro && altro._id === id,
            getFileHandle: async (nome) => ({
                createWritable: async () => {
                    let testo = '';
                    return { write: async (x) => { testo += x; }, close: async () => { d.file.set(id + '/' + nome.toLowerCase(), testo); d.scritture.push(id + '/' + nome); } };
                },
            }),
        };
        return h;
    };
    return d;
};
const salva = async (foto, { t = lingue.en, finestra = {} } = {}) => {
    const r = { notifiche: [], salvate: [] };
    let stato = foto.map(f => ({ ...f }));
    const f = new Function('setIsSaving', 'setImportProgress', 'showNotification', 't', 'getOrderedTagString', 'window', 'setImages', 'soundManager', 'console',
        'buildTagFileName', 'sanitizeFileName', 'sidecarTagFileName', 'document', 'URL', 'Blob', 'setTimeout', 'isUndoRedoAction', 'avvisoSalvataggioRef', 'gemelliDelTxt',
        jsSalva + '\nreturn performSave;')(() => { }, () => { }, (m, tipo) => r.notifiche.push([m, tipo]), t, (tags) => (tags.length ? tags.join(', ') + ',' : ''),
        finestra, (agg) => { stato = typeof agg === 'function' ? agg(stato) : agg; }, { chime() { } }, muto, P.buildTagFileName, P.sanitizeFileName,
        P.sidecarTagFileName, { createElement: () => ({ click() { } }), body: { appendChild() { }, removeChild() { } } },
        { createObjectURL: () => 'blob:finto', revokeObjectURL() { } }, Blob, (fn) => { fn(); return 0; }, { current: false }, { current: '' }, async () => () => { });
    r.ok = await f(foto);
    r.salvate = stato.filter(i => JSON.stringify(i.tags) === JSON.stringify(i.originalTags)).map(i => i.id);
    r.ultimo = r.notifiche[r.notifiche.length - 1] || null;
    return r;
};
const foto = (id, nome, dir, tags) => ({ id, file: { name: nome }, dirHandle: dir, tags, originalTags: ['vecchio'] });

console.log('\n--- la stessa cartella aperta due volte, copie con tag diversi ---');
for (const [titolo, stessoHandle] of [['stesso handle', true], ['due handle della stessa cartella (due "Carica cartella")', false]]) {
    const d = creaDisco();
    const h1 = d.cartella('dataset');
    const h2 = stessoHandle ? h1 : d.cartella('dataset');
    const A = foto('A', 'img.png', h1, ['red dress', 'ohwx']);
    const B = foto('B', 'img.png', h2, ['ohwx']);
    const r = await salva([A, B]);
    dice(titolo + ': il .txt non viene scritto da nessuna delle due', [[], false], [d.scritture, r.ok]);
    dice('...nessuna delle due risulta salvata', [], r.salvate);
    const atteso = lingue.en.saveSameFileTwice;
    dice('...e l\'avviso (errore) dice quale e cosa fare', [typeof atteso === 'string' ? atteso.replace('{names}', 'img.png') : '(manca saveSameFileTwice)', 'error'], r.ultimo);
}

console.log('\n--- foto di "Carica immagini" caricate due volte (Electron, stesso percorso) ---');
{
    const scritti = [];
    const api = {
        getPathForFile: (f) => f.percorso,
        writeSidecarTags: async (items) => { scritti.push(...items.map(i => i.imagePath)); return { results: items.map(() => true) }; },
    };
    const A = { id: 'A', file: { name: 'a.png', percorso: 'E:\\foto\\a.png' }, dirHandle: null, tags: ['red dress'], originalTags: ['x'] };
    const B = { id: 'B', file: { name: 'a.png', percorso: 'E:\\FOTO\\A.png' }, dirHandle: null, tags: ['y'], originalTags: ['x'] };
    const C = { id: 'C', file: { name: 'c.png', percorso: 'E:\\foto\\c.png' }, dirHandle: null, tags: ['z'], originalTags: ['x'] };
    const r = await salva([A, B, C], { finestra: { electronAPI: api } });
    dice('le due copie con tag diversi non si scrivono, l\'altra foto si', [['E:\\foto\\c.png'], ['C'], false], [scritti, r.salvate, r.ok]);
}

// ITALIANO: a.png e a.jpg sono due foto DIVERSE, ma l'import (makeFolderKeyer), Kohya e il processo
//           principale le abbinano allo stesso a.txt. Con tag diversi non si sceglie in silenzio:
//           con "Carica immagini" prima si scrivevano tutte e due nello stesso a.txt (vinceva
//           l'ultima) e risultavano salvate tutte e due; con "Carica cartella" erano bloccate, ma
//           l'avviso le chiamava "copie aperte due volte".
// ENGLISH: a.png and a.jpg are two DIFFERENT photos, but the import (makeFolderKeyer), Kohya and the
//          main process pair them with the same a.txt. With different tags there is no silent pick:
//          with "Load images" both used to be written into the same a.txt (the last one won) and
//          both counted as saved; with "Load folder" they were blocked, but the notice called them
//          "copies open twice".
console.log('\n--- a.png e a.jpg nella stessa cartella: lo stesso a.txt ---');
{
    const d = creaDisco();
    const h = d.cartella('dataset');
    const r = await salva([foto('A', 'a.png', h, ['red dress']), foto('B', 'a.jpg', h, ['blue dress'])]);
    dice('"Carica cartella": nessuna delle due si scrive, nessuna risulta salvata', [[], [], false], [d.scritture, r.salvate, r.ok]);
    dice('...l\'avviso le nomina', [lingue.en.saveSameFileTwice.replace('{names}', 'a.png, a.jpg'), 'error'], r.ultimo);
}
{
    const scritti = [];
    const api = {
        getPathForFile: (f) => f.percorso,
        writeSidecarTags: async (items) => { scritti.push(...items.map(i => i.imagePath)); return { results: items.map(() => true) }; },
    };
    const via = (id, percorso, tags) => ({ id, file: { name: path.win32.basename(percorso), percorso }, dirHandle: null, tags, originalTags: ['x'] });
    const r = await salva([via('A', 'E:\\foto\\a.png', ['red dress']), via('B', 'E:\\Foto\\A.JPG', ['blue dress']), via('C', 'E:\\foto\\c.png', ['z'])], { finestra: { electronAPI: api } });
    dice('"Carica immagini": a.png e a.jpg con tag diversi non si scrivono, c.png si', [['E:\\foto\\c.png'], ['C'], false], [scritti, r.salvate, r.ok]);
    dice('...l\'avviso le nomina', [lingue.en.saveSameFileTwice.replace('{names}', 'a.png, A.JPG'), 'error'], r.ultimo);
    scritti.length = 0;
    const s = await salva([via('A', 'E:\\foto\\a.png', ['cat']), via('B', 'E:\\foto\\a.jpg', ['cat'])], { finestra: { electronAPI: api } });
    dice('...con gli STESSI tag si scrivono come sempre', [['E:\\foto\\a.png', 'E:\\foto\\a.jpg'], ['A', 'B'], true], [scritti, s.salvate, s.ok]);
    scritti.length = 0;
    const u = await salva([via('A', 'E:\\foto\\a.png', ['cat']), via('B', 'E:\\altra\\a.jpg', ['dog']), via('D', 'E:\\foto\\a.b.png', ['owl'])], { finestra: { electronAPI: api } });
    dice('...in cartelle diverse, o con un altro nome (a.b.png), si scrivono tutte', [['E:\\foto\\a.png', 'E:\\altra\\a.jpg', 'E:\\foto\\a.b.png'], true], [scritti, u.ok]);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const d = creaDisco();
    const h1 = d.cartella('dataset');
    const r = await salva([foto('A', 'img.png', h1, ['ohwx', 'cat']), foto('B', 'img.png', d.cartella('dataset'), ['ohwx', 'cat'])]);
    dice('due copie con gli STESSI tag: il .txt si scrive e tutte e due risultano salvate', [true, ['A', 'B'], true],
        [d.file.get('dataset/img.txt') === 'ohwx, cat,', r.salvate, r.ok]);
    const e = creaDisco();
    const s = await salva([foto('A', 'img.png', e.cartella('char1'), ['a']), foto('B', 'img.png', e.cartella('char2'), ['b'])]);
    dice('stesso nome in due cartelle DIVERSE: si scrivono tutte e due', [['char1/img.txt', 'char2/img.txt'], ['A', 'B'], true], [e.scritture, s.salvate, s.ok]);
    const g = creaDisco();
    const h = g.cartella('dataset');
    const u = await salva([foto('A', 'a.png', h, ['x']), foto('B', 'b.png', h, ['y'])]);
    dice('foto diverse della stessa cartella: come sempre', [['dataset/a.txt', 'dataset/b.txt'], true, 'success'], [g.scritture, u.ok, u.ultimo[1]]);
}

console.log('\n--- la frase nelle nove lingue ---');
for (const l of ['it', 'en', 'fr', 'es', 'de', 'zh', 'ja', 'pt', 'ru']) {
    const s = lingue[l].saveSameFileTwice;
    dice(l + ': saveSameFileTwice presente, con {names} una sola volta', true, typeof s === 'string' && s.split('{names}').length === 2);
    // ITALIANO: la frase vale anche per due foto diverse (a.png e a.jpg): parla del .txt in comune.
    // ENGLISH: the sentence also fits two different photos (a.png and a.jpg): it names the shared .txt.
    dice(l + ': saveSameFileTwice parla del file .txt in comune', true, typeof s === 'string' && s.includes('.txt'));
}

process.exit(esito());
