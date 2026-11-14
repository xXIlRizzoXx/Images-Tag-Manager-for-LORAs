/* ITALIANO: PROVA DEL .txt CAMBIATO DA UN ALTRO PROGRAMMA DOPO L'APERTURA
   Cartella aperta, a.txt con "cat,". A programma aperto un altro programma (il tagger WD14 di Kohya,
   il Blocco note, OneDrive) riscrive a.txt. Poi nel programma si scrive la trigger "ohwx" e si preme
   "Salva Modifiche" (o "Salva file .txt" del visualizzatore): a.txt diventava "ohwx, cat," con
   l'avviso verde, e i tag dell'altro programma erano persi. Ora, prima di scrivere, il programma
   rilegge il .txt: se i tag sul disco non sono piu' quelli che conosce (letti all'import o scritti da
   lui), lo dice e chiede se sovrascrivere. Con "Annulla" quel .txt resta com'e', la foto resta da
   salvare, l'avviso la nomina e Salva torna FALSE ("Salva e chiudi" non chiude); con la conferma si
   scrive come prima.
   Casi vicini che non devono cambiare: due Salva di fila senza cambi da fuori non chiedono niente
   (il ricordo del disco si aggiorna dopo ogni scrittura); stessi tag in un altro ordine o con altri
   spazi non sono un cambio; un .txt cancellato da fuori si riscrive senza chiedere (non c'e' niente
   da perdere); le altre foto si salvano lo stesso.
   Si eseguono i testi VERI di handleSaveChanges, performSave e del controllo (undo-harness.mjs), di
   handleSaveSingleTxt (Lightbox.tsx) e, per le foto senza cartella, i canali veri di electron/main.cjs
   (main-harness.mjs) su una cartella temporanea.
   Uso:  node scripts/test-save-txt-changed-outside.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE .txt CHANGED BY ANOTHER PROGRAM AFTER THE FOLDER WAS OPENED
   Folder open, a.txt holding "cat,". With the program open another program (Kohya's WD14 tagger,
   Notepad, OneDrive) rewrites a.txt. Then the trigger "ohwx" is typed and "Save Changes" (or the
   viewer's "Save .txt file") is pressed: a.txt became "ohwx, cat," with the green notice, and the
   other program's tags were lost. Now, before writing, the program reads the .txt again: if the tags
   on disk are no longer the ones it knows (read at import or written by itself), it says so and asks
   whether to overwrite. With "Cancel" that .txt stays as it is, the photo stays unsaved, the notice
   names it and Save returns FALSE ("Save and close" does not close); when confirmed it is written as
   before.
   Neighbouring cases that must not change: two Saves in a row with no change from outside ask
   nothing (the disk record is updated after every write); the same tags in another order or with
   other spaces are not a change; a .txt deleted from outside is written again without asking (there
   is nothing to lose); the other photos are saved anyway.
   The REAL texts of handleSaveChanges, performSave and the check (undo-harness.mjs), of
   handleSaveSingleTxt (Lightbox.tsx) and, for folder-less photos, the real channels of
   electron/main.cjs (main-harness.mjs) run on a temporary folder.
   Usage:  node scripts/test-save-txt-changed-outside.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaApp, t } from './undo-harness.mjs';
import { caricaMain, creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const P = await (async () => {
    const uscita = await esbuild.build({ entryPoints: [path.join(radice, 'src/utils/pathUtils.ts')], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
    return import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));
})();

// ITALIANO: una cartella sul "disco" che si rilegge: getFileHandle senza create da' NotFoundError per
//           cio' che manca, getFile da' il contenuto di adesso.
// ENGLISH: a folder on the "disk" that can be read back: getFileHandle without create gives
//          NotFoundError for what is missing, getFile gives the current content.
const cartella = (voci) => {
    const disco = new Map(Object.entries(voci));
    const nonCe = () => new DOMException('not found', 'NotFoundError');
    return {
        disco, name: 'dataset',
        getFileHandle: async (nome, o) => {
            if (!disco.has(nome) && !(o && o.create)) throw nonCe();
            return {
                getFile: async () => { if (!disco.has(nome)) throw nonCe(); return new File([disco.get(nome)], nome, { type: 'text/plain' }); },
                createWritable: async () => { let s = ''; return { write: async (x) => { s += x; }, close: async () => { disco.set(nome, s); } }; },
            };
        },
    };
};
const foto = (id, tags, dir, file = null) => ({
    id, file: file || { name: id + '.png' }, thumb: 'blob:finto/' + id, tags: [...tags], originalTags: [...tags],
    isTrashed: false, dirHandle: dir, width: 1024, height: 1024,
});
// ITALIANO: la trigger scritta nel riquadro dopo l'import: va su tutte le foto.
// ENGLISH: the trigger typed in the box after the import: it goes on every photo.
const conTrigger = (app) => app.modifica(prev => prev.map(i => ({ ...i, tags: ['ohwx', ...i.tags.filter(x => x !== 'ohwx')] })));

// ITALIANO: preme Salva; se compare la domanda risponde `risposta` ('annulla' / 'sovrascrivi').
// ENGLISH: presses Save; if the question shows up it answers `risposta` ('annulla' / 'sovrascrivi').
const salva = async (app, risposta = 'annulla') => {
    const promessa = app.render().handleSaveChanges();
    let domanda = null;
    for (let i = 0; i < 40 && !domanda; i++) {
        await app.attendi(1);
        if (app.stato.confirmDialog && app.stato.confirmDialog.isOpen) domanda = app.stato.confirmDialog;
    }
    if (domanda) (risposta === 'sovrascrivi' ? domanda.onConfirm : domanda.onCancel)();
    const ok = await promessa;
    await app.attendi();
    return { ok, domanda, ultimo: app.notifiche[app.notifiche.length - 1] || null };
};

const ESTERNO = '1girl, solo, long hair, smile, outdoors,';

console.log('\n--- "Salva Modifiche": a.txt riscritto da un altro programma, poi Annulla ---');
{
    const c = cartella({ 'a.png': 'x', 'a.txt': 'cat,', 'b.png': 'x', 'b.txt': 'dog,' });
    const app = creaApp([foto('a', ['cat'], c), foto('b', ['dog'], c)], { trigger: ['ohwx'] });
    app.importa(); await app.attendi();
    c.disco.set('a.txt', ESTERNO);
    conTrigger(app); await app.attendi();
    const r = await salva(app, 'annulla');
    dice('chiede prima di sovrascrivere, sopra la finestra "Salva e chiudi", e nomina a.png',
        [true, true, true], [!!r.domanda, !!(r.domanda && r.domanda.sopra), !!(r.domanda && String(r.domanda.message).includes('a.png'))]);
    dice('...con Annulla a.txt resta quello dell\'altro programma', ESTERNO, c.disco.get('a.txt'));
    dice('...b.txt si salva lo stesso', 'ohwx, dog,', c.disco.get('b.txt'));
    dice('...a.png resta da salvare (ricordo del disco invariato) e Salva torna false', [['cat'], false], [app.fotoCon('a').originalTags, r.ok]);
    dice('...l\'avviso nomina a.png con la frase nuova', true, !!(r.ultimo && String(r.ultimo[0]).includes(t.saveTxtChangedOne && t.saveTxtChangedOne.replace('{names}', 'a.png'))));
}

console.log('\n--- stessa cosa, ma si sceglie di sovrascrivere ---');
{
    const c = cartella({ 'a.png': 'x', 'a.txt': 'cat,' });
    const app = creaApp([foto('a', ['cat'], c)], { trigger: ['ohwx'] });
    app.importa(); await app.attendi();
    c.disco.set('a.txt', ESTERNO);
    conTrigger(app); await app.attendi();
    const r = await salva(app, 'sovrascrivi');
    dice('con la conferma a.txt si scrive come prima e Salva torna true', ['ohwx, cat,', true, ['ohwx', 'cat']], [c.disco.get('a.txt'), r.ok, app.fotoCon('a').originalTags]);
}

console.log('\n--- cartella senza .txt: il tagger esterno li crea dopo l\'apertura ---');
{
    const c = cartella({ 'a.png': 'x' });
    const app = creaApp([foto('a', [], c)], { trigger: ['ohwx'] });
    app.importa(); await app.attendi();
    c.disco.set('a.txt', ESTERNO);
    conTrigger(app); await app.attendi();
    const r = await salva(app, 'annulla');
    dice('a.txt nato da fuori: si chiede, e con Annulla resta quello del tagger', [true, ESTERNO, false], [!!r.domanda, c.disco.get('a.txt'), r.ok]);
}

console.log('\n--- due .txt cambiati: una domanda sola, al plurale ---');
{
    const c = cartella({ 'a.png': 'x', 'a.txt': 'cat,', 'b.png': 'x', 'b.txt': 'dog,' });
    const app = creaApp([foto('a', ['cat'], c), foto('b', ['dog'], c)], { trigger: ['ohwx'] });
    app.importa(); await app.attendi();
    c.disco.set('a.txt', ESTERNO);
    c.disco.set('b.txt', 'dog, outdoors,');
    conTrigger(app); await app.attendi();
    const r = await salva(app, 'annulla');
    dice('la domanda e l\'avviso usano le frasi al plurale con 2 e i due nomi',
        [t.saveTxtChangedAskMany && t.saveTxtChangedAskMany.replace('{n}', '2').replace('{names}', 'a.png, b.png'), true, false],
        [r.domanda && r.domanda.message, !!(r.ultimo && String(r.ultimo[0]).includes(t.saveTxtChangedMany && t.saveTxtChangedMany.replace('{n}', '2').replace('{names}', 'a.png, b.png'))), r.ok]);
}
{
    // ITALIANO: la finestra di conferma, chiesta "sopra", sta sopra quella di "Salva e chiudi" (z 500).
    // ENGLISH: the confirm dialog, asked "above", sits above the "Save and close" one (z 500).
    const ui = fs.readFileSync(path.join(radice, 'src/components/ui.tsx'), 'utf8');
    const corpo = ui.slice(ui.indexOf('export const CustomConfirmDialog'), ui.indexOf('export const SaveBeforeCloseDialog'));
    const m = /sopra \? \{ zIndex: (\d+) \}/.exec(corpo);
    dice('CustomConfirmDialog con `sopra` ha uno z-index sopra 500', true, !!m && Number(m[1]) > 500);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const c = cartella({ 'a.png': 'x', 'a.txt': 'cat,' });
    const app = creaApp([foto('a', ['cat'], c)], { trigger: ['ohwx'] });
    app.importa(); await app.attendi();
    conTrigger(app); await app.attendi();
    const r1 = await salva(app);
    app.modifica(prev => prev.map(i => ({ ...i, tags: [...i.tags, 'smile'] }))); await app.attendi();
    const r2 = await salva(app);
    dice('due Salva di fila senza cambi da fuori: nessuna domanda, tutto scritto', [false, true, false, true, 'ohwx, cat, smile,'],
        [!!r1.domanda, r1.ok, !!r2.domanda, r2.ok, c.disco.get('a.txt')]);
}
{
    const c = cartella({ 'a.png': 'x', 'a.txt': 'cat, dog,' });
    const app = creaApp([foto('a', ['cat', 'dog'], c)], { trigger: ['ohwx'] });
    app.importa(); await app.attendi();
    c.disco.set('a.txt', ' dog ,\r\ncat');
    conTrigger(app); await app.attendi();
    const r = await salva(app);
    dice('stessi tag in un altro ordine e con altri spazi: nessuna domanda', [false, true, 'ohwx, cat, dog,'], [!!r.domanda, r.ok, c.disco.get('a.txt')]);
}
{
    const c = cartella({ 'a.png': 'x', 'a.txt': 'cat,' });
    const app = creaApp([foto('a', ['cat'], c)], { trigger: ['ohwx'] });
    app.importa(); await app.attendi();
    c.disco.delete('a.txt');
    conTrigger(app); await app.attendi();
    const r = await salva(app);
    dice('.txt cancellato da fuori: si riscrive senza chiedere', [false, true, 'ohwx, cat,'], [!!r.domanda, r.ok, c.disco.get('a.txt')]);
}

console.log('\n--- "Salva file .txt" del visualizzatore ---');
const sorgenteLightbox = fs.readFileSync(path.join(radice, 'src/components/Lightbox.tsx'), 'utf8');
const jsLightbox = await (async () => {
    const inizio = sorgenteLightbox.indexOf('    const handleSaveSingleTxt = async () => {');
    const chiusura = /\r?\n    \};\r?\n/g;
    chiusura.lastIndex = Math.max(inizio, 0);
    const fine = inizio < 0 ? null : chiusura.exec(sorgenteLightbox);
    if (inizio < 0 || !fine) { console.log('NO  handleSaveSingleTxt non trovato in Lightbox.tsx'); process.exit(1); }
    return (await esbuild.transform(sorgenteLightbox.slice(inizio, fine.index + fine[0].length), { loader: 'tsx' })).code;
})();
const muto = { log() { }, warn() { }, error() { } };
const documento = { createElement: () => ({ click() { } }), body: { appendChild() { }, removeChild() { } } };
const url = { createObjectURL: () => 'blob:finto', revokeObjectURL() { } };
{
    const c = cartella({ 'a.png': 'x', 'a.txt': 'cat,' });
    const app = creaApp([foto('a', ['cat'], c)], { trigger: ['ohwx'] });
    app.importa(); await app.attendi();
    c.disco.set('a.txt', ESTERNO);
    const immagine = { ...app.fotoCon('a'), tags: ['ohwx', 'cat'] };
    const r = { notifiche: [], salvata: false, domanda: null };
    const conferma = app.render().confermaSovrascrittura;
    const f = new Function('orderTags', 'currentTags', 'image', 'dirHandle', 'updateOriginalTags', 'soundManager', 'showNotification', 't', 'window', 'console',
        'buildTagFileName', 'sidecarTagFileName', 'document', 'URL', 'Blob', 'confermaSovrascrittura',
        jsLightbox + '\nreturn handleSaveSingleTxt;')((x) => x, immagine.tags, immagine, c, () => { r.salvata = true; }, { chime() { } },
        (m, tipo) => r.notifiche.push([m, tipo]), t, {}, muto, P.buildTagFileName, P.sidecarTagFileName, documento, url, Blob, conferma);
    const promessa = f();
    for (let i = 0; i < 40 && !r.domanda; i++) {
        await app.attendi(1);
        if (app.stato.confirmDialog && app.stato.confirmDialog.isOpen) r.domanda = app.stato.confirmDialog;
    }
    if (r.domanda) r.domanda.onCancel();
    await promessa;
    dice('il visualizzatore chiede, e con Annulla a.txt resta com\'e\' e la foto non risulta salvata', [true, ESTERNO, false],
        [!!r.domanda, c.disco.get('a.txt'), r.salvata]);
    // ITALIANO: un .txt che all'import non si e' potuto leggere si sostituisce apposta dal visualizzatore:
    //           nessuna domanda (vedi txtNonLettoInVigore).
    // ENGLISH: a .txt that could not be read at import is replaced on purpose from the viewer: no
    //          question (see txtNonLettoInVigore).
    const base = ['ohwx'];
    const nonLetta = { ...app.fotoCon('a'), tags: ['ohwx', 'cat'], originalTags: base, baseTxtNonLetto: base };
    const conteggio = { domande: 0 };
    const giro = await conferma([nonLetta]).then((s) => s.size);
    if (app.stato.confirmDialog && app.stato.confirmDialog.isOpen) conteggio.domande++;
    dice('...un .txt mai letto all\'import non fa domande', [0, 0], [giro, conteggio.domande]);
}

console.log('\n--- foto senza cartella ("Carica immagini"): i canali veri del processo principale ---');
{
    const { handlers } = caricaMain();
    const leggi = handlers.get('images:read-sidecar-tags');
    const scrivi = handlers.get('images:write-sidecar-tags');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'itm-txt-cambiato-'));
    try {
        const finestra = { electronAPI: {
            getPathForFile: (f) => f.percorso,
            readSidecarTags: (p) => leggi(null, p),
            writeSidecarTags: (items) => scrivi(null, items),
        } };
        const prepara = (nome, testo) => {
            const img = path.join(dir, nome + '.png');
            fs.writeFileSync(img, 'x');
            if (testo !== null) fs.writeFileSync(path.join(dir, nome + '.txt'), testo);
            return foto(nome, testo ? [String(testo).replace(/,$/, '')] : [], null, { name: nome + '.png', percorso: img });
        };
        const txt = (nome) => fs.readFileSync(path.join(dir, nome + '.txt'), 'utf8');
        {
            const app = creaApp([prepara('a', 'cat,'), prepara('b', 'dog,')], { trigger: ['ohwx'], finestra });
            app.importa(); await app.attendi();
            fs.writeFileSync(path.join(dir, 'a.txt'), ESTERNO);
            conTrigger(app); await app.attendi();
            const r = await salva(app, 'annulla');
            dice('a.txt cambiato da fuori: si chiede, e con Annulla resta quello esterno; b.txt si scrive',
                [true, ESTERNO, 'ohwx, dog,', false], [!!r.domanda, txt('a'), txt('b'), r.ok]);
            const r2 = await salva(app, 'sovrascrivi');
            dice('...al Salva dopo si sceglie di sovrascrivere: a.txt scritto, Salva torna true', [true, 'ohwx, cat,', true], [!!r2.domanda, txt('a'), r2.ok]);
        }
        {
            const app = creaApp([prepara('c', 'cat,')], { trigger: ['ohwx'], finestra });
            app.importa(); await app.attendi();
            conTrigger(app); await app.attendi();
            const r = await salva(app);
            dice('nessun cambio da fuori: nessuna domanda, c.txt scritto', [false, true, 'ohwx, cat,'], [!!r.domanda, r.ok, txt('c')]);
        }
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

process.exit(esito());
