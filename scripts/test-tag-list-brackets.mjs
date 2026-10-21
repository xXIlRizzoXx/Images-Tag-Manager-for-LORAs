/* ITALIANO: PROVA DEI TAG CHE INIZIANO CON UNA PARENTESI QUADRA O GRAFFA
   Una foto con i tag "1girl" e "[artist name]" (o "{best quality}", il peso alla NovelAI) e
   nessuna trigger: Salva ordina i tag con localeCompare, che mette "[" e "{" prima di numeri e
   lettere, e scrive "[artist name], 1girl,". L'editor dei file di tag prendeva ogni testo che
   inizia con "[" o "{" per un JSON: aprire quel .txt dava "Impossibile leggere il file".
   Allo stesso modo l'export TXT dei tag del progetto che comincia con "{best quality}" non si
   poteva reimportare ("Impossibile leggere il file dei tag"): il caso "[" era gia' a posto.
   Ora un .txt che inizia con una parentesi ma non e' un JSON si legge come TXT; un .json rotto
   e un .txt che e' chiaramente un JSON rotto ('{"tags": [...') restano un errore.
   Si eseguono i testi VERI di parseTagFile e parseTagTriggers (src/components/TagFileEditor.tsx)
   e di handleImportProjectTags (src/App.tsx), compilati con esbuild.
   Uso:  node scripts/test-tag-list-brackets.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF TAGS STARTING WITH A SQUARE BRACKET OR A BRACE
   A photo with the tags "1girl" and "[artist name]" (or "{best quality}", NovelAI weighting) and
   no trigger: Save sorts the tags with localeCompare, which puts "[" and "{" before digits and
   letters, and writes "[artist name], 1girl,". The tag file editor took any text starting with
   "[" or "{" for JSON: opening that .txt gave "Could not read the file". In the same way the
   project tags TXT export starting with "{best quality}" could not be imported back ("Could not
   read the tags file"): the "[" case was already fine.
   Now a .txt starting with a bracket that is not JSON is read as TXT; a broken .json and a .txt
   that is clearly broken JSON ('{"tags": [...') stay an error.
   The REAL texts of parseTagFile and parseTagTriggers (src/components/TagFileEditor.tsx) and of
   handleImportProjectTags (src/App.tsx) are run, compiled with esbuild.
   Usage:  node scripts/test-tag-list-brackets.mjs      (exits with code 1 if anything is off) */

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

// ITALIANO: ritaglia una funzione dal sorgente, dall'intestazione alla prima chiusura con lo stesso rientro.
// ENGLISH: cuts a function out of the source, from its header to the first closing with the same indent.
const ritaglia = async (file, intestazione, chiusura) => {
    const sorgente = fs.readFileSync(path.join(radice, file), 'utf8');
    const inizio = sorgente.indexOf(intestazione);
    chiusura.lastIndex = Math.max(inizio, 0);
    const fine = inizio < 0 ? null : chiusura.exec(sorgente);
    if (inizio < 0 || !fine) {
        console.log(`NO  non trovato in ${file}: ${intestazione.trim()}`);
        process.exit(1);
    }
    const testo = sorgente.slice(inizio, fine.index + fine[0].length).replace(/^export /, '');
    return (await esbuild.transform(testo, { loader: 'ts' })).code;
};
// ITALIANO: la regola di modulo che parseTagFile usa, se c'e' (una riga sola).
// ENGLISH: the module-level rule parseTagFile uses, when present (a single line).
const sorgenteEditor = fs.readFileSync(path.join(radice, 'src/components/TagFileEditor.tsx'), 'utf8');
const rigaRegola = (sorgenteEditor.match(/^const SEMBRA_JSON = .*$/m) || [''])[0];
const editor = new Function(rigaRegola + '\n' +
    (await ritaglia('src/components/TagFileEditor.tsx', 'export const parseTagFile = (', /\r?\n\};\r?\n/g)) + '\n' +
    (await ritaglia('src/components/TagFileEditor.tsx', 'export const parseTagTriggers = (', /\r?\n\};\r?\n/g)) +
    '\nreturn { parseTagFile, parseTagTriggers };')();
const leggi = (testo, nome) => {
    try { return editor.parseTagFile(testo, nome); } catch (err) { return 'ERRORE: ' + (err && err.name); }
};

const fabbrica = new Function('t', 'showNotification', 'setCustomProjectTags', 'soundManager', 'projectTagsImportRef', 'pulisciTagProgetto', 'leggiTestoSidecar', 'allUniqueTags', 'hasTagIgnoringCase', 'uniqueTagsIgnoringCase',
    (await ritaglia('src/App.tsx', '    const handleImportProjectTags = async (e: any) => {', /\r?\n    \};\r?\n/g)) + '\nreturn handleImportProjectTags;');
const importa = async (testo, iniziale = []) => {
    const r = { palette: [...iniziale], notifiche: [] };
    const fn = fabbrica(t, (m, tipo) => r.notifiche.push([m, tipo]), (f) => { r.palette = typeof f === 'function' ? f(r.palette) : f; },
        { chime() { } }, { current: { value: 'x' } }, S.pulisciTagProgetto, S.leggiTestoSidecar, [...r.palette], TC.hasTagIgnoringCase, TC.uniqueTagsIgnoringCase);
    await fn({ target: { files: [{ size: Buffer.byteLength(testo), text: async () => testo }] } });
    return r;
};
const errore = [[t.importTagsError, 'error']];

