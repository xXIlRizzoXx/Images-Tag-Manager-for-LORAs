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
//           cio' che manca, getFile da' il contenuto di adesso (testo o byte). Una funzione al posto
//           del contenuto e' un file che c'e' ma non si legge: getFile chiama lei (che lancia).
// ENGLISH: a folder on the "disk" that can be read back: getFileHandle without create gives
//          NotFoundError for what is missing, getFile gives the current content (text or bytes). A
//          function instead of the content is a file that is there but cannot be read: getFile calls
//          it (and it throws).
const cartella = (voci) => {
    const disco = new Map(Object.entries(voci));
    const nonCe = () => new DOMException('not found', 'NotFoundError');
    return {
        disco, name: 'dataset',
        getFileHandle: async (nome, o) => {
            if (!disco.has(nome) && !(o && o.create)) throw nonCe();
            return {
                getFile: async () => {
                    if (!disco.has(nome)) throw nonCe();
                    const v = disco.get(nome);
                    return typeof v === 'function' ? v() : new File([v], nome, { type: 'text/plain' });
                },
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

// ITALIANO: un .txt che al momento di Salva c'e' ma non si legge conta come cambiato: un altro programma
//           lo tiene bloccato, lo ha riscritto in ANSI con lettere accentate o lo ha fatto diventare piu'
//           grande di 1 MB. I tag sul disco non si possono confrontare, quindi si chiede. Il file oltre
//           1 MB contiene apposta gli stessi tag che il programma ricorda: se il controllo della
//           dimensione mancasse, il testo si leggerebbe uguale e non si chiederebbe niente.
// ENGLISH: a .txt that is there at Save time but cannot be read counts as changed: another program
//          keeps it locked, rewrote it in ANSI with accented letters or made it bigger than 1 MB. The
//          tags on disk cannot be compared, so the question comes. The file over 1 MB holds on purpose
//          the same tags the program remembers: without the size check the text would read the same and
//          nothing would be asked.
const TXT_MAX_BYTES = 1024 * 1024;
const bloccato = () => { throw new DOMException('locked', 'NotReadableError'); };
const illeggibili = [
    ['bloccato da un altro programma (NotReadableError)', bloccato],
    ['riscritto in ANSI ("cat" e una e accentata, non UTF-8)', new Uint8Array([0x63, 0x61, 0x74, 0xE8, 0x2C])],
    ['piu\' grande di 1 MB, con gli stessi tag', 'cat,' + ' '.repeat(TXT_MAX_BYTES)],
];
for (const [come, contenuto] of illeggibili) {
    console.log(`\n--- "Salva Modifiche": a.txt ${come} ---`);
    const c = cartella({ 'a.png': 'x', 'a.txt': 'cat,', 'b.png': 'x', 'b.txt': 'dog,' });
    const app = creaApp([foto('a', ['cat'], c), foto('b', ['dog'], c)], { trigger: ['ohwx'] });
    app.importa(); await app.attendi();
    c.disco.set('a.txt', contenuto);
    conTrigger(app); await app.attendi();
    const r = await salva(app, 'annulla');
    dice('si chiede e la domanda nomina a.png', [true, true], [!!r.domanda, !!(r.domanda && String(r.domanda.message).includes('a.png'))]);
    dice('...con Annulla a.txt resta com\'era, b.txt si scrive, a.png resta da salvare e Salva torna false',
        [true, 'ohwx, dog,', ['cat'], false], [c.disco.get('a.txt') === contenuto, c.disco.get('b.txt'), app.fotoCon('a').originalTags, r.ok]);
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
        // ITALIANO: .txt che c'e' ma non si legge (il canale lo torna { skipped: true }): conta come cambiato.
        //           Quello oltre 1 MB ha gli stessi tag che il programma ricorda (vedi sopra).
        // ENGLISH: a .txt that is there but cannot be read (the channel returns it { skipped: true }):
        //          counts as changed. The one over 1 MB holds the tags the program remembers (see above).
        for (const [come, nome, byte] of [
            ['riscritto in ANSI (non UTF-8)', 'd', Buffer.from([0x63, 0x61, 0x74, 0xE8, 0x2C])],
            ['piu\' grande di 1 MB, con gli stessi tag', 'e', Buffer.from('cat,' + ' '.repeat(TXT_MAX_BYTES))],
        ]) {
            const app = creaApp([prepara(nome, 'cat,')], { trigger: ['ohwx'], finestra });
            app.importa(); await app.attendi();
            fs.writeFileSync(path.join(dir, nome + '.txt'), byte);
            conTrigger(app); await app.attendi();
            const r = await salva(app, 'annulla');
            dice(`${nome}.txt ${come}: si chiede, e con Annulla resta com'era e Salva torna false`, [true, true, false],
                [!!r.domanda, fs.readFileSync(path.join(dir, nome + '.txt')).equals(byte), r.ok]);
        }
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

process.exit(esito());
