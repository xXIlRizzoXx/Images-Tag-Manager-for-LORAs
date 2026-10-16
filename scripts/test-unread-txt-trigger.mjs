/* ITALIANO: PROVA DI UN .TXT NON LETTO ALL'IMPORT E DELLE TRIGGER CAMBIATE DOPO
   Un .txt che c'e' ma non si legge (oltre 1 MB, bloccato, un file di OneDrive solo in rete) viene
   saltato dall'import: cosa contiene non si sa. Se la trigger "ohwx" veniva scritta DOPO l'import
   (l'ordine normale), la foto risultava modificata e "Salva" scriveva "ohwx," SOPRA il file vero;
   se la trigger era attiva all'import e poi veniva tolta, "Salva" ci scriveva un file vuoto. La
   regola: per una foto cosi' contano solo i tag messi apposta su di lei, non le trigger; quando il
   suo .txt viene scritto davvero torna la regola di sempre, anche dopo un Ctrl+Z.
   Si eseguono i testi VERI di processImportData, handleGlobalTagsChange, handleSaveChanges e
   handleCloseProject presi da src/App.tsx, con le regole vere di src/utils (compilate con esbuild).
   Uso:  node scripts/test-unread-txt-trigger.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF A .TXT NOT READ AT IMPORT AND OF TRIGGERS CHANGED AFTERWARDS
   A .txt that exists but cannot be read (over 1 MB, locked, a OneDrive online-only file) is skipped
   by the import: its content is unknown. If the trigger "ohwx" was typed AFTER the import (the
   normal order), the photo counted as modified and "Save" wrote "ohwx," OVER the real file; if the
   trigger was active at import and then removed, "Save" wrote an empty file there. The rule: for
   such a photo only the tags put on it on purpose count, not the triggers; once its .txt is really
   written the usual rule is back, after a Ctrl+Z too.
   The REAL text of processImportData, handleGlobalTagsChange, handleSaveChanges and
   handleCloseProject taken from src/App.tsx is run, with the real rules of src/utils (compiled with
   esbuild).
   Usage:  node scripts/test-unread-txt-trigger.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const carica = async (rel) => {
    const uscita = await esbuild.build({
        entryPoints: [path.join(radice, rel)],
        bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
    });
    return import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));
};
const S = await carica('src/utils/sidecarTags.ts');
const B = await carica('src/utils/tagBackup.ts');
const C = await carica('src/utils/tagCase.ts');
const G = await carica('src/utils/closeGuard.ts');
const H = await carica('src/utils/historyUtils.ts');
const N = await carica('src/utils/importNotice.ts');
const t = (await carica('src/constants.ts')).translations.en;
const { dice, esito } = creaControlli();

const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const ritaglia = async (intestazione) => {
    const inizio = sorgente.indexOf(intestazione);
    const chiusura = /\r?\n    \};\r?\n/g;
    chiusura.lastIndex = Math.max(inizio, 0);
    const fine = inizio < 0 ? null : chiusura.exec(sorgente);
    if (inizio < 0 || !fine) {
        console.log('NO  non trovato in src/App.tsx: ' + intestazione.trim());
        process.exit(1);
    }
    return (await esbuild.transform(sorgente.slice(inizio, fine.index + fine[0].length), { loader: 'ts' })).code;
};
const NOMI = ['globalTriggers', 'globalTriggersRef', 'images', 'setImages', 'setGlobalTriggers', 'uniqueTagsIgnoringCase',
    'setImportSummary', 'setDirHandle', 'setIsImporting', 'setImportProgress', 'folderSignature', 'nuovoIdFoto', 'backupDellImport',
    'localStorage', 'makeFolderKeyer', 'makeBackupKeyer', 'TXT_MAX_BYTES', 'parseSidecarText', 'generateThumbnail', 'tagDiImport',
    'tagDaRipristinare', 'asDirHandle', 'anteprimeProgettoRef', 'soundManager', 'avvisoImport', 't', 'showNotification',
    'folderInputRef', 'console', 'performSave', 'fotoDaSalvare', 'setSaveCloseDialog', 'setConfirmDialog', 'closeProjectNow', 'importAttiviRef', 'txtNonLettoInVigore', 'progettoGenRef'];
const fabbrica = new Function(...NOMI,
    (await ritaglia('    const processImportData = async (')) + '\n' + (await ritaglia('    const handleGlobalTagsChange = (')) + '\n' +
    (await ritaglia('    const handleSaveChanges = async ')) + '\n' + (await ritaglia('    const handleCloseProject = () => {')) +
    '\nreturn { processImportData, handleGlobalTagsChange, handleSaveChanges, handleCloseProject };');

const TXT_MAX_BYTES = 1024 * 1024;
const leggibile = (name, testo) => ({ name, size: testo.length, lastModified: 0, text: async () => testo });
const bloccato = (name) => ({ name, size: 40, lastModified: 0, text: async () => { throw new Error('The file is locked'); } });
const enorme = (name) => ({ name, size: TXT_MAX_BYTES + 1, lastModified: 0, text: async () => 'mai letto,' });

// ITALIANO: l'app finta: import di b.png (.txt non letto) e c.png (.txt letto), con le trigger `prima`.
//           render() da' le funzioni vere viste dallo stato di adesso; `scritte` = cosa Salva scrive.
// ENGLISH: the fake app: import of b.png (unread .txt) and c.png (read .txt), with the triggers `prima`.
//          render() gives the real functions seen from the current state; `scritte` = what Save writes.
const creaApp = async (prima, txtB = bloccato('b.txt')) => {
    const stato = { images: [], trigger: prima, scritte: null, finestra: 'nessuna', notifiche: [] };
    const ref = { current: prima };
    let id = 0;
    const render = () => {
        ref.current = stato.trigger;
        return fabbrica(stato.trigger, ref, stato.images,
            (fn) => { stato.images = typeof fn === 'function' ? fn(stato.images) : fn; },
            (v) => { stato.trigger = typeof v === 'function' ? v(stato.trigger) : v; }, C.uniqueTagsIgnoringCase,
            () => { }, () => { }, () => { }, () => { }, B.folderSignature, () => 'id' + (++id), B.backupDellImport,
            { getItem: () => null }, S.makeFolderKeyer, () => (f) => 'dataset\x1f' + f.name, TXT_MAX_BYTES, S.parseSidecarText,
            async () => ({ url: 'blob:finto', width: 1, height: 1 }), S.tagDiImport,
            B.tagDaRipristinare, () => null, { current: new Set() }, { chime() { } }, N.avvisoImport, t,
            (m) => stato.notifiche.push(m), { current: null }, { log() { }, warn() { }, error() { } },
            async (lista, frase = '', blocca) => { stato.scritte = lista.map(i => i.file.name); stato.frase = frase; stato.blocca = blocca; return true; }, G.fotoDaSalvare,
            (d) => { if (d && d.isOpen) stato.finestra = 'tre scelte'; }, (d) => { if (d && d.isOpen) stato.finestra = 'conferma semplice'; }, () => { }, { current: 0 }, S.txtNonLettoInVigore, { current: 0 });
    };
    await render().processImportData([{ name: 'b.png' }, { name: 'c.png' }], [txtB, leggibile('c.txt', 'blue sky,')]);
    const app = {
        stato, render,
        foto: (nome) => stato.images.find(i => i.file.name === nome),
        trigger: (nuove) => render().handleGlobalTagsChange(nuove),
        // ITALIANO: preme Salva: torna i nomi delle foto che performSave riceve ([] = "Nessuna modifica").
        // ENGLISH: presses Save: returns the names of the photos performSave receives ([] = "No changes").
        salva: async () => { stato.scritte = []; await render().handleSaveChanges(); return stato.scritte; },
        chiudiProgetto: () => { stato.finestra = 'nessuna'; render().handleCloseProject(); return stato.finestra; },
        modifica: (nome, tags) => { stato.images = stato.images.map(i => i.file.name === nome ? { ...i, tags } : i); },
    };
    return app;
};

console.log('\n--- .txt bloccato, poi la trigger "ohwx" scritta dopo l\'import ---');
{
    const app = await creaApp([]);
    app.trigger(['ohwx']);
    dice('la foto mostra la trigger', ['ohwx'], app.foto('b.png').tags);
    dice('"Salva" non scrive sopra il .txt non letto, scrive quello letto', ['c.png'], await app.salva());
    // ITALIANO: ma lo dice: prima il messaggio era "salvate con successo" e basta (visto dal vivo).
    // ENGLISH: but it says so: the message used to be "saved successfully" and nothing else (seen live).
    dice('il messaggio nomina b.png, lasciata com\'era', true, app.stato.frase === t.saveUnreadTxtOne.replace('{names}', 'b.png'));
    dice('e "Salva e chiudi" chiude lo stesso (era solo la trigger)', false, app.stato.blocca);
    dice('la X della finestra non chiede niente per lei', false, G.modificheNonSalvate([app.foto('b.png')], app.stato.trigger));
    dice('"Chiudi progetto" non dice che ci sono modifiche non salvate', 'conferma semplice', (app.modifica('c.png', app.foto('c.png').originalTags), app.chiudiProgetto()));
}

console.log('\n--- trigger "ohwx" attiva all\'import, poi tolta ---');
{
    const app = await creaApp(['ohwx']);
    dice('all\'import la trigger si scrive solo nel .txt letto (come prima)', ['c.png'], await app.salva());
    app.trigger([]);
    dice('tolta la trigger: "Salva" non svuota il .txt non letto', [], await app.salva());
}

console.log('\n--- .txt oltre 1 MB ---');
{
    const app = await creaApp([], enorme('b.txt'));
    app.trigger(['ohwx']);
    dice('stessa regola: non si scrive sopra', ['c.png'], await app.salva());
}

console.log('\n--- il backup anti-crash usa la stessa regola ---');
{
    // ITALIANO: le trigger non restano da una sessione all'altra: una trigger finita nel backup
    //           tornava come tag della foto, e "Salva" la scriveva sopra il .txt non letto.
    // ENGLISH: triggers do not last from one session to the next: a trigger stored in the backup
    //          came back as a tag of the photo, and "Save" wrote it over the unread .txt.
    const memoria = new Map();
    const archivio = { getItem: (k) => (memoria.has(k) ? memoria.get(k) : null), setItem: (k, v) => memoria.set(k, String(v)), removeItem: (k) => memoria.delete(k) };
    const chiavi = () => (JSON.parse(archivio.getItem('tagBackup') || '{"sources":[]}').sources || []).flatMap(s => Object.keys(s.data).map(k => k.split('\x1f')[1]));
    const app = await creaApp([]);
    app.trigger(['ohwx']);
    G.scriviBackupSubito(archivio, app.stato.images, [], 'dataset', app.stato.trigger);
    dice('solo la trigger sulla foto col .txt non letto: non entra nel backup', ['c.png'], chiavi());
    app.modifica('b.png', ['ohwx', 'cat']);
    G.scriviBackupSubito(archivio, app.stato.images, [], 'dataset', app.stato.trigger);
    dice('un tag messo apposta: entra, come prima', ['b.png', 'c.png'], chiavi().sort());
    const righe = sorgente.split('\n').filter(r => r.includes('scriviBackupSubito(localStorage,'));
    dice('in App.tsx le due scritture del backup passano le trigger attive', [2, true], [righe.length, righe.every(r => r.includes('globalTriggersRef.current, lottiSessioneRef.current)'))]);
}

// ITALIANO: il visualizzatore scrive il .txt della foto: si esegue la riga VERA di updateOriginalTags.
// ENGLISH: the viewer writes the photo's .txt: the REAL line of updateOriginalTags is run.
const rigaVisualizzatore = sorgente.split('\n').find(r => r.startsWith('    const updateOriginalTags = '));
if (!rigaVisualizzatore) { console.log('NO  updateOriginalTags non trovato in src/App.tsx'); process.exit(1); }
const fabbricaVisualizzatore = new Function('isUndoRedoAction', 'setImages',
    (await esbuild.transform(rigaVisualizzatore, { loader: 'ts' })).code + '\nreturn updateOriginalTags;');
const salvaDalVisualizzatore = (app, nome, tags) => {
    app.modifica(nome, tags);
    fabbricaVisualizzatore({ current: false }, (fn) => { app.stato.images = typeof fn === 'function' ? fn(app.stato.images) : fn; })(app.foto(nome).id, tags);
};

console.log('\n--- .txt scritto davvero con lo stesso contenuto dell\'import: la regola di sempre torna ---');
{
    // ITALIANO: trigger "ohwx" prima dell'import, b.txt non letto. Il visualizzatore scrive
    //           "ohwx, cat", poi "ohwx," (uguale al ricordo dell'import), poi la trigger diventa
    //           "sks": b.txt va riscritto come gli altri, non lasciato con "ohwx" senza avviso.
    // ENGLISH: trigger "ohwx" before the import, b.txt unread. The viewer writes "ohwx, cat", then
    //          "ohwx," (equal to the import's record), then the trigger becomes "sks": b.txt must be
    //          rewritten like the others, not left with "ohwx" without a notice.
    const app = await creaApp(['ohwx']);
    salvaDalVisualizzatore(app, 'b.png', ['ohwx', 'cat']);
    salvaDalVisualizzatore(app, 'b.png', ['ohwx']);
    app.trigger(['sks']);
    dice('la X della finestra la conta fra le modifiche non salvate', true, G.modificheNonSalvate([app.foto('b.png')], app.stato.trigger));
    dice('"Salva" scrive anche b.txt con la trigger nuova', ['b.png', 'c.png'], await app.salva());
}
{
    // ITALIANO: senza trigger: il visualizzatore svuota b.txt (uguale al ricordo dell'import, []),
    //           poi sulla card si aggiunge "dog": "Salva" lo scrive.
    // ENGLISH: no trigger: the viewer empties b.txt (equal to the import's record, []), then "dog"
    //          is added on the card: "Save" writes it.
    const app = await creaApp([]);
    salvaDalVisualizzatore(app, 'b.png', []);
    app.modifica('b.png', ['dog']);
    dice('b.txt svuotato dal visualizzatore, poi "dog": "Salva" lo scrive', ['b.png'], await app.salva());
}
{
    // ITALIANO: l'editor dei file di tag scrive b.txt con le sole trigger (uguale al ricordo dell'import).
    // ENGLISH: the tag file editor writes b.txt with the triggers only (equal to the import's record).
    const app = await creaApp(['ohwx']);
    app.stato.images = app.stato.images.map(i => i.file.name === 'b.png' ? { ...i, ...S.tagDopoEditor(i.tags, i.originalTags, ['ohwx'], ['ohwx'], i.baseTxtNonLetto) } : i);
    app.trigger(['sks']);
    dice('dopo l\'editor, la trigger nuova: "Salva" scrive anche b.txt', ['b.png', 'c.png'], await app.salva());
}
{
    // ITALIANO: Ctrl+Z fino al passo dell'import dopo le scritture: il .txt resta noto.
    // ENGLISH: Ctrl+Z back to the import step after the writes: the .txt stays known.
    const app = await creaApp(['ohwx']);
    const passoImport = app.stato.images;
    salvaDalVisualizzatore(app, 'b.png', ['ohwx', 'cat']);
    salvaDalVisualizzatore(app, 'b.png', ['ohwx']);
    const disco = new Map(app.stato.images.map(i => [i.id, i.originalTags]));
    app.stato.images = H.withLiveOriginalTags(passoImport, disco);
    app.trigger(['sks']);
    dice('Ctrl+Z dopo le scritture, poi la trigger nuova: "Salva" scrive anche b.txt', ['b.png', 'c.png'], await app.salva());
}
{
    // ITALIANO: una copia della foto senza scrittura (come "Ripristina tutte") non chiude l'eccezione.
    // ENGLISH: a copy of the photo with no write (like "Restore all") does not end the exemption.
    const app = await creaApp(['ohwx']);
    app.stato.images = app.stato.images.map(i => ({ ...i }));
    app.trigger(['sks']);
    dice('copia senza scrittura: b.txt non letto resta fuori da "Salva"', ['c.png'], await app.salva());
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const app = await creaApp([]);
    app.trigger(['ohwx']);
    app.modifica('b.png', ['ohwx', 'cat']);
    // ITALIANO: la foto risulta da salvare, ma "Salva" non scrive sopra il .txt mai letto (vedi
    //           test-unread-txt-bulk.mjs): per sostituirlo apposta c'e' il visualizzatore.
    // ENGLISH: the photo counts as unsaved, but "Save" does not write over the .txt never read (see
    //          test-unread-txt-bulk.mjs): the viewer is there to replace it on purpose.
    dice('un tag messo apposta: Salva scrive solo il .txt letto', ['c.png'], await app.salva());
    dice('...e "Chiudi progetto" lo dice', 'tre scelte', app.chiudiProgetto());
}
{
    const app = await creaApp([], leggibile('b.txt', 'red hat,'));
    app.trigger(['ohwx']);
    dice('.txt letto: la trigger scritta dopo si salva come sempre', ['b.png', 'c.png'], await app.salva());
}
{
    // ITALIANO: Ctrl+Z dopo il cambio di trigger: il passo dell'import torna col ricordo del disco
    //           di adesso (withLiveOriginalTags), e la foto col .txt non letto resta fuori da Salva.
    // ENGLISH: Ctrl+Z after the trigger change: the import step comes back with today's disk
    //          record (withLiveOriginalTags), and the photo with the unread .txt stays out of Save.
    const app = await creaApp(['ohwx']);
    const passoImport = app.stato.images;
    app.trigger([]);
    const disco = new Map(app.stato.images.map(i => [i.id, i.originalTags]));
    app.stato.images = H.withLiveOriginalTags(passoImport, disco);
    app.stato.trigger = ['ohwx'];
    dice('Ctrl+Z dopo aver tolto la trigger: si salva solo il .txt letto', ['c.png'], await app.salva());
}
{
    // ITALIANO: la foto modificata apposta e salvata: il suo .txt ora e' noto. Un Ctrl+Z oltre il
    //           salvataggio torna a un passo diverso dal disco, e Salva lo scrive come sempre.
    // ENGLISH: the photo edited on purpose and saved: its .txt is now known. A Ctrl+Z past the save
    //          goes back to a step different from the disk, and Save writes it as always.
    const app = await creaApp([]);
    const passoImport = app.stato.images;
    app.modifica('b.png', ['cat']);
    app.stato.images = app.stato.images.map(i => i.file.name === 'b.png' ? { ...i, originalTags: ['cat'] } : i);
    const disco = new Map(app.stato.images.map(i => [i.id, i.originalTags]));
    app.stato.images = H.withLiveOriginalTags(passoImport, disco);
    dice('salvata e poi Ctrl+Z: Salva riscrive il .txt (ora noto)', ['b.png'], await app.salva());
}

process.exit(esito());
