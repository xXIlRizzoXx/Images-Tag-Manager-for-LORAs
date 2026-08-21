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

; ITALIANO: Pagina "Installazione pulita", che compare solo se in %APPDATA% c'e' gia'
;           qualcosa da cancellare (cioe' su un aggiornamento, non alla prima installazione).
;           La descrizione dice per esteso cosa sparisce, perche' "pulita" fa paura a ragione,
;           e soprattutto dice cosa NON viene toccato: le foto e i .txt dell'utente.
; ENGLISH: "Clean install" page, shown only when %APPDATA% already holds something to delete
;          (an upgrade, not a first install). The description spells out what goes - and, more
;          importantly, what does not: the user's photos and .txt files.
LangString CLEAN_INSTALL_TITLE ${LANG_ENGLISH}               "Clean install"
LangString CLEAN_INSTALL_TITLE ${LANG_ITALIAN}               "Installazione pulita"
LangString CLEAN_INSTALL_TITLE ${LANG_FRENCH}                "Installation propre"
LangString CLEAN_INSTALL_TITLE ${LANG_SPANISHINTERNATIONAL}  "Instalación limpia"
LangString CLEAN_INSTALL_TITLE ${LANG_GERMAN}                "Saubere Installation"
LangString CLEAN_INSTALL_TITLE ${LANG_SIMPCHINESE}           "全新安装"
LangString CLEAN_INSTALL_TITLE ${LANG_JAPANESE}              "クリーンインストール"
LangString CLEAN_INSTALL_TITLE ${LANG_PORTUGUESEBR}          "Instalação limpa"
LangString CLEAN_INSTALL_TITLE ${LANG_RUSSIAN}               "Чистая установка"

LangString CLEAN_INSTALL_SUBTITLE ${LANG_ENGLISH}               "Choose whether to start from scratch"
LangString CLEAN_INSTALL_SUBTITLE ${LANG_ITALIAN}               "Scegli se ripartire da zero"
LangString CLEAN_INSTALL_SUBTITLE ${LANG_FRENCH}                "Choisissez de repartir de zéro ou non"
LangString CLEAN_INSTALL_SUBTITLE ${LANG_SPANISHINTERNATIONAL}  "Elige si quieres empezar de cero"
LangString CLEAN_INSTALL_SUBTITLE ${LANG_GERMAN}                "Wählen Sie, ob Sie neu beginnen möchten"
LangString CLEAN_INSTALL_SUBTITLE ${LANG_SIMPCHINESE}           "选择是否从零开始"
LangString CLEAN_INSTALL_SUBTITLE ${LANG_JAPANESE}              "最初からやり直すかどうかを選びます"
LangString CLEAN_INSTALL_SUBTITLE ${LANG_PORTUGUESEBR}          "Escolha se quer começar do zero"
LangString CLEAN_INSTALL_SUBTITLE ${LANG_RUSSIAN}               "Выберите, начинать ли с нуля"

LangString CLEAN_INSTALL_CHECK ${LANG_ENGLISH}               "Delete the settings and start from scratch"
LangString CLEAN_INSTALL_CHECK ${LANG_ITALIAN}               "Cancella le impostazioni e riparti da zero"
LangString CLEAN_INSTALL_CHECK ${LANG_FRENCH}                "Effacer les réglages et repartir de zéro"
LangString CLEAN_INSTALL_CHECK ${LANG_SPANISHINTERNATIONAL}  "Borrar los ajustes y empezar de cero"
LangString CLEAN_INSTALL_CHECK ${LANG_GERMAN}                "Einstellungen löschen und neu beginnen"
LangString CLEAN_INSTALL_CHECK ${LANG_SIMPCHINESE}           "删除设置并从零开始"
LangString CLEAN_INSTALL_CHECK ${LANG_JAPANESE}              "設定を削除して最初からやり直す"
LangString CLEAN_INSTALL_CHECK ${LANG_PORTUGUESEBR}          "Apagar as configurações e começar do zero"
LangString CLEAN_INSTALL_CHECK ${LANG_RUSSIAN}               "Удалить настройки и начать с нуля"

LangString CLEAN_INSTALL_DESC ${LANG_ENGLISH}               "This deletes the program's own settings: the saved AI key (you will have to enter it again), the chosen language, theme and sounds, and the automatic backup of unsaved tags.$\r$\n$\r$\nYour photos and your .txt files are NOT touched: they live in your own folders, not here.$\r$\n$\r$\nLeave the box empty to keep everything as it is."
LangString CLEAN_INSTALL_DESC ${LANG_ITALIAN}               "Vengono cancellate le impostazioni del programma: la chiave AI salvata (andrà rimessa), la lingua scelta, tema e suoni, e il backup automatico dei tag non salvati.$\r$\n$\r$\nLe tue foto e i tuoi file .txt NON vengono toccati: stanno nelle tue cartelle, non qui.$\r$\n$\r$\nLascia la casella vuota per conservare tutto."
LangString CLEAN_INSTALL_DESC ${LANG_FRENCH}                "Cela efface les réglages du programme : la clé AI enregistrée (à saisir de nouveau), la langue choisie, le thème et les sons, ainsi que la sauvegarde automatique des tags non enregistrés.$\r$\n$\r$\nVos photos et vos fichiers .txt ne sont PAS touchés : ils sont dans vos dossiers, pas ici.$\r$\n$\r$\nLaissez la case vide pour tout conserver."
LangString CLEAN_INSTALL_DESC ${LANG_SPANISHINTERNATIONAL}  "Se borran los ajustes del programa: la clave de AI guardada (habrá que introducirla otra vez), el idioma elegido, el tema y los sonidos, y la copia automática de las etiquetas sin guardar.$\r$\n$\r$\nTus fotos y tus archivos .txt NO se tocan: están en tus carpetas, no aquí.$\r$\n$\r$\nDeja la casilla vacía para conservarlo todo."
LangString CLEAN_INSTALL_DESC ${LANG_GERMAN}                "Damit werden die Einstellungen des Programms gelöscht: der gespeicherte AI-Schlüssel (er muss neu eingegeben werden), die gewählte Sprache, Design und Töne sowie die automatische Sicherung nicht gespeicherter Tags.$\r$\n$\r$\nIhre Fotos und Ihre .txt-Dateien werden NICHT angerührt: sie liegen in Ihren Ordnern, nicht hier.$\r$\n$\r$\nLassen Sie das Kästchen leer, um alles zu behalten."
LangString CLEAN_INSTALL_DESC ${LANG_SIMPCHINESE}           "这会删除程序自身的设置：已保存的 AI 密钥（需要重新输入）、已选择的语言、主题和声音，以及未保存标签的自动备份。$\r$\n$\r$\n您的照片和 .txt 文件不会被触碰：它们在您自己的文件夹里，不在这里。$\r$\n$\r$\n留空此复选框可保留全部设置。"
LangString CLEAN_INSTALL_DESC ${LANG_JAPANESE}              "プログラム自身の設定を削除します: 保存済みの AI キー（入力し直しが必要）、選んだ言語、デザインと効果音、未保存タグの自動バックアップ。$\r$\n$\r$\nあなたの写真と .txt ファイルには触れません。それらはご自身のフォルダーにあり、ここにはありません。$\r$\n$\r$\nすべて残す場合はチェックを入れないでください。"
LangString CLEAN_INSTALL_DESC ${LANG_PORTUGUESEBR}          "Isso apaga as configurações do programa: a chave de AI salva (será preciso digitá-la de novo), o idioma escolhido, o tema e os sons, e o backup automático das tags não salvas.$\r$\n$\r$\nSuas fotos e seus arquivos .txt NÃO são tocados: eles ficam nas suas pastas, não aqui.$\r$\n$\r$\nDeixe a caixa vazia para manter tudo."
LangString CLEAN_INSTALL_DESC ${LANG_RUSSIAN}               "Будут удалены настройки самой программы: сохранённый ключ AI (его придётся ввести заново), выбранный язык, оформление и звуки, а также автоматическая копия несохранённых тегов.$\r$\n$\r$\nВаши фотографии и файлы .txt НЕ затрагиваются: они лежат в ваших папках, а не здесь.$\r$\n$\r$\nОставьте флажок пустым, чтобы сохранить всё как есть."
