/* ITALIANO: PROVA DELLE TRIGGER WORD CAMBIATE MENTRE UN IMPORT E' IN CORSO
   Un import lungo (migliaia di foto) mostra solo la barra di avanzamento e lascia libero il resto
   della finestra. Scrivendo la trigger "ohwx" in quel momento, le foto gia' caricate la ricevevano,
   ma quelle dell'import in corso arrivavano costruite con le trigger di quando si era premuto
   Importa (nessuna): i loro .txt si salvavano senza la trigger che il riquadro mostrava attiva. Al
   contrario, togliendo una trigger durante l'import, le foto nuove la tenevano e "Salva" la
   scriveva. L'import ora legge le trigger di ADESSO, nel momento in cui costruisce le foto.
   Si eseguono i testi VERI di processImportData e handleGlobalTagsChange presi da src/App.tsx
   (compilati con esbuild), con le regole vere di src/utils/ e una miniatura finta che aspetta.
   Uso:  node scripts/test-trigger-during-import.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF TRIGGER WORDS CHANGED WHILE AN IMPORT IS RUNNING
   A long import (thousands of photos) only shows the progress bar and leaves the rest of the
   window usable. Typing the trigger "ohwx" at that moment gave it to the photos already loaded,
   but those of the running import arrived built with the triggers of the moment Import was pressed
   (none): their .txt files were saved without the trigger the box showed as active. Conversely,
   removing a trigger during the import left it on the new photos and "Save" wrote it. The import
   now reads the CURRENT triggers, at the moment it builds the photos.
   The REAL text of processImportData and handleGlobalTagsChange taken from src/App.tsx is run
   (compiled with esbuild), with the real rules of src/utils/ and a fake thumbnail that waits.
   Usage:  node scripts/test-trigger-during-import.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
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
    'folderInputRef', 'console'];
const fabbrica = new Function(...NOMI,
    (await ritaglia('    const processImportData = async (')) + '\n' + (await ritaglia('    const handleGlobalTagsChange = (')) +
    '\nreturn { processImportData, handleGlobalTagsChange };');

// ITALIANO: un import di b.png e c.png (con i loro .txt) iniziato con le trigger `prima`; mentre le
//           miniature sono in corso l'utente cambia il riquadro in `dopo`. Torna i tag delle foto.
// ENGLISH: an import of b.png and c.png (with their .txt) started with the triggers `prima`; while
//          the thumbnails are running the user changes the box to `dopo`. Returns the photos' tags.
const importaCambiando = async (prima, dopo) => {
    const stato = { images: [{ id: 'a', file: { name: 'a.png' }, tags: [...prima, 'smile'], originalTags: ['smile'] }], trigger: prima };
    const ref = { current: prima };
    let apri;
    const cancello = new Promise(ok => { apri = ok; });
    let id = 0;
    // ITALIANO: un "render": funzioni nuove che vedono lo stato di quel momento, e la ref aggiornata
    //           come fa App.tsx a ogni render.
    // ENGLISH: a "render": new functions that see the state of that moment, and the ref updated as
    //          App.tsx does on every render.
    const render = () => {
        ref.current = stato.trigger;
        return fabbrica(stato.trigger, ref, stato.images,
            (fn) => { stato.images = typeof fn === 'function' ? fn(stato.images) : fn; },
            (v) => { stato.trigger = typeof v === 'function' ? v(stato.trigger) : v; }, C.uniqueTagsIgnoringCase,
            () => { }, () => { }, () => { }, () => { }, B.folderSignature, () => 'id' + (++id), B.backupDellImport,
            { getItem: () => null }, S.makeFolderKeyer, () => (f) => 'dataset\x1f' + f.name, 1024 * 1024, S.parseSidecarText,
            async () => { await cancello; return { url: 'blob:finto', width: 1, height: 1 }; }, S.tagDiImport,
            B.tagDaRipristinare, () => null, { current: new Set() }, { chime() { } }, N.avvisoImport, t, () => { },
            { current: null }, { log() { }, warn() { }, error() { } });
    };
    const txt = (name, testo) => ({ name, size: testo.length, lastModified: 0, text: async () => testo });
    const inCorso = render().processImportData([{ name: 'b.png' }, { name: 'c.png' }], [txt('b.txt', 'red hat,'), txt('c.txt', 'blue sky,')]);
    await new Promise(ok => setTimeout(ok, 350));
    render().handleGlobalTagsChange(dopo);
    render();
    apri();
    await inCorso;
    return Object.fromEntries(stato.images.map(i => [i.file.name, { tags: i.tags, originalTags: i.originalTags }]));
};

console.log('\n--- la trigger "ohwx" scritta mentre l\'import e\' in corso ---');
{
    const r = await importaCambiando([], ['ohwx']);
    dice('la foto gia\' caricata la riceve, come prima', ['ohwx', 'smile'], r['a.png'].tags);
    dice('le foto dell\'import in corso la ricevono davanti', [['ohwx', 'red hat'], ['ohwx', 'blue sky']], [r['b.png'].tags, r['c.png'].tags]);
    dice('...e "Salva modifiche" la scrive (il disco non ce l\'ha)', ['red hat'], r['b.png'].originalTags);
}

console.log('\n--- la trigger "ohwx" tolta mentre l\'import e\' in corso ---');
{
    const r = await importaCambiando(['ohwx'], []);
    dice('le foto dell\'import in corso non la ricevono', [['red hat'], ['blue sky']], [r['b.png'].tags, r['c.png'].tags]);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const r = await importaCambiando(['ohwx'], ['ohwx']);
    dice('trigger invariata: le foto importate la ricevono davanti', [['ohwx', 'red hat'], ['ohwx', 'blue sky']], [r['b.png'].tags, r['c.png'].tags]);
}

process.exit(esito());
