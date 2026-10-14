/* ITALIANO: PROVA DELL'EDITOR DEI FILE DI TAG CON NOMI CHE DIFFERISCONO SOLO PER LE MAIUSCOLE
   L'import abbina IMG_001.JPG e img_001.txt senza guardare le maiuscole, come Windows. Salvando
   img_001.txt nell'editor dei file di tag, pero', la foto non veniva aggiornata: il confronto dei
   nomi teneva conto delle maiuscole ('IMG_001' contro 'img_001'). La foto restava coi tag
   vecchi, e il "Salva modifiche" successivo riscriveva IMG_001.txt, che su NTFS E' img_001.txt,
   cancellando in silenzio quello che si era scritto nell'editor.
   Si esegue il testo VERO di handleTagEditorSaved preso da src/App.tsx, con una cartella finta
   che, come NTFS, trova i file senza guardare le maiuscole.
   Uso:  node scripts/test-editor-sync-case.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE TAG FILE EDITOR WITH NAMES THAT DIFFER ONLY IN CASE
   The import pairs IMG_001.JPG and img_001.txt ignoring case, as Windows does. Saving img_001.txt
   in the tag file editor, though, did not update the photo: the name comparison was case-
   sensitive ('IMG_001' against 'img_001'). The photo kept its old tags, and the next "Save changes"
   rewrote IMG_001.txt, which on NTFS IS img_001.txt, silently wiping what was written in the editor.
   The REAL text of handleTagEditorSaved taken from src/App.tsx is run, with a fake folder that,
   like NTFS, finds files ignoring case.
   Usage:  node scripts/test-editor-sync-case.mjs      (exits with code 1 if anything is off) */

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
fine.lastIndex = inizio;
const trovata = inizio >= 0 ? fine.exec(sorgente) : null;
if (!trovata) { console.log('NO  handleTagEditorSaved non trovato in src/App.tsx'); process.exit(1); }
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
// ITALIANO: l'editor salva `nome` nella cartella `dir`: si vede com'e' la foto dopo.
// ENGLISH: the editor saves `name` in folder `dir`: see how the photo looks afterwards.
const salvaNellEditor = async (images, nome, nuovi, dir) => {
    let stato = images;
    const f = new Function('images', 'setImages', 'globalTriggers', codice + '\nreturn handleTagEditorSaved;')(
        images, (agg) => { stato = typeof agg === 'function' ? agg(stato) : agg; }, []);
    await f(nome, nuovi, dir.handle(nome));
    return stato;
};
const foto = (id, nome, dir) => ({ id, file: { name: nome }, dirHandle: dir, tags: ['vecchio'], originalTags: ['vecchio'] });

console.log('\n--- IMG_001.JPG con img_001.txt ---');
{
    const dir = cartella(['IMG_001.JPG', 'img_001.txt']);
    const dopo = await salvaNellEditor([foto('p1', 'IMG_001.JPG', dir)], 'img_001.txt', ['nuovo', 'dall editor'], dir);
    dice('la foto prende i tag salvati nell\'editor (tags e originalTags)', [['nuovo', 'dall editor'], ['nuovo', 'dall editor']], [dopo[0].tags, dopo[0].originalTags]);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const dir = cartella(['IMG_001.JPG', 'IMG_001.txt']);
    const dopo = await salvaNellEditor([foto('p1', 'IMG_001.JPG', dir)], 'IMG_001.txt', ['nuovo'], dir);
    dice('stesse maiuscole: la foto si aggiorna', ['nuovo'], dopo[0].tags);
    // ITALIANO: una foto omonima in un'ALTRA cartella non e' toccata (isSameEntry la protegge).
    // ENGLISH: a same-named photo in ANOTHER folder is left alone (isSameEntry protects it).
    const altra = cartella(['IMG_001.JPG', 'img_001.txt']);
    const dirEditor = cartella(['img_001.txt']);
    const omonima = await salvaNellEditor([foto('q1', 'IMG_001.JPG', altra)], 'img_001.txt', ['nuovo'], dirEditor);
    dice('foto omonima in un\'altra cartella: resta com\'era', ['vecchio'], omonima[0].tags);
    const diversa = await salvaNellEditor([foto('p2', 'IMG_002.JPG', dir)], 'img_001.txt', ['nuovo'], cartella(['IMG_002.JPG', 'img_001.txt']));
    dice('un\'altra foto della stessa cartella: resta com\'era', ['vecchio'], diversa[0].tags);
}

process.exit(esito());
