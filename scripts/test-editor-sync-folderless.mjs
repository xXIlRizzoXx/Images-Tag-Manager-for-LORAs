/* ITALIANO: PROVA DELL'EDITOR DEI FILE DI TAG SUL .txt DI UNA FOTO SENZA CARTELLA
   Le foto caricate con "Carica immagini" o trascinate non hanno una cartella del progetto (niente
   handle): quando l'editor salvava il loro .txt, il progetto non le allineava. La galleria restava
   coi tag vecchi e, alla prima modifica di quella foto (una trigger, un'aggiunta in blocco), "Salva"
   riscriveva il .txt coi tag vecchi: quelli scritti nell'editor sparivano senza avviso.
   Ora, in Electron, per una foto senza cartella col nome giusto si rilegge il SUO .txt dal suo
   percorso vero (lo stesso canale dell'import): se sul disco c'e' altro rispetto a quello che il
   progetto sa, la foto si allinea come quelle con la cartella (le modifiche non salvate della card
   restano sopra). Una foto omonima di un'altra cartella, col suo .txt invariato, non si tocca.
   Si esegue il testo VERO di handleTagEditorSaved preso da src/App.tsx, con le regole vere di
   src/utils/sidecarTags.ts (compilati con esbuild) e un electronAPI finto.
   Uso:  node scripts/test-editor-sync-folderless.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE TAG FILE EDITOR ON THE .txt OF A PHOTO WITH NO FOLDER
   Photos loaded with "Load images" or dropped in have no project folder (no handle): when the editor
   saved their .txt, the project did not sync them. The gallery kept the old tags and, at the first
   edit of that photo (a trigger, a bulk addition), "Save" rewrote the .txt with the old tags: the
   ones written in the editor were gone with no notice.
   Now, in Electron, for a folder-less photo with the right name its OWN .txt is read again from its
   real path (the same channel as the import): if the disk holds something else than what the
   project knows, the photo syncs like those with a folder (the card's unsaved edits stay on top). A
   same-named photo from another folder, with its .txt unchanged, is left alone.
   The REAL text of handleTagEditorSaved taken from src/App.tsx is run, with the real rules of
   src/utils/sidecarTags.ts (compiled with esbuild) and a fake electronAPI.
   Usage:  node scripts/test-editor-sync-folderless.mjs      (exits with code 1 if anything is off) */

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

// ITALIANO: il disco finto: percorso della foto -> testo del suo .txt (null = .txt illeggibile).
// ENGLISH: the fake disk: photo path -> text of its .txt (null = unreadable .txt).
const creaApi = (disco) => {
    const api = { letture: [] };
    api.getPathForFile = (file) => file.percorso || '';
    api.readSidecarTags = async (percorsi) => {
        api.letture.push(...percorsi);
        return percorsi.filter(p => p in disco).map(p => {
            const nome = path.win32.basename(p, path.win32.extname(p)) + '.txt';
            const dir = path.win32.dirname(p);
            return disco[p] === null ? { name: nome, dir, skipped: true } : { name: nome, content: disco[p], dir };
        });
    };
    return api;
};
const salvaNellEditor = async (images, nome, nuovi, { api, trigger = [], handle } = {}) => {
    let stato = images;
    const finestra = api ? { electronAPI: api } : {};
    const f = new Function('images', 'setImages', 'globalTriggers', 'tagDopoEditor', 'window', 'parseSidecarText', codice + '\nreturn handleTagEditorSaved;')(
        images, (agg) => { stato = typeof agg === 'function' ? agg(stato) : agg; }, trigger, S.tagDopoEditor, finestra, S.parseSidecarText);
    await f(nome, nuovi, handle || { name: nome, isSameEntry: async () => false });
    return stato;
};
const foto = (id, nome, percorso, tags, originalTags = tags) => ({ id, file: { name: nome, percorso }, dirHandle: null, filePath: percorso, tags, originalTags });

