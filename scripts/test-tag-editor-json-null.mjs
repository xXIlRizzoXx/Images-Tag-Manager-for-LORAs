/* ITALIANO: PROVA DEI .JSON CON VOCI null E CON "globalTriggers" CHE NON E' UN ELENCO
   L'editor dei file di tag leggeva i .json con meno cautele dell'import dei tag del progetto: una voce
   null di ["1girl", null, "solo"] diventava il tag «null» (che finiva anche nell'elenco dei tag del
   progetto e, salvando, nel file), e {"tags":["a"],"globalTriggers":"ohwx"} si apriva con i tag
   «o», «h», «w», «x», «a» (il testo veniva sparso lettera per lettera). Ora valgono le regole
   dell'import dei tag del progetto: le voci null e undefined si saltano e un globalTriggers che non e'
   un elenco si ignora; risalvando, quel campo resta com'era invece di diventare [].
   Si eseguono i testi VERI di parseTagFile, parseTagTriggers, parseTagShape e serializeTagFile presi
   da src/components/TagFileEditor.tsx.
   Uso:  node scripts/test-tag-editor-json-null.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF .JSON FILES WITH null ENTRIES AND WITH A "globalTriggers" THAT IS NOT A LIST
   The tag file editor read .json files with fewer safeguards than the project tag import: a null
   entry of ["1girl", null, "solo"] became the tag "null" (which also reached the project tag list
   and, on save, the file), and {"tags":["a"],"globalTriggers":"ohwx"} opened with the tags "o", "h",
   "w", "x", "a" (the text was spread letter by letter). Now the project tag import rules apply: null
   and undefined entries are skipped and a globalTriggers that is not a list is ignored; when saved
   back, that field stays as it was instead of becoming [].
   The REAL texts of parseTagFile, parseTagTriggers, parseTagShape and serializeTagFile from
   src/components/TagFileEditor.tsx are run.
   Usage:  node scripts/test-tag-editor-json-null.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const sorgente = fs.readFileSync(process.argv[2] || path.join(radice, 'src/components/TagFileEditor.tsx'), 'utf8');

const ritaglia = (intestazione, chiusura) => {
    const inizio = sorgente.indexOf(intestazione);
    chiusura.lastIndex = Math.max(inizio, 0);
    const fine = inizio < 0 ? null : chiusura.exec(sorgente);
    if (inizio < 0 || !fine) {
        console.log('NO  non trovato in src/components/TagFileEditor.tsx: ' + intestazione.trim());
        process.exit(1);
    }
    return sorgente.slice(inizio, fine.index + fine[0].length).replace(/^export /, '');
};
const fuori = /\r?\n\};\r?\n/g;
const testo = [
    ritaglia('const SEMBRA_JSON = ', /;\r?\n/g),
    ritaglia('export const parseTagFile = (', fuori),
    ritaglia('export const parseTagTriggers = (', fuori),
    ritaglia('export const parseTagShape = (', fuori),
    ritaglia('export const serializeTagFile = (', fuori),
].join('\n');
const codice = (await esbuild.transform(testo, { loader: 'ts' })).code;
const { parseTagFile, parseTagTriggers, parseTagShape, serializeTagFile } =
    new Function(codice + '\nreturn { parseTagFile, parseTagTriggers, parseTagShape, serializeTagFile };')();
const leggi = (contenuto, nome) => { try { return parseTagFile(contenuto, nome); } catch (e) { return 'ERRORE: ' + e.message; } };

console.log('\n--- voci null e undefined: si saltano ---');
dice('lista.json ["1girl", null, "solo"]: niente tag «null»', ['1girl', 'solo'], leggi('["1girl", null, "solo"]', 'lista.json'));
dice('prog.json {"tags":["a", null, "b"]}: niente tag «null»', ['a', 'b'], leggi('{"tags":["a", null, "b"]}', 'prog.json'));
dice('un elenco di soli null: nessun tag, nessun errore', [], leggi('[null, null]', 'lista.json'));
dice('un .txt che contiene un elenco JSON con null: niente «null»', ['x', 'y'], leggi('["x", null, "y"]', 'tags.txt'));
dice('risalvando la lista si scrive senza null', '[\n  "1girl",\n  "solo"\n]',
    serializeTagFile(leggi('["1girl", null, "solo"]', 'lista.json'), 'lista.json', [], { nome: 'lista.json', forma: parseTagShape('["1girl", null, "solo"]', 'lista.json') }));

console.log('\n--- globalTriggers che non e\' un elenco: si ignora ---');
{
    const contenuto = '{"tags":["a"],"globalTriggers":"ohwx"}';
    dice('prog.json con globalTriggers testo: solo «a», niente lettere', ['a'], leggi(contenuto, 'prog.json'));
    dice('le trigger lette: nessuna', [], parseTagTriggers(contenuto, 'prog.json'));
    const forma = parseTagShape(contenuto, 'prog.json');
    const salvato = JSON.parse(serializeTagFile(['a', 'b'], 'prog.json', [], { nome: 'prog.json', forma }));
    dice('risalvando: globalTriggers resta il testo di prima, tags cambia', { tags: ['a', 'b'], globalTriggers: 'ohwx' }, salvato);
    dice('globalTriggers numero: si apre (prima dava l\'errore generico)', ['a'], leggi('{"tags":["a"],"globalTriggers":5}', 'prog.json'));
}

console.log('\n--- quello che NON deve cambiare ---');
dice('un elenco senza null resta uguale', ['1girl', 'solo'], leggi('["1girl","solo"]', 'lista.json'));
dice('globalTriggers elenco: le trigger in testa', ['ohwx', 'a'], leggi('{"tags":["a"],"globalTriggers":["ohwx"]}', 'prog.json'));
dice('le trigger elenco si leggono', ['ohwx'], parseTagTriggers('{"tags":["a"],"globalTriggers":["ohwx"]}', 'prog.json'));
dice('i numeri restano tag', ['1', '2'], leggi('[1, 2]', 'lista.json'));
dice('un oggetto fra i tag resta un errore', 'ERRORE: JSON senza elenco di tag', leggi('[{"a":1}]', 'lista.json'));
{
    const forma = parseTagShape('{"tags":["a"],"globalTriggers":["ohwx"]}', 'prog.json');
    const salvato = JSON.parse(serializeTagFile(['ohwx', 'a'], 'prog.json', ['ohwx'], { nome: 'prog.json', forma }));
    dice('globalTriggers elenco risalvato: le trigger restano trigger', { tags: ['a'], globalTriggers: ['ohwx'] }, salvato);
    const tolta = JSON.parse(serializeTagFile(['a'], 'prog.json', ['ohwx'], { nome: 'prog.json', forma }));
    dice('trigger tolta nell\'editor: globalTriggers diventa []', { tags: ['a'], globalTriggers: [] }, tolta);
}
dice('un .txt normale', ['1girl', 'solo'], leggi('1girl, solo,', 'a.txt'));

process.exit(esito());
