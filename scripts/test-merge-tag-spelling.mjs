/* ITALIANO: PROVA CHE merge-tag-suggestions SCRIVA I TAG NUOVI NELLA FORMA DEL DIZIONARIO
   Il dizionario dei suggerimenti ha tutti i tag in minuscolo con spazi singoli. Unendo un file in
   stile Danbooru/WD14 ("Blue_Sky, Red  Scarf") lo script riconosceva i doppioni ignorando
   trattini bassi e maiuscole, ma scriveva il tag nuovo come l'aveva letto: 'Blue_Sky' finiva nel
   dizionario, e chi cliccava il suggerimento se lo trovava cosi' nei .txt. La regola: il piano
   (--out) e l'inserimento (--apply, anche di un piano scritto a mano) usano la forma minuscola con
   spazi singoli; le parentesi restano; un'emoticon senza lettere (^_^) resta com'e'; un tag gia'
   presente non si reinserisce. Il trattino basso resta dove fa parte del tag: le emoticon di WD14
   (o_o, x_x, 0_0) e i tag di qualita' di Pony (score_9, score_8_up, source_anime, rating_safe),
   che i modelli conoscono solo cosi': prima diventavano 'o o' e 'score 9', anche da un piano
   corretto a mano. Si lancia lo script VERO su una copia del dizionario VERO in una
   cartella temporanea: il dizionario del progetto non si tocca.
   Uso:  node scripts/test-merge-tag-spelling.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST THAT merge-tag-suggestions WRITES NEW TAGS IN THE DICTIONARY'S FORM
   The suggestion dictionary has every tag lowercase with single spaces. Merging a
   Danbooru/WD14-style file ("Blue_Sky, Red  Scarf") the script recognised duplicates ignoring
   underscores and case, but wrote the new tag as it had read it: 'Blue_Sky' went into the
   dictionary, and whoever clicked the suggestion got it like that in the .txt files. The rule:
   the plan (--out) and the insertion (--apply, also of a hand-written plan) use the lowercase
   single-space form; parentheses stay; an emoticon without letters (^_^) stays as it is; a tag
   already present is not inserted again. The underscore stays where it is part of the tag: the
   WD14 emoticons (o_o, x_x, 0_0) and Pony's quality tags (score_9, score_8_up, source_anime,
   rating_safe), which models only know that way: they used to become 'o o' and 'score 9', even
   from a plan corrected by hand. The REAL script runs on a copy of the REAL dictionary
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

    // ITALIANO: i tag in cui il trattino basso fa parte del nome lo tengono, nel piano e
    //           nell'inserimento (anche di un piano scritto a mano); gli altri no.
    // ENGLISH: tags whose underscore is part of the name keep it, in the plan and in the insertion
    //          (also of a hand-written plan); the others do not.
    // ITALIANO: '(o)_(o)' e' fatto solo di gruppi tra parentesi: la chiave che ignora le parentesi
    //           lo riduceva a '' e il rapporto lo scartava senza dirlo.
    // ENGLISH: '(o)_(o)' is made only of parenthesised groups: the key that ignores parentheses
    //          reduced it to '' and the report dropped it without a word.
    fs.writeFileSync(path.join(prova, 'pony.txt'), 'score_9, Score_8_Up, source_anime, rating_safe, o_o, X_X, 0_0, (o)_(o), <o>_<o>, Green_Field, scored_high\n');
    const rapportoPony = lancia('pony.txt', '--out', 'piano-pony.json');
    const pianoPony = JSON.parse(fs.readFileSync(path.join(prova, 'piano-pony.json'), 'utf8'));
    dice('il piano tiene i trattini bassi di emoticon e tag di Pony, toglie gli altri', ['(o)_(o)', '0_0', '<o>_<o>', 'green field', 'o_o', 'rating_safe', 'score_8_up', 'score_9', 'scored high', 'source_anime', 'x_x'], Object.keys(pianoPony).sort());
    dice('il rapporto conta 11 tag distinti (anche (o)_(o))', true, /tag distinti nei file : 11\b/.test(rapportoPony));
    fs.writeFileSync(path.join(prova, 'mano.json'), JSON.stringify({
        'Score_9': { categoria: 'framing', it: 'x' },
        'O_O': { categoria: 'framing', it: 'x' },
        'Source_Anime': { categoria: 'framing', it: 'x' },
        'Green_Field': { categoria: 'framing', it: 'x' },
        '(o)_(o)': { categoria: 'framing', it: 'x' },
        '(x)': { categoria: 'framing', it: 'x' },
    }));
    lancia('--apply', 'mano.json');
    const testoMano = fs.readFileSync(path.join(prova, 'src', 'constants', 'tagSuggestions.ts'), 'utf8');
    dice('un piano a mano con (o)_(o) lo inserisce col trattino basso', true, testoMano.includes("{ tag: '(o)_(o)', translations: { it: 'x', en: '(o)_(o)' } },"));
    dice('due tag fatti solo di parentesi non si scambiano per doppioni: (x) inserito', true, testoMano.includes("{ tag: '(x)', translations: { it: 'x', en: '(x)' } },"));
    dice('un piano a mano con score_9 inserisce { tag: \'score_9\', ... en: \'score_9\' }', true, testoMano.includes("{ tag: 'score_9', translations: { it: 'x', en: 'score_9' } },"));
    dice('un piano a mano con O_O inserisce o_o', true, testoMano.includes("{ tag: 'o_o', translations: { it: 'x', en: 'o_o' } },"));
    dice('un piano a mano con Source_Anime inserisce source_anime', true, testoMano.includes("{ tag: 'source_anime', translations: { it: 'x', en: 'source_anime' } },"));
    dice('un piano a mano con Green_Field inserisce ancora green field', true, testoMano.includes("{ tag: 'green field', translations: { it: 'x', en: 'green field' } },"));
    dice('nessun "score 9", "o o" o "source anime" nel dizionario', false, /\{ tag: '(score 9|o o|source anime)'/.test(testoMano));
    const dopoMano = tagScritti();
    dice('score_9 e score 9 sono lo stesso tag: un piano con "score 9" non lo reinserisce', dopoMano.length, (() => {
        fs.writeFileSync(path.join(prova, 'doppio.json'), JSON.stringify({ 'score 9': { categoria: 'framing', it: 'x' } }));
        lancia('--apply', 'doppio.json');
        return tagScritti().length;
    })());

    const TENUTI = new Set(['^_^', 'score_9', 'o_o', 'source_anime', '(o)_(o)']);
    const sbagliati = tagScritti().filter((t) => !TENUTI.has(t) && (/[A-Z_]/.test(t) || / {2}/.test(t)));
    dice('nessun altro tag del dizionario ha maiuscole, trattini bassi o doppi spazi', [], sbagliati);

    // ITALIANO: i tag scritti con il peso dei prompt sono i tag di sempre: masterpiece e best quality
    //           ci sono gia', smile no (entra senza peso), e (x) resta un tag a se'.
    // ENGLISH: tags written with a prompt weight are the usual tags: masterpiece and best quality are
    //          already there, smile is not (it goes in without the weight), and (x) stays a tag of its own.
    fs.writeFileSync(path.join(prova, 'pesi.txt'), '(masterpiece), ((Best_Quality)), (smile:1.2), [blue sky], (x)\n');
    const rapportoPesi = lancia('pesi.txt', '--out', 'piano-pesi.json');
    const pianoPesi = JSON.parse(fs.readFileSync(path.join(prova, 'piano-pesi.json'), 'utf8'));
    dice('i tag con il peso noti non sono proposti come nuovi; smile entra senza peso', ['smile'], Object.keys(pianoPesi).sort());
    dice('il rapporto conta 4 tag gia\' nel dizionario: masterpiece, best quality, blue sky e (x)', true, /gia' nel dizionario\s*: 4\b/.test(rapportoPesi));

    // ITALIANO: una precisazione tra parentesi fa un tag diverso: 'spring (object)' (la molla) non e'
    //           'spring' (la stagione), che c'e' gia'. La chiave toglieva tutto il testo tra parentesi
    //           e il rapporto li dava per "gia' nel dizionario"; con --apply finivano fra i saltati.
    // ENGLISH: a parenthesised qualifier makes a different tag: 'spring (object)' (the coil) is not
    //          'spring' (the season), which is already there. The key removed all text in parentheses
    //          and the report called them "already in the dictionary"; with --apply they were skipped.
    const conBase = tagScritti();
    dice('premessa: il dizionario ha spring, aura, fire e hood', [true, true, true, true], ['spring', 'aura', 'fire', 'hood'].map((t) => conBase.includes(t)));
    fs.writeFileSync(path.join(prova, 'precisazioni.txt'), 'spring (object), Aura_(Sousou_no_Frieren), Fire_(Element), hood (clothing), spring, Hood, zzqx\n');
    const rapportoPrec = lancia('precisazioni.txt', '--out', 'piano-prec.json');
    const pianoPrec = JSON.parse(fs.readFileSync(path.join(prova, 'piano-prec.json'), 'utf8'));
    dice('il piano propone i tag con la precisazione, non spring e hood', ['aura (sousou no frieren)', 'fire (element)', 'hood (clothing)', 'spring (object)', 'zzqx'], Object.keys(pianoPrec).sort());
    dice('il rapporto conta 2 tag gia\' nel dizionario: spring e hood', true, /gia' nel dizionario\s*: 2\b/.test(rapportoPrec));
    fs.writeFileSync(path.join(prova, 'prec.json'), JSON.stringify({ 'Spring_(Object)': { categoria: 'seasons', it: 'molla' } }));
    const rapportoApplyPrec = lancia('--apply', 'prec.json');
    dice('--apply inserisce { tag: \'spring (object)\', ... } e non lo salta', [true, false], [fs.readFileSync(dizionario, 'utf8').includes("{ tag: 'spring (object)', translations: { it: 'molla', en: 'spring (object)' } },"), /gia' presente/.test(rapportoApplyPrec)]);
    dice('spring_(object) e spring (object) sono lo stesso tag: un secondo --apply non lo reinserisce', tagScritti().length, (() => {
        fs.writeFileSync(path.join(prova, 'prec2.json'), JSON.stringify({ 'spring_(object)': { categoria: 'seasons', it: 'molla' } }));
        lancia('--apply', 'prec2.json');
        return tagScritti().length;
    })());

    // ITALIANO: rifare lo stesso inserimento non aggiunge niente (niente doppioni).
    // ENGLISH: repeating the same insertion adds nothing (no duplicates).
    const quanti = tagScritti().length;
    lancia('--apply', 'piano.json');
    dice('un secondo --apply dello stesso piano non aggiunge tag', quanti, tagScritti().length);
} finally {
    fs.rmSync(prova, { recursive: true, force: true });
}

process.exit(esito());
