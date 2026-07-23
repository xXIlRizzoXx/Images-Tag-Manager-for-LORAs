/******************************************************************************
*******************************************************************************
**                                                                            **
**  ITALIANO: MOTORE DESKTOP (ELECTRON)                                       **
**  Questo file permette al programma di funzionare come una vera app         **
**  per computer, gestendo la finestra e il sistema operativo.                **
**                                                                            **
**  ENGLISH: DESKTOP ENGINE (ELECTRON)                                        **
**  This file allows the program to run as a real computer app,               **
**  managing the window and the operating system.                             **
**                                                                            **
*******************************************************************************
*******************************************************************************/
const { app, BrowserWindow, ipcMain, safeStorage, session, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const isDev = process.env.NODE_ENV === 'development';

// ITALIANO: Lettura della versione una sola volta all'avvio
// ENGLISH: Read the version once at startup
let appVersion = '0.0.0';
try {
    const packageJsonPath = path.join(__dirname, '../package.json');
    const packageData = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    appVersion = packageData.version || appVersion;
} catch (e) {
    console.error('Unable to read version from package.json', e);
}

// ITALIANO: Lock per evitare istanze multiple dell'app
// ENGLISH: Lock to prevent multiple instances of the app
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
    process.exit(0);
}

// ITALIANO: Riferimenti alle finestre conservati a livello modulo
// ENGLISH: Window references kept at module level
let mainWindow = null;
let splashWindow = null;

// ITALIANO: Handler IPC per la versione dell'app
// ENGLISH: IPC handler for the app version
ipcMain.handle('app:get-version', () => appVersion);

// ITALIANO: Storage cifrato per la API key Gemini, basato sul keychain del SO
// ENGLISH: Encrypted storage for the Gemini API key, backed by the OS keychain
const getSecretsPath = () => path.join(app.getPath('userData'), 'secrets.json');

const readSecrets = () => {
    try {
        const p = getSecretsPath();
        if (!fs.existsSync(p)) return {};
        const raw = fs.readFileSync(p, 'utf8');
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
        console.error('Failed to read secrets file', e);
        return {};
    }
};

const writeSecrets = (data) => {
    try {
        fs.writeFileSync(getSecretsPath(), JSON.stringify(data), { encoding: 'utf8', mode: 0o600 });
        return true;
    } catch (e) {
        console.error('Failed to write secrets file', e);
        return false;
    }
};

ipcMain.handle('secure-storage:available', () => {
    try { return safeStorage.isEncryptionAvailable(); } catch { return false; }
});

ipcMain.handle('secure-storage:get', (_event, key) => {
    if (typeof key !== 'string' || !key) return '';
    try {
        const secrets = readSecrets();
        const encoded = secrets[key];
        if (!encoded || typeof encoded !== 'string') return '';
        if (!safeStorage.isEncryptionAvailable()) return '';
        const buf = Buffer.from(encoded, 'base64');
        return safeStorage.decryptString(buf);
    } catch (e) {
        console.error('secure-storage:get failed', e);
        return '';
    }
});

ipcMain.handle('secure-storage:set', (_event, key, value) => {
    if (typeof key !== 'string' || !key) return false;
    try {
        const secrets = readSecrets();
        if (typeof value !== 'string' || value === '') {
            delete secrets[key];
        } else {
            if (!safeStorage.isEncryptionAvailable()) return false;
            const encrypted = safeStorage.encryptString(value);
            secrets[key] = encrypted.toString('base64');
        }
        return writeSecrets(secrets);
    } catch (e) {
        console.error('secure-storage:set failed', e);
        return false;
    }
});

ipcMain.handle('secure-storage:delete', (_event, key) => {
    if (typeof key !== 'string' || !key) return false;
    try {
        const secrets = readSecrets();
        delete secrets[key];
        return writeSecrets(secrets);
    } catch (e) {
        console.error('secure-storage:delete failed', e);
        return false;
    }
});

/* ITALIANO: TAG "GEMELLI" (.txt) DELLE IMMAGINI SCELTE
   Quando l'utente sceglie delle immagini singole, il selettore mostra SOLO immagini.
   Qui, per ogni immagine scelta, cerco accanto ad essa il file di testo con lo STESSO
   nome (foto.jpg -> foto.txt) e, se c'e', lo leggo: cosi' i tag si abbinano da soli.
   Se il .txt non c'e' (es. prima volta) non succede nulla: si carica solo l'immagine.

   Limiti di sicurezza (il ponte resta stretto): leggo SOLO file .txt, SOLO se accanto
   a un'immagine vera che esiste su disco, mai in scrittura e mai oltre 1 MB.

   ENGLISH: SIDECAR .txt TAGS FOR THE PICKED IMAGES
   When the user picks individual images the dialog shows ONLY images. Here, for each
   picked image, I look next to it for the text file with the SAME name
   (photo.jpg -> photo.txt) and read it if present, so tags pair up automatically.
   If there is no .txt (e.g. first time) nothing happens: only the image is loaded.

   Safety limits (the bridge stays narrow): read ONLY .txt files, ONLY when sitting next
   to a real image that exists on disk, never write, never above 1 MB. */
