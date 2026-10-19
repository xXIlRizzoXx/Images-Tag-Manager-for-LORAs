/* ITALIANO: PROVA DEI TAG DEL PROGETTO CHE DIFFERISCONO SOLO PER LE MAIUSCOLE
   La casella "aggiungi al progetto" rifiuta un tag che il progetto ha gia' con un'altra grafia
   ("Smile" accanto a "smile"). Tre altre strade invece lo aggiungevano: l'import di un elenco
   (Gestione tag -> Importa), i tag aperti nell'editor dei file di tag e i tag suggeriti nel
   visualizzatore. Con il progetto [smile, Blue Eyes] e il file "Smile, blue eyes, smile, SMILE"
   l'elenco diventava smile, Blue Eyes, Smile, blue eyes, SMILE, e l'avviso verde diceva
   "Tag importati nel progetto (4)" anche se non era entrato nessun tag nuovo. Ora entrano solo i
   tag nuovi a parte le maiuscole, l'avviso conta solo quelli, e se non ce n'e' nessuno lo dice.
   Si eseguono i testi VERI di handleImportProjectTags e delle due funzioni passate a TagFileEditor
   (onImportTagsToProject) e a Lightbox (addProjectTag) in src/App.tsx, con il vero tagCase.ts.
   Casi vicini che non devono cambiare: un tag davvero nuovo entra con la grafia del file, un tag
   gia' presente con la stessa grafia non si ripete.
   Uso:  node scripts/test-project-tags-import-case.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF PROJECT TAGS THAT DIFFER ONLY BY CASE
   The "add to project" box refuses a tag the project already has with another spelling ("Smile"
   next to "smile"). Three other roads added it instead: importing a list (Tag manager -> Import),
   the tags opened in the tag file editor and the tags suggested in the viewer. With the project
   [smile, Blue Eyes] and the file "Smile, blue eyes, smile, SMILE" the list became smile, Blue Eyes,
   Smile, blue eyes, SMILE, and the green notice said "Tags imported into the project (4)" although
   no new tag went in. Now only the tags new apart from case go in, the notice counts only those, and
   if there are none it says so.
   The REAL text of handleImportProjectTags and of the two functions handed to TagFileEditor
   (onImportTagsToProject) and to Lightbox (addProjectTag) in src/App.tsx runs, with the real tagCase.ts.
   Neighbouring cases that must not change: a really new tag goes in with the file's spelling, a tag
   already there with the same spelling is not repeated.
   Usage:  node scripts/test-project-tags-import-case.mjs      (exits with code 1 if anything is off) */

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
const TC = await carica('src/utils/tagCase.ts');
const lingue = (await carica('src/constants.ts')).translations;
const t = lingue.en;
const { dice, esito } = creaControlli();

const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const inizio = sorgente.indexOf('    const handleImportProjectTags = async (e: any) => {');
const chiusura = /\r?\n    \};\r?\n/g;
chiusura.lastIndex = Math.max(inizio, 0);
const fine = inizio < 0 ? null : chiusura.exec(sorgente);
if (inizio < 0 || !fine) {
    console.log('NO  handleImportProjectTags non trovato in src/App.tsx');
    process.exit(1);
}
const js = (await esbuild.transform(sorgente.slice(inizio, fine.index + fine[0].length), { loader: 'ts' })).code;
const NOMI = ['t', 'showNotification', 'setCustomProjectTags', 'soundManager', 'projectTagsImportRef', 'pulisciTagProgetto', 'leggiTestoSidecar',
    'allUniqueTags', 'hasTagIgnoringCase', 'uniqueTagsIgnoringCase'];
const fabbrica = new Function(...NOMI, js + '\nreturn handleImportProjectTags;');

// ITALIANO: `palette` = i tag aggiunti al progetto (customProjectTags); `sulleFoto` = i tag delle foto.
//           allUniqueTags, come in App.tsx, e' l'unione dei due.
// ENGLISH: `palette` = the tags added to the project (customProjectTags); `sulleFoto` = the photos' tags.
//          allUniqueTags, as in App.tsx, is the union of the two.
const tutti = (palette, sulleFoto) => [...new Set([...sulleFoto, ...palette])].sort((a, b) => a.localeCompare(b));
const importa = async (testo, palette = [], sulleFoto = []) => {
    const r = { palette: [...palette], notifiche: [] };
    const fn = fabbrica(t, (m, tipo) => r.notifiche.push([m, tipo]), (f) => { r.palette = typeof f === 'function' ? f(r.palette) : f; },
        { chime() { } }, { current: { value: 'x' } }, S.pulisciTagProgetto, S.leggiTestoSidecar, tutti(palette, sulleFoto), TC.hasTagIgnoringCase, TC.uniqueTagsIgnoringCase);
    await fn({ target: { files: [{ size: Buffer.byteLength(testo), text: async () => testo }] } });
    return r;
};

