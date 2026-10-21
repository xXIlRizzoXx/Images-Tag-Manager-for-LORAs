/* ITALIANO: PROVA DELLA CONTENT-SECURITY-POLICY NELLA PAGINA DEL PROGRAMMA COSTRUITO
   Il programma apre dist/index.html da file://, dove l'header CSP di electron/main.cjs non vale
   (guida alla sicurezza di Electron): restava il meta di index.html, che permette WebSocket verso
   qualsiasi indirizzo (ws: wss:) e script 'unsafe-inline' 'unsafe-eval', mentre README e
   CONTRIBUTING promettono che la finestra raggiunge solo Google. Ora il plugin csp-produzione
   (scripts/csp-produzione.mjs, in vite.config.ts) stringe il meta solo nella build. Si controlla:
   il meta di produzione ha esattamente le direttive della politica di main.cjs; il resto della
   pagina non cambia; in sviluppo (index.html) il meta resta largo per Vite; senza meta la build si
   ferma; vite.config.ts usa davvero il plugin.
   Uso:  node scripts/test-csp-production-meta.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE CONTENT-SECURITY-POLICY IN THE BUILT APP'S PAGE
   The app opens dist/index.html from file://, where electron/main.cjs's CSP header does not apply
   (Electron's security guide): index.html's meta was left, which allows WebSockets to any address
   (ws: wss:) and 'unsafe-inline' 'unsafe-eval' scripts, while README and CONTRIBUTING promise the
   window reaches only Google. Now the csp-produzione plugin (scripts/csp-produzione.mjs, in
   vite.config.ts) tightens the meta in the build only. Checked: the production meta has exactly the
   directives of main.cjs's policy; the rest of the page does not change; in development
   (index.html) the meta stays loose for Vite; without a meta the build stops; vite.config.ts really
   uses the plugin.
   Usage:  node scripts/test-csp-production-meta.mjs      (exits with code 1 if anything is off) */

import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const leggi = (rel) => fs.readFileSync(path.join(radice, rel), 'utf8');

let modulo = null;
try {
    modulo = await import(pathToFileURL(path.join(radice, 'scripts/csp-produzione.mjs')).href);
} catch {
    modulo = null;
}
dice('scripts/csp-produzione.mjs esiste ed esporta stringiCspProduzione e cspProduzione', true,
    !!modulo && typeof modulo.stringiCspProduzione === 'function' && typeof modulo.cspProduzione === 'function');

const META = /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]*)"/i;
const direttive = (csp) => csp.split(';').map((d) => d.trim().split(/\s+/).join(' ')).filter(Boolean);

const html = leggi('index.html');
const sviluppo = META.exec(html);
console.log('\n--- premesse: index.html (sviluppo) e la politica di main.cjs ---');
dice('index.html ha il meta CSP', true, !!sviluppo);
dice('in sviluppo il meta resta largo per Vite (ws: e unsafe-eval presenti)', true,
    !!sviluppo && sviluppo[1].includes('ws:') && sviluppo[1].includes("'unsafe-eval'"));
const main = leggi('electron/main.cjs');
const blocco = /const csp = \[([\s\S]*?)\]\.join\('; '\)/.exec(main);
const politicaMain = blocco ? [...blocco[1].matchAll(/"([^"]+)"/g)].map((m) => m[1].split(/\s+/).join(' ')) : [];
dice('premessa: politica di main.cjs letta (12 direttive)', 12, politicaMain.length);

console.log('\n--- il meta del pacchetto (dopo il plugin) ---');
let prodotto = '';
try {
    prodotto = modulo ? modulo.stringiCspProduzione(html) : '';
} catch {
    prodotto = '';
}
const prod = META.exec(prodotto);
dice('il meta c\'e\' ancora', true, !!prod);
const dirProd = prod ? direttive(prod[1]) : [];
dice('le direttive sono esattamente quelle di main.cjs', politicaMain, dirProd);
const connect = dirProd.find((d) => d.startsWith('connect-src ')) || '';
dice('connect-src: solo \'self\' e Google (niente ws: wss:)', "connect-src 'self' https://generativelanguage.googleapis.com", connect);
const script = dirProd.find((d) => d.startsWith('script-src ')) || '';
dice('script-src: solo \'self\' (niente unsafe-inline, unsafe-eval)', "script-src 'self'", script);
dice('style-src tiene \'unsafe-inline\' (serve a React)', true, dirProd.includes("style-src 'self' 'unsafe-inline'"));
dice('il resto della pagina non cambia', html.replace(META, ''), prodotto.replace(META, ''));
dice('applicato due volte da\' lo stesso risultato', prodotto, (() => { try { return modulo.stringiCspProduzione(prodotto); } catch { return null; } })());

console.log('\n--- il plugin vale solo nella build, e senza meta la build si ferma ---');
{
    const plugin = modulo ? modulo.cspProduzione() : null;
    dice('apply: \'build\' (in sviluppo Vite tiene il meta largo)', 'build', plugin ? plugin.apply : null);
    dice('transformIndexHtml stringe il meta', prodotto, plugin ? plugin.transformIndexHtml(html) : null);
    let errore = false;
    try { if (modulo) modulo.stringiCspProduzione('<html><head></head></html>'); } catch { errore = true; }
    dice('pagina senza meta CSP: errore', true, errore);
}

console.log('\n--- vite.config.ts usa il plugin ---');
{
    const vite = leggi('vite.config.ts');
    dice('importa cspProduzione da ./scripts/csp-produzione.mjs', true,
        /import\s*\{\s*cspProduzione\s*\}\s*from\s*'\.\/scripts\/csp-produzione\.mjs'/.test(vite));
    dice('lo mette tra i plugin', true, /plugins:\s*\[[^\]]*cspProduzione\(\)/.test(vite));
}

process.exit(esito());
