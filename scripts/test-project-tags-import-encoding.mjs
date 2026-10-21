/* ITALIANO: PROVA DELLA CODIFICA NELL'IMPORT DEI TAG DEL PROGETTO
   "Importa" nel pannello dei tag del progetto leggeva il file sempre come UTF-8 (file.text()). Un
   elenco salvato da PowerShell 5.1 (`... > tags.txt`) o dal Blocco note come "Unicode" e' UTF-16:
   nella palette entravano tag come "o h w x", "1 g i r l" (con i caratteri NUL diventati spazi) con
   l'avviso verde "Tag importati nel progetto (3)", e un project-tags.json UTF-16 diventava tre tag
   fatti di pezzi di JSON. Un file ANSI con lettere accentate dava tag con il carattere sostitutivo.
   Ora si legge come i .txt e l'editor dei file di tag (leggiTestoSidecar): UTF-8, UTF-16 con BOM;
   un file che non e' ne' l'uno ne' l'altro da' l'errore di lettura e la palette resta com'era.
   Si esegue il testo VERO di handleImportProjectTags preso da src/App.tsx (compilato con esbuild),
   con src/utils/sidecarTags.ts e i testi veri di src/constants.ts, su oggetti File veri.
   Uso:  node scripts/test-project-tags-import-encoding.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE ENCODING IN THE PROJECT TAGS IMPORT
   "Import" in the project tags panel always read the file as UTF-8 (file.text()). A list saved by
   PowerShell 5.1 (`... > tags.txt`) or by Notepad as "Unicode" is UTF-16: the palette got tags like
   "o h w x", "1 g i r l" (the NUL characters turned into spaces) with the green notice "Tags
   imported into the project (3)", and a UTF-16 project-tags.json became three tags made of JSON
   pieces. An ANSI file with accented letters gave tags with the replacement character.
   Now it is read like the .txt files and the tag file editor (leggiTestoSidecar): UTF-8, UTF-16 with
   BOM; a file that is neither gives the reading error and the palette stays as it was.
   The REAL text of handleImportProjectTags taken from src/App.tsx is run (compiled with esbuild),
   with src/utils/sidecarTags.ts and the real strings of src/constants.ts, on real File objects.
   Usage:  node scripts/test-project-tags-import-encoding.mjs      (exits with code 1 if anything is off) */

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
const t = (await carica('src/constants.ts')).translations.en;
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
const fabbrica = new Function('t', 'showNotification', 'setCustomProjectTags', 'soundManager', 'projectTagsImportRef', 'pulisciTagProgetto', 'leggiTestoSidecar', 'allUniqueTags', 'hasTagIgnoringCase', 'uniqueTagsIgnoringCase',
    js + '\nreturn handleImportProjectTags;');

// ITALIANO: `byte` = il contenuto del file su disco; si passa un File vero, come il selettore.
// ENGLISH: `byte` = the file's content on disk; a real File is passed, as from the picker.
const importa = async (byte, nome, iniziale = []) => {
    const r = { palette: [...iniziale], notifiche: [] };
    const fn = fabbrica(t, (m, tipo) => r.notifiche.push([m, tipo]), (f) => { r.palette = typeof f === 'function' ? f(r.palette) : f; },
        { chime() { } }, { current: { value: 'x' } }, S.pulisciTagProgetto, S.leggiTestoSidecar, [...r.palette], TC.hasTagIgnoringCase, TC.uniqueTagsIgnoringCase);
    await fn({ target: { files: [new File([byte], nome, { type: nome.endsWith('.json') ? 'application/json' : 'text/plain' })] } });
    return r;
};
const utf16 = (testo) => Buffer.concat([Buffer.from([0xFF, 0xFE]), Buffer.from(testo, 'utf16le')]);
const errore = [[t.importTagsError, 'error']];
const verde = (n) => [[`${t.projectTagsImported} (${n})`, 'success']];

console.log('\n--- UTF-16 con BOM (PowerShell 5.1, Blocco note "Unicode") ---');
{
    const r = await importa(utf16('ohwx\r\n1girl\r\nsmile\r\n'), 'tags.txt');
    dice('elenco UTF-16: entrano ohwx, 1girl, smile', ['ohwx', '1girl', 'smile'], r.palette);
    dice('elenco UTF-16: avviso verde con 3', verde(3), r.notifiche);
    const j = await importa(utf16(JSON.stringify({ app: 'Images Tag Manager for LORAs', globalTriggers: ['ohwx'], tags: ['smile', 'red hair'] })), 'project-tags.json');
    dice('project-tags.json UTF-16: i tag giusti, poi le trigger', ['smile', 'red hair', 'ohwx'], j.palette);
}

console.log('\n--- ANSI con lettere accentate (non UTF-8, non UTF-16) ---');
{
    const r = await importa(Buffer.from([0x63, 0x69, 0x74, 0x74, 0xE0, 0x2C, 0x20, 0x6D, 0x61, 0x72, 0x65, 0x0D, 0x0A]), 'tags.txt', ['prima']);
    dice('file ANSI ("citta\'" con E0): errore di lettura', errore, r.notifiche);
    dice('...e la palette resta com\'era', ['prima'], r.palette);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const r = await importa(Buffer.from('red hair, smile\nblue eyes\n', 'utf8'), 'tags.txt');
    dice('UTF-8 senza BOM: come prima', ['red hair', 'smile', 'blue eyes'], r.palette);
    const b = await importa(Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from('città, mare', 'utf8')]), 'tags.txt');
    dice('UTF-8 con BOM e lettere accentate: come prima', ['città', 'mare'], b.palette);
    const j = await importa(Buffer.from('["1girl", "solo"]', 'utf8'), 'list.json');
    dice('elenco JSON UTF-8: come prima', ['1girl', 'solo'], j.palette);
}

process.exit(esito());
