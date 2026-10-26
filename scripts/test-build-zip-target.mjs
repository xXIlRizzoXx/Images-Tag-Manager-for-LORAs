/* ITALIANO: PROVA DELLA PORTABLE IN .ZIP
   Il 26/10/2026 Avast ha bloccato l'installer 2.0.2 (non firmato, mai visto prima) per il suo
   comportamento: estrae file, chiude il programma aperto, toglie la versione vecchia. Accanto a
   installer e portable .exe si pubblica allora anche una portable in .zip, che si scompatta e si apre
   senza nessun programma che estrae o chiude altro. La regola: la build fa tre file, la portable .exe
   e l'installer tengono il nome di sempre (chi li cerca per nome li ritrova), e lo .zip ha un nome
   che dice cos'e'. Si legge il package.json VERO e si espandono i nomi come fa electron-builder.
   Uso:  node scripts/test-build-zip-target.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE .ZIP PORTABLE
   On 26/10/2026 Avast blocked the 2.0.2 installer (unsigned, never seen before) for its behaviour:
   it extracts files, closes the running app, removes the old version. Next to the installer and the
   portable .exe a .zip portable is now published too: it is unpacked and opened, with no program
   extracting or closing anything. The rule: the build makes three files, the portable .exe and the
   installer keep their usual names (whoever looks for them by name still finds them), and the .zip
   has a name that says what it is. The REAL package.json is read and the names are expanded the
   way electron-builder does.
   Usage:  node scripts/test-build-zip-target.mjs      (exits with code 1 if anything is off) */

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const pacchetto = JSON.parse(fs.readFileSync(path.join(radice, 'package.json'), 'utf8'));
const b = pacchetto.build;
const bersagli = (b.win.target || []).map((t) => (typeof t === 'string' ? t : t.target));

// ITALIANO: i nomi come li compone electron-builder: la regola del bersaglio, altrimenti quella di win.
// ENGLISH: the names as electron-builder composes them: the target's own rule, otherwise win's.
const nome = (bersaglio, ext) => {
    const regola = b[bersaglio]?.artifactName || b.win.artifactName;
    return regola ? regola.replace('${productName}', b.productName).replace('${version}', '2.0.2').replace('${ext}', ext) : null;
};

dice('la build fa installer, portable .exe e portable .zip', 'nsis,portable,zip', [...bersagli].sort().join(','));
dice('installer: nome di sempre', 'Images Tag Manager for LORAs Setup 2.0.2.exe', nome('nsis', 'exe'));
dice('portable .exe: nome di sempre', 'Images Tag Manager for LORAs 2.0.2.exe', nome('portable', 'exe'));
dice('portable .zip: il nome dice che e\' la portable', 'Images Tag Manager for LORAs 2.0.2 portable.zip', nome('zip', 'zip'));
dice('i tre nomi sono diversi (nessun file ne copre un altro)', 3, new Set([nome('nsis', 'exe'), nome('portable', 'exe'), nome('zip', 'zip')]).size);

esito();
