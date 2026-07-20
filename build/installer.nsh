; ============================================================================
;  ITALIANO: Personalizzazione dell'installer NSIS di Images Tag Manager.
;            Aggiunge la PAGINA FINALE con due caselle:
;              [x] Esegui <app>                     (nativa MUI)
;              [x] Crea un collegamento sul desktop (aggiunta qui)
;            electron-builder non offre nativamente la seconda casella:
;            riusiamo lo slot "SHOWREADME" della pagina finale MUI.
;
;  ENGLISH: NSIS installer customization for Images Tag Manager.
;           Adds the FINISH PAGE with two checkboxes:
;             [x] Run <app>                 (native MUI)
;             [x] Create a desktop shortcut (added here)
;           electron-builder has no native option for the second one, so we
;           reuse the MUI finish-page "SHOWREADME" slot.
;
;  ATTENZIONE / CAUTION: electron-builder include questo file DUE volte:
;  una per l'installer e una per il DISINSTALLATORE. Nella passata del
;  disinstallatore NON esistono il plugin StdUtils ne' i define dell'app
;  (APP_EXECUTABLE_FILENAME, SHORTCUT_NAME...). In electron-builder 26.x
;  quella passata si riconosce da UNINSTALLER_OUT_FILE (NON esiste alcun
;  BUILD_UNINSTALLER). Senza questa guardia la compilazione fallisce con
;  "Plugin not found, cannot call StdUtils::ExecShellAsUser".
;  electron-builder includes this file TWICE (installer + uninstaller). The
;  uninstaller pass has no StdUtils plugin and none of the app defines; it is
;  identified by UNINSTALLER_OUT_FILE (there is no BUILD_UNINSTALLER in 26.x).
; ============================================================================

!ifndef UNINSTALLER_OUT_FILE

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

; ITALIANO: Alla disinstallazione togliamo anche il collegamento sul desktop
;           (electron-builder non lo fa: createDesktopShortcut e' false).
; ENGLISH: On uninstall also remove the desktop shortcut (electron-builder
;          skips it because createDesktopShortcut is false).
!macro customUnInstall
  Delete "$DESKTOP\Images Tag Manager for LORAs.lnk"
!macroend
