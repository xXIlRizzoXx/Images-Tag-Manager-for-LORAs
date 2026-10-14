/* ITALIANO: PROVA DELLE PROMESSE DEL README (E DI CONTRIBUTING) CONTRO IL CODICE
   Il README pubblico prometteva cose che il programma non fa piu' cosi':
   - "non chiama mai casa" e "Google e' l'unico indirizzo raggiungibile", ma chi risponde si' alla
     domanda sugli aggiornamenti fa collegare il programma a GitHub a ogni avvio;
   - "si usa un solo modello (Gemini 3.6 Flash)", ma il programma sceglie e cambia da solo il
     modello piu' recente della linea gratuita;
   - "il ritmo resta nel piano gratuito", ma il cursore della velocita' arriva oltre quel limite;
   - "cancellare manda nel Cestino di Windows, mai direttamente nel nulla", ma per le cartelle di
     rete (che il Cestino non ce l'hanno) la seconda conferma cancella per sempre.
   La regola: finche' il codice fa una di queste cose, la frase vecchia non deve tornare e quella
   nuova deve nominare l'eccezione. Si legge il codice VERO, non una copia.
   Uso:  node scripts/test-readme-claims.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE README (AND CONTRIBUTING) PROMISES AGAINST THE CODE
   The public README promised things the app no longer does that way:
   - "never phones home" and "Google is the only address it can reach", but whoever says yes to
     the update question makes the app connect to GitHub at every start;
   - "one model is used (Gemini 3.6 Flash)", but the app picks and switches to the newest model of
     the free line by itself;
   - "the pace stays inside Google's free tier", but the speed slider goes past that limit;
   - "deleting sends them to the Windows Recycle Bin, never straight to nothing", but for network
     folders (which have no Recycle Bin) the second confirmation deletes for good.
   The rule: while the code does one of these things, the old sentence must not come back and the
   new one must name the exception. The REAL code is read, not a copy.
   Usage:  node scripts/test-readme-claims.mjs      (exits with code 1 if anything is off) */

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const leggi = (f) => fs.readFileSync(path.join(radice, f), 'utf8');

const readme = leggi('README.md');
const contributing = leggi('CONTRIBUTING.md');
const main = leggi('electron/main.cjs');
const gemini = leggi('src/services/geminiService.ts');
const app = leggi('src/App.tsx');

// ITALIANO: la sezione Privacy del README, dal suo titolo al separatore successivo.
// ENGLISH: the README Privacy section, from its heading to the next separator.
const privacy = (readme.match(/## 🔒 Privacy[\s\S]*?\n---/) || [''])[0];
dice('il README ha la sezione Privacy', true, privacy.length > 0);

if (main.includes('api.github.com')) {
    console.log('Il programma puo\' collegarsi a GitHub (controllo aggiornamenti).');
    dice('niente piu\' "never phones home"', false, readme.includes('never phones home'));
    dice('niente piu\' "Google is the only address"', false, readme.includes('Google is the only address'));
    dice('la sezione Privacy nomina GitHub', true, privacy.includes('GitHub'));
}

if (/export\s+(const|let|(async\s+)?function)\s+aggiornaModelloAutomatico\b/.test(gemini)) {
    console.log('Il programma sceglie il modello da solo.');
    dice('niente piu\' "one model is used"', false, readme.includes('one model is used'));
    dice('niente piu\' un modello fisso "Gemini 3.6 Flash"', false, readme.includes('Gemini 3.6 Flash'));
}

const cursore = app.match(/value=\{aiRpm\}/) && app.match(/min=\{\d+\} max=\{(\d+)\}[^\n]*\n[^\n]*value=\{aiRpm\}/);
if (cursore && Number(cursore[1]) > 15) {
    console.log(`Il cursore della velocita' arriva a ${cursore[1]} richieste al minuto.`);
    dice('niente piu\' "the pace stays inside Google\'s free tier" senza riserve', false, readme.includes("the pace stays inside Google's free tier"));
}

if (/chiediEliminazioneDefinitiva/.test(app)) {
    console.log('Il programma puo\' cancellare per sempre dove il Cestino di Windows non c\'e\'.');
    for (const [nome, testo] of [['README', readme], ['CONTRIBUTING', contributing]]) {
        dice(`${nome}: niente piu' "never straight to nothing"`, false, testo.includes('never straight to nothing'));
        dice(`${nome}: nomina le cartelle di rete`, true, /network folders/i.test(testo));
    }
}

process.exit(esito());
