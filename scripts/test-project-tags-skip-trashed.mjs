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

// ITALIANO: "Pulisci inutilizzati" deve usare la stessa regola. Un tag aggiunto a mano al progetto e
//           usato solo da una foto nel cestino ha 0 usi nelle Statistiche e non viene dalle foto in
//           galleria: il pulsante diceva "Completato" ma lo lasciava nell'elenco, nella tavolozza
//           della selezione in blocco e nell'export.
// ENGLISH: "Clean unused" must use the same rule. A tag added to the project by hand and used only
//          by a photo in the trash has 0 uses in the Statistics and does not come from the gallery
//          photos: the button said "Completed" but left it in the list, the bulk palette and the export.
const iPulisci = s.indexOf('    const handleCleanUnusedTags = () => {');
const finePulisci = /\r?\n    \};\r?\n/g;
finePulisci.lastIndex = Math.max(iPulisci, 0);
const fPulisci = iPulisci < 0 ? null : finePulisci.exec(s);
dice('premessa: "Pulisci inutilizzati" si trova in src/App.tsx', true, Boolean(fPulisci));
const codicePulisci = (await esbuild.transform(s.slice(iPulisci, fPulisci.index + fPulisci[0].length), { loader: 'ts' })).code;
const pulisci = (images, progetto) => {
    let tag = [...progetto];
    const avvisi = [];
    new Function('images', 'setCustomProjectTags', 'showNotification', 't', 'soundManager', codicePulisci + '\nreturn handleCleanUnusedTags;')(
        images, (f) => { tag = typeof f === 'function' ? f(tag) : f; }, (m, tipo) => avvisi.push([m, tipo]), { completed: 'Completed' }, { pop() { } })();
    return { tag, avvisi, elenco: calcola(images, tag) };
};
const conCestino = [
    { id: 'a', tags: ['smile'], isTrashed: false },
    { id: 'p', tags: ['beach', 'smile'], isTrashed: true },
];
const r1 = pulisci(conCestino, ['beach', 'smile']);
dice('"beach", usato solo dalla foto nel cestino, esce dai tag del progetto', ['smile'], r1.tag);
dice('...e dall\'elenco del progetto', ['smile'], r1.elenco);
dice('...con il messaggio verde', [['Completed', 'success']], r1.avvisi);
dice('un tag del progetto usato da una foto in galleria resta', ['beach', 'smile'],
    pulisci(conCestino.map(f => ({ ...f, isTrashed: false })), ['beach', 'smile']).tag);
dice('un tag del progetto che nessuna foto usa esce come prima', ['smile'], pulisci(conCestino, ['mai usato', 'smile']).tag);
const dopoPulizia = pulisci(conCestino, ['beach']).tag;
dice('ripristinata la foto dopo la pulizia, "beach" torna nell\'elenco dalla foto stessa', ['beach', 'smile'],
    calcola(conCestino.map(f => ({ ...f, isTrashed: false })), dopoPulizia));
process.exit(esito());
