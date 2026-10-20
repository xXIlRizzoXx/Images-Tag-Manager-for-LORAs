/* ITALIANO: PROVA DEL SALVATAGGIO DI UNA FOTO CHE NON C'E' PIU' NELLA SUA CARTELLA
   Foto aperta con "Carica Cartella", poi cancellata (o rinominata) da Esplora file a programma aperto.
   "Salva Modifiche" e "Salva file .txt" del visualizzatore creavano lo stesso il suo .txt (un .txt
   orfano, o con il nome vecchio e quindi lontano dalla foto vera) e dicevano "salvato con successo".
   Ora la foto che manca non si scrive: "Salva Modifiche" la nomina fra quelle non salvate ("Salva e
   chiudi" non chiude), il visualizzatore da' l'errore di salvataggio.
   Casi vicini che non devono cambiare: le altre foto si salvano, una foto senza tag svuota il .txt che
   c'e' (se la foto c'e'), e nessun .txt nuovo nasce per una foto senza tag.
   Si eseguono i testi VERI di performSave (src/App.tsx) e handleSaveSingleTxt (Lightbox.tsx).
   Uso:  node scripts/test-save-photo-gone.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF SAVING A PHOTO THAT IS NO LONGER IN ITS FOLDER
   A photo opened with "Load Folder", then deleted (or renamed) in File Explorer with the program open.
   "Save Changes" and the viewer's "Save .txt file" still created its .txt (an orphan .txt, or one with
   the old name and so away from the real photo) and said "saved successfully". Now the missing photo
   is not written: "Save Changes" names it among the unsaved ones ("Save and close" does not close),
   the viewer gives the save error.
   Neighbouring cases that must not change: the other photos are saved, an untagged photo empties the
   .txt that is there (when the photo is there), and no new .txt is born for an untagged photo.
   The REAL text of performSave (src/App.tsx) and handleSaveSingleTxt (Lightbox.tsx) runs.
   Usage:  node scripts/test-save-photo-gone.mjs      (exits with code 1 if anything is off) */

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
const t = (await carica('src/constants.ts')).translations.en;
const ritaglia = async (file, intestazione) => {
    const sorgente = fs.readFileSync(path.join(radice, file), 'utf8');
    const inizio = sorgente.indexOf(intestazione);
    const chiusura = /\r?\n    \};\r?\n/g;
    chiusura.lastIndex = Math.max(inizio, 0);
    const fine = inizio < 0 ? null : chiusura.exec(sorgente);
    if (inizio < 0 || !fine) { console.log(`NO  non trovato in ${file}: ${intestazione.trim()}`); process.exit(1); }
    return (await esbuild.transform(sorgente.slice(inizio, fine.index + fine[0].length), { loader: 'tsx' })).code;
};
const jsSalva = await ritaglia('src/App.tsx', '    const performSave = async (imagesToSave: any[]');
const jsLightbox = await ritaglia('src/components/Lightbox.tsx', '    const handleSaveSingleTxt = async () => {');
const muto = { log() { }, warn() { }, error() { } };
const documento = { createElement: () => ({ click() { } }), body: { appendChild() { }, removeChild() { } } };
const url = { createObjectURL: () => 'blob:finto', revokeObjectURL() { } };

// ITALIANO: una cartella sul "disco": getFileHandle senza create da' NotFoundError per cio' che manca.
// ENGLISH: a folder on the "disk": getFileHandle without create gives NotFoundError for what is missing.
const cartella = (voci) => {
    const disco = new Map(Object.entries(voci));
    return {
        disco, name: '10_face',
        getFileHandle: async (nome, o) => {
            if (!disco.has(nome) && !(o && o.create)) throw new DOMException('not found', 'NotFoundError');
            return { createWritable: async () => { let s = ''; return { write: async (x) => { s += x; }, close: async () => { disco.set(nome, s); } }; } };
        },
    };
};
const salva = async (foto) => {
    const r = { notifiche: [] };
    const f = new Function('setIsSaving', 'setImportProgress', 'showNotification', 't', 'getOrderedTagString', 'window', 'setImages', 'soundManager', 'console',
        'buildTagFileName', 'sanitizeFileName', 'sidecarTagFileName', 'document', 'URL', 'Blob', 'setTimeout', 'isUndoRedoAction', 'avvisoSalvataggioRef', 'gemelliDelTxt',
        jsSalva + '\nreturn performSave;')(() => { }, () => { }, (m, tipo) => r.notifiche.push([m, tipo]), t, (tags) => (tags.length ? tags.join(', ') + ',' : ''),
        {}, () => { }, { chime() { } }, muto, P.buildTagFileName, P.sanitizeFileName, P.sidecarTagFileName, documento, url, Blob, (fn) => { fn(); return 0; },
        { current: false }, { current: '' }, async () => () => { });
    r.ok = await f(foto);
    r.ultimo = r.notifiche[r.notifiche.length - 1] || null;
    return r;
};
const foto = (id, nome, tags, dir) => ({ id, file: { name: nome }, tags, originalTags: ['vecchio'], dirHandle: dir });

