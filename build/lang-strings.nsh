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

; ITALIANO: Avviso sulla pagina di benvenuto - possibile allarme dell'antivirus.
;           Il programma non e' firmato digitalmente (serve un certificato a pagamento),
;           quindi Windows SmartScreen puo' dire editore sconosciuto. Qui si spiega
;           perche' succede e come proseguire, senza dire di ignorare l'antivirus.
; ENGLISH: Welcome-page notice about a possible antivirus alert. The program is not
;          code-signed (a paid certificate is required), so Windows SmartScreen may say
;          unknown publisher. This explains why it happens and how to proceed, without
;          telling anyone to ignore their antivirus.
LangString AV_NOTICE_TEXT ${LANG_ENGLISH}               "Note: Windows or your antivirus may warn about this program: it has no paid digital signature. It is not dangerous and by default sends nothing over the Internet. If the warning appears, choose More info and then Run anyway."
LangString AV_NOTICE_TEXT ${LANG_ITALIAN}               "Nota: Windows o l'antivirus possono avvisarti: il programma non ha una firma digitale a pagamento. Non è pericoloso e di serie non invia nulla su Internet. Se l'avviso compare, scegli Ulteriori informazioni e poi Esegui comunque."
LangString AV_NOTICE_TEXT ${LANG_FRENCH}                "Remarque : Windows ou votre antivirus peuvent avertir : pas de signature numérique payante. Il n'est pas dangereux et n'envoie rien sur Internet par défaut. Si l'avertissement apparaît, choisissez Informations complémentaires puis Exécuter quand même."
LangString AV_NOTICE_TEXT ${LANG_SPANISHINTERNATIONAL}  "Nota: Windows o su antivirus pueden advertir: sin firma digital de pago. No es peligroso y de serie no envía nada por Internet. Si aparece la advertencia, elija Más información y luego Ejecutar de todas formas."
LangString AV_NOTICE_TEXT ${LANG_GERMAN}                "Hinweis: Windows oder Ihr Virenschutz warnen eventuell: keine kostenpflichtige Signatur. Es ist nicht gefährlich und sendet standardmäßig nichts über das Internet. Bei der Warnung wählen Sie Weitere Informationen und dann Trotzdem ausführen."
LangString AV_NOTICE_TEXT ${LANG_SIMPCHINESE}           "注意：Windows 或杀毒软件可能发出警告：本程序没有付费数字签名。它并不危险，默认也不向互联网发送任何内容。出现警告时，请选择“更多信息”，然后选择“仍要运行”。"
LangString AV_NOTICE_TEXT ${LANG_JAPANESE}              "注意: 有料のデジタル署名がないため、Windows やウイルス対策ソフトが警告を表示することがあります。危険はなく、初期設定ではインターネットへ何も送信しません。警告が出たら「詳細情報」、次に「実行」を選んでください。"
LangString AV_NOTICE_TEXT ${LANG_PORTUGUESEBR}          "Observação: o Windows ou o antivírus podem avisar: sem assinatura digital paga. Ele não é perigoso e por padrão não envia nada pela Internet. Se o aviso aparecer, escolha Mais informações e depois Executar assim mesmo."
LangString AV_NOTICE_TEXT ${LANG_RUSSIAN}               "Примечание: Windows или антивирус могут предупредить: нет платной цифровой подписи. Она не опасна и по умолчанию ничего не отправляет в Интернет. При появлении предупреждения выберите Подробнее, затем Выполнить в любом случае."
