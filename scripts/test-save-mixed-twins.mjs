/* ITALIANO: PROVA: a.png SENZA CARTELLA E a.jpg CON LA CARTELLA USANO LO STESSO a.txt
   a.png entra trascinata o con "Carica immagini" (nessuna cartella, scrive dal suo percorso);
   a.jpg entra dopo con "Carica cartella" della stessa cartella (scrive dalla cartella). Il .txt e'
   uno, a.txt. Il controllo delle copie doppie guardava i due gruppi separati, mai una coppia
   mista: con tag diversi "Salva Modifiche" scriveva a.txt due volte (vinceva l'ultima), dava
   l'avviso verde e tutte e due risultavano salvate, mentre "red" di a.jpg non era sul disco. Ora la
   coppia mista con tag diversi non si scrive e l'avviso saveSameFileTwice la nomina. Anche dopo un
   salvataggio di una sola delle due, l'altra (senza modifiche) si allinea al file scritto
   (gemelliDelTxt), e l'editor dei file di tag allinea le foto dei due tipi insieme.
   Casi vicini che non devono cambiare: coppia mista con gli stessi tag = si scrive; a.jpg di
   un'altra cartella = nessun conflitto; foto con cartella senza percorso noto (cartella di rete) =
   come prima; le coppie dello stesso tipo hanno gia' le loro prove (test-save-duplicate-target,
   test-save-twin-sequence, test-editor-sync-folderless).
   Si eseguono i testi VERI di performSave, gemelliDelTxt e handleTagEditorSaved presi da src/App.tsx.
   Uso:  node scripts/test-save-mixed-twins.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST: a.png WITHOUT A FOLDER AND a.jpg WITH THE FOLDER USE THE SAME a.txt
   a.png comes in dropped or with "Load images" (no folder, writes from its path); a.jpg comes in
   later with "Load folder" of the same folder (writes through the folder). There is one .txt,
   a.txt. The duplicate check looked at the two groups separately, never at a mixed pair: with
   different tags "Save Changes" wrote a.txt twice (the last one won), gave the green notice and
   both counted as saved, while a.jpg's "red" was not on disk. Now the mixed pair with different
   tags is not written and the saveSameFileTwice notice names it. Also after saving only one of
   the two, the other (with no edits) syncs to the written file (gemelliDelTxt), and the tag file
   editor syncs the photos of both kinds together.
   Neighbouring cases that must not change: a mixed pair with the same tags = written; a.jpg from
   another folder = no conflict; a photo with a folder and no known path (network folder) = as
   before; same-kind pairs already have their own tests (test-save-duplicate-target,
   test-save-twin-sequence, test-editor-sync-folderless).
   The REAL text of performSave, gemelliDelTxt and handleTagEditorSaved from src/App.tsx is run.
   Usage:  node scripts/test-save-mixed-twins.mjs      (exits with code 1 if anything is off) */

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
const S = await carica('src/utils/sidecarTags.ts');
const t = (await carica('src/constants.ts')).translations.en;
const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const ritaglia = async (intestazione) => {
    const inizio = sorgente.indexOf(intestazione);
    const re = /\r?\n    \};\r?\n/g;
    re.lastIndex = Math.max(inizio, 0);
    const fine = inizio < 0 ? null : re.exec(sorgente);
    if (!fine) { console.log('NO  non trovato in src/App.tsx: ' + intestazione.trim()); process.exit(1); }
    return (await esbuild.transform(sorgente.slice(inizio, fine.index + fine[0].length), { loader: 'tsx' })).code;
};
const jsSalva = await ritaglia('    const performSave = async (imagesToSave: any[]');
const jsGemelli = await ritaglia('    const gemelliDelTxt = async ');
const jsEditor = await ritaglia('    const handleTagEditorSaved = async ');
const muto = { log() { }, warn() { }, error() { } };
const B = String.fromCharCode(92);
const D = 'E:' + B + 'dataset' + B;
const ALTRA = 'F:' + B + 'altro' + B;

