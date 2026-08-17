/* ITALIANO: Script della schermata di avvio.
   Sta in un file A PARTE, non dentro splash.html, perche' in produzione la regola di
   sicurezza (CSP "script-src 'self'") rifiuta gli script scritti dentro la pagina: la
   versione restava quindi bloccata sul testo scritto a mano e i messaggi non cambiavano.
   In sviluppo non si notava, perche' li' la regola non viene applicata.

   ENGLISH: Splash screen script.
   It lives in a SEPARATE file rather than inside splash.html because in production the
   security rule (CSP "script-src 'self'") refuses scripts written inside the page: the
   version therefore stayed stuck on the hardcoded text and the messages never rotated.
   It was invisible in development, where the rule is not applied. */

// ITALIANO: Messaggio della schermata di avvio, uno solo, in tutte le 9 lingue dell'app. La lingua
//           arriva dal processo principale come parametro ?lang=xx: e' quella scelta dall'utente
//           oppure, al primissimo avvio, quella di Windows.
//           Prima erano QUATTRO frasi che si davano il cambio ogni 0,8 secondi in un ciclo infinito
//           ("Inizializzazione ambiente...", "Preparazione interfaccia...", "Quasi pronto...",
//           "Avvio in corso..."). Sembravano testi a caso, e in un certo senso lo erano: non
//           seguivano nessun avanzamento vero, giravano solo a tempo, e a 0,8 secondi l'una non si
//           faceva in tempo a leggerne una che era gia' cambiata. Una riga sola e ferma dice la
//           stessa cosa senza fingere di informare.
// ENGLISH: The splash message, a single one, in all 9 app languages. The language arrives from the
//          main process as a ?lang=xx parameter: the user's choice, or Windows' own language on the
//          very first launch.
//          There used to be FOUR sentences taking turns every 0.8 seconds in an endless loop
//          ("Initializing environment...", "Preparing the interface...", "Almost ready...",
//          "Starting up..."). They read as random text, and in a way they were: they tracked no real
//          progress, they just rotated on a timer, and at 0.8s apiece one was gone before it could be
//          read. A single, still line says the same thing without pretending to inform.
const MESSAGES = {
    en: 'Starting up...',
    it: 'Avvio in corso...',
    fr: 'Démarrage en cours...',
    es: 'Iniciando...',
    de: 'Wird gestartet...',
    zh: '正在启动…',
    ja: '起動しています…',
    pt: 'Iniciando...',
    ru: 'Запуск...',
};

const paramLang = new URLSearchParams(window.location.search).get('lang');
const message = MESSAGES[paramLang] || MESSAGES.en;

const msgEl = document.getElementById('loading-msg');
if (msgEl) msgEl.innerText = message;

// ITALIANO: Chiede la versione al processo principale tramite il ponte sicuro (preload).
//           La scrive sotto al sottotitolo (ben visibile) e anche in basso a destra.
// ENGLISH: Asks the main process for the version through the secure bridge (preload).
//          Writes it under the subtitle (clearly visible) and also at the bottom right.
if (window.electronAPI && typeof window.electronAPI.getAppVersion === 'function') {
    window.electronAPI.getAppVersion()
        .then(function (v) {
            if (!v) return;
            const principale = document.getElementById('version-main');
            if (principale) principale.innerText = 'v' + v;
        })
        .catch(function () { /* ITALIANO: fallback silenzioso — ENGLISH: silent fallback */ });
}

// ITALIANO: Il copyright apre il profilo GitHub nel browser di sistema (non dentro l'app).
//           L'apertura passa dal processo principale, che accetta solo http/https.
// ENGLISH: The copyright opens the GitHub profile in the system browser (not inside the app).
//          It goes through the main process, which only accepts http/https.
const PROFILO_GITHUB = 'https://github.com/xXIlRizzoXx';
const copyrightEl = document.getElementById('copyright-link');
if (copyrightEl && window.electronAPI && typeof window.electronAPI.openExternal === 'function') {
    copyrightEl.addEventListener('click', function () {
        window.electronAPI.openExternal(PROFILO_GITHUB);
    });
}

// ITALIANO: Riserva del logo. Prima stava come onerror="..." dentro l'HTML, ma la regola di
//           sicurezza (script-src 'self') rifiuta i gestori scritti nell'HTML nell'app compilata:
//           era codice morto. Qui, dallo script vero, funziona.
// ENGLISH: Logo fallback. It used to be an inline onerror="..." in the HTML, but the security rule
//          (script-src 'self') refuses handlers written in the HTML in the packaged app: it was dead
//          code. Here, from the real script, it works.
const logoEl = document.getElementById('splash-logo');
if (logoEl) {
    logoEl.addEventListener('error', function () {
        if (!logoEl.dataset.fallbackDone) {
            logoEl.dataset.fallbackDone = '1';
            logoEl.src = '../public/icon.png';
        }
    });
}
