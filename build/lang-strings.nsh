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
LangString AV_NOTICE_TEXT ${LANG_ENGLISH}               "Note: Windows or your antivirus may show a warning for this program. That happens because it does not carry a paid digital signature, not because it is dangerous. It works entirely on your computer: it collects no data and sends nothing over the Internet. If the Windows warning appears, choose More info and then Run anyway."
LangString AV_NOTICE_TEXT ${LANG_ITALIAN}               "Nota: Windows o l'antivirus potrebbero mostrare un avviso su questo programma. Succede perché non ha una firma digitale a pagamento, non perché sia pericoloso. Funziona interamente sul tuo computer: non raccoglie dati e non invia nulla su Internet. Se compare l'avviso di Windows, scegli Ulteriori informazioni e poi Esegui comunque."
LangString AV_NOTICE_TEXT ${LANG_FRENCH}                "Remarque : Windows ou votre antivirus peuvent afficher un avertissement pour ce programme. Cela vient de l'absence de signature numérique payante, pas d'un danger. Il fonctionne entièrement sur votre ordinateur : il ne collecte aucune donnée et n'envoie rien sur Internet. Si l'avertissement de Windows apparaît, choisissez Informations complémentaires puis Exécuter quand même."
LangString AV_NOTICE_TEXT ${LANG_SPANISHINTERNATIONAL}  "Nota: Windows o su antivirus pueden mostrar una advertencia sobre este programa. Ocurre porque no tiene una firma digital de pago, no porque sea peligroso. Funciona por completo en su equipo: no recopila datos ni envía nada por Internet. Si aparece la advertencia de Windows, elija Más información y luego Ejecutar de todas formas."
LangString AV_NOTICE_TEXT ${LANG_GERMAN}                "Hinweis: Windows oder Ihr Virenschutz zeigen für dieses Programm möglicherweise eine Warnung an. Das liegt daran, dass es keine kostenpflichtige digitale Signatur besitzt, nicht daran, dass es gefährlich wäre. Es arbeitet vollständig auf Ihrem Computer: Es sammelt keine Daten und sendet nichts über das Internet. Wenn die Windows-Warnung erscheint, wählen Sie Weitere Informationen und dann Trotzdem ausführen."
LangString AV_NOTICE_TEXT ${LANG_SIMPCHINESE}           "注意：Windows 或杀毒软件可能会对本程序显示警告。这是因为它没有付费的数字签名，并不表示它有危险。本程序完全在您的电脑上运行：不收集任何数据，也不向互联网发送任何内容。如果出现 Windows 警告，请选择“更多信息”，然后选择“仍要运行”。"
LangString AV_NOTICE_TEXT ${LANG_JAPANESE}              "注意: Windows やウイルス対策ソフトが本プログラムについて警告を表示することがあります。これは有料のデジタル署名がないためであり、危険だからではありません。本プログラムはすべてお使いのパソコン上で動作し、データを収集せず、インターネットへ何も送信しません。Windows の警告が出た場合は「詳細情報」を選び、次に「実行」を選んでください。"
LangString AV_NOTICE_TEXT ${LANG_PORTUGUESEBR}          "Observação: o Windows ou o seu antivírus podem exibir um aviso sobre este programa. Isso acontece porque ele não possui uma assinatura digital paga, e não porque seja perigoso. Ele funciona inteiramente no seu computador: não coleta dados nem envia nada pela Internet. Se o aviso do Windows aparecer, escolha Mais informações e depois Executar assim mesmo."
LangString AV_NOTICE_TEXT ${LANG_RUSSIAN}               "Примечание: Windows или антивирус могут показать предупреждение об этой программе. Это происходит из-за отсутствия платной цифровой подписи, а не потому, что она опасна. Программа работает полностью на вашем компьютере: она не собирает данные и ничего не отправляет в Интернет. Если появится предупреждение Windows, выберите Подробнее, а затем Выполнить в любом случае."
