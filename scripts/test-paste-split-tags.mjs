/* ITALIANO: PROVA DI UN ELENCO "a, b, c" INCOLLATO NEI CAMPI CHE AGGIUNGONO TAG
   Incollando "1girl, solo, smile" (una didascalia copiata da un altro programma) nel campo "cerca o
   aggiungi" del visualizzatore, nel campo di aggiunta del pannello in blocco o in quello del
   gestore dei tag del progetto, e premendo Invio, nasceva UN tag solo con le virgole dentro. Il
   confronto dei doppioni non vedeva che "smile" c'era gia', e il .txt usciva
   "1girl, solo, smile, smile,": un doppione nella didascalia, e al caricamento dopo tre tag diversi
   da quello mostrato. Il campo delle card (TagInput) e l'editor dividevano gia' sulle virgole.
   Ora anche questi tre campi dividono su virgole e a capo, e aggiungono solo i tag che mancano.
   Si eseguono la regola VERA di src/utils/tagCase.ts e i gestori VERI presi da
   src/components/Lightbox.tsx e da src/App.tsx (compilati con esbuild).
   Uso:  node scripts/test-paste-split-tags.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF A LIST "a, b, c" PASTED INTO THE FIELDS THAT ADD TAGS
   Pasting "1girl, solo, smile" (a caption copied from another program) into the viewer's "search or
   add" box, the bulk panel's add box or the project tag manager's box, and pressing Enter, made ONE
   tag with the commas inside. The duplicate check could not see that "smile" was already there,
   and the .txt came out "1girl, solo, smile, smile,": a duplicate in the caption, and on the next
   load three tags other than the one shown. The cards' box (TagInput) and the editor already split
   on commas. Now these three fields split on commas and line breaks too, and add only the tags
   that are missing.
   The REAL rule of src/utils/tagCase.ts and the REAL handlers taken from
   src/components/Lightbox.tsx and src/App.tsx are run (compiled with esbuild).
   Usage:  node scripts/test-paste-split-tags.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const uscita = await esbuild.build({ entryPoints: [path.join(radice, 'src/utils/tagCase.ts')], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
const C = await import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));
const dividi = typeof C.splitTagInput === 'function' ? C.splitTagInput : (testo) => [String(testo).trim().replace(/,$/, '')].filter(Boolean);
const muto = { pop() { }, click() { }, chime() { } };

// ITALIANO: il gestore Invio del visualizzatore, dalla sua riga fino alla chiusa.
// ENGLISH: the viewer's Enter handler, from its line down to its end.
const lightbox = fs.readFileSync(path.join(radice, 'src/components/Lightbox.tsx'), 'utf8');
const iL = lightbox.indexOf('    const handleSidebarKeyDown = (e: any) => {');
const fL = /\r?\n    \};\r?\n/g;
fL.lastIndex = Math.max(iL, 0);
const mL = iL >= 0 ? fL.exec(lightbox) : null;
if (!mL) { console.log('NO  handleSidebarKeyDown non trovato in src/components/Lightbox.tsx'); process.exit(1); }
const codiceL = (await esbuild.transform(lightbox.slice(iL, mL.index + mL[0].length), { loader: 'ts' })).code;
const invioViewer = (attuali, scritto) => {
    const r = { tags: null, campo: scritto };
    new Function('filterText', 'currentTags', 'hasTagIgnoringCase', 'updateTags', 'image', 'setFilterText', 'soundManager', 'splitTagInput',
        codiceL + '\nreturn handleSidebarKeyDown;')(scritto, attuali, C.hasTagIgnoringCase, (_id, nuovi) => { r.tags = nuovi; }, { id: 'p1' },
        (v) => { r.campo = v; }, muto, dividi)({ key: 'Enter', preventDefault() { } });
    return r;
};

// ITALIANO: il gestore onKeyDown in linea del campo con questo placeholder, in src/App.tsx.
// ENGLISH: the inline onKeyDown handler of the field with this placeholder, in src/App.tsx.
const app = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const gestoreInLinea = async (placeholder) => {
    const iP = app.indexOf('placeholder={' + placeholder + '}');
    const iK = iP < 0 ? -1 : app.indexOf('onKeyDown={', iP);
    if (iP < 0 || iK < 0 || iK - iP > 600) { console.log('NO  campo ' + placeholder + ' non trovato in src/App.tsx'); process.exit(1); }
    let i = iK + 'onKeyDown='.length, prof = 0;
    const da = i;
    for (; i < app.length; i++) { if (app[i] === '{') prof++; else if (app[i] === '}' && --prof === 0) break; }
    return (await esbuild.transform('const gestore = ' + app.slice(da + 1, i) + ';', { loader: 'ts' })).code;
};
const codiceBlocco = await gestoreInLinea('t.bulkAddPlaceholder');
const invioBlocco = (inFila, scritto) => {
    const r = { fila: inFila, campo: { value: scritto } };
    new Function('setStagedBulkTags', 'hasTagIgnoringCase', 'soundManager', 'splitTagInput', codiceBlocco + '\nreturn gestore;')(
        (f) => { r.fila = typeof f === 'function' ? f(r.fila) : f; }, C.hasTagIgnoringCase, muto, dividi)({ key: 'Enter', preventDefault() { }, target: r.campo });
    return r;
};
const codiceProgetto = await gestoreInLinea('t.addTagToProject');
const invioProgetto = (delProgetto, scritto) => {
    const r = { aggiunti: [], campo: { value: scritto } };
    new Function('allUniqueTags', 'setCustomProjectTags', 'hasTagIgnoringCase', 'soundManager', 'splitTagInput', codiceProgetto + '\nreturn gestore;')(
        delProgetto, (f) => { r.aggiunti = typeof f === 'function' ? f(r.aggiunti) : f; }, C.hasTagIgnoringCase, muto, dividi)({ key: 'Enter', preventDefault() { }, target: r.campo });
    return r;
};
// ITALIANO: il .txt come lo scrive Salva (getOrderedTagString), dopo i doppioni tolti da updateImageTags.
// ENGLISH: the .txt as Save writes it (getOrderedTagString), after updateImageTags drops duplicates.
const txt = (tags, trigger = []) => {
    const u = C.uniqueTagsIgnoringCase(tags, trigger);
    const o = [...trigger.filter(t => u.includes(t)), ...u.filter(t => !trigger.includes(t)).sort((a, b) => a.localeCompare(b))];
    return o.length ? o.join(', ') + ',' : '';
};

console.log('\n--- la regola ---');
dice('splitTagInput esiste in src/utils/tagCase.ts', 'function', typeof C.splitTagInput);
dice('"1girl, solo, smile" -> tre tag', ['1girl', 'solo', 'smile'], dividi('1girl, solo, smile'));
dice('a capo e virgole in fondo contano come separatori, senza vuoti', ['a', 'b', 'c'], dividi('a,\nb\r\n, c,'));
dice('due grafie dello stesso tag: resta la prima', ['smile'], dividi('smile, Smile'));

console.log('\n--- visualizzatore, campo "cerca o aggiungi" ---');
{
    const r = invioViewer(['smile'], '1girl, solo, smile');
    dice('incollato su una foto che ha "smile": tre tag distinti', ['smile', '1girl', 'solo'], r.tags);
    dice('...il .txt non ha doppioni', '1girl, smile, solo,', txt(r.tags || []));
    dice('...e il campo si svuota', '', r.campo);
    const t = invioViewer(['ohwx'], 'ohwx, 1girl');
    dice('con la trigger ohwx attiva: "ohwx, 1girl" non la raddoppia', 'ohwx, 1girl,', txt(t.tags || ['ohwx'], ['ohwx']));
}

console.log('\n--- pannello in blocco e gestore dei tag del progetto ---');
{
    const b = invioBlocco(['smile'], '1girl, solo, smile');
    dice('in blocco: si preparano i tag uno per uno, senza doppioni', [['smile', '1girl', 'solo'], ''], [b.fila, b.campo.value]);
    const p = invioProgetto(['smile'], '1girl, solo, smile');
    dice('progetto: si aggiungono solo quelli che mancano, uno per uno', [['1girl', 'solo'], ''], [p.aggiunti, p.campo.value]);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const r = invioViewer(['smile'], 'blue eyes');
    dice('un tag solo scritto a mano si aggiunge come prima', ['smile', 'blue eyes'], r.tags);
    const g = invioViewer(['smile'], 'Smile');
    dice('un tag che c\'e\' gia\' (altre maiuscole): niente aggiunto, il campo resta (si sta cercando)', [null, 'Smile'], [g.tags, g.campo]);
    const v = invioViewer(['smile'], '  ');
    dice('campo vuoto: niente', null, v.tags);
    const b = invioBlocco(['smile'], 'smile');
    dice('in blocco, un tag gia\' in fila: la fila resta uguale e il campo si svuota', [['smile'], ''], [b.fila, b.campo.value]);
    const p = invioProgetto(['smile'], 'Smile');
    dice('progetto, un tag gia\' presente: niente aggiunto e il campo resta', [[], 'Smile'], [p.aggiunti, p.campo.value]);
}

process.exit(esito());