const SIDECAR_MAX_BYTES = 1024 * 1024;
const SIDECAR_MAX_FILES = 5000;
const SIDECAR_IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.avif', '.tif', '.tiff']);

ipcMain.handle('images:read-sidecar-tags', (_event, imagePaths) => {
    if (!Array.isArray(imagePaths)) return [];
    const out = [];
    const seen = new Set();
    for (const raw of imagePaths.slice(0, SIDECAR_MAX_FILES)) {
        if (typeof raw !== 'string' || !raw) continue;
        try {
            // ITALIANO: dev'essere un'immagine VERA presente su disco
            // ENGLISH: it must be a REAL image present on disk
            if (!SIDECAR_IMAGE_EXT.has(path.extname(raw).toLowerCase())) continue;
            const imgStat = fs.statSync(raw);
            if (!imgStat.isFile()) continue;

            const base = path.basename(raw, path.extname(raw));
            const txtPath = path.join(path.dirname(raw), base + '.txt');
            if (path.extname(txtPath).toLowerCase() !== '.txt') continue;
            if (seen.has(txtPath)) continue;
            seen.add(txtPath);

            const txtStat = fs.statSync(txtPath);
            if (!txtStat.isFile() || txtStat.size > SIDECAR_MAX_BYTES) continue;
            // ITALIANO: torno anche la cartella del .txt: cosi' il rinnovo lato app puo' abbinare
            //           ogni testo alla SUA immagine anche se due foto scelte hanno lo stesso nome
            //           ma stanno in cartelle diverse.
            // ENGLISH: also return the .txt's folder: this lets the app pair each text with ITS
            //          image even when two picked photos share a name but sit in different folders.
            out.push({ name: base + '.txt', content: fs.readFileSync(txtPath, 'utf8'), dir: path.dirname(txtPath) });
        } catch (_) {
            // ITALIANO: nessun .txt accanto a questa immagine: e' normale, si prosegue
            // ENGLISH: no .txt next to this image: that is normal, carry on
        }
    }
    return out;
});

/* ITALIANO: CESTINO DI SISTEMA
   Sposta i file nel Cestino di Windows invece di cancellarli per sempre, cosi' un
   ripensamento resta sempre recuperabile. Accetto solo immagini e .txt: il canale non
   deve poter diventare un "cancella qualsiasi cosa". I file inesistenti (es. il .txt di
   una foto che non ne ha) vengono ignorati senza errore.

   ENGLISH: SYSTEM RECYCLE BIN
   Moves files to the Windows Recycle Bin instead of deleting them for good, so a change of
   mind stays recoverable. Only images and .txt files are accepted: this channel must not
   become a "delete anything" primitive. Missing files (e.g. the .txt of a photo that has
   none) are skipped without error. */
const TRASH_ALLOWED_EXT = new Set([...SIDECAR_IMAGE_EXT, '.txt']);
const TRASH_MAX_FILES = 5000;

ipcMain.handle('shell:trash-files', async (_event, filePaths) => {
    if (!Array.isArray(filePaths)) return { ok: false, trashed: 0 };
    let trashed = 0;
    for (const raw of filePaths.slice(0, TRASH_MAX_FILES)) {
        if (typeof raw !== 'string' || !raw) continue;
        if (!TRASH_ALLOWED_EXT.has(path.extname(raw).toLowerCase())) continue;
        try {
            if (!fs.statSync(raw).isFile()) continue;
            await shell.trashItem(raw);
            trashed++;
        } catch (_) {
            // ITALIANO: file assente o non spostabile: si prosegue
            // ENGLISH: file missing or not movable: carry on
        }
    }
    return { ok: true, trashed };
});

/* ITALIANO: APERTURA DI UN INDIRIZZO WEB NEL BROWSER DI SISTEMA
   Serve ai link dell'app (es. il profilo GitHub sulla schermata di avvio). Accetto
   SOLO http e https: cosi' il canale non puo' essere usato per lanciare programmi o
   aprire file locali.
   ENGLISH: OPEN A WEB ADDRESS IN THE SYSTEM BROWSER
   Used by the app's links (e.g. the GitHub profile on the splash screen). Only http and
   https are accepted, so this channel cannot be used to launch programs or open local
   files. */
ipcMain.handle('shell:open-external', async (_event, url) => {
    if (typeof url !== 'string') return false;
    try {
        const target = new URL(url);
        if (target.protocol !== 'http:' && target.protocol !== 'https:') return false;
        await shell.openExternal(target.href);
        return true;
    } catch (_) {
        return false;
    }
});