console.log('\n--- a.png caricata con "Carica immagini", a.txt salvato nell\'editor ---');
{
    const api = creaApi({ 'E:\\foto\\a.png': 'smile, hat, red dress,' });
    const dopo = await salvaNellEditor([foto('p1', 'a.png', 'E:\\foto\\a.png', ['smile', 'hat'])], 'a.txt', ['smile', 'hat', 'red dress'], { api });
    dice('la foto prende il .txt scritto (tags e originalTags): un Salva dopo non lo riscrive coi tag vecchi',
        [['smile', 'hat', 'red dress'], ['smile', 'hat', 'red dress']], [dopo[0].tags, dopo[0].originalTags]);
    const conCard = await salvaNellEditor([foto('p1', 'a.png', 'E:\\foto\\a.png', ['smile', 'hat', 'blue eyes'], ['smile', 'hat'])], 'A.TXT', ['smile', 'hat', 'red dress'], { api });
    dice('una modifica non salvata della card resta sopra il file, e la foto resta da salvare',
        [['smile', 'hat', 'red dress', 'blue eyes'], ['smile', 'hat', 'red dress']], [conCard[0].tags, conCard[0].originalTags]);
    const conTrigger = await salvaNellEditor([foto('p1', 'a.png', 'E:\\foto\\a.png', ['ohwx', 'smile', 'hat'], ['smile', 'hat'])], 'a.txt', ['smile', 'hat', 'red dress'], { api, trigger: ['ohwx'] });
    dice('una trigger ancora da salvare resta davanti e fuori dal disco', [['ohwx', 'smile', 'hat', 'red dress'], ['smile', 'hat', 'red dress']],
        [conTrigger[0].tags, conTrigger[0].originalTags]);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const api = creaApi({ 'E:\\foto\\a.png': 'smile, hat, red dress,', 'E:\\altra\\a.png': 'x,' });
    const due = await salvaNellEditor([foto('p1', 'a.png', 'E:\\foto\\a.png', ['smile', 'hat']), foto('q1', 'a.png', 'E:\\altra\\a.png', ['x'])],
        'a.txt', ['smile', 'hat', 'red dress'], { api });
    dice('la foto omonima di un\'altra cartella, col .txt invariato, resta com\'era', [['x'], ['x']], [due[1].tags, due[1].originalTags]);
    dice('...e quella giusta si allinea', ['smile', 'hat', 'red dress'], due[0].tags);
    const altra = await salvaNellEditor([foto('p2', 'b.png', 'E:\\foto\\b.png', ['y'])], 'a.txt', ['nuovo'], { api });
    dice('una foto con un altro nome: non si legge niente e resta com\'era', [['y'], 0], [altra[0].tags, api.letture.filter(p => p.endsWith('b.png')).length]);
    const json = creaApi({ 'E:\\foto\\a.png': 'smile, hat, red dress,' });
    const conJson = await salvaNellEditor([foto('p1', 'a.png', 'E:\\foto\\a.png', ['smile', 'hat'])], 'a.json', ['smile', 'hat', 'red dress'], { api: json });
    dice('un a.json salvato: nessuna lettura e la foto resta com\'era', [['smile', 'hat'], 0], [conJson[0].tags, json.letture.length]);
    const illeggibile = creaApi({ 'E:\\foto\\a.png': null });
    const saltato = await salvaNellEditor([foto('p1', 'a.png', 'E:\\foto\\a.png', ['smile', 'hat'])], 'a.txt', ['smile'], { api: illeggibile });
    dice('il .txt non si rilegge (bloccato): la foto resta com\'era', ['smile', 'hat'], saltato[0].tags);
    const browser = await salvaNellEditor([foto('p1', 'a.png', '', ['smile', 'hat'])], 'a.txt', ['smile', 'hat', 'red dress'], {});
    dice('anteprima del browser (niente electronAPI): niente errori e la foto resta com\'era', ['smile', 'hat'], browser[0].tags);
    // ITALIANO: una foto CON la cartella si allinea per identita' (isSameEntry), senza leggere niente dal disco.
    // ENGLISH: a photo WITH a folder syncs by identity (isSameEntry), without reading anything from disk.
    const entrata = {};
    const dir = { getFileHandle: async (n) => ({ name: n, _e: entrata }) };
    const conCartella = creaApi({});
    const fc = await salvaNellEditor([{ id: 'c1', file: { name: 'a.png' }, dirHandle: dir, tags: ['v'], originalTags: ['v'] }], 'a.txt', ['n'],
        { api: conCartella, handle: { name: 'a.txt', isSameEntry: async (h) => !!h && h._e === entrata } });
    dice('foto con la cartella: si allinea come prima, senza letture', [['n'], 0], [fc[0].tags, conCartella.letture.length]);
}

process.exit(esito());
