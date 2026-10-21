/* ITALIANO: CONTENT-SECURITY-POLICY STRETTA NELLA PAGINA DEL PROGRAMMA COSTRUITO
   Il programma apre dist/index.html con loadFile (file://). La politica stretta di electron/main.cjs
   e' un header HTTP (onHeadersReceived) e la guida alla sicurezza di Electron dice che con file://
   l'header non si puo' usare: restava quindi solo il meta di index.html, largo perche' in sviluppo
   Vite ne ha bisogno (WebSocket di HMR ws: wss:, script in linea ed eval di react-refresh). Questo
   plugin, solo nella build (vite build), toglie dal meta di dist/index.html 'unsafe-inline' e
   'unsafe-eval' da script-src e ws: wss: da connect-src: il meta del pacchetto diventa uguale alla
   politica di main.cjs (prova: scripts/test-csp-production-meta.mjs). In sviluppo il meta resta com'e'.

   ENGLISH: STRICT CONTENT-SECURITY-POLICY IN THE BUILT APP'S PAGE
   The app opens dist/index.html with loadFile (file://). electron/main.cjs's strict policy is an HTTP
   header (onHeadersReceived) and Electron's security guide says the header cannot be used with
   file://: so only index.html's meta was left, loose because Vite needs it in development (HMR
   WebSocket ws: wss:, react-refresh inline script and eval). This plugin, in the build only (vite
   build), removes 'unsafe-inline' and 'unsafe-eval' from script-src and ws: wss: from connect-src in
   dist/index.html's meta: the package's meta becomes equal to main.cjs's policy (test:
   scripts/test-csp-production-meta.mjs). In development the meta stays as it is. */

const META_CSP = /(<meta\s+http-equiv="Content-Security-Policy"\s+content=")([^"]*)(")/i;
const TOGLIERE = {
    'script-src': new Set(["'unsafe-inline'", "'unsafe-eval'"]),
    'connect-src': new Set(['ws:', 'wss:']),
};

export const stringiCspProduzione = (html) => {
    const m = META_CSP.exec(html);
    // ITALIANO: senza il meta la pagina costruita non avrebbe nessuna politica: meglio fermare la build.
    // ENGLISH: without the meta the built page would have no policy at all: better to stop the build.
    if (!m) throw new Error('csp-produzione: Content-Security-Policy meta not found in index.html');
    const direttive = m[2].split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
        const [nome, ...valori] = d.split(/\s+/);
        const via = TOGLIERE[nome.toLowerCase()];
        return [nome, ...(via ? valori.filter((v) => !via.has(v)) : valori)].join(' ');
    });
    return html.replace(META_CSP, (_tutto, prima, _vecchio, dopo) => prima + direttive.join('; ') + ';' + dopo);
};

export const cspProduzione = () => ({
    name: 'csp-produzione',
    apply: 'build',
    transformIndexHtml: (html) => stringiCspProduzione(html),
});
