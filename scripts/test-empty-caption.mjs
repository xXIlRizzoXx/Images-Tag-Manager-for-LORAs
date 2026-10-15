/* ITALIANO: PROVA DEL SALVATAGGIO DI UNA FOTO SENZA TAG
   Togliendo tutti i tag a una foto e salvando, "Salva modifiche" (e "Salva .txt" del
   visualizzatore) scriveva un .txt da 0 byte, anche dove il .txt non c'era: sd-scripts / Kohya si
   ferma su un .txt vuoto ("caption file is empty"), mentre un .txt che manca non lo ferma.
   L'esportazione lo sapeva gia' (una foto senza tag entra senza .txt), il salvataggio no, e non
   diceva niente. Ora:
   - un .txt vuoto NUOVO non si crea mai (cartella aperta, "Carica immagini" in Electron,
     visualizzatore): la foto risulta salvata, il disco resta senza .txt come prima;
   - un .txt che c'era si svuota davvero (e' quello che l'utente ha chiesto: lasciare i tag vecchi
     sul disco sarebbe peggio) ma il messaggio lo dice, con una frase intera nelle nove lingue.
   Si eseguono i testi VERI di performSave (src/App.tsx), handleSaveSingleTxt
   (src/components/Lightbox.tsx) e del canale 'images:write-sidecar-tags' (electron/main.cjs, col
   banco main-harness.mjs, in una cartella temporanea).
   Uso:  node scripts/test-empty-caption.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF SAVING A PHOTO WITH NO TAGS
   Removing every tag from a photo and saving, "Save changes" (and the viewer's "Save .txt") wrote
   a 0-byte .txt, even where there was no .txt: sd-scripts / Kohya stops on an empty .txt
   ("caption file is empty"), while a missing .txt does not stop it. The export already knew (an
   untagged photo goes in without a .txt), the save did not, and said nothing. Now:
   - a NEW empty .txt is never created (open folder, "Load images" in Electron, viewer): the photo
     counts as saved, the disk stays without a .txt as before;
   - a .txt that was there is really emptied (it is what the user asked for: leaving the old tags
     on disk would be worse) but the message says so, in a whole sentence in all nine languages.
   The REAL text of performSave (src/App.tsx), handleSaveSingleTxt (src/components/Lightbox.tsx) and
   of the 'images:write-sidecar-tags' channel (electron/main.cjs, on the main-harness.mjs bench, in
   a temporary folder) is run.
   Usage:  node scripts/test-empty-caption.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli, caricaMain } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const carica = async (rel) => {
    const uscita = await esbuild.build({
        entryPoints: [path.join(radice, rel)],
        bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
    });
    return import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));
};
const P = await carica('src/utils/pathUtils.ts');
const lingue = (await carica('src/constants.ts')).translations;
const t = lingue.en;

const ritaglia = async (file, intestazione) => {
    const sorgente = fs.readFileSync(path.join(radice, file), 'utf8');
    const inizio = sorgente.indexOf(intestazione);
    const chiusura = /\r?\n    \};\r?\n/g;
    chiusura.lastIndex = Math.max(inizio, 0);
    const fine = inizio < 0 ? null : chiusura.exec(sorgente);
    if (inizio < 0 || !fine) {
        console.log(`NO  non trovato in ${file}: ${intestazione.trim()}`);
        process.exit(1);
    }
    return (await esbuild.transform(sorgente.slice(inizio, fine.index + fine[0].length), { loader: 'tsx' })).code;
};
const jsSalva = await ritaglia('src/App.tsx', '    const performSave = async (imagesToSave: any[]');
const jsLightbox = await ritaglia('src/components/Lightbox.tsx', '    const handleSaveSingleTxt = async () => {');
const muto = { log() { }, warn() { }, error() { } };

// ITALIANO: una cartella aperta: `file` = i .txt che ci sono (nome -> testo). getFileHandle senza
//           { create: true } su un file che manca da' NotFoundError, come quello vero.
// ENGLISH: an open folder: `file` = the .txt files present (name -> text). getFileHandle without
//          { create: true } on a missing file gives NotFoundError, like the real one.
const cartella = (presenti = {}) => {
    const c = { file: new Map(Object.entries(presenti)) };
    c.getFileHandle = async (nome, opz) => {
        if (!c.file.has(nome) && !(opz && opz.create)) throw new DOMException('not found', 'NotFoundError');
        return { createWritable: async () => { let testo = ''; return { write: async (s) => { testo += String(s); }, close: async () => { c.file.set(nome, testo); } }; } };
    };
    return c;
};
const salva = async (foto) => {
    const r = { notifiche: [], salvate: [] };
    const f = new Function('setIsSaving', 'setImportProgress', 'showNotification', 't', 'getOrderedTagString', 'window', 'setImages', 'soundManager', 'console',
        'buildTagFileName', 'sanitizeFileName', 'sidecarTagFileName', 'isUndoRedoAction', 'avvisoSalvataggioRef',
        jsSalva + '\nreturn performSave;')(() => { }, () => { }, (m, tipo) => r.notifiche.push([m, tipo]), t, (tags) => (tags.length ? tags.join(', ') + ',' : ''),
        {}, (fn) => { r.salvate = fn(foto).filter((img, i) => img !== foto[i]).map(i => i.id); }, { chime() { } }, muto,
        P.buildTagFileName, P.sanitizeFileName, P.sidecarTagFileName, { current: false }, { current: '' });
    r.ok = await f(foto);
    r.ultimo = r.notifiche[r.notifiche.length - 1] || null;
    return r;
};

console.log('\n--- "Salva modifiche", cartella aperta, una foto senza tag e senza .txt ---');
{
    const dir = cartella({ 'b.txt': 'smile,' });
    const r = await salva([
        { id: 'a', file: { name: 'a.png' }, tags: [], originalTags: ['x'], dirHandle: dir },
        { id: 'b', file: { name: 'b.png' }, tags: ['red hair'], originalTags: ['smile'], dirHandle: dir },
    ]);
    dice('nessun a.txt vuoto creato', false, dir.file.has('a.txt'));
    dice('le due foto risultano salvate', ['a', 'b'], r.salvate);
    dice('"Salva e chiudi" puo\' chiudere', true, r.ok);
}

console.log('\n--- "Salva modifiche", cartella aperta, il .txt c\'era e la foto non ha piu\' tag ---');
{
    const dir = cartella({ 'a.txt': 'smile, hat,' });
    const r = await salva([{ id: 'a', file: { name: 'a.png' }, tags: [], originalTags: ['smile', 'hat'], dirHandle: dir }]);
    dice('il .txt si svuota (come chiesto)', '', dir.file.get('a.txt'));
    dice('il messaggio dice che la foto ha un .txt vuoto, al singolare', true,
        typeof t.saveEmptyCaptionOne === 'string' && !!r.ultimo && r.ultimo[0].includes(t.saveEmptyCaptionOne));
    const due = cartella({ 'a.txt': 'x,', 'b.txt': 'y,' });
    const r2 = await salva(['a', 'b'].map(id => ({ id, file: { name: id + '.png' }, tags: [], originalTags: ['z'], dirHandle: due })));
    dice('due foto: la frase al plurale con 2', true,
        typeof t.saveEmptyCaptionMany === 'string' && !!r2.ultimo && r2.ultimo[0].includes(t.saveEmptyCaptionMany.replace('{n}', '2')));
}

console.log('\n--- "Salva .txt" del visualizzatore ---');
{
    const salvaUna = async (dir, originalTags) => {
        const notifiche = [];
        let salvata = false;
        const f = new Function('orderTags', 'currentTags', 'image', 'dirHandle', 'updateOriginalTags', 'soundManager', 'showNotification', 't', 'window', 'console',
            'buildTagFileName', 'sidecarTagFileName',
            jsLightbox + '\nreturn handleSaveSingleTxt;')((x) => x, [], { id: '1', file: { name: 'a.png' }, originalTags }, dir, () => { salvata = true; }, { chime() { } },
            (m, tipo) => notifiche.push([m, tipo]), t, {}, muto, P.buildTagFileName, P.sidecarTagFileName);
        await f();
        return { notifiche, salvata };
    };
    const senza = cartella();
    const r = await salvaUna(senza, []);
    dice('foto senza tag e senza .txt: nessun a.txt vuoto creato', false, senza.file.has('a.txt'));
    dice('...e la foto risulta salvata', true, r.salvata);
    const con = cartella({ 'a.txt': 'smile,' });
    const r2 = await salvaUna(con, ['smile']);
    dice('il .txt c\'era: si svuota e il messaggio lo dice', [true, true],
        [con.file.get('a.txt') === '', typeof t.saveEmptyCaptionOne === 'string' && r2.notifiche.some(([m]) => m.includes(t.saveEmptyCaptionOne))]);
}

console.log('\n--- "Carica immagini" in Electron: il canale del processo principale ---');
{
    const { handlers } = caricaMain();
    const scrivi = handlers.get('images:write-sidecar-tags');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'itm-empty-caption-'));
    try {
        const a = path.join(tmp, 'a.png');
        const b = path.join(tmp, 'b.png');
        fs.writeFileSync(a, 'png');
        fs.writeFileSync(b, 'png');
        fs.writeFileSync(path.join(tmp, 'b.txt'), 'smile,');
        const r = scrivi(null, [{ imagePath: a, content: '' }, { imagePath: b, content: '' }]);
        dice('a.png senza .txt e senza tag: risulta salvata, nessun a.txt creato', [true, false], [r.results[0], fs.existsSync(path.join(tmp, 'a.txt'))]);
        dice('b.txt c\'era: si svuota', [true, ''], [r.results[1], fs.readFileSync(path.join(tmp, 'b.txt'), 'utf8')]);
        const r2 = scrivi(null, [{ imagePath: a, content: 'red hair,' }]);
        dice('con dei tag il .txt si crea come prima', [true, 'red hair,'], [r2.results[0], fs.readFileSync(path.join(tmp, 'a.txt'), 'utf8')]);
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
}

console.log('\n--- le frasi esistono nelle nove lingue ---');
dice('saveEmptyCaptionOne e saveEmptyCaptionMany (con {n})', [],
    ['it', 'en', 'fr', 'es', 'de', 'zh', 'ja', 'pt', 'ru'].filter(l => typeof lingue[l].saveEmptyCaptionOne !== 'string'
        || typeof lingue[l].saveEmptyCaptionMany !== 'string' || !lingue[l].saveEmptyCaptionMany.includes('{n}')));

process.exit(esito());
