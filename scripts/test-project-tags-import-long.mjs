/* ITALIANO: PROVA DELL'IMPORT DEI TAG DEL PROGETTO CON DIDASCALIE LUNGHE
   Un progetto con didascalie in frase (Flux/SDXL, 120-300 caratteri) esportava i suoi tag interi,
   ma reimportandoli ogni tag oltre i 100 caratteri tornava TAGLIATO, a meta' parola, e oltre i
   5000 tag il resto spariva: il messaggio diceva solo quanti ne erano entrati. Cliccando il tag
   monco lo si aggiungeva alle foto, e Salva lo scriveva nei .txt. Ora vale il limite dei .txt
   (TXT_TAG_MAX_CHARS, 4000 caratteri) e, se qualcosa si accorcia o resta fuori, lo si dice con
   una frase intera, nelle nove lingue.
   Si esegue il testo VERO di handleImportProjectTags preso da src/App.tsx (compilato con esbuild),
   con src/utils/sidecarTags.ts e i testi veri di src/constants.ts.
   Uso:  node scripts/test-project-tags-import-long.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE PROJECT TAGS IMPORT WITH LONG CAPTIONS
   A project with sentence captions (Flux/SDXL, 120-300 characters) exported its tags whole, but
   re-importing them every tag over 100 characters came back CUT, mid-word, and past 5000 tags the
   rest vanished: the message only said how many got in. Clicking the cut tag added it to photos,
   and Save wrote it into the .txt files. Now the .txt cap applies (TXT_TAG_MAX_CHARS, 4000
   characters) and, if anything is shortened or left out, a whole sentence says so, in all nine
   languages.
   The REAL text of handleImportProjectTags taken from src/App.tsx is run (compiled with esbuild),
   with src/utils/sidecarTags.ts and the real strings of src/constants.ts.
   Usage:  node scripts/test-project-tags-import-long.mjs      (exits with code 1 if anything is off) */

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
const fabbrica = new Function('t', 'showNotification', 'setCustomProjectTags', 'soundManager', 'projectTagsImportRef', 'pulisciTagProgetto',
    js + '\nreturn handleImportProjectTags;');

const importa = async (testo) => {
    const r = { palette: [], notifiche: [] };
    const fn = fabbrica(t, (m, tipo) => r.notifiche.push([m, tipo]), (f) => { r.palette = typeof f === 'function' ? f(r.palette) : f; },
        { chime() { } }, { current: { value: 'x' } }, S.pulisciTagProgetto);
    await fn({ target: { files: [{ size: Buffer.byteLength(testo), text: async () => testo }] } });
    return r;
};
const avvisa = (r) => r.notifiche.some(([m]) => typeof t.projectTagsImportShortened === 'string' && m.includes(t.projectTagsImportShortened.split('{n}')[0]));

const frase = 'a young woman with long wavy auburn hair standing on a sunlit beach at golden hour wearing a flowing white linen dress and holding a straw hat';
console.log(`\n--- una didascalia in frase da ${frase.length} caratteri ---`);
{
    const j = await importa(JSON.stringify({ tags: [frase, 'smile'], globalTriggers: [] }));
    dice('JSON: torna intera', [frase, 'smile'], j.palette);
    dice('...senza avviso di tag accorciati', false, avvisa(j));
    const x = await importa(frase + '\nsmile\n');
    dice('TXT: torna intera', [frase, 'smile'], x.palette);
}

console.log('\n--- un tag oltre il limite dei .txt (4500 caratteri) ---');
{
    const r = await importa(JSON.stringify({ tags: ['x'.repeat(4500)] }));
    dice('si accorcia al limite dei .txt', [S.TXT_TAG_MAX_CHARS], r.palette.map(s => s.length));
    dice('e lo si dice', true, avvisa(r));
}

console.log('\n--- 5001 tag diversi ---');
{
    const r = await importa(JSON.stringify({ tags: Array.from({ length: 5001 }, (_, i) => 't' + i) }));
    dice('se ne tengono 5000', 5000, r.palette.length);
    dice('e si dice che alcuni sono rimasti fuori', true, avvisa(r));
}

console.log('\n--- la frase esiste nelle nove lingue, con {n} ---');
dice('projectTagsImportShortened in it/en/fr/es/de/zh/ja/pt/ru', [],
    ['it', 'en', 'fr', 'es', 'de', 'zh', 'ja', 'pt', 'ru'].filter(l => !lingue[l] || typeof lingue[l].projectTagsImportShortened !== 'string'
        || !lingue[l].projectTagsImportShortened.includes('{n}')));

console.log('\n--- quello che NON deve cambiare ---');
{
    const r = await importa('red hair, smile\nred hair\n\x07bell\n');
    dice('virgole e righe separano, doppioni e caratteri di controllo via', ['red hair', 'smile', 'bell'], r.palette);
    dice('messaggio di sempre', [[`${t.projectTagsImported} (3)`, 'success']], r.notifiche);
    const vuoto = await importa('  \n , \n');
    dice('file senza tag: errore di lettura', [[t.importTagsError, 'error']], vuoto.notifiche);
}

process.exit(esito());