console.log('\n--- "Salva Modifiche" con una foto cancellata da Esplora file ---');
{
    const c = cartella({ 'img_001.png': 'x', 'img_001.txt': 'vecchio,' });
    const r = await salva([foto('1', 'img_001.png', ['ohwx', 'cat'], c), foto('5', 'img_005.png', ['ohwx', 'dog'], c)]);
    dice('nessun img_005.txt orfano', false, c.disco.has('img_005.txt'));
    dice('...img_001.txt si scrive come sempre', 'ohwx, cat,', c.disco.get('img_001.txt'));
    dice('...l\'avviso nomina la foto non salvata, in rosso, e "Salva e chiudi" non chiude',
        [[t.saveSomeFailed.replace('{saved}', '1').replace('{total}', '2').replace('{names}', 'img_005.png'), 'error'], false], [r.ultimo, r.ok]);
}
{
    // ITALIANO: foto senza tag e cancellata: il .txt rimasto accanto non si tocca.
    // ENGLISH: an untagged photo, deleted: the .txt left behind is not touched.
    const c = cartella({ 'img_005.txt': 'vecchio,' });
    const r = await salva([foto('5', 'img_005.png', [], c)]);
    dice('foto senza tag cancellata: il suo .txt non si svuota', ['vecchio,', false], [c.disco.get('img_005.txt'), r.ok]);
}

console.log('\n--- "Salva file .txt" del visualizzatore ---');
const salvaUna = async (immagine, tags, dir) => {
    const r = { notifiche: [], salvata: false };
    const f = new Function('orderTags', 'currentTags', 'image', 'dirHandle', 'updateOriginalTags', 'soundManager', 'showNotification', 't', 'window', 'console',
        'buildTagFileName', 'sidecarTagFileName', 'document', 'URL', 'Blob',
        jsLightbox + '\nreturn handleSaveSingleTxt;')((x) => x, tags, immagine, dir, () => { r.salvata = true; }, { chime() { } },
        (m, tipo) => r.notifiche.push([m, tipo]), t, {}, muto, P.buildTagFileName, P.sidecarTagFileName, documento, url, Blob);
    await f();
    return r;
};
{
    const c = cartella({ 'img_001.png': 'x' });
    const r = await salvaUna({ id: '5', file: { name: 'img_005.png' }, originalTags: [] }, ['ohwx'], c);
    dice('foto sparita: nessun .txt, errore e foto non segnata come salvata', [false, [[t.errorSaveGen || t.dirError, 'error']], false],
        [c.disco.has('img_005.txt'), r.notifiche, r.salvata]);
    const vuota = cartella({ 'img_005.txt': 'vecchio,' });
    const r2 = await salvaUna({ id: '5', file: { name: 'img_005.png' }, originalTags: ['vecchio'] }, [], vuota);
    dice('...senza tag: il .txt rimasto non si svuota', ['vecchio,', false], [vuota.disco.get('img_005.txt'), r2.salvata]);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const c = cartella({ 'a.png': 'x', 'b.png': 'x', 'b.txt': 'vecchio,' });
    const r = await salva([foto('a', 'a.png', ['cat'], c), foto('b', 'b.png', [], c)]);
    dice('foto presenti: a.txt scritto, b.txt svuotato, tutto salvato', ['cat,', '', true], [c.disco.get('a.txt'), c.disco.get('b.txt'), r.ok]);
    const c2 = cartella({ 'c.png': 'x' });
    const r2 = await salva([foto('c', 'c.png', [], c2)]);
    dice('foto senza tag e senza .txt: nessun .txt nuovo', [false, true], [c2.disco.has('c.txt'), r2.ok]);
    const c3 = cartella({ 'a.png': 'x' });
    const r3 = await salvaUna({ id: 'a', file: { name: 'a.png' }, originalTags: [] }, ['cat'], c3);
    dice('visualizzatore, foto presente: a.txt scritto e salvata', ['cat,', true, 'success'], [c3.disco.get('a.txt'), r3.salvata, r3.notifiche[0] && r3.notifiche[0][1]]);
}

process.exit(esito());
