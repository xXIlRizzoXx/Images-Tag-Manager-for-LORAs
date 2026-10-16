/* ITALIANO: PROVA DEL "SALVA COME .json" DELL'EDITOR DEI FILE DI TAG ACCANTO A UNA FOTO
   L'editor salva anche in JSON. Salvando img_001.json nella cartella della foto img_001.png, la foto
   veniva "allineata" lo stesso: si confrontava solo il nome senza estensione, e l'identita' del file
   (isSameEntry) la provava proprio il .json appena scritto. La foto prendeva i tag del JSON sia come
   tag sia come disco: risultava salvata, "Salva" rispondeva "Nessuna modifica", ma img_001.txt
   (quello che Kohya legge) restava senza i tag nuovi. Ora si allinea solo il .txt della foto.
   Si esegue il testo VERO di handleTagEditorSaved preso da src/App.tsx, con la regola vera di
   src/utils/sidecarTags.ts (compilati con esbuild), su una cartella finta.
   Uso:  node scripts/test-tag-editor-saved-json.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE TAG FILE EDITOR'S "SAVE AS .json" NEXT TO A PHOTO
   The editor saves JSON too. Saving img_001.json in the folder of the photo img_001.png still
   "synced" the photo: only the name without extension was compared, and the file identity
   (isSameEntry) was proven by the very .json just written. The photo took the JSON's tags both as
   tags and as disk: it counted as saved, "Save" answered "No changes", but img_001.txt (the one Kohya
   reads) stayed without the new tags. Now only the photo's .txt syncs.
   The REAL text of handleTagEditorSaved taken from src/App.tsx is run, with the real rule of
   src/utils/sidecarTags.ts (compiled with esbuild), on a fake folder.
   Usage:  node scripts/test-tag-editor-saved-json.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const inizio = sorgente.indexOf('    const handleTagEditorSaved = async ');
const fine = /\r?\n    \};\r?\n/g;
fine.lastIndex = Math.max(inizio, 0);
const trovata = inizio >= 0 ? fine.exec(sorgente) : null;
if (!trovata) { console.log('NO  handleTagEditorSaved non trovato in src/App.tsx'); process.exit(1); }
const uscita = await esbuild.build({
    entryPoints: [path.join(radice, 'src/utils/sidecarTags.ts')],
    bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
});
const S = await import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));
const codice = (await esbuild.transform(sorgente.slice(inizio, trovata.index + trovata[0].length), { loader: 'ts' })).code;

// ITALIANO: una cartella finta come NTFS: ogni file e' un'"entrata" unica, trovata senza maiuscole.
// ENGLISH: a fake NTFS-like folder: each file is one "entry", found ignoring case.
const cartella = (nomiSuDisco) => {
    const entrate = new Map(nomiSuDisco.map(n => [n.toLowerCase(), { n }]));
    const handle = (nome) => {
        const e = entrate.get(nome.toLowerCase());
        if (!e) throw new DOMException('not found', 'NotFoundError');
        return { name: nome, _e: e, isSameEntry: async (altro) => !!altro && altro._e === e };
    };
    return { getFileHandle: async (nome) => handle(nome), handle };
};
const salvaNellEditor = async (images, nome, nuovi, dir) => {
    let stato = images;
    const f = new Function('images', 'setImages', 'globalTriggers', 'tagDopoEditor', 'window', 'parseSidecarText', codice + '\nreturn handleTagEditorSaved;')(
        images, (agg) => { stato = typeof agg === 'function' ? agg(stato) : agg; }, [], S.tagDopoEditor, {}, S.parseSidecarText);
    await f(nome, nuovi, dir.handle(nome));
    return stato;
};
const foto = (nome, dir) => ({ id: nome, file: { name: nome }, dirHandle: dir, tags: ['hat', 'smile'], originalTags: ['hat', 'smile'] });
const NUOVI = ['hat', 'smile', 'red dress'];

console.log('\n--- img_001.json salvato nella cartella di img_001.png ---');
{
    const dir = cartella(['img_001.png', 'img_001.txt', 'img_001.json']);
    const dopo = await salvaNellEditor([foto('img_001.png', dir)], 'img_001.json', NUOVI, dir);
    dice('la foto resta com\'era: il suo .txt non e\' stato scritto', [['hat', 'smile'], ['hat', 'smile']], [dopo[0].tags, dopo[0].originalTags]);
    const dir2 = cartella(['img_001.png', 'img_001.txt', 'img_001.JSON']);
    const dopo2 = await salvaNellEditor([foto('img_001.png', dir2)], 'img_001.JSON', NUOVI, dir2);
    dice('...anche con l\'estensione in maiuscolo', ['hat', 'smile'], dopo2[0].tags);
}

console.log('\n--- quello che NON deve cambiare ---');
for (const [titolo, fotoNome, salvato] of [
    ['img_001.txt della foto img_001.png', 'img_001.png', 'img_001.txt'],
    ['IMG_001.TXT della foto img_001.png', 'img_001.png', 'IMG_001.TXT'],
    ['img_001.txt della foto IMG_001.JPG', 'IMG_001.JPG', 'img_001.txt'],
]) {
    const dir = cartella([fotoNome, salvato, 'img_001.json']);
    const dopo = await salvaNellEditor([foto(fotoNome, dir)], salvato, NUOVI, dir);
    dice(titolo + ': la foto prende i tag salvati', [NUOVI, NUOVI], [dopo[0].tags, dopo[0].originalTags]);
}

process.exit(esito());
