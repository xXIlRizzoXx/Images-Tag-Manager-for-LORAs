/* ITALIANO: PROVA DEI "TERMINI D'USO" DELL'INSTALLER E DEL SERVER MCP (build/license_<lingua>.txt)
   La sezione 3 dei Termini dice "i tuoi dati restano sul tuo computer" e la sezione 4 parla solo
   di Gemini: scritte prima del server MCP. Con il server MCP acceso e un'app AI collegata,
   get_photo e list_photos passano foto e tag a quell'app, e un'app che lavora in cloud li manda ai
   suoi server. Il README lo dice gia' ("leave your computer only if ... MCP server ..."); i Termini
   che l'utente accetta devono dirlo anche loro, in tutte e nove le lingue, dentro la sezione 3.
   Il resto non cambia: BOM UTF-8, fine riga LF, i sei punti numerati, codifica intatta.
   Uso:  node scripts/test-installer-license-mcp.mjs   (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE INSTALLER "TERMS OF USE" AND THE MCP SERVER (build/license_<language>.txt)
   Section 3 of the Terms says "your data stays on your computer" and section 4 talks only about
   Gemini: written before the MCP server existed. With the MCP server on and an AI app connected,
   get_photo and list_photos pass photos and tags to that app, and an app that works in the cloud
   sends them to its servers. The README already says so; the Terms the user accepts must say it
   too, in all nine languages, inside section 3. The rest must not change: UTF-8 BOM, LF line
   endings, the six numbered points, intact encoding.
   Usage:  node scripts/test-installer-license-mcp.mjs   (exits with code 1 if anything is off) */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();

const LINGUE = ['de', 'en', 'es', 'fr', 'it', 'ja', 'pt_BR', 'ru', 'zh_CN'];
// ITALIANO: la parola "cloud" nelle nove lingue (come la scrive mcpHint in src/constants.ts).
// ENGLISH: the word "cloud" in the nine languages (as mcpHint in src/constants.ts writes it).
const CLOUD = /cloud|Cloud|nube|nuvem|облак|云端|クラウド/;

// ITALIANO: premessa: il server MCP esiste davvero e get_photo manda l'immagine al client.
// ENGLISH: premise: the MCP server really exists and get_photo sends the image to the client.
{
    const server = fs.readFileSync(path.join(radice, 'electron', 'mcp-server.src.mjs'), 'utf8');
    dice('premessa: il server MCP ha get_photo e list_photos e manda un\'immagine', [true, true, true],
        [server.includes("'get_photo'"), server.includes("'list_photos'"), server.includes("type: 'image'")]);
}

for (const lingua of LINGUE) {
    const byte = fs.readFileSync(path.join(radice, 'build', `license_${lingua}.txt`));
    const testo = byte.toString('utf8').replace(/^﻿/, '');
    const sezione3 = (testo.match(/^3\. [\s\S]*?(?=^4\. )/m) || [''])[0];
    dice(`${lingua}: la sezione 3 nomina il server MCP`, true, /\bMCP\b/.test(sezione3));
    dice(`${lingua}: la sezione 3 dice che un'app in cloud manda foto e tag ai suoi server`, true, CLOUD.test(sezione3));
    dice(`${lingua}: la sezione 3 dice ancora che il programma non invia nulla di sua iniziativa`, true,
        /iniziativa|initiative|iniciativa|von sich aus|conta própria|собственной инициативе|自作主张|自分の判断/.test(sezione3));
    dice(`${lingua}: comincia con il BOM UTF-8`, true, byte[0] === 0xEF && byte[1] === 0xBB && byte[2] === 0xBF);
    dice(`${lingua}: fine riga solo LF`, false, byte.includes(0x0D));
    dice(`${lingua}: i sei punti numerati ci sono ancora`, [1, 2, 3, 4, 5, 6],
        (testo.match(/^[1-6]\. /gm) || []).map((s) => Number(s[0])));
    dice(`${lingua}: nessun carattere sostitutivo (codifica intatta)`, false, testo.includes('�'));
}

process.exit(esito());