console.log('\n--- editor dei file di tag: un .txt che inizia con una parentesi ---');
{
    // ITALIANO: l'ordine che usa Salva: le parentesi vengono prima delle lettere.
    // ENGLISH: the order Save uses: brackets come before letters.
    const ordinati = ['1girl', 'smile', '{best quality}', '[artist name]'].sort((a, b) => a.localeCompare(b));
    dice('Salva mette "[" e "{" in testa (localeCompare)', ['[artist name]', '{best quality}', '1girl', 'smile'], ordinati);
    dice('"[artist name], 1girl, smile," (.txt scritto da Salva) si apre', ['[artist name]', '1girl', 'smile'],
        leggi('[artist name], 1girl, smile,', 'img_001.txt'));
    dice('"{best quality}, 1girl, solo," si apre', ['{best quality}', '1girl', 'solo'], leggi('{best quality}, 1girl, solo,', 'img_002.txt'));
    dice('"{{masterpiece}}, 1girl" si apre', ['{{masterpiece}}', '1girl'], leggi('{{masterpiece}}, 1girl', 'a.txt'));
    dice('"[a]" (un solo tag tra quadre) si apre', ['[a]'], leggi('[a]', 'a.txt'));
    dice('anche su piu\' righe, con a capo Windows', ['{best quality}', '1girl', 'smile'], leggi('{best quality}\r\n1girl\r\nsmile\r\n', 'a.TXT'));
    dice('le trigger di un .txt cosi\': nessuna', [], editor.parseTagTriggers('{best quality}, 1girl,', 'a.txt'));
}

console.log('\n--- editor: quello che NON deve cambiare ---');
{
    dice('"1girl, [artist name]," come prima', ['1girl', '[artist name]'], leggi('1girl, [artist name],', 'a.txt'));
    dice('un elenco JSON in un .txt resta un elenco', ['1girl', 'solo'], leggi('["1girl", "solo"]', 'a.txt'));
    dice('il formato progetto in un .txt: trigger e tag', ['ohwx', 'smile'], leggi('{"globalTriggers":["ohwx"],"tags":["smile"]}', 'a.txt'));
    dice('...e le sue trigger', ['ohwx'], editor.parseTagTriggers('{"globalTriggers":["ohwx"],"tags":["smile"]}', 'a.txt'));
    dice('un .json rotto resta un errore', 'ERRORE: SyntaxError', leggi('{best quality}, 1girl', 'tags.json'));
    dice('un .json valido si legge', ['a', 'b'], leggi('{"tags":["a","b"]}', 'tags.json'));
    dice('un .txt che e\' un JSON rotto ({"tags": [...) resta un errore', 'ERRORE: SyntaxError', leggi('{"tags": ["a",', 'a.txt'));
    dice('un .txt che e\' un elenco JSON rotto (["a",) resta un errore', 'ERRORE: SyntaxError', leggi('["a", "b"', 'a.txt'));
    dice('un .txt con "{}" vuoto: errore (nessun elenco di tag)', 'ERRORE: Error', leggi('{}', 'a.txt'));
    dice('tag come oggetti: errore (niente "[object Object]")', 'ERRORE: Error', leggi('[{"tag":"x"}]', 'a.txt'));
    dice('TXT normale', ['red hair', 'smile', 'blue eyes'], leggi('red hair, smile\nblue eyes\n', 'a.txt'));
}

console.log('\n--- import dei tag del progetto: l\'export TXT che inizia con "{" ---');
{
    const r = await importa('{best quality}\n1girl\nsmile\n');
    dice('"{best quality}\\n1girl\\nsmile" entra nella palette', ['{best quality}', '1girl', 'smile'], r.palette);
    dice('...con il messaggio "importati (3)"', [[`${t.projectTagsImported} (3)`, 'success']], r.notifiche);
    const g = await importa('{{masterpiece}}, smile\n');
    dice('"{{masterpiece}}, smile" entra nella palette', ['{{masterpiece}}', 'smile'], g.palette);
}

console.log('\n--- import: quello che NON deve cambiare ---');
{
    const app = await importa(JSON.stringify({ app: 'Images Tag Manager for LORAs', globalTriggers: ['ohwx'], tags: ['smile'] }, null, 2));
    dice('il formato dell\'app (JSON con a capo)', ['smile', 'ohwx'], app.palette);
    const rotto = await importa('{"tags": ["a",');
    dice('JSON rotto: errore di lettura, palette intatta', [errore, []], [rotto.notifiche, rotto.palette]);
    const rottoSpazi = await importa('{\n  "tags": [');
    dice('JSON rotto con a capo: errore di lettura', errore, rottoSpazi.notifiche);
    const quadra = await importa('[artist name], smile\n');
    dice('TXT che inizia con "[": letto come TXT', ['[artist name]', 'smile'], quadra.palette);
    const vuoto = await importa('{}');
    dice('"{}": niente da importare, errore di lettura', errore, vuoto.notifiche);
}

process.exit(esito());