// ITALIANO: il disco finto: percorso del .txt (minuscolo) -> testo; scritture in ordine.
// ENGLISH: the fake disk: .txt path (lower case) -> text; writes in order.
const creaDisco = () => {
    const d = { file: new Map(), scritture: [] };
    d.cartella = (dir) => {
        const h = { name: 'dataset', _dir: dir };
        h.isSameEntry = async (altro) => !!altro && altro._dir === dir;
        h.getFileHandle = async (nome) => ({
            name: nome, _percorso: (dir + nome).toLowerCase(),
            isSameEntry: async (x) => !!x && x._percorso === (dir + nome).toLowerCase(),
            createWritable: async () => {
                let testo = '';
                return { write: async (x) => { testo += x; }, close: async () => { d.file.set((dir + nome).toLowerCase(), testo); d.scritture.push('cartella:' + nome); } };
            },
        });
        return h;
    };
    // ITALIANO: come il processo principale: il .txt accanto all'immagine, con lo stesso nome.
    // ENGLISH: like the main process: the .txt beside the image, with the same name.
    d.api = {
        getPathForFile: (f) => f.percorso || '',
        writeSidecarTags: async (items) => {
            for (const it of items) {
                const txt = it.imagePath.replace(/\.[^.\\]+$/, '.txt').toLowerCase();
                d.file.set(txt, it.content);
                d.scritture.push('percorso:' + path.win32.basename(txt));
            }
            return { results: items.map(() => true) };
        },
        readSidecarTags: async (percorsi) => percorsi.map(p => {
            const txt = p.replace(/\.[^.\\]+$/, '.txt');
            const c = d.file.get(txt.toLowerCase());
            return c === undefined ? null : { name: path.win32.basename(txt), dir: path.win32.dirname(txt), content: c };
        }).filter(Boolean),
    };
    return d;
};
// ITALIANO: a.png senza cartella (percorso vero); a.jpg con la cartella e il percorso dato dal processo
//           principale alla scelta (filePath), mentre getPathForFile per i file della cartella e' vuoto.
// ENGLISH: a.png with no folder (real path); a.jpg with the folder and the path given by the main
//          process at pick time (filePath), while getPathForFile is empty for the folder's files.
const sciolta = (id, nome, dir, tags, originalTags = ['cat']) => ({ id, file: { name: nome, percorso: dir + nome }, dirHandle: null, tags: [...tags], originalTags: [...originalTags] });
const conCartella = (id, nome, h, tags, originalTags = ['cat'], filePath = h._dir + nome) => ({ id, file: { name: nome }, dirHandle: h, filePath, tags: [...tags], originalTags: [...originalTags] });

const salva = async (d, foto) => {
    const r = { notifiche: [] };
    let stato = foto.map(f => ({ ...f }));
    const f = new Function('setIsSaving', 'setImportProgress', 'showNotification', 't', 'getOrderedTagString', 'window', 'setImages', 'soundManager', 'console',
        'buildTagFileName', 'sanitizeFileName', 'sidecarTagFileName', 'document', 'URL', 'Blob', 'setTimeout', 'isUndoRedoAction', 'avvisoSalvataggioRef', 'gemelliDelTxt',
        jsSalva + '\nreturn performSave;')(() => { }, () => { }, (m, tipo) => r.notifiche.push([m, tipo]), t, (tags) => (tags.length ? tags.join(', ') + ',' : ''),
        { electronAPI: d.api }, (agg) => { stato = typeof agg === 'function' ? agg(stato) : agg; }, { chime() { } }, muto, P.buildTagFileName, P.sanitizeFileName,
        P.sidecarTagFileName, { createElement: () => ({ click() { } }), body: { appendChild() { }, removeChild() { } } },
        { createObjectURL: () => 'blob:finto', revokeObjectURL() { } }, Blob, (fn) => { fn(); return 0; }, { current: false }, { current: '' }, async () => () => { });
    r.ok = await f(stato);
    r.salvate = stato.filter(i => JSON.stringify(i.tags) === JSON.stringify(i.originalTags)).map(i => i.id);
    r.ultimo = r.notifiche[r.notifiche.length - 1] || null;
    return r;
};

console.log('\n--- "Salva Modifiche": coppia mista con tag diversi ---');
for (const ordine of ['a.png prima', 'a.jpg prima']) {
    const d = creaDisco();
    d.file.set((D + 'a.txt').toLowerCase(), 'cat,');
    const h = d.cartella(D);
    const png = sciolta('A', 'a.png', D, ['cat', 'dog']);
    const jpg = conCartella('J', 'a.jpg', h, ['cat', 'red']);
    const r = await salva(d, ordine === 'a.png prima' ? [png, jpg] : [jpg, png]);
    dice(ordine + ': a.txt non viene scritto da nessuna delle due', [[], 'cat,'], [d.scritture, d.file.get((D + 'a.txt').toLowerCase())]);
    dice('...Salva non e\' riuscito e nessuna delle due risulta salvata', [false, []], [r.ok, r.salvate]);
    dice('...l\'avviso (errore) e\' saveSameFileTwice e le nomina', ['error', true, true],
        [r.ultimo && r.ultimo[1], !!r.ultimo && r.ultimo[0].startsWith(t.saveSameFileTwice.split('{names}')[0]), !!r.ultimo && /a\.png/.test(r.ultimo[0]) && /a\.jpg/.test(r.ultimo[0])]);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const d = creaDisco();
    const h = d.cartella(D);
    const r = await salva(d, [sciolta('A', 'a.png', D, ['cat', 'dog']), conCartella('J', 'a.jpg', h, ['cat', 'dog'])]);
    dice('coppia mista con gli stessi tag: si scrive come sempre', [true, ['A', 'J'], 'cat, dog,'], [r.ok, r.salvate, d.file.get((D + 'a.txt').toLowerCase())]);
}
{
    const d = creaDisco();
    const h = d.cartella(ALTRA);
    const r = await salva(d, [sciolta('A', 'a.png', D, ['cat', 'dog']), conCartella('J', 'a.jpg', h, ['cat', 'red'])]);
    dice('a.jpg di un\'altra cartella: nessun conflitto, si scrivono tutte e due', [true, ['A', 'J']], [r.ok, r.salvate]);
}
{
    const d = creaDisco();
    const h = d.cartella(D);
    const r = await salva(d, [sciolta('A', 'a.png', D, ['cat', 'dog']), conCartella('J', 'a.jpg', h, ['cat', 'red'], ['cat'], '')]);
    dice('foto con cartella senza percorso noto (cartella di rete): come prima, si scrivono', [true, 2], [r.ok, d.scritture.length]);
}

