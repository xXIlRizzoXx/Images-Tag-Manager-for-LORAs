/* ITALIANO: PROVA CHE L'IMPORT E IL BACKUP DI App.tsx USINO DAVVERO LE REGOLE PROVATE IN src/utils
   Le regole dell'import (abbinamento foto/.txt, trigger, .txt lunghi) e del backup anti-crash
   stanno in src/utils/sidecarTags.ts e src/utils/tagBackup.ts, con le loro prove. Ma quelle prove
   caricano solo i moduli: rimettendo in App.tsx il codice vecchio (originalTags = [...orderedTags],
   la cartella del .txt grezza, il taglio a 100 caratteri scritto li', l'impronta calcolata
   nell'effetto) restavano tutte verdi. Qui si legge il TESTO di App.tsx e si pretende, per ogni
   punto, la chiamata giusta E l'assenza della forma vecchia. Limite: e' un controllo sul testo,
   non sul comportamento; una riscrittura equivalente ma diversa lo fa diventare rosso, e va
   aggiornato insieme al codice.
   Uso:  node scripts/test-import-wiring.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST THAT App.tsx's IMPORT AND BACKUP REALLY USE THE RULES TESTED IN src/utils
   The import rules (photo/.txt pairing, triggers, long .txt files) and the crash-backup rules
   live in src/utils/sidecarTags.ts and src/utils/tagBackup.ts, with their tests. But those tests
   load only the modules: putting the old code back in App.tsx (originalTags = [...orderedTags],
   the raw .txt folder, the 100-character cut written inline, the fingerprint computed in the
   effect) left them all green. Here the TEXT of App.tsx is read and, for each site, the right
   call AND the absence of the old form are required. Limit: it checks the text, not the
   behaviour; an equivalent but different rewrite turns it red, and it must be updated together
   with the code.
   Usage:  node scripts/test-import-wiring.mjs      (exits with code 1 if anything is off) */

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const leggi = (f) => { try { return fs.readFileSync(path.join(radice, f), 'utf8').replace(/\r\n/g, '\n'); } catch (_) { return ''; } };

const app = leggi('src/App.tsx');
const guardia = leggi('src/utils/closeGuard.ts');

// ITALIANO: il corpo di una funzione di App: dalla sua dichiarazione alla successiva dello stesso
//           livello (4 spazi). Vuoto se non c'e'.
// ENGLISH: the body of an App function: from its declaration to the next one at the same level
//          (4 spaces). Empty if missing.
const corpo = (nome) => {
    const i = app.indexOf(`\n    const ${nome} =`);
    if (i < 0) return '';
    const fine = app.indexOf('\n    const ', i + 1);
    return app.slice(i, fine < 0 ? undefined : fine);
};
// ITALIANO: il pezzo di testo da `da` al primo `a` che segue (compreso). Vuoto se manca uno dei due.
// ENGLISH: the text from `da` to the first following `a` (included). Empty if either is missing.
const tratto = (testo, da, a) => {
    const i = testo.indexOf(da);
    if (i < 0) return '';
    const j = testo.indexOf(a, i + da.length);
    return j < 0 ? '' : testo.slice(i, j + a.length);
};

// ITALIANO: i nomi vengono dai moduli provati, e App non ne ha una copia sua.
// ENGLISH: the names come from the tested modules, and App has no copy of its own.
const daSidecar = (app.match(/import \{([^}]*)\} from '\.\/utils\/sidecarTags';/) || [])[1] || '';
for (const n of ['makeFolderKeyer', 'cartellaImmagine', 'cartellaTesto', 'parseSidecarText', 'tagDiImport']) {
    dice(`${n} viene importato da utils/sidecarTags`, true, new RegExp(`\\b${n}\\b`).test(daSidecar));
    dice(`App non definisce un suo ${n}`, false, new RegExp(`\\b(const|function) ${n}\\b`).test(app));
}
const daBackup = (app.match(/import \{([^}]*)\} from '\.\/utils\/tagBackup';/) || [])[1] || '';
for (const n of ['backupDellImport', 'tagDaRipristinare']) {
    dice(`${n} viene importato da utils/tagBackup`, true, new RegExp(`\\b${n}\\b`).test(daBackup));
    dice(`App non definisce un suo ${n}`, false, new RegExp(`\\b(const|function) ${n}\\b`).test(app));
}

