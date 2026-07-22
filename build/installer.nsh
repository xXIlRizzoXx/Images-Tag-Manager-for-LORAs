; ============================================================================
;  ITALIANO: Personalizzazione dell'installer NSIS di Images Tag Manager.
;
;    - PAGINA DI BENVENUTO con la fascia illustrata a sinistra.
;      electron-builder NON la mette: l'installer assistito parte dritto dalla
;      scelta cartella. Senza questa pagina l'immagine laterale si vedrebbe
;      soltanto alla fine.
;    - PAGINA FINALE con due caselle:
;        [x] Esegui <app>                     (nativa MUI)
;        [x] Crea un collegamento sul desktop (aggiunta qui, riusando lo slot
;            "SHOWREADME" della pagina finale MUI: electron-builder non offre
;            nativamente questa casella)
;
;  ENGLISH: NSIS installer customization for Images Tag Manager.
;    - WELCOME page with the illustrated sidebar (electron-builder does not
;      add one; without it the sidebar art would only show on the last page).
;    - FINISH page with "Run app" (native MUI) + "Create a desktop shortcut"
;      (added here by reusing the MUI finish-page "SHOWREADME" slot).
;
;  Le immagini del wizard le genera scripts/make-installer-art.mjs ed
;  electron-builder le raccoglie per convenzione sul nome:
;      build/installerSidebar.bmp     164 x 314   -> MUI_WELCOMEFINISHPAGE_BITMAP
;      build/uninstallerSidebar.bmp   164 x 314   -> MUI_UNWELCOMEFINISHPAGE_BITMAP
;      build/installerHeader.bmp      150 x  57   -> MUI_HEADERIMAGE_BITMAP
;  (vedi node_modules/app-builder-lib/out/targets/nsis/NsisTarget.js:419-429)
;
;  ----------------------------------------------------------------------------
;  ATTENZIONE / CAUTION - dove mettere le Function
;
;  Questo file viene incluso MOLTO PRESTO nello script generato: alla riga ~81,
;  mentre "!addplugindir" (che dice a NSIS dove sta il plugin StdUtils) arriva
;  solo alla riga ~84. Verificato leggendo release/builder-debug.yml.
;
;  Conseguenza: una Function scritta al livello principale di questo file, se
;  chiama ${StdUtils.*}, NON compila:
;      "Plugin not found, cannot call StdUtils::ExecShellAsUser"
;  e non c'entra nulla la passata del disinstallatore.
;
;  Le Function vanno quindi dentro la macro customHeader, che electron-builder
;  inserisce a installer.nsi:45 - cioe' DOPO !addplugindir e DOPO addLangs.
;  Definire una macro qui sopra va invece benissimo: il corpo viene compilato
;  dove la macro viene inserita, non dove viene definita.
;
;  Nota sulle guardie: BUILD_UNINSTALLER e' l'unico define che distingue le due
;  passate (NsisTarget.js:349 lo mette, :373 lo toglie). UNINSTALLER_OUT_FILE
;  sembra equivalente ma e' definito in ENTRAMBE (:350, :299, :374): usarlo
;  spegne le pagine personalizzate anche nell'installer, in silenzio.
;
;  CAUTION: this file is included at generated-script line ~81, BEFORE
;  !addplugindir at line ~84 - so top-level Functions calling ${StdUtils.*}
;  fail to compile in BOTH passes. Put them inside customHeader, which is
;  inserted at installer.nsi:45 (after !addplugindir and after addLangs).
;  Use BUILD_UNINSTALLER to tell the passes apart, never UNINSTALLER_OUT_FILE
;  (defined in both).
; ============================================================================

