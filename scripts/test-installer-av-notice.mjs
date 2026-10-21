/* ITALIANO: PROVA CHE L'AVVISO ANTIVIRUS DELL'INSTALLER DICE CHE E' IL PROGRAMMA A NON ESSERE PERICOLOSO
   La pagina di benvenuto dell'installer comincia con AV_NOTICE_TEXT. Quando il testo e' stato
   accorciato, in francese, spagnolo, tedesco, portoghese e russo la prima frase ha perso il nome
   del programma, ma la frase dopo e' rimasta con il pronome: «Il n'est pas dangereux» si legava a
   «votre antivirus», «Ele não é perigoso» a «o antivírus», «Она не опасна» alla firma (подписи),
   e in tedesco e spagnolo il soggetto restava indovinato. La regola: in quelle cinque lingue la
   frase di rassicurazione ha come soggetto il programma; il testo non supera la lunghezza gia'
   misurata come sicura nella casella fissa della pagina (commit che ha accorciato l'avviso: piu'
   lungo di cosi' le ultime righe venivano tagliate); il file resta UTF-8 con BOM e ci sono
   sempre le nove righe.
   Uso:  node scripts/test-installer-av-notice.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST THAT THE INSTALLER'S ANTIVIRUS NOTICE SAYS IT IS THE PROGRAM THAT IS NOT DANGEROUS
   The installer's welcome page starts with AV_NOTICE_TEXT. When the text was shortened, in French,
   Spanish, German, Portuguese and Russian the first sentence lost the program's name but the next
   sentence kept its pronoun: "Il n'est pas dangereux" bound to "votre antivirus", "Ele não é
   perigoso" to "o antivírus", "Она не опасна" to the signature (подписи), and in German and
   Spanish the subject was left to guess. The rule: in those five languages the reassuring sentence
   has the program as its subject; the text is not longer than the length already measured as safe
   in the page's fixed box (beyond it the last lines were cut off); the file stays UTF-8 with BOM
   and all nine lines are there.
   Usage:  node scripts/test-installer-av-notice.mjs      (exits with code 1 if anything is off) */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const byte = fs.readFileSync(path.join(radice, 'build/lang-strings.nsh'));
const testo = byte.toString('utf8');

let guai = 0, fatti = 0;
const dice = (cosa, ok) => {
    fatti++;
    if (!ok) guai++;
    console.log('  ' + (ok ? 'OK  ' : 'NO  ') + cosa);
};

dice('il file comincia con il BOM UTF-8 (EF BB BF)', byte[0] === 0xef && byte[1] === 0xbb && byte[2] === 0xbf);

const righe = {};
for (const m of testo.matchAll(/^LangString AV_NOTICE_TEXT \$\{LANG_(\w+)\}\s+"([^"\r\n]*)"\r?$/gm)) righe[m[1]] = m[2];
const tutte = ['ENGLISH', 'ITALIAN', 'FRENCH', 'SPANISHINTERNATIONAL', 'GERMAN', 'SIMPCHINESE', 'JAPANESE', 'PORTUGUESEBR', 'RUSSIAN'];
dice('ci sono le nove righe AV_NOTICE_TEXT, ognuna una stringa NSIS valida', tutte.every(l => typeof righe[l] === 'string' && righe[l].length > 0));

// ITALIANO: per lingua: la frase che deve esserci (programma come soggetto), quella sbagliata che
//           non deve tornare, e la lunghezza massima gia' misurata come sicura nella casella.
// ENGLISH: per language: the sentence that must be there (program as subject), the wrong one that
//          must not come back, and the maximum length already measured as safe in the box.
const regole = {
    FRENCH: { giusta: 'Ce programme n\'est pas dangereux', sbagliata: /(^|\. )Il n'est pas dangereux/, tetto: 259 },
    SPANISHINTERNATIONAL: { giusta: 'El programa no es peligroso', sbagliata: /(^|\. )No es peligroso/, tetto: 226 },
    GERMAN: { giusta: 'Das Programm ist nicht gefährlich', sbagliata: /(^|\. )Es ist nicht gefährlich/, tetto: 252 },
    PORTUGUESEBR: { giusta: 'O programa não é perigoso', sbagliata: /(^|\. )Ele não é perigoso/, tetto: 231 },
    RUSSIAN: { giusta: 'Программа не опасна', sbagliata: /(^|\. )Она не опасна/, tetto: 233 },
};
for (const [lingua, r] of Object.entries(regole)) {
    const t = righe[lingua] || '';
    dice(lingua + ': la rassicurazione ha il programma come soggetto («' + r.giusta + '»)', t.includes(r.giusta));
    dice(lingua + ': non torna il pronome senza soggetto chiaro', !r.sbagliata.test(t));
    const n = [...t].length;
    dice(lingua + ': ' + n + ' caratteri, non oltre i ' + r.tetto + ' misurati come sicuri', n > 0 && n <= r.tetto);
}

// ITALIANO: le lingue che gia' nominavano il programma restano come sono.
// ENGLISH: the languages that already named the program stay as they are.
dice('ENGLISH nomina ancora il programma', (righe.ENGLISH || '').includes('about this program'));
dice('ITALIAN nomina ancora il programma', (righe.ITALIAN || '').includes('il programma non ha'));
dice('SIMPCHINESE nomina ancora il programma', (righe.SIMPCHINESE || '').includes('本程序'));

console.log('\n' + (guai ? 'FALLITE ' + guai + ' su ' + fatti : 'TUTTE PASSATE (' + fatti + ')'));
process.exit(guai ? 1 : 0);
