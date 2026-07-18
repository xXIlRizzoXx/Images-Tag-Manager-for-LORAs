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
const { app, BrowserWindow, ipcMain, safeStorage, session, Menu } = require('electron');
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

    // ITALIANO: Blocca la navigazione verso URL esterni (apertura nella finestra dell'app)
    // ENGLISH: Block navigation to external URLs (opening inside the app window)
    mainWindow.webContents.on('will-navigate', (event, url) => {
        const target = new URL(url);
        const allowedDevHost = isDev && target.host === 'localhost:3000';
        const allowedFileProto = target.protocol === 'file:';
        if (!allowedDevHost && !allowedFileProto) {
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
