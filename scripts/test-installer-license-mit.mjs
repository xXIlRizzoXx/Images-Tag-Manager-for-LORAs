/* ITALIANO: PROVA DEI "TERMINI D'USO" MOSTRATI DALL'INSTALLER (build/license_<lingua>.txt)
   Il repository e' sotto licenza MIT (LICENSE, package.json, README), che permette di copiare,
   modificare, ridistribuire e anche vendere il programma. La pagina di licenza dell'installer, in
   tutte e nove le lingue, diceva invece "non puoi rivenderlo": due licenze che si contraddicono.
   electron-builder mostra proprio questi nove file (nessun license.txt generico in build/), quindi
   ognuno deve citare la MIT e nessuno deve vietare la rivendita. Il resto non deve cambiare: BOM
   UTF-8 in testa (senza, gli accenti si leggono male), i sei punti numerati, nessuna garanzia.
   Uso:  node scripts/test-installer-license-mit.mjs   (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE "TERMS OF USE" SHOWN BY THE INSTALLER (build/license_<language>.txt)
   The repository is MIT licensed (LICENSE, package.json, README), which allows copying, modifying,
   redistributing and also selling the program. The installer's license page, in all nine
   languages, said "you may not resell it" instead: two licenses contradicting each other.
   electron-builder shows exactly these nine files (no generic license.txt in build/), so each must
   name the MIT License and none may forbid reselling. The rest must not change: UTF-8 BOM first
   (without it accents show garbled), the six numbered points, no warranty.
   Usage:  node scripts/test-installer-license-mit.mjs   (exits with code 1 if anything is off) */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();

const LINGUE = ['de', 'en', 'es', 'fr', 'it', 'ja', 'pt_BR', 'ru', 'zh_CN'];
// ITALIANO: le parole del divieto di rivendita nelle nove lingue (come erano scritte prima).
// ENGLISH: the resale-ban words in the nine languages (as they were written before).
const DIVIETO = /resell|rivend|revend|weiterverk|転売|转售|перепрод/i;

dice('premessa: il repository e\' sotto licenza MIT', [true, 'MIT'],
    [fs.readFileSync(path.join(radice, 'LICENSE'), 'utf8').startsWith('MIT License'),
        JSON.parse(fs.readFileSync(path.join(radice, 'package.json'), 'utf8')).license]);
dice('premessa: in build/ non c\'e\' un license.txt generico (valgono i nove file per lingua)', false,
    fs.existsSync(path.join(radice, 'build', 'license.txt')));

for (const lingua of LINGUE) {
    const file = path.join(radice, 'build', `license_${lingua}.txt`);
    const byte = fs.readFileSync(file);
    const testo = byte.toString('utf8').replace(/^﻿/, '');
    dice(`${lingua}: comincia con il BOM UTF-8`, true, byte[0] === 0xEF && byte[1] === 0xBB && byte[2] === 0xBF);
    // ITALIANO: "MIT" accanto alla parola "licenza" (il tedesco ha gia' "MIT" = "con" nei titoli).
    // ENGLISH: "MIT" next to the word "license" (German already has "MIT" = "with" in headings).
    dice(`${lingua}: cita la licenza MIT`, true,
        /MIT[ -]?(License|Lizenz|ライセンス|许可证)|(licenza|licence|licencia|licença|лицензией) MIT/.test(testo));
    dice(`${lingua}: nessun divieto di rivendita`, null, (testo.match(DIVIETO) || [null])[0]);
    dice(`${lingua}: i sei punti numerati ci sono ancora`, [1, 2, 3, 4, 5, 6],
        (testo.match(/^[1-6]\. /gm) || []).map((s) => Number(s[0])));
    dice(`${lingua}: nessun carattere sostitutivo (codifica intatta)`, false, testo.includes('�'));
}


// ITALIANO: ricontrollo lingue del 17/10/2026: i Termini tedeschi davano del "du" mentre le pagine
//           dell'installer intorno e tutto il programma danno del "Sie"; in spagnolo "afiliado"
//           regge "a", non "por".
// ENGLISH: language recheck of 2026-10-17: the German terms used "du" while the installer pages
//          around them and the whole app use "Sie"; in Spanish "afiliado" takes "a", not "por".
{
    const de = fs.readFileSync(path.join(radice, 'build', 'license_de.txt'), 'utf8');
    dice('de: i Termini danno del Sie, niente du/dein', null, (de.match(/\b(du|Du|dein[a-z]*|Dein[a-z]*|DEIN[A-Z]*)\b/) || [null])[0]);
    dice('de: virgolette tedesche, non dritte', false, de.includes('"'));
    const es = fs.readFileSync(path.join(radice, 'build', 'license_es.txt'), 'utf8');
    dice('es: "afiliado a", non "afiliado ni aprobado por"', [false, true], [/afiliado ni aprobado por/.test(es), /afiliado a Google/.test(es)]);
}

process.exit(esito());
