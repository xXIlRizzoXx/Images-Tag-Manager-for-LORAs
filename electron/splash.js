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

// ITALIANO: Messaggi della schermata di avvio in tutte le 9 lingue dell'app. La lingua arriva
//           dal processo principale come parametro ?lang=xx (letto dal file salvato dall'app);
//           al primissimo avvio non c'e' e si usa l'inglese. Prima erano solo in italiano, quindi
//           8 lingue su 9 vedevano testo straniero a ogni avvio.
// ENGLISH: Splash messages in all 9 app languages. The language arrives from the main process as a
//          ?lang=xx parameter (read from the file the app saves); on the very first launch there is
//          none and English is used. They used to be Italian only, so 8 of 9 languages saw foreign
//          text at every launch.
const MESSAGES = {
    en: ['Initializing environment...', 'Preparing the interface...', 'Almost ready...', 'Starting up...'],
    it: ['Inizializzazione ambiente...', 'Preparazione interfaccia...', 'Quasi pronto...', 'Avvio in corso...'],
    fr: ["Initialisation de l'environnement...", "Préparation de l'interface...", 'Presque prêt...', 'Démarrage en cours...'],
    es: ['Inicializando el entorno...', 'Preparando la interfaz...', 'Casi listo...', 'Iniciando...'],
    de: ['Umgebung wird initialisiert...', 'Oberfläche wird vorbereitet...', 'Fast fertig...', 'Wird gestartet...'],
    zh: ['正在初始化环境…', '正在准备界面…', '即将就绪…', '正在启动…'],
    ja: ['環境を初期化しています…', 'インターフェースを準備しています…', 'まもなく完了します…', '起動しています…'],
    pt: ['Inicializando o ambiente...', 'Preparando a interface...', 'Quase pronto...', 'Iniciando...'],
    ru: ['Инициализация среды...', 'Подготовка интерфейса...', 'Почти готово...', 'Запуск...'],
};

const paramLang = new URLSearchParams(window.location.search).get('lang');
const messages = MESSAGES[paramLang] || MESSAGES.en;

let i = 0;
const msgEl = document.getElementById('loading-msg');
if (msgEl && messages[0]) msgEl.innerText = messages[0];

if (msgEl) {
    setInterval(function () {
        i = (i + 1) % messages.length;
        msgEl.style.opacity = 0;
        setTimeout(function () {
            msgEl.innerText = messages[i];
            msgEl.style.opacity = 1;
        }, 200);
    }, 800);
}

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
