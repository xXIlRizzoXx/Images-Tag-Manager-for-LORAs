/* ITALIANO: PROVA DI UNA VOCE JSON CON UNA VIRGOLA DENTRO
   Un file JSON con {"tags":["red hair, blue eyes","smile"]} (scritto a mano o da un altro strumento)
   entrava nell'elenco dei tag del progetto come UNA pillola «red hair, blue eyes». Aggiunta a una
   foto che aveva gia' «red hair», Salva scriveva "red hair, red hair, blue eyes," e alla riapertura
   la foto aveva due tag diversi da quelli visti. Lo stesso file in TXT si divideva bene, e cosi' ogni
   altro ingresso del programma. Ora anche le voci JSON si dividono su virgole e a capo: nell'import
   dei tag del progetto (pulisciTagProgetto) e nell'editor dei file di tag (parseTagFile e
   parseTagTriggers). Si eseguono il testo VERO di handleImportProjectTags (src/App.tsx), il vero
   src/utils/sidecarTags.ts e i testi VERI di parseTagFile e parseTagTriggers
   (src/components/TagFileEditor.tsx).
   Uso:  node scripts/test-project-tags-json-comma.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF A JSON ENTRY WITH A COMMA INSIDE
   A JSON file with {"tags":["red hair, blue eyes","smile"]} (hand-written or from another tool) went
   into the project tag list as ONE pill "red hair, blue eyes". Added to a photo that already had
   "red hair", Save wrote "red hair, red hair, blue eyes," and on reopening the photo had two tags
   different from the ones shown. The same file as TXT was split fine, and so was every other input
   of the program. Now JSON entries are split on commas and newlines too: in the project tags import
   (pulisciTagProgetto) and in the tag file editor (parseTagFile and parseTagTriggers). The REAL text
   of handleImportProjectTags (src/App.tsx), the real src/utils/sidecarTags.ts and the REAL texts of
   parseTagFile and parseTagTriggers (src/components/TagFileEditor.tsx) are run.
   Usage:  node scripts/test-project-tags-json-comma.mjs      (exits with code 1 if anything is off) */

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

const ritaglia = async (rel, intestazione, chiusura) => {
    const sorgente = fs.readFileSync(path.join(radice, rel), 'utf8');
    const inizio = sorgente.indexOf(intestazione);
    chiusura.lastIndex = Math.max(inizio, 0);
    const fine = inizio < 0 ? null : chiusura.exec(sorgente);
    if (!fine) { console.log('NO  non trovato in ' + rel + ': ' + intestazione.trim()); process.exit(1); }
    return (await esbuild.transform(sorgente.slice(inizio, fine.index + fine[0].length).replace(/^export /, ''), { loader: 'ts' })).code;
};
const fabbrica = new Function('t', 'showNotification', 'setCustomProjectTags', 'soundManager', 'projectTagsImportRef', 'pulisciTagProgetto', 'leggiTestoSidecar', 'allUniqueTags', 'hasTagIgnoringCase', 'uniqueTagsIgnoringCase',
    (await ritaglia('src/App.tsx', '    const handleImportProjectTags = async (e: any) => {', /\r?\n    \};\r?\n/g)) + '\nreturn handleImportProjectTags;');
// ITALIANO: la regola di modulo che parseTagFile usa (una riga sola).
// ENGLISH: the module-level rule parseTagFile uses (a single line).
const rigaRegola = (fs.readFileSync(path.join(radice, 'src/components/TagFileEditor.tsx'), 'utf8').match(/^const SEMBRA_JSON = .*$/m) || [''])[0];
const editor = new Function(rigaRegola + '\n' +
    (await ritaglia('src/components/TagFileEditor.tsx', 'export const parseTagFile = (', /\r?\n\};\r?\n/g)) + '\n' +
    (await ritaglia('src/components/TagFileEditor.tsx', 'export const parseTagTriggers = (', /\r?\n\};\r?\n/g)) +
    '\nreturn { parseTagFile, parseTagTriggers };')();

const importa = async (testo, iniziale = []) => {
    const r = { palette: [...iniziale], notifiche: [] };
    const fn = fabbrica(t, (m, tipo) => r.notifiche.push([m, tipo]), (f) => { r.palette = typeof f === 'function' ? f(r.palette) : f; },
        { chime() { } }, { current: { value: 'x' } }, S.pulisciTagProgetto, S.leggiTestoSidecar, [...r.palette], TC.hasTagIgnoringCase, TC.uniqueTagsIgnoringCase);
    await fn({ target: { files: [{ size: Buffer.byteLength(testo), text: async () => testo }] } });
    return r;
};

console.log('\n--- import dei tag del progetto ---');
{
    const json = await importa(JSON.stringify({ tags: ['red hair, blue eyes', 'smile'] }));
    const txt = await importa('red hair, blue eyes\nsmile');
    dice('JSON {"tags":["red hair, blue eyes","smile"]} -> tre tag', ['red hair', 'blue eyes', 'smile'], json.palette);
    dice('...gli stessi del TXT con lo stesso contenuto', txt.palette, json.palette);
    dice('...e l\'avviso conta tre tag', [[`${t.projectTagsImported} (3)`, 'success']], json.notifiche);
    const elenco = await importa(JSON.stringify(['1girl, solo', 'smile\nlooking at viewer']));
    dice('elenco semplice con virgole e a capo dentro le voci', ['1girl', 'solo', 'smile', 'looking at viewer'], elenco.palette);
    const trig = await importa(JSON.stringify({ globalTriggers: ['ohwx, sks'], tags: ['a'] }));
    dice('anche le trigger del file si dividono', ['a', 'ohwx', 'sks'], trig.palette);
    const doppio = await importa(JSON.stringify({ tags: ['red hair, blue eyes'] }), ['red hair']);
    dice('un tag gia\' nel progetto non rientra due volte', ['red hair', 'blue eyes'], doppio.palette);
}
{
    const r = S.pulisciTagProgetto(['red hair, blue eyes', ' , ', 'smile']);
    dice('pulisciTagProgetto da sola: divide e salta i pezzi vuoti', { tags: ['red hair', 'blue eyes', 'smile'], truncated: false }, r);
    const lungo = 'x'.repeat(5000);
    dice('pulisciTagProgetto: un pezzo troppo lungo si accorcia ancora e lo dice', [4000, true],
        (({ tags, truncated }) => [tags[0].length, truncated])(S.pulisciTagProgetto([lungo + ', y'])));
}

console.log('\n--- editor dei file di tag ---');
{
    const testo = JSON.stringify({ globalTriggers: ['ohwx, sks'], tags: ['red hair, blue eyes', 'smile'] });
    dice('parseTagFile .json: voci divise come nel TXT', ['ohwx', 'sks', 'red hair', 'blue eyes', 'smile'], editor.parseTagFile(testo, 'tags.json'));
    dice('parseTagTriggers .json: trigger divise allo stesso modo', ['ohwx', 'sks'], editor.parseTagTriggers(testo, 'tags.json'));
    dice('parseTagFile elenco semplice', ['1girl', 'solo', 'smile'], editor.parseTagFile('["1girl, solo", "smile"]', 'lista.json'));
    dice('TXT come prima', ['red hair', 'blue eyes', 'smile'], editor.parseTagFile('red hair, blue eyes\nsmile', 'a.txt'));
    let errore = null; try { editor.parseTagFile('[{"tag":"a"}]', 'x.json'); } catch (err) { errore = err.message; }
    dice('un elenco di oggetti resta un errore', 'JSON senza elenco di tag', errore);
}

process.exit(esito());