; ITALIANO: Firma in basso a sinistra, su tutte le pagine del wizard e anche
;           nel disinstallatore. Sovrascrive common.nsh:4, che viene incluso
;           prima: in NSIS vince l'ultima BrandingText.
;           Solo caratteri ASCII: il file e' senza BOM e i caratteri accentati
;           diventerebbero illeggibili.
; ENGLISH: Etched signature at the bottom-left of every wizard page and of the
;          uninstaller. Overrides common.nsh:4 (included earlier - in NSIS the
;          last BrandingText wins). ASCII only: this file has no BOM.
!macro customHeader
  BrandingText "${PRODUCT_NAME} ${VERSION} - by xXIlRizzoXx"

  !ifndef BUILD_UNINSTALLER
    ; ITALIANO: Avvia l'app al termine, NON con i privilegi dell'installer.
    ; ENGLISH: Launch the app at the end, NOT with installer privileges.
    Function StartAppAfterInstall
      ${StdUtils.ExecShellAsUser} $0 "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "open" ""
    FunctionEnd

    ; ITALIANO: Crea il collegamento sul desktop solo se la casella e' spuntata.
    ;           Nome scritto per esteso: deve combaciare con quello cancellato
    ;           dal disinstallatore, dove i define non sono disponibili.
    ; ENGLISH: Create the desktop shortcut only when the checkbox is ticked.
    ;          Literal name: it must match the one deleted by the uninstaller,
    ;          where the defines are not available.
    Function CreateDesktopShortcutNow
      CreateShortCut "$DESKTOP\Images Tag Manager for LORAs.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0
    FunctionEnd
  !endif
!macroend

!ifndef BUILD_UNINSTALLER

  ; ITALIANO: Pagina di benvenuto. Titolo e testo li mette MUI nella lingua
  ;           scelta all'avvio: tradotti in tutte e 9 le lingue, gratis.
  ; ENGLISH: Welcome page. MUI supplies the localized title/body for the
  ;          language picked at startup - free translation in all 9 languages.
  !macro customWelcomePage
    !insertmacro MUI_PAGE_WELCOME
  !macroend

  !macro customFinishPage
    ; --- Casella 1: esegui l'app / Checkbox 1: run the app ---
    !define MUI_FINISHPAGE_RUN
    !define MUI_FINISHPAGE_RUN_FUNCTION "StartAppAfterInstall"

    ; --- Casella 2: collegamento sul desktop / Checkbox 2: desktop shortcut ---
    ; NOTA: l'etichetta resta in inglese perche' NSIS vuole le stringhe tradotte
    ;       prima del caricamento delle lingue, cosa impossibile da uno script
    ;       incluso da electron-builder. Il resto del wizard (Avanti, Installa,
    ;       Annulla...) e' tradotto da NSIS nelle 9 lingue.
    !define MUI_FINISHPAGE_SHOWREADME ""
    !define MUI_FINISHPAGE_SHOWREADME_TEXT "Create a desktop shortcut"
    !define MUI_FINISHPAGE_SHOWREADME_FUNCTION "CreateDesktopShortcutNow"

    !insertmacro MUI_PAGE_FINISH
  !macroend

!endif

; ITALIANO: Salta la pagina "Per chi installare?" e installa SEMPRE solo per
;           l'utente corrente (niente richiesta di privilegi amministratore).
;           electron-builder inserisce questa macro dentro la funzione della
;           pagina di scelta modalita' (multiUserUi.nsh:41); mettendo
;           $isForceCurrentInstall a "1" il codice subito dopo
;           (multiUserUi.nsh:59-62) forza la modalita' utente e fa Abort della
;           pagina, che quindi non viene mai mostrata. Vale anche per il
;           disinstallatore, coerente con l'installazione per-utente.
; ENGLISH: Skip the "Who should this be installed for?" page and ALWAYS install
;          for the current user only (no admin elevation). electron-builder
;          inserts this macro inside the install-mode page function
;          (multiUserUi.nsh:41); setting $isForceCurrentInstall to "1" makes the
;          following code (multiUserUi.nsh:59-62) force per-user mode and Abort
;          the page, so it never shows. Also applies to the uninstaller.
!macro customInstallMode
  StrCpy $isForceCurrentInstall "1"
!macroend

; ITALIANO: Alla disinstallazione togliamo anche il collegamento sul desktop
;           (electron-builder non lo fa: createDesktopShortcut e' false).
; ENGLISH: On uninstall also remove the desktop shortcut (electron-builder
;          skips it because createDesktopShortcut is false).
!macro customUnInstall
  Delete "$DESKTOP\Images Tag Manager for LORAs.lnk"
!macroend
