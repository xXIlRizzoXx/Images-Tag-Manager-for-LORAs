/* ITALIANO: PROVA CHE LA PAGINA "INSTALLAZIONE PULITA" DICE TUTTO QUELLO CHE CANCELLA
   Con la casella spuntata l'installer cancella l'intera cartella dati del programma. Dentro ci
   sono anche mcp.json (server MCP acceso e codice segreto) e il localStorage con il prompt
   personalizzato per l'AI. Il testo CLEAN_INSTALL_DESC elencava solo chiave AI, lingua, tema,
   suoni e backup dei tag: dopo l'aggiornamento il server MCP restava spento e, riacceso, aveva un
   codice nuovo (le app AI configurate col vecchio ricevevano 401), e il prompt scritto a mano era
   sparito senza avviso. La regola: in tutte e nove le lingue il testo nomina il server MCP, il
   suo codice segreto (con lo stesso nome dell'interfaccia) e il prompt personalizzato; il resto
   del testo (foto e .txt non toccati) resta, il file resta UTF-8 con BOM e le righe restano
   stringhe NSIS valide. La scritta deve anche avere spazio: la sua altezza in installer.nsh deve
   arrivare almeno a 118u.
   Uso:  node scripts/test-installer-clean-desc.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST THAT THE "CLEAN INSTALL" PAGE SAYS EVERYTHING IT DELETES
   With the box ticked the installer deletes the program's whole data folder. That folder also
   holds mcp.json (MCP server on and its secret token) and the localStorage with the custom AI
   prompt. CLEAN_INSTALL_DESC only listed AI key, language, theme, sounds and tag backup: after
   the update the MCP server stayed off and, turned on again, had a new token (AI apps set up
   with the old one got 401), and the hand-written prompt was gone without a word. The rule: in
   all nine languages the text names the MCP server, its secret token (with the interface's own
   name) and the custom prompt; the rest of the text (photos and .txt untouched) stays, the file
   stays UTF-8 with BOM and the lines stay valid NSIS strings. The label must also have room: its
   height in installer.nsh must be at least 118u.
   Usage:  node scripts/test-installer-clean-desc.mjs      (exits with code 1 if anything is off) */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const byte = fs.readFileSync(path.join(radice, 'build/lang-strings.nsh'));
const testo = byte.toString('utf8');
const installer = fs.readFileSync(path.join(radice, 'build/installer.nsh'), 'utf8');

let guai = 0, fatti = 0;
const dice = (cosa, ok) => {
    fatti++;
    if (!ok) guai++;
    console.log('  ' + (ok ? 'OK  ' : 'NO  ') + cosa);
};

// ITALIANO: per ogni lingua: le parole che devono esserci (MCP, nome del codice segreto come
//           in src/constants.ts mcpToken, nome del prompt come in aiCustomPromptLabel).
// ENGLISH: per language: the words that must be there (MCP, the secret token's name as in
//          src/constants.ts mcpToken, the prompt's name as in aiCustomPromptLabel).
const lingue = {
    ENGLISH: ['MCP', 'secret token', 'custom prompt'],
    ITALIAN: ['MCP', 'codice segreto', 'prompt personalizzato'],
    FRENCH: ['MCP', 'code secret', 'prompt personnalisé'],
    SPANISHINTERNATIONAL: ['MCP', 'código secreto', 'prompt personalizado'],
    GERMAN: ['MCP', 'geheime', 'prompt'],
    SIMPCHINESE: ['MCP', '密钥代码', '自定义提示词'],
    JAPANESE: ['MCP', '秘密コード', 'カスタムプロンプト'],
    PORTUGUESEBR: ['MCP', 'código secreto', 'prompt personalizado'],
    RUSSIAN: ['MCP', 'секретный код', 'промпт'],
};

dice('lang-strings.nsh comincia con il BOM UTF-8', byte[0] === 0xEF && byte[1] === 0xBB && byte[2] === 0xBF);

for (const [lingua, parole] of Object.entries(lingue)) {
    const righe = testo.split('\n').filter(r => r.startsWith(`LangString CLEAN_INSTALL_DESC \${LANG_${lingua}}`));
    dice(`${lingua}: una sola riga CLEAN_INSTALL_DESC`, righe.length === 1);
    if (righe.length !== 1) continue;
    const m = /^LangString CLEAN_INSTALL_DESC \$\{LANG_\w+\}\s+"(.*)"\r?$/.exec(righe[0]);
    dice(`${lingua}: la riga e' una stringa NSIS chiusa`, !!m);
    if (!m) continue;
    const corpo = m[1];
    // ITALIANO: dentro la stringa nessuna virgoletta nuda e nessun $ che non sia $\r, $\n o $\".
    // ENGLISH: inside the string no bare quote and no $ other than $\r, $\n or $\".
    dice(`${lingua}: niente virgolette o $ sciolti`, !/(^|[^\\])"/.test(corpo) && !/\$(?!\\[rn"])/.test(corpo));
    dice(`${lingua}: tre paragrafi come prima`, corpo.split('$\\r$\\n$\\r$\\n').length === 3);
    dice(`${lingua}: dice ancora che i .txt non vengono toccati`, corpo.includes('.txt'));
    for (const p of parole) dice(`${lingua}: nomina "${p}"`, corpo.toLowerCase().includes(p.toLowerCase()));
}

const etichetta = /\$\{NSD_CreateLabel\} 0 20u 100% (\d+)u "\$\(CLEAN_INSTALL_DESC\)"/.exec(installer);
dice('installer.nsh: la scritta della pagina e\' alta almeno 118u', !!etichetta && Number(etichetta[1]) >= 118);
dice('installer.nsh: la scritta non esce dalla pagina (20u + altezza <= 140u)', !!etichetta && 20 + Number(etichetta[1]) <= 140);
dice('installer.nsh: resta puro ASCII', ![...fs.readFileSync(path.join(radice, 'build/installer.nsh'))].some(b => b > 0x7F));

console.log(`\n${guai === 0 ? 'TUTTO A POSTO' : 'PROBLEMI: ' + guai} (${fatti} controlli)`);
process.exit(guai === 0 ? 0 : 1);