// ITALIANO: le due funzioni scritte dentro il JSX di App.tsx, ritagliate per nome della prop.
// ENGLISH: the two functions written inside App.tsx's JSX, cut out by prop name.
const prop = async (apertura, fineRe) => {
    const i = sorgente.indexOf(apertura);
    if (i < 0) return null;
    fineRe.lastIndex = i;
    const f = fineRe.exec(sorgente);
    if (!f) return null;
    // ITALIANO: si toglie l'ultima graffa trovata, quella che chiude la prop nel JSX.
    // ENGLISH: the last brace found, the one closing the prop in the JSX, is dropped.
    const testo = sorgente.slice(i + apertura.length, f.index + f[0].trimEnd().length - 1);
    const codice = (await esbuild.transform('const __f = (' + testo + ');', { loader: 'tsx' })).code;
    return (palette, sulleFoto) => {
        const r = { palette: [...palette] };
        const fn = new Function('setCustomProjectTags', 'allUniqueTags', 'hasTagIgnoringCase', 'uniqueTagsIgnoringCase', codice + '\nreturn __f;')(
            (v) => { r.palette = typeof v === 'function' ? v(r.palette) : v; }, tutti(palette, sulleFoto), TC.hasTagIgnoringCase, TC.uniqueTagsIgnoringCase);
        return { r, fn };
    };
};
const dallEditor = await prop('onImportTagsToProject={', /\r?\n {16}\}\}/g);
const suggerito = await prop('addProjectTag={', /\}\r?\n/g);
if (!dallEditor || !suggerito) { console.log('NO  onImportTagsToProject o addProjectTag non trovati in src/App.tsx'); process.exit(1); }

console.log('\n--- Gestione tag -> Importa: tag che il progetto ha gia\' con un\'altra grafia ---');
{
    const r = await importa('Smile\nblue eyes\nsmile\nSMILE', ['smile', 'Blue Eyes']);
    dice('l\'elenco del progetto resta [smile, Blue Eyes]', ['smile', 'Blue Eyes'], r.palette);
    dice('l\'avviso dice che non e\' entrato niente, non "importati (4)"', [[t.projectTagsImportNothingNew, 'info']], r.notifiche);
    const misto = await importa('Smile, freckles, FRECKLES', ['smile', 'Blue Eyes']);
    dice('con un tag nuovo entra solo quello, una volta', ['smile', 'Blue Eyes', 'freckles'], misto.palette);
    dice('l\'avviso conta 1', [[`${t.projectTagsImported} (1)`, 'success']], misto.notifiche);
    const foto = await importa('red hair\nhat', [], ['Red Hair']);
    dice('un tag che sta gia\' sulle foto con un\'altra grafia non entra', ['hat'], foto.palette);
    dice('...e l\'avviso conta solo "hat"', [[`${t.projectTagsImported} (1)`, 'success']], foto.notifiche);
    const stesso = await importa('smile\nBlue Eyes', ['smile', 'Blue Eyes']);
    dice('lo stesso file importato due volte: nessun doppione, avviso "gia\' presenti"', [['smile', 'Blue Eyes'], [[t.projectTagsImportNothingNew, 'info']]], [stesso.palette, stesso.notifiche]);
}

console.log('\n--- la frase nuova nelle nove lingue ---');
for (const l of ['it', 'en', 'fr', 'es', 'de', 'zh', 'ja', 'pt', 'ru']) {
    dice(`${l}: projectTagsImportNothingNew c'e'`, true, typeof lingue[l].projectTagsImportNothingNew === 'string' && lingue[l].projectTagsImportNothingNew.length > 10);
}

console.log('\n--- editor dei file di tag: i tag aperti entrano nel progetto ---');
{
    const { r, fn } = dallEditor(['smile'], ['Tree']);
    fn(['Smile', ' tree ', 'cat', 'CAT']);
    dice('entra solo "cat", una volta; "Smile" e "tree" ci sono gia\'', ['smile', 'cat'], r.palette);
}

console.log('\n--- visualizzatore: un tag suggerito va nel progetto ---');
{
    const { r, fn } = suggerito(['smile'], ['Tree']);
    fn('Smile');
    fn('TREE');
    dice('"Smile" e "TREE" non si aggiungono accanto a "smile" e "Tree"', ['smile'], r.palette);
    fn('cat');
    fn('cat');
    dice('un tag nuovo entra, una volta sola', ['smile', 'cat'], r.palette);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const r = await importa('OHWX\n1girl');
    dice('un tag nuovo entra con la grafia del file', ['OHWX', '1girl'], r.palette);
    dice('avviso "importati (2)"', [[`${t.projectTagsImported} (2)`, 'success']], r.notifiche);
    const vuoto = await importa('\n,\n');
    dice('un file senza tag resta un errore', [[t.importTagsError, 'error']], vuoto.notifiche);
}

process.exit(esito());
