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
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow () {
  // Leggi la versione dal package.json
  let appVersion = '2.1.0';
  try {
    const packageJsonPath = path.join(__dirname, '../package.json');
    const packageData = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    appVersion = packageData.version;
  } catch (e) {
    console.error('Impossibile leggere la versione dal package.json', e);
  }

  // Crea la finestra di Splash Screen
  const splash = new BrowserWindow({
    width: 600,
    height: 400,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  splash.loadFile(path.join(__dirname, 'splash.html'));

  // Crea la finestra principale (nascosta all'inizio)
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: `Images Tag Manager for LORAs v${appVersion}`,
    show: false, // Nascondi finché non è pronta
    autoHideMenuBar: true, // Nasconde il menu in alto (File, Edit, ecc.)
    icon: path.join(__dirname, '../public/logo.png'), // Icona della finestra
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Se siamo in fase di sviluppo, carica il server locale di Vite
  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:3000');
  } else {
    // In produzione, carica il file index.html compilato
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Quando la finestra principale è pronta, aspetta un po' per mostrare lo splash screen, poi scambia
  win.once('ready-to-show', () => {
    setTimeout(() => {
      splash.close();
      win.show();
    }, 3000); // Mostra lo splash screen per 3 secondi
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