// ITALIANO: 1) l'import: le foto nuove tengono come originalTags SOLO cio' che e' nel .txt
//              (tagDiImport), non i tag con le trigger aggiunte.
// ENGLISH: 1) the import: new photos keep as originalTags ONLY what is in the .txt (tagDiImport),
//             not the tags with the triggers added.
const importa = corpo('processImportData');
dice('premessa: App.tsx ha processImportData', true, importa.length > 0);
dice('processImportData prende tags e originalTags da tagDiImport', true, /const \{ tags: orderedTags, originalTags \} = tagDiImport\(/.test(importa));
const fotoNuova = tratto(importa, 'newImages.push({', '});');
dice('premessa: trovata la foto nuova (newImages.push)', true, fotoNuova.length > 0);
dice('la foto nuova ha originalTags = una copia di originalTags (discoImport)', true,
    /\bconst discoImport = \[\.\.\.originalTags\];/.test(importa) && /\boriginalTags: discoImport,/.test(fotoNuova));
// ITALIANO: il segno del .txt non letto e' LO STESSO array di originalTags (vedi txtNonLettoInVigore).
// ENGLISH: the unread-.txt mark is THE SAME array as originalTags (see txtNonLettoInVigore).
dice('baseTxtNonLetto e originalTags sono lo stesso array', true, /\{ baseTxtNonLetto: discoImport \}/.test(fotoNuova));
dice('la foto nuova NON ha originalTags: [...orderedTags]', false, /\boriginalTags: \[\.\.\.orderedTags\]/.test(fotoNuova));

// ITALIANO: 2) l'abbinamento: foto e .txt passano per la stessa regola di cartella, anche alla
//              radice di un'unita' ("E:" contro "E:\"), e senza maiuscole (makeFolderKeyer).
// ENGLISH: 2) the pairing: photo and .txt go through the same folder rule, also at a drive root
//             ("E:" against "E:\"), and case-insensitively (makeFolderKeyer).
const sidecar = corpo('loadSidecarTxtFiles');
dice('premessa: App.tsx ha loadSidecarTxtFiles', true, sidecar.length > 0);
dice('la cartella della foto passa da cartellaImmagine', true, /folderOf\.set\(f, cartellaImmagine\(p\)\)/.test(sidecar));
dice('la cartella del .txt passa da cartellaTesto(s.dir)', true, /folderOf\.set\(file, [^\n;]*cartellaTesto\(s\.dir\)/.test(sidecar));
dice('la cartella del .txt NON e\' s.dir grezza', false, /folderOf\.set\(file, (typeof s\.dir === 'string' \? )?s\.dir\b/.test(sidecar));
dice('processImportData abbina con makeFolderKeyer(folderOf)', true, /const folderKeyOf = makeFolderKeyer\(folderOf\);/.test(importa));
// ITALIANO: il riepilogo prima dell'import ("con testo / senza testo") deve abbinare con la STESSA
//           regola dell'import: con una chiave sua (nome senza estensione, maiuscole contate)
//           IMG_001.JPG e img_001.txt, o foto omonime in sottocartelle, verrebbero contate male.
// ENGLISH: the pre-import summary ("with text / without text") must pair with the SAME rule as
//          the import: with a key of its own (name without extension, case-sensitive) IMG_001.JPG
//          and img_001.txt, or same-named photos in subfolders, would be counted wrongly.
const riepilogo = corpo('calculateImportSummary');
dice('premessa: App.tsx ha calculateImportSummary', true, riepilogo.length > 0);
dice('il riepilogo abbina con makeFolderKeyer(folderOf)', true, /const keyOf = makeFolderKeyer\(folderOf\);/.test(riepilogo));
dice('il riepilogo usa keyOf per i .txt e per le foto', [true, true], [/new Set\(txtFiles\.map\(keyOf\)\)/.test(riepilogo), /txtKeys\.has\(keyOf\(f\)\)/.test(riepilogo)]);
dice('il riepilogo non costruisce una chiave sua dal nome del file (.name)', false, /\.name\b/.test(riepilogo));
dice('il riepilogo definisce un solo abbinamento (una sola makeFolderKeyer, nessun altro keyOf)', [1, 1], [(riepilogo.match(/makeFolderKeyer\(/g) || []).length, (riepilogo.match(/\b(const|let|var) keyOf\b/g) || []).length]);

// ITALIANO: 3) la lettura del .txt passa da parseSidecarText (limiti larghi, testo accorciato
//              contato), senza un taglio a 100 caratteri o una divisione scritti a mano.
// ENGLISH: 3) reading the .txt goes through parseSidecarText (wide caps, shortened text
//             counted), without a hand-written 100-character cut or split.
dice('il .txt si legge con parseSidecarText(text)', true, /const letti = parseSidecarText\(text\);/.test(importa));
dice('i tag letti vanno in textMap da parseSidecarText', true, /textMap\.set\(folderKeyOf\(txtFiles\[i\]\), letti\.tags\)/.test(importa));
dice('niente .slice(0, 100) nell\'import', false, /\.slice\(0,\s*100\)/.test(importa));
dice('niente text.split( scritto a mano nell\'import', false, /\btext\.split\(/.test(importa));

// ITALIANO: 4) il ripristino dal backup: backupDellImport e tagDaRipristinare decidono.
// ENGLISH: 4) restoring from the backup: backupDellImport and tagDaRipristinare decide.
dice('l\'import legge il backup con backupDellImport', true, /backup = backupDellImport\(localStorage\.getItem\('tagBackup'\), importFolder, importSignature\)/.test(importa));
dice('l\'import ripristina con tagDaRipristinare', true, /const ripristinati = tagDaRipristinare\(entry, orderedTags, originalTags, /.test(importa));

// ITALIANO: 5) l'effetto del backup anti-crash scrive tramite scriviBackupSubito, che usa
//              costruisciBackup; nessuna impronta calcolata dentro l'effetto.
// ENGLISH: 5) the crash-backup effect writes through scriviBackupSubito, which uses
//             costruisciBackup; no fingerprint computed inside the effect.
const effetto = tratto(app, 'const backupConFotoRef = useRef(false);', '}, [images, dirHandle]);');
dice('premessa: trovato l\'effetto del backup anti-crash', true, effetto.length > 0);
dice('l\'effetto chiama scriviBackupSubito(localStorage, images, fotoChiuseRef.current.values(), folder, globalTriggersRef.current)', true, /scriviBackupSubito\(localStorage, images, fotoChiuseRef\.current\.values\(\), folder, globalTriggersRef\.current\)/.test(effetto));
dice('l\'effetto NON calcola l\'impronta da solo (folderSignature)', false, /folderSignature\(/.test(effetto));
dice('l\'effetto NON scrive tagBackup a mano', false, /localStorage\.setItem\(/.test(effetto));
dice('scriviBackupSubito viene importato da utils/closeGuard', true, /import \{[^}]*\bscriviBackupSubito\b[^}]*\} from '\.\/utils\/closeGuard';/.test(app));
dice('scriviBackupSubito usa costruisciBackup', true, /import \{[^}]*\bcostruisciBackup\b[^}]*\} from '\.\/tagBackup';/.test(guardia) && /= costruisciBackup\(images, chiuse, cartella, /.test(guardia));

process.exit(esito());