// ITALIANO: Header Content-Security-Policy applicato in produzione
// ENGLISH: Content-Security-Policy header applied in production
const applyContentSecurityPolicy = (sess) => {
    if (isDev) return; // ITALIANO: In sviluppo Vite ha bisogno di flessibilità — ENGLISH: In dev mode Vite needs flexibility
    const csp = [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https://flagcdn.com",
        "font-src 'self' data:",
        "connect-src 'self' https://generativelanguage.googleapis.com",
        "worker-src 'self' blob:",
        "child-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'none'",
        "frame-ancestors 'none'",
    ].join('; ');

    sess.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [csp],
                'X-Content-Type-Options': ['nosniff'],
            },
        });
    });
};

function resolveIconPath() {
    const ico = path.join(__dirname, '../public/icon.ico');
    if (process.platform === 'win32' && fs.existsSync(ico)) return ico;
    return path.join(__dirname, '../public/logo.png');
}

function createSplashWindow() {
    splashWindow = new BrowserWindow({
        width: 600,
        height: 400,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        resizable: false,
        skipTaskbar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
        },
    });
    splashWindow.loadFile(path.join(__dirname, 'splash.html'));
    splashWindow.on('closed', () => { splashWindow = null; });
}

function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        title: `Images Tag Manager for LORAs v${appVersion}`,
        show: false,
        autoHideMenuBar: true,
        icon: resolveIconPath(),
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            webSecurity: true,
            allowRunningInsecureContent: false,
            // ITALIANO: DevTools sempre disponibili (Ctrl+Shift+I) per ispezionare i log AI
            // ENGLISH: DevTools always available (Ctrl+Shift+I) to inspect AI logs
            devTools: true,
        },
    });

    /* ITALIANO: Blocca QUALSIASI navigazione fuori dall'app.
       Prima erano ammessi tutti gli URL "file:", non solo la pagina dell'app: bastava
       trascinare una foto sulla finestra e Chromium ci navigava sopra, sostituendo il
       programma con l'immagine. Con il menu disattivato non si tornava indietro: progetto,
       cestino e cronologia persi. La pagina dell'app viene caricata con loadFile, che NON
       emette will-navigate, quindi qui possiamo bloccare tutto senza effetti collaterali.
       ENGLISH: Block ANY navigation away from the app.
       Every "file:" URL used to be allowed, not just the app's own page: dropping a photo on
       the window made Chromium navigate to it, replacing the program with the image. With the
       menu disabled there was no way back: project, trash and undo history all lost. The app's
       page is loaded via loadFile, which does NOT emit will-navigate, so blocking everything
       here is safe. */
    mainWindow.webContents.on('will-navigate', (event, url) => {
        const target = new URL(url);
        const allowedDevHost = isDev && target.host === 'localhost:3000';
        if (!allowedDevHost) {
            event.preventDefault();
        }
    });

    // ITALIANO: I link "_blank" non aprono nuove finestre Electron, li deleghiamo al browser di sistema
    // ENGLISH: "_blank" links do not open new Electron windows; delegate them to the system browser
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        try {
            const target = new URL(url);
            if (target.protocol === 'http:' || target.protocol === 'https:') {
                const { shell } = require('electron');
                shell.openExternal(url);
            }
        } catch (_) { /* ignore malformed URL */ }
        return { action: 'deny' };
    });

    if (isDev) {
        mainWindow.loadURL('http://localhost:3000');
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    // ITALIANO: Quando la finestra è pronta, chiudi lo splash, massimizza (finestra piena,
    //           con barra del titolo — non a schermo intero) e mostra l'app. Il 1280x800
    //           sopra resta la dimensione "ripristinata" quando l'utente riduce la finestra.
    // ENGLISH: When the window is ready, close the splash, maximize it (full window with the
    //          title bar — not fullscreen) and show the app. The 1280x800 above stays as the
    //          "restored" size when the user un-maximizes.
    mainWindow.once('ready-to-show', () => {
        if (splashWindow && !splashWindow.isDestroyed()) {
            splashWindow.close();
        }
        mainWindow.maximize();
        mainWindow.show();
    });

    mainWindow.on('closed', () => { mainWindow = null; });
}

app.on('second-instance', () => {
    if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
    }
});

app.whenReady().then(() => {
    applyContentSecurityPolicy(session.defaultSession);
    // ITALIANO: Nessuna barra dei menù di default in produzione
    // ENGLISH: No default menu bar in production
    if (!isDev) Menu.setApplicationMenu(null);

    createSplashWindow();
    createMainWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createSplashWindow();
            createMainWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// ITALIANO: Difesa in profondità — vietiamo qualunque tentativo di creare webview
// ENGLISH: Defense in depth — forbid any attempt to create webview tags
app.on('web-contents-created', (_event, contents) => {
    contents.on('will-attach-webview', (event) => {
        event.preventDefault();
    });
});
