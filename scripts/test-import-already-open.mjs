/* ITALIANO: PROVA DELLE FOTO GIA' APERTE (voce 33 di NOTES)
   Riaprire la stessa cartella caricava di nuovo le foto gia' aperte, in doppio (visto: 5 -> 10 -> 24):
   due card per lo stesso file e due salvataggi sullo stesso .txt. Ora "Importa" del riepilogo lascia
   fuori le foto il cui percorso su disco e' gia' nel progetto (in galleria o nel cestino), e l'avviso
   di fine import dice quante. Si eseguono i pezzi VERI: confermaImport di src/App.tsx, la regola di
   src/utils/alreadyOpen.ts e l'avviso di src/utils/importNotice.ts.
   Uso:  node scripts/test-import-already-open.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE PHOTOS ALREADY OPEN (NOTES item 33)
   Reopening the same folder loaded the open photos again, twice. The summary's "Import" now leaves
   out the photos whose path on disk is already in the project, and the end-of-import notice says how
   many. The REAL pieces run. */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const carica = async (rel) => import('data:text/javascript;base64,' + Buffer.from((await esbuild.build({
    entryPoints: [path.join(radice, rel)], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
})).outputFiles[0].text).toString('base64'));
const A = await carica('src/utils/alreadyOpen.ts');
const S = await carica('src/utils/sidecarTags.ts');
const N = await carica('src/utils/importNotice.ts');
const t = (await carica('src/constants.ts')).translations.en;

console.log('\n--- la regola ---');
const f1 = { name: 'a.png' }, f2 = { name: 'b.png' };
const percorso = new Map([[f1, 'E:\\dataset\\a.png'], [f2, 'E:\\dataset\\b.png']]);
const regola = async (inArrivo, percorsoDi, aperti) => [...(await A.fotoGiaAperte(inArrivo, (f) => ({ percorso: percorsoDi(f), nome: f.name, cartella: null }),
    aperti.map(p => ({ percorso: p, nome: '', cartella: null })))).keys()];
dice('a.png e\' gia\' aperta (anche scritta con altre maiuscole e barre)', [f1], await regola([f1, f2], (f) => percorso.get(f), ['e:/DATASET/A.png']));
dice('senza percorsi (anteprima del browser) non si scarta niente', [], await regola([f1, f2], () => '', ['E:\\dataset\\a.png']));
dice('progetto vuoto: niente da scartare', [], await regola([f1], (f) => percorso.get(f), []));

console.log('\n--- "Importa" del riepilogo ---');
const s = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
dice('il riepilogo chiama confermaImport', true, s.includes('onConfirm={confermaImport}'));
const i = s.indexOf('    const confermaImport = async (');
const fine = /\r?\n    \};\r?\n/g;
fine.lastIndex = i;
const m = i < 0 ? null : fine.exec(s);
dice('premessa: confermaImport si trova', true, Boolean(m));
if (m) {
    const codice = (await esbuild.transform(s.slice(i, m.index + m[0].length), { loader: 'ts' })).code;
    const prova = async (inArrivo, aperte) => {
        const r = { importate: null, notifiche: [], chiuso: false };
        const confermaImport = new Function('importSummary', 'window', 'fotoGiaAperte', 'imagesRef', 'percorsiSuDisco', 'setImportSummary',
            'folderInputRef', 'showNotification', 't', 'processImportData', 'progettoGenRef', 'asDirHandle', 'importInCorsoRef', 'nuovoIdFoto',
            'makeFolderKeyer', 'ripristinoInCorsoRef', 'isUndoRedoAction', 'setImages', 'setHistory', codice + '\nreturn confermaImport;')(
            { pendingData: { imgFiles: inArrivo, txtFiles: [], handle: null, folderOf: null, relPathOf: null, pathOf: percorso, cartellaRelOf: null } },
            {}, A.fotoGiaAperte, { current: aperte.map(p => ({ p, file: { name: '' } })) }, (img) => ({ imgPath: img.p, txtPath: '' }),
            () => { r.chiuso = true; }, { current: null }, (msg, tipo) => r.notifiche.push([msg, tipo]), t,
            async (...arg) => { r.importate = arg[0].map(f => f.name); r.giaAperte = arg[7]; }, { current: 0 }, () => null, { current: [] },
            () => 'lotto', S.makeFolderKeyer, { current: false }, { current: false }, () => { }, () => { });
        await confermaImport();
        return r;
    };
    const parte = await prova([f1, f2], ['E:\\dataset\\a.png']);
    dice('riaprendo la cartella con a.png gia\' aperta si importa solo b.png', ['b.png'], parte.importate);
    dice('...e l\'import sa che una era gia\' aperta', 1, parte.giaAperte);
    const tutte = await prova([f1], ['E:\\dataset\\a.png']);
    dice('se sono tutte gia\' aperte: non si importa niente e si dice', [null, true, [[t.importAlreadyOpen.replace('{n}', '1'), 'info']]],
        [tutte.importate, tutte.chiuso, tutte.notifiche]);
}

console.log('\n--- l\'avviso di fine import ---');
const avv = N.avvisoImport(t, { caricate: 3, ripristinate: 0, saltati: 0, accorciati: 0, giaAperte: 2 });
dice('dice le foto caricate e quante erano gia\' aperte', t.successImport.replace('{n}', '3') + ' · ' + t.importAlreadyOpen.replace('{n}', '2'), avv.testo);
dice('senza doppioni l\'avviso resta com\'era', t.successImport.replace('{n}', '3'), N.avvisoImport(t, { caricate: 3, ripristinate: 0, saltati: 0, accorciati: 0 }).testo);
process.exit(esito());
