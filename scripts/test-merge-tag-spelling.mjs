/* ITALIANO: PROVA CHE merge-tag-suggestions SCRIVA I TAG NUOVI NELLA FORMA DEL DIZIONARIO
   Il dizionario dei suggerimenti ha tutti i tag in minuscolo con spazi singoli. Unendo un file in
   stile Danbooru/WD14 ("Blue_Sky, Red  Scarf") lo script riconosceva i doppioni ignorando
   trattini bassi e maiuscole, ma scriveva il tag nuovo come l'aveva letto: 'Blue_Sky' finiva nel
   dizionario, e chi cliccava il suggerimento se lo trovava cosi' nei .txt. La regola: il piano
   (--out) e l'inserimento (--apply, anche di un piano scritto a mano) usano la forma minuscola con
   spazi singoli; le parentesi restano; un'emoticon senza lettere (^_^) resta com'e'; un tag gia'
   presente non si reinserisce. Si lancia lo script VERO su una copia del dizionario VERO in una
   cartella temporanea: il dizionario del progetto non si tocca.
   Uso:  node scripts/test-merge-tag-spelling.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST THAT merge-tag-suggestions WRITES NEW TAGS IN THE DICTIONARY'S FORM
   The suggestion dictionary has every tag lowercase with single spaces. Merging a
   Danbooru/WD14-style file ("Blue_Sky, Red  Scarf") the script recognised duplicates ignoring
   underscores and case, but wrote the new tag as it had read it: 'Blue_Sky' went into the
   dictionary, and whoever clicked the suggestion got it like that in the .txt files. The rule:
   the plan (--out) and the insertion (--apply, also of a hand-written plan) use the lowercase
   single-space form; parentheses stay; an emoticon without letters (^_^) stays as it is; a tag
   already present is not inserted again. The REAL script runs on a copy of the REAL dictionary
   in a temporary folder: the project dictionary is not touched.
   Usage:  node scripts/test-merge-tag-spelling.mjs      (exits with code 1 if anything is off) */

import fs from 'node:fs';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();

const prova = fs.mkdtempSync(path.join(os.tmpdir(), 'itm-merge-'));
try {
    fs.mkdirSync(path.join(prova, 'scripts'));
    fs.mkdirSync(path.join(prova, 'src', 'constants'), { recursive: true });
    const script = path.join(prova, 'scripts', 'merge-tag-suggestions.mjs');
    const dizionario = path.join(prova, 'src', 'constants', 'tagSuggestions.ts');
    fs.copyFileSync(path.join(radice, 'scripts', 'merge-tag-suggestions.mjs'), script);
    fs.copyFileSync(path.join(radice, 'src', 'constants', 'tagSuggestions.ts'), dizionario);
    const lancia = (...arg) => execFileSync(process.execPath, [script, ...arg], { cwd: prova, encoding: 'utf8' });
    const tagScritti = () => [...fs.readFileSync(dizionario, 'utf8').matchAll(/\{ tag: '((?:[^'\\]|\\.)*)'/g)].map((m) => m[1]);

    const prima = tagScritti();
    dice('premessa: il dizionario vero ha "extreme close-up" e nessun "blue sky"', [true, false], [prima.includes('extreme close-up'), prima.includes('blue sky')]);

    // ITALIANO: passo 1, il rapporto con il piano da riempire.
    // ENGLISH: step 1, the report with the plan to fill in.
    fs.writeFileSync(path.join(prova, 'in.txt'), 'Blue_Sky, Red  Scarf, Extreme_Close-Up\n');
    lancia('in.txt', '--out', 'piano.json');
    const piano = JSON.parse(fs.readFileSync(path.join(prova, 'piano.json'), 'utf8'));
    dice('il piano propone i tag nuovi in minuscolo con spazi singoli', ['blue sky', 'red scarf'], Object.keys(piano).sort());

    // ITALIANO: passo 2, l'inserimento.
    // ENGLISH: step 2, the insertion.
    for (const v of Object.values(piano)) { v.categoria = 'framing'; v.it = 'x'; }
    fs.writeFileSync(path.join(prova, 'piano.json'), JSON.stringify(piano));
    lancia('--apply', 'piano.json');
    const testo = fs.readFileSync(dizionario, 'utf8');
    dice('inserito { tag: \'blue sky\', ... en: \'blue sky\' }', true, testo.includes("{ tag: 'blue sky', translations: { it: 'x', en: 'blue sky' } },"));
    dice('inserito { tag: \'red scarf\', ... en: \'red scarf\' }', true, testo.includes("{ tag: 'red scarf', translations: { it: 'x', en: 'red scarf' } },"));
    dice('nessun "Blue_Sky" o "Red  Scarf" nel dizionario', false, /Blue_Sky|Red {2}Scarf/.test(testo));

    // ITALIANO: un piano scritto a mano (o da una versione vecchia dello script) con la grafia grezza.
    // ENGLISH: a plan written by hand (or by an older version of the script) with the raw spelling.
    fs.writeFileSync(path.join(prova, 'vecchio.json'), JSON.stringify({
        'Zzqx_Thing': { categoria: 'framing', it: 'x' },
        'Hatsune_Miku_(Vocaloid)': { categoria: 'framing', it: 'x' },
        '^_^': { categoria: 'framing', it: 'x' },
    }));
    lancia('--apply', 'vecchio.json');
    const dopo = tagScritti();
    dice('un piano scritto a mano viene normalizzato (zzqx thing)', [true, false], [dopo.includes('zzqx thing'), dopo.includes('Zzqx_Thing')]);
    dice('la parentesi resta: hatsune miku (vocaloid)', true, dopo.includes('hatsune miku (vocaloid)'));
    dice('un\'emoticon senza lettere resta com\'e\': ^_^', true, dopo.includes('^_^'));
    const sbagliati = dopo.filter((t) => t !== '^_^' && (/[A-Z_]/.test(t) || / {2}/.test(t)));
    dice('nessun tag del dizionario ha maiuscole, trattini bassi o doppi spazi', [], sbagliati);

    // ITALIANO: rifare lo stesso inserimento non aggiunge niente (niente doppioni).
    // ENGLISH: repeating the same insertion adds nothing (no duplicates).
    const quanti = dopo.length;
    lancia('--apply', 'piano.json');
    dice('un secondo --apply dello stesso piano non aggiunge tag', quanti, tagScritti().length);
} finally {
    fs.rmSync(prova, { recursive: true, force: true });
}

process.exit(esito());
