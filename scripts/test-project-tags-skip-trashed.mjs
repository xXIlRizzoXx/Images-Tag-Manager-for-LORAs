/* ITALIANO: PROVA CHE I TAG DEL PROGETTO NON CONTINO LE FOTO NEL CESTINO
   L'elenco "tutti i tag del progetto" (pannello, export JSON/TXT, tavolozza della selezione in
   blocco, editor) metteva insieme i tag di TUTTE le foto, anche quelle nel cestino dell'app: una
   foto scartata dal dataset continuava a portare il suo vocabolario nell'export. Ora conta solo le
   foto in galleria (piu' i tag aggiunti a mano al progetto). Si esegue il pezzo VERO di src/App.tsx.
   Uso:  node scripts/test-project-tags-skip-trashed.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST THAT THE PROJECT TAGS DO NOT COUNT THE PHOTOS IN THE TRASH
   The "all project tags" list (panel, JSON/TXT export, bulk palette, editor) gathered the tags of
   ALL photos, those in the app's trash too: a photo dropped from the dataset kept carrying its
   vocabulary into the export. It now counts only the photos in the gallery (plus the tags added to
   the project by hand). The REAL piece of src/App.tsx runs. */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const s = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const inizio = s.indexOf('    const allUniqueTags = useMemo(() => {');
const fine = s.indexOf('}, [images, customProjectTags]);', inizio);
dice('premessa: il calcolo si trova in src/App.tsx', true, inizio > 0 && fine > inizio);
const codice = (await esbuild.transform(s.slice(inizio, fine) + '}, [images, customProjectTags]);', { loader: 'ts' })).code;
const calcola = (images, customProjectTags) => new Function('useMemo', 'images', 'customProjectTags', codice + '\nreturn allUniqueTags;')((f) => f(), images, customProjectTags);

const foto = [
    { id: 'a', tags: ['smile', 'red dress'], isTrashed: false },
    { id: 'b', tags: ['blurry', 'smile'], isTrashed: true },
];
dice('i tag della foto nel cestino ("blurry") non ci sono', ['custom tag', 'red dress', 'smile'], calcola(foto, ['custom tag']));
dice('ripristinata la foto, tornano', ['blurry', 'red dress', 'smile'], calcola(foto.map(f => ({ ...f, isTrashed: false })), []));
process.exit(esito());
