; ============================================================================
;  ITALIANO: Etichette tradotte usate dalle pagine personalizzate del wizard.
;    Qui - e solo qui - servono accenti e alfabeti non latini: per questo il
;    file e' salvato in UTF-8 CON BOM, la stessa convenzione dei
;    build/license_*.txt. Il file installer.nsh resta invece in puro ASCII.
;
;    Va incluso da DENTRO la macro customHeader, che electron-builder inserisce
;    dopo addLangs (installer.nsi: addLangs alla riga 43, customHeader alla 46):
;    solo li' le costanti ${LANG_*} sono gia' definite.
;
;    Il riferimento $(DESKTOP_SHORTCUT_TEXT) nella pagina finale sta invece piu'
;    in alto (riga 40), ma NSIS risolve le stringhe di lingua a fine
;    compilazione: e' lecito usarle prima di definirle. E' lo stesso schema con
;    cui MUI dichiara le descrizioni delle sezioni.
;
;  ENGLISH: Translated labels used by the custom wizard pages. Accents and
;    non-Latin alphabets are needed only here, so this file is UTF-8 WITH BOM
;    (same convention as build/license_*.txt); installer.nsh stays pure ASCII.
;
;    Include it from INSIDE customHeader, which electron-builder inserts after
;    addLangs (installer.nsi:43 -> :46), the only place where the ${LANG_*}
;    constants already exist. The $(DESKTOP_SHORTCUT_TEXT) reference on the
;    finish page sits earlier (line 40), but NSIS resolves language strings at
;    the end of compilation, so using one before defining it is legal - the same
;    pattern MUI uses for section descriptions.
; ============================================================================

; ITALIANO: Casella 2 della pagina finale - collegamento sul desktop
; ENGLISH: Finish page checkbox 2 - desktop shortcut
LangString DESKTOP_SHORTCUT_TEXT ${LANG_ENGLISH}               "Create a desktop shortcut"
LangString DESKTOP_SHORTCUT_TEXT ${LANG_ITALIAN}               "Crea un collegamento sul desktop"
LangString DESKTOP_SHORTCUT_TEXT ${LANG_FRENCH}                "Créer un raccourci sur le bureau"
LangString DESKTOP_SHORTCUT_TEXT ${LANG_SPANISHINTERNATIONAL}  "Crear un acceso directo en el escritorio"
LangString DESKTOP_SHORTCUT_TEXT ${LANG_GERMAN}                "Verknüpfung auf dem Desktop erstellen"
LangString DESKTOP_SHORTCUT_TEXT ${LANG_SIMPCHINESE}           "创建桌面快捷方式"
LangString DESKTOP_SHORTCUT_TEXT ${LANG_JAPANESE}              "デスクトップにショートカットを作成"
LangString DESKTOP_SHORTCUT_TEXT ${LANG_PORTUGUESEBR}          "Criar um atalho na área de trabalho"
LangString DESKTOP_SHORTCUT_TEXT ${LANG_RUSSIAN}               "Создать ярлык на рабочем столе"