console.log('\n--- dopo il salvataggio di una sola: la gemella dell\'altro tipo si allinea (gemelliDelTxt) ---');
const allinea = async (d, images, scritte) => {
    let stato = images;
    const g = new Function('imagesRef', 'window', 'sidecarTagFileName', 'isUndoRedoAction', 'setImages', 'setHistory', 'tagDopoEditor', 'globalTriggersRef', jsGemelli + '\nreturn gemelliDelTxt;')(
        { current: images }, { electronAPI: d.api }, P.sidecarTagFileName, { current: false }, (f) => { stato = f(stato); }, () => { }, S.tagDopoEditor, { current: [] });
    (await g(scritte))();
    return stato;
};
{
    const d = creaDisco();
    const h = d.cartella(D);
    const dopo = await allinea(d, [sciolta('A', 'a.png', D, ['cat']), conCartella('J', 'a.jpg', h, ['cat']), conCartella('X', 'a.jpg', d.cartella(ALTRA), ['cat'])],
        [{ id: 'A', tags: ['cat', 'dog'] }]);
    dice('scritta a.png (senza cartella): a.jpg con la cartella prende il file scritto; quella di un\'altra cartella no',
        [[['cat', 'dog'], ['cat', 'dog']], ['cat']], [[dopo[1].tags, dopo[1].originalTags], dopo[2].tags]);
    const rovescio = await allinea(d, [sciolta('A', 'a.png', D, ['cat']), conCartella('J', 'a.jpg', h, ['cat']), sciolta('Y', 'a.png', ALTRA, ['cat'])],
        [{ id: 'J', tags: ['cat', 'red'] }]);
    dice('scritta a.jpg (con la cartella): a.png senza cartella prende il file scritto; quella di un\'altra cartella no',
        [[['cat', 'red'], ['cat', 'red']], ['cat']], [[rovescio[0].tags, rovescio[0].originalTags], rovescio[2].tags]);
    const senzaPercorso = await allinea(d, [sciolta('A', 'a.png', D, ['cat']), conCartella('J', 'a.jpg', h, ['cat'], ['cat'], '')],
        [{ id: 'A', tags: ['cat', 'dog'] }]);
    dice('a.jpg senza percorso noto: resta com\'era (nessuna prova che sia lo stesso .txt)', ['cat'], senzaPercorso[1].tags);
}

console.log('\n--- l\'editor dei file di tag salva a.txt: si allineano le foto dei due tipi ---');
{
    const d = creaDisco();
    const h = d.cartella(D);
    d.file.set((D + 'a.txt').toLowerCase(), 'cat, blue,');
    let stato = [sciolta('A', 'a.png', D, ['cat']), conCartella('J', 'a.jpg', h, ['cat'])];
    const f = new Function('images', 'setImages', 'globalTriggers', 'tagDopoEditor', 'window', 'parseSidecarText', 'txtNonLettoInVigore', jsEditor + '\nreturn handleTagEditorSaved;')(
        stato, (agg) => { stato = typeof agg === 'function' ? agg(stato) : agg; }, [], S.tagDopoEditor, { electronAPI: d.api }, S.parseSidecarText, S.txtNonLettoInVigore);
    await f('a.txt', ['cat', 'blue'], await h.getFileHandle('a.txt'));
    dice('a.jpg (cartella) e a.png (senza cartella) prendono tutte e due il file dell\'editor',
        [['cat', 'blue'], ['cat', 'blue']], [stato.find(i => i.id === 'J').tags, stato.find(i => i.id === 'A').tags]);
    dice('...e risultano salvate', [['cat', 'blue'], ['cat', 'blue']], [stato.find(i => i.id === 'J').originalTags, stato.find(i => i.id === 'A').originalTags]);
}

process.exit(esito());
