/*
 * ITALIANO: l'intestazione di scripts/make-readme-shots.mjs (l'unica istruzione indicata da
 *   CONTRIBUTING.md per rifare le immagini del README) deve funzionare se seguita alla lettera:
 *   lancio con electron (sotto node l'import da 'electron' non ha "app"), indirizzo coerente
 *   con "npm run dev", tutte le opzioni del codice elencate, e "nessuna foto reale" detto solo
 *   per il caso senza --folder (con --folder lo script copia foto vere in public/__shots).
 *   Legge i file come testo: non avvia niente.
 * ENGLISH: the header of scripts/make-readme-shots.mjs (the only instruction CONTRIBUTING.md
 *   points to for redoing the README images) must work when followed literally: launched with
 *   electron (under node the 'electron' import has no "app"), an address consistent with
 *   "npm run dev", every option of the code listed, and "no real photos" said only for the case
 *   without --folder (with --folder the script copies real photos into public/__shots).
 *   Reads the files as text: starts nothing.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'scripts', 'make-readme-shots.mjs'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

let falliti = 0;
const dice = (nome, ok) => { console.log((ok ? 'OK  ' : 'NO  ') + nome); if (!ok) falliti++; };

const fine = src.indexOf('*/');
const testa = fine > 0 ? src.slice(0, fine) : '';
dice('lo script si apre con un commento di intestazione', src.startsWith('/*') && fine > 0);

// 1. Lancio: con electron, mai con node.
dice('la riga d\'uso lancia lo script con electron', /npx electron scripts\/make-readme-shots\.mjs/.test(testa));
dice('la riga d\'uso non dice di lanciarlo con node', !/(^|[\s*])node scripts\/make-readme-shots\.mjs/m.test(testa));

// 2. Indirizzo: la porta di "npm run dev" e quella predefinita del codice devono tornare.
const portaDev = (String(pkg.scripts && pkg.scripts.dev).match(/--port[= ](\d+)/) || [])[1];
dice('package.json "dev" dichiara una porta', !!portaDev);
const predefinito = (src.match(/argOf\('url',\s*'([^']+)'\)/) || [])[1];
dice('il codice ha un indirizzo predefinito', !!predefinito);
const portaPredefinita = predefinito ? new URL(predefinito).port : '';
if (/npm run dev/.test(testa) && portaPredefinita !== portaDev) {
    dice(`con npm run dev (porta ${portaDev}) l'intestazione dice di passare --url http://localhost:${portaDev}`,
        testa.includes(`--url http://localhost:${portaDev}`));
}
// ogni porta citata nell'intestazione e' quella di npm run dev o quella predefinita del codice
const porteCitate = [...testa.matchAll(/localhost:(\d+)/g)].map(m => m[1]);
dice('l\'intestazione cita almeno un indirizzo', porteCitate.length > 0);
for (const p of new Set(porteCitate)) {
    dice(`la porta ${p} citata e' quella di npm run dev o quella predefinita`, p === portaDev || p === portaPredefinita);
}
if (portaPredefinita && portaPredefinita !== portaDev) {
    dice(`l'intestazione dice come avere un server sulla porta predefinita ${portaPredefinita}`,
        testa.includes(`--port=${portaPredefinita}`) || testa.includes(`--port ${portaPredefinita}`));
}

// 3. Opzioni: tutte quelle lette dal codice compaiono nell'intestazione.
const opzioni = [...src.matchAll(/argOf\('([a-z]+)'/g)].map(m => m[1]);
dice('il codice legge delle opzioni', opzioni.length >= 4);
for (const o of new Set(opzioni)) dice(`l'opzione --${o} e' descritta nell'intestazione`, testa.includes('--' + o));

// 4. Foto vere: --folder e public/__shots spiegati; "nessuna foto reale" solo per il caso senza --folder.
dice('l\'intestazione dice che --folder copia foto vere in public/__shots', testa.includes('public/__shots'));
for (const frase of ['nessuna foto reale', 'no real photos']) {
    let i = testa.indexOf(frase);
    while (i >= 0) {
        const prima = testa.slice(Math.max(0, i - 250), i);
        dice(`"${frase}" (posizione ${i}) e' detto solo per il caso senza --folder`, /(senza|without) --folder/i.test(prima));
        i = testa.indexOf(frase, i + 1);
    }
}

// 5. Fine riga: il file resta LF.
dice('make-readme-shots.mjs resta LF', !src.includes('\r'));

if (falliti) { console.log(`\nFALLITO: ${falliti} controlli`); process.exit(1); }
console.log('\nTUTTO OK');
