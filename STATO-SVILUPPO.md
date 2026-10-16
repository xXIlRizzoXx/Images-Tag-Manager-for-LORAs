# Stato di sviluppo — Images Tag Manager for LORAs

**Ultimo aggiornamento:** 16 ottobre 2026
**Versione attuale:** 2.0.0 in lavorazione — la 1.2.0 e' pubblicata su GitHub dal 21 agosto 2026
Novità 2.0.0 (traguardo 108, 15-16 ottobre 2026): **due funzioni nuove per l'AI, provate sul
programma vero e ricontrollate.** (1) **Prova i modelli recenti**: nelle Impostazioni un pulsante
prova, con un'immagine minuscola, i modelli delle ultime tre versioni di Gemini che Google elenca
per la chiave, e li divide nella tendina in utilizzabili, a pagamento, senza accesso, non adatti
e da riprovare. (2) **Server MCP**: spento di serie, ascolta solo su questo computer e chiede un
codice segreto; permette a un'AI che si usa già (Claude Code, Claude Desktop, Cursor...) di vedere
le foto aperte e cambiarne i tag, ma non salva mai: i .txt si scrivono solo con "Salva Modifiche".
Le Impostazioni AI e MCP sono divise in schede. Le prove sul programma vero hanno trovato tre
difetti seri, tutti riparati: l'immagine di prova dei modelli era un file rotto e Google rifiutava
ogni modello (per questo anche la scelta automatica non passava mai a un modello più nuovo); con
l'AI accesa il pannello Impostazioni usciva dallo schermo; un modello lento fermava tutta la prova
come se mancasse la rete. Due revisori indipendenti hanno poi ricontrollato le riparazioni e
trovato altri ritocchi, sistemati: la finestra ora ha una misura minima (1024x600, mai più grande
dello schermo), il pannello si adatta anche alla finestra stretta, una connessione appesa ferma la
prova invece di farla durare un'ora, e il costo delle prove con la fatturazione attiva è scritto
onestamente. I testi nuovi sono stati ricontrollati nelle 9 lingue. Prove automatiche: 156 file,
tutte verdi. Provata il 16 ottobre sul programma vero, con la build finale: la scelta automatica
è passata da sola al modello più nuovo (3.8), la prova dei modelli è arrivata in fondo senza
segnare per sbaglio nessun modello come non adatto, e un client MCP vero ha letto le foto, ne ha
cambiato i tag e il disco è rimasto intatto finché non si è premuto "Salva Modifiche". Le
Impostazioni AI ora mostrano solo chiave e modello: il resto sta in "Avanzate".
Novità 2.0.0 (traguardo 107, 15 ottobre 2026): **secondo grande ciclo di controllo chiuso, e la
versione diventa 2.0.0.** Tre giri completi su tutto il programma, con lo stesso metodo del ciclo
precedente: 122 problemi segnalati, 106 confermati da verificatori indipendenti, **99 riparati in
26 salvataggi**, ognuno con la sua prova automatica e ricontrollato da un revisore. Le prove
automatiche sono passate da 86 a 148 file, tutte verdi. Il terzo giro ha trovato molto meno dei
primi due (25 segnalazioni contro 46 e 51). I più seri: la domanda "salvare prima di chiudere?"
che restava nascosta, un .txt non letto che poteva essere sovrascritto, il recupero dopo un crash
che perdeva una cartella, le foto HEIC che l'AI non taggava più, e lo svuotamento del Cestino che
si portava via il .txt di un'altra foto con lo stesso nome (a.png e a.jpg). Una prova usava una
posizione GPS vera come esempio: è stata sostituita con una finta in tutta la storia non ancora
pubblicata. Restano 9 rifiniture minori in elenco per il prossimo controllo. Le riparazioni vanno
ancora provate sul programma vero. La 1.3.0 non è mai stata costruita né pubblicata: la prossima
versione scaricabile sarà la 2.0.0, e da lì riparte la regola del +0.0.1.
Novità 1.3.0 (traguardo 106, 14 ottobre 2026): **chiuso il grande ciclo di controllo e riparazione.**
Due giri completi su tutto il programma: agenti che cercano i difetti per area, tre verificatori
indipendenti che provano a smontare ogni segnalazione, un correttore che ripara con una prova
automatica per ogni riparazione, e un revisore che ricontrolla ogni salvataggio. Il primo giro ha
confermato 55 difetti e ne ha riparati 54; il secondo ne ha confermati 78 e riparati 68. In tutto
**122 difetti riparati in 19 salvataggi**, e le prove automatiche sono passate da 47 a 86 file,
tutte verdi. I più seri riguardavano il backup anti-crash (che in certi casi rimetteva tag vecchi o
perdeva quelli di una seconda cartella), il Ctrl+Z dopo il Cestino, "Annulla lo svuotamento" con
un file omonimo, l'AI che continuava a lavorare dopo essere stata spenta, e le foto aperte da una
cartella di rete (`\\server\...`), che ora si salvano. Restano aperte tre cose che non stanno nel
codice ma nell'articolo pubblicato su Civitai (promesse non più vere su cestino, tag in minuscolo e
tag in blocco), più 28 rifiniture segnalate dai revisori dell'ultimo giro: sono in elenco per il
prossimo controllo. Le riparazioni non sono ancora state provate sul programma vero: serve una build.
Novità 1.3.0 (traguardo 105, 24 settembre 2026): **la versione in lavorazione diventa 1.3.0.** Il
lavoro nato come 1.2.1 (scelta automatica del modello AI, qui sotto) e il giro di controllo completo
che lo accompagna cambiano abbastanza cose da meritare un salto della seconda cifra: il numero sale
di 0.1.0 e la terza cifra torna a zero. La 1.2.1 non e' mai stata costruita ne' pubblicata, quindi
nessuno la ha sul proprio computer: la prossima versione che si potra' scaricare sara' la 1.3.0.
Novità 1.2.1 (traguardo 104): **il programma non è più legato a un modello AI preciso.** Prima
dentro il codice c'era una sigla sola, `gemini-3.6-flash`: il giorno che Google la chiude, l'AI
smette di funzionare per tutti e l'unico rimedio è andare a cambiarla a mano. Adesso **quali
modelli esistano lo dice Google**: il programma chiede l'elenco (allo stesso indirizzo a cui già
parlava, e la richiesta non consuma nulla) e sceglie da sé il più recente della linea gratuita.
L'elenco scritto nel codice non è più una gabbia: è la riserva, quella che si usa finché non si
è potuto chiedere l'elenco vero.
Quattro trappole, tutte verificate con un elenco finto fatto come quello vero. La prima è la più
insidiosa: **in ordine alfabetico "3.10" viene prima di "3.6"**, perché confronta l'1 con il 6.
Ordinando i nomi come testo, il giorno che Google supera il .9 il programma tornerebbe indietro
da solo, in silenzio. La versione va letta come numero. La seconda: **nell'elenco c'è di tutto**,
anteprime, modelli sperimentali, per l'audio, per generare immagini, per gli embedding — alcuni
non accettano nemmeno una foto, cioè proprio il mestiere che serve qui. La terza: **essere
nell'elenco non vuol dire poterlo usare**, perché un modello può comparire e poi rispondere che
serve la fatturazione; per questo, prima di adottarne uno, glielo si fa fare davvero — una
chiamata con un'immagine di un pixel e lo stesso schema del tagging. Adottarlo sperando che
funzioni sarebbe di nuovo dichiarare un successo senza averlo controllato. La quarta: **un
limite di frequenza non dice niente sul modello**; se la prova torna "troppe richieste" il
modello esiste eccome, e scartarlo farebbe scendere di versione il programma al primo momento
di traffico.
Il controllo parte una volta al giorno all'avvio, e subito quando il modello in uso risponde
"non esisto" — così chi ci finisce sopra non resta con l'AI rotta senza capire perché. Parte
**solo con l'AI accesa e la chiave presente**: chi non usa l'AI continua a non far partire
nessun collegamento, e quella promessa resta vera alla lettera. E ogni cambio **viene detto**:
un modello nuovo può taggare in modo diverso, e se si è a metà di un dataset è una cosa da
sapere. Nelle Impostazioni si vede quando è stato fatto l'ultimo controllo, c'è un tasto per
farlo subito, e scegliendo un modello a mano quello resta fermo.

Novità 1.2.0 (traguardo 103): **la 1.2.0 è pubblicata.** Sulla pagina delle release ci sono i due
file da scaricare, installer e portable, con la spiegazione di quale scegliere, la nota sull'avviso
dell'antivirus e, in cima a tutto, l'avvertimento a chi ha la 1.1.0: quella versione poteva
cancellare per sempre i file svuotando il cestino, e conviene aggiornare. Da adesso la regola del
+0.0.1 è di nuovo attiva: la prossima modifica farà 1.2.1.
Una cosa da sapere: **chi ha la 1.1.0 non vedrà nessun avviso di aggiornamento**, perché il
controllo è nato dentro la 1.2.0. Comincia a funzionare da questa versione in avanti, e chi ha la
vecchia deve passare dalla pagina delle release.

Novità 1.2.0 (traguardo 102): **le due funzioni nuove provate sul programma vero, e due difetti
che solo la prova poteva far uscire.** Il collaudo è stato fatto con una cartella costruita
apposta per essere scomoda: un nome con lo spazio, uno con l'accento, una foto senza testo, due
foto con lo stesso nome in cartelle diverse. Ogni risultato è stato controllato **sul disco e
dentro il Cestino di Windows**, non sul messaggio che il programma dava.
L'export ha superato tutto: le due foto omonime restano distinte e con i tag giusti, la rinomina
in sequenza appaia ogni numero alla sua estensione vera, e la cartella di partenza resta intatta
byte per byte in tutti e tre i giri. L'annullamento ha rimesso le foto al loro posto con le
miniature e i tag; che fossero i file veri e non una ricostruzione lo dimostra un dettaglio: il
file di testo è tornato con l'ordine originale dei tag, non con quello riordinato che il
programma userebbe riscrivendolo.
I due difetti sono usciti dall'ultima prova, quella col file omonimo. Il primo: il programma si
rifiutava correttamente di sovrascrivere, e poi annunciava che nel Cestino non aveva trovato
niente — mandando a cercare nel posto sbagliato e facendo sembrare perso un file che era al
sicuro. Il secondo, che nessuno aveva previsto: la foto restava bloccata ma il suo file di testo
tornava da solo, e si sarebbe piazzato accanto all'immagine diversa che aveva preso quel nome,
passandole in silenzio i tag di un'altra foto — per un dataset, un errore che poi non si scopre
più. Adesso la coppia foto+testo torna insieme o non torna, e il messaggio dice il motivo vero.
È il terzo giro di fila in cui una riparazione ne nasconde un'altra: ricontrollare le
riparazioni non è prudenza, è parte del lavoro.

Novità 1.2.0 (traguardo 101): **svuotare il cestino si può annullare.** Fino a ieri quello era
l'ultimo passo senza ritorno dal programma: i file finivano nel Cestino di Windows — recuperabili,
sì, ma solo andando a cercarseli lì dentro, in mezzo alla roba di tutti. Adesso, dopo uno
svuotamento, nel cestino compare **"Annulla lo svuotamento"**: le foto tornano al loro posto sul
disco e riappaiono nel cestino dell'app, cioè esattamente dove stavano un attimo prima. È il
contrario esatto del passo che si vuole annullare, non una scorciatoia che le rimette in galleria
saltando un passaggio. Funziona finché il Cestino di Windows non viene svuotato a sua volta, e la
scritta lo dice invece di lasciarlo scoprire.
Tre cose sono venute fuori **solo provandolo davvero**, e ognuna sarebbe finita nel programma senza
farsi notare: Windows restituisce i nomi **senza estensione** se sul computer è attiva
l'impostazione "nascondi le estensioni", quindi cercando per nome mostrato non si ritroverebbe
niente su mezzo mondo; il comando giusto si chiama "undelete" e **non** è la voce di menu
"Ripristina", che è tradotta e su un Windows tedesco o cinese non si troverebbe mai; e un comando di
sistema rifiutava due opzioni messe insieme, protestando in silenzio dentro una rete di sicurezza
che lo faceva tornare come un onesto "non riuscito" senza dire perché.
Se nel frattempo al posto del file ne è nato un altro con lo stesso nome, il file **non** viene
rimesso e il programma lo dice: questa funzione esiste per non perdere file, non per perderne di
nuovi.
Novità 1.2.0 (traguardo 100): **l'archivio si porta dentro anche le foto, e sa numerarle.**
"Esporta (.zip)" adesso fa due domande. La prima: solo i file di testo con i tag, oppure **anche le
foto**, ognuna accanto al suo testo e con lo stesso nome — cioè un dataset pronto all'uso. Sotto
ogni scelta si vedono **quanti file sono e quanto pesano**, perché fra le due strade ci passano i KB
da una parte e i GB dall'altra, e la differenza va vista **prima** di premere, non dopo.
La seconda domanda compare **solo se dentro ci vanno le foto**: tenere i nomi originali, oppure
rinominare in sequenza 0001, 0002, 0003… che è la convenzione dei dataset LoRA e fa sparire da sola
la questione dei nomi doppi. Rinominare i soli file di testo darebbe file che non corrispondono più
a nessuna immagine sul disco, quindi lì la domanda non si fa nemmeno. **I file nella cartella non
vengono rinominati**: cambiano i nomi solo dentro l'archivio, e la scritta lo dice.
L'archivio non si costruisce più tutto in memoria prima di essere salvato: i pezzi vengono scritti
**direttamente sul file scelto** man mano che escono, così anche un dataset da qualche migliaio di
foto non fa morire la finestra.
Novità 1.2.0 (traguardo 99): **il programma è stato costruito e provato davvero, e il Cestino di
Windows funziona anche nell'exe.** Era il dubbio che non si poteva sciogliere in nessun altro modo:
la riparazione del Cestino era stata misurata solo sul programma in prova, che carica le pagine da
un indirizzo di rete locale, mentre il programma consegnato le carica dal disco — e i permessi, in
Chromium, sono legati a quell'indirizzo. Se lì non avesse funzionato, la novità principale della
1.2.0 sarebbe stata finta. La prova è andata così: una foto dentro una **sottocartella**, messa nel
cestino e poi svuotata dal programma portable. Il programma ha detto "File spostati nel Cestino di
Windows", senza aprire nessuna seconda finestra, e andando a guardare **dentro il Cestino di
Windows** i due file c'erano davvero, con scritto che venivano dalla sottocartella giusta: quindi il
percorso viene ricostruito anche per le foto che stanno dentro le cartelle interne. Non è stato
creduto il messaggio, è stato controllato il Cestino. **Il difetto di perdita dati della 1.1.0 è
chiuso alla radice**, sul programma vero.
Nello stesso giro si sono viste tutte le frasi riscritte in questi giorni, con una foto sola davanti:
"Immagini caricate: 3", "Aggiungi tag alle foto selezionate: 1", "Foto spostate nel cestino: 1",
"Foto nel cestino: 1". Nessuna si sgrammatica più.
Novità 1.2.0 (traguardo 98): **tre cose nuove nel programma di installazione.**
La prima è l'**installazione pulita**: una casella, spenta di serie, che compare solo se sul computer
ci sono già le impostazioni di una volta precedente (alla prima installazione non ci sarebbe niente
da pulire e la domanda sarebbe rumore). Spuntandola si riparte da zero: sparisce la chiave AI salvata
— va rimessa a mano — la lingua scelta, tema e suoni, e il salvataggio automatico dei tag non salvati.
La scritta dice tutto questo per esteso, e dice soprattutto la cosa che conta: **le foto e i file di
testo non vengono toccati**, perché stanno nelle cartelle di chi usa il programma, non lì.
La seconda **c'era già e non serviva scriverla**: se il programma è aperto mentre si installa, esce
un avviso che chiede di chiuderlo, tradotto in tutte e nove le lingue. Vale per il programma
installato, non per quello portable — e va bene così, perché il portable gira da un'altra parte e
l'installazione non tocca niente di suo.
La terza è l'**avviso di una versione nuova**, e su questa c'è una scelta da spiegare. Il programma
si vanta di non mandare niente su internet, e proprio in questi giorni gli è stato spento il
correttore ortografico perché era l'unico collegamento che apriva senza che nessuno glielo avesse
chiesto. Quindi l'avviso non è stato acceso di nascosto: al primo avvio il programma **chiede una
volta sola** se controllare, spiega che si collega soltanto a GitHub e che legge soltanto il numero
di versione, e finché non si risponde non si collega. Chi dice di no non vedrà mai un collegamento
partire, e la frase "non manda niente" resta vera alla lettera; chi dice di sì, quando esce una
versione nuova si vede il numero vecchio, quello nuovo e un tasto che apre la pagina da cui
scaricarla. Si cambia idea quando si vuole dalle Impostazioni.
Novità 1.2.0 (traguardo 97): **le nove lingue hanno un controllo che gira da solo**. Il controllo
dei tipi, che dalla 1.2.0 parte prima di ogni costruzione, non vede circa 50 delle 254 scritte
dell'interfaccia: sono quelle che le finestre interne (editor dei tag, visualizzatore, finestrelle di
conferma) ricevono per strada, e su quelle il computer non ha modo di accorgersi se una lingua ne ha
una in meno. Ora c'è `scripts/check-translations.mjs`, che confronta tutte e nove le lingue con
l'inglese e si ferma se trova una voce mancante o in più, una casella vuota, un doppione, o un
segnaposto (le parti che vengono riempite con un numero o un nome) diverso da quello inglese; in coda
elenca le voci rimaste identiche all'inglese, che a volte sono giuste e a volte sono una traduzione
dimenticata. Oggi passa pulito su 254 voci per 9 lingue. Quello che una macchina non sa giudicare —
se una frase dice davvero la stessa cosa, se sta dentro un pulsante, se è la lingua giusta — resta
affidato a una squadra di controllori, uno per lingua, che tengono un quaderno di quello che imparano
per non ripetere le stesse domande: quelli però vivono fuori dal programma e non finiscono nel
pacchetto che si scarica.
Novità 1.2.0 (traguardo 96): **le ultime rifiniture prima di costruire**. Il correttore ortografico
di Electron era acceso: era l'unico collegamento a internet che il programma apriva senza che nessuno
glielo avesse chiesto, e per un programma che si vanta di non far uscire niente dal PC era una
contraddizione. Ora è spento in tutte e due le finestre. Aggiunto il file **LICENSE (MIT)**, che la
copertina prometteva già da mesi con la scritta "Free & open source" senza che nel progetto ci fosse.
L'errore **"chiave AI non valida"** usciva in inglese in tutte e nove le lingue, pur avendo la
traduzione già scritta e mai usata: ora parla la lingua scelta, e se la chiave manca mentre si tagga
in blocco il programma lo dice **prima** di aprire la finestra della chiave, invece di aprirla e
basta. La funzione che assegna una categoria a ogni tag (serve per il colore e per le statistiche)
rifaceva lo stesso calcolo migliaia di volte sullo stesso tag: ora se lo ricorda, ed è il guadagno di
velocità più grosso di tutta l'analisi. Nel **portoghese** due parole erano portoghese europeo
("ficheiro", "guardar") dentro un blocco per il resto brasiliano; nel **tedesco** il tema grafico si
chiamava "Thema", che in tedesco è l'argomento di un discorso, non l'aspetto di un programma. Infine
la **scheda 11** della pagina di presentazione prometteva un ordinamento "per numero di tag" che non
esiste — si ordina per nome o per data, e lo si legge perfino nella stessa immagine, dove c'è scritto
"SORT BY: Name (A-Z)".
Novità 1.2.0 (traguardo 95): **il Cestino di Windows funziona di nuovo per le cartelle aperte con
"Carica Cartella"**. Era il difetto del traguardo 94, ora chiuso alla radice invece che con la sola
conferma. Il programma apre la cartella con il selettore del browser, che di proposito non gli dice
dove quella cartella si trovi sul disco — ed è per questo che non poteva chiedere a Windows di
cestinare niente. Ma il percorso Windows lo dice a Electron, quando concede il permesso di leggere e
scrivere quella cartella: ora quel dato viene raccolto e da lì si ricostruisce il percorso di ogni
foto, sottocartelle comprese. Nessun cambiamento per chi usa il programma, tranne che **le foto
tornano recuperabili dal Cestino di Windows** e la seconda finestra non compare più.
Non è stato tolto niente per ottenerlo: l'editor dei tag continua a sincronizzarsi col progetto, il
backup anti-crash usa le stesse chiavi di prima, il ricarico delle foto ritoccate da fuori e il
salvataggio sono intatti, e non è stata cambiata **nessuna** delle scritte nelle 9 lingue.
Il ricontrollo di questa stessa riparazione ha poi trovato il difetto peggiore della giornata, ed è
stato chiuso subito: il programma teneva **l'ultimo** percorso visto, ma in quel momento ne arrivano
anche di altre cartelle (basta che rilegga la foto selezionata di una cartella aperta prima), e
l'unica difesa era il **nome** della cartella — cioè l'assunto che qui è già costato caro due volte,
visto che i dataset si chiamano quasi tutti "dataset" o "img". Con due cartelle omonime, le foto
della seconda potevano prendersi il percorso della prima, e svuotando il cestino sarebbero finiti nel
Cestino di Windows i file **dell'altra cartella**. Ora il programma non chiede più "che percorso hai
visto": porta le prove di cosa ha appena letto (nome, sottocartella, dimensione e data di qualche
file) e riceve un percorso solo se una cartella contiene davvero quei file, ed è l'unica a contenerli.
Se due combaciano non risponde: meglio la seconda conferma che un percorso indovinato.
Restano fuori le **cartelle di rete** (i dataset sul NAS): lì Windows un Cestino non ce l'ha proprio,
quindi vale ancora la seconda conferma con la cancellazione definitiva, che è l'unica verità
possibile. Provato guidando il programma vero: una foto dentro una sottocartella è finita nel Cestino
di Windows col suo percorso completo, senza nessuna finestra in più.
Novità 1.2.0 (traguardo 94): **scoperto un difetto grave nella 1.1.0 già consegnata: svuotando il
cestino le foto non finivano nel Cestino di Windows, venivano cancellate per sempre.** Non riguarda
tutti allo stesso modo: capita alle foto aperte con **Carica Cartella**, che è la strada normale.
Quella strada usa il selettore di cartelle del browser, e i file che ne escono non si portano dietro
il percorso su disco: il programma quindi non sapeva quale file dire a Windows di cestinare, e
ripiegava di nascosto sulla cancellazione diretta, annunciando lo stesso "File eliminati con
successo". Provato sull'app vera il 17 agosto 2026. Chi ha caricato le foto una per una o
trascinandole non è mai stato toccato dal difetto.
Ora il programma prova il Cestino di Windows e, quando non può usarlo, **si ferma e apre una seconda
finestra**: dice quante foto riguarda, perché non è possibile, e che quei file escono dalla cartella
per sempre. Solo un sì esplicito cancella; annullando resta tutto dov'è. La riparazione vera —
aprire la cartella con la finestra di Windows invece che con quella del browser, così ogni foto ha un
percorso e il Cestino funziona per tutti — è più lunga ed è in elenco.
Novità 1.2.0 (traguardo 93): **la schermata di avvio non fa più scorrere testi**. Erano quattro frasi
che si davano il cambio ogni 0,8 secondi in un ciclo senza fine: sembravano scritte a caso, e in un
certo senso lo erano, perché non seguivano nessun avanzamento vero ma giravano solo a tempo, troppo
in fretta perché si facesse in tempo a leggerle. Ora c'è una riga sola e ferma. E al primissimo
avvio la schermata parla la **lingua di Windows** invece che inglese sempre: prima su un PC italiano
si vedeva una schermata in inglese e subito dopo la scelta della lingua in italiano.
Novità 1.2.0 (traguardo 92): **riparazioni nate da una segnalazione di un utente su Civitai**. Uno
che usa il programma ha scritto tre cose, e tutte e tre erano vere.
La più seria l'ha fatta scoprire senza saperlo: **il cestino diceva bugie sui tuoi file**. Svuotando
il cestino, se Windows non riusciva a spostare un file (bloccato, permessi), il programma lo
cancellava **per davvero**, senza Cestino di Windows e senza possibilità di recupero — proprio nel
momento in cui serviva poter tornare indietro. E in ogni caso annunciava "File eliminati con
successo", togliendo la foto dal progetto anche quando il file era rimasto al suo posto. Ora o il
file arriva nel Cestino di Windows o non si tocca niente e te lo dice: le foto che non ce l'hanno
fatta **restano nel cestino**, sotto gli occhi, con il conto di quante sono. (Questo bastava solo a
metà: vedi il traguardo 94, dove si scopre che nel caso più comune il Cestino di Windows non era
nemmeno raggiungibile.)
Sistemati anche i **testi del cestino**, che non dicevano mai la cosa più importante: che le foto
escono dalla tua cartella. La conferma diceva perfino "questa azione non può essere annullata", che
è falso (i file si recuperano dal Cestino di Windows), mentre altre tre finestre rassicurano che "i
file su disco non vengono toccati" — chi legge quelle arriva qui convinto che nemmeno questo tasto
tocchi niente. Ora tutte e 9 le lingue nominano il Cestino di Windows, una riga gialla dentro la
vista Cestino lo dice **prima** di premere, e "Elimina definitivamente" non si chiama più così.
Il tasto **"Esporta tutti"** si chiama ora **"Esporta tag"**: l'archivio ha sempre contenuto solo i
file di testo, mai le foto, ma il nome faceva pensare al dataset intero e l'unico modo di scoprirlo
era aprire lo zip. Aggiunto un suggerimento che lo dice. E l'export **non porta più via le foto che
hai messo nel cestino**: era l'unico punto dell'esportazione delle didascalie che non le filtrava.
Attenzione, non è tutto: l'elenco dei tag del progetto (e il suo export in JSON o TXT) conta ancora
anche i tag delle foto cestinate. È un'altra cosa e non è stata toccata qui.
Infine la **vista Quadrate**: lo spazio che il programma riserva alle anteprime non ancora disegnate
era lo stesso per le due viste, ma una card quadrata è molto più alta — con lo zoom in alto valeva
meno della metà del vero, e alla prima scorsa di una cartella grande la pagina si ricalcolava di
continuo. Ora in Quadrate il valore è molto più vicino al vero; in Intere non cambia niente, lì era
già ragionevole. Resta comunque una stima per difetto, perché le colonne si allargano oltre il minimo
scelto con lo zoom. E se questo basti a togliere gli scatti che l'utente ha visto non è dimostrato:
serve una misura su una cartella vera, che non è stata fatta ed è annotata.
Novità 1.2.0 (traguardo 91): **due foto non possono più scambiarsi i tag**. Ogni foto caricata riceve
un'etichetta interna che serve al programma per distinguerla dalle altre. Era un numero a caso corto:
su una cartella da 3000 foto, circa una volta su 160, due foto ricevevano la stessa etichetta e
diventavano gemelle. Scrivendo un tag su una lo si scriveva anche sull'altra e, al salvataggio, il
file di testo della seconda veniva sovrascritto: in silenzio, senza nessun avviso. Ora l'etichetta la
genera il sistema ed è lunga 36 caratteri: due uguali non capitano nemmeno lavorando per anni.
Provato sul programma vero: 500.000 etichette, zero doppioni; con quella vecchia, 2 cartelle su 500
avevano già la coppia sbagliata.
Novità 1.2.0 (traguardo 90): **prima di costruire il programma parte il controllo dei tipi**. Fino a
ieri la costruzione non controllava niente: un errore nel codice sarebbe entrato dritto dentro l'exe
e sarebbe saltato fuori addosso a chi lo usa. Ora il comando di costruzione fa prima il controllo e,
se trova anche un solo errore, si ferma lì: niente exe sbagliato da riconsegnare. Costa pochi secondi
e oggi passa pulito. Vale la pena dire cosa copre e cosa no: guarda il codice della finestra
principale, non i file del guscio Electron. Sulle traduzioni si accorge delle scritte usate nella
schermata principale, ma non di quelle lette dentro le finestre separate (editor dei tag,
visualizzatore, finestrelle di conferma), perché lì le traduzioni arrivano senza etichetta e il
controllo non riesce a guardarci dentro. Provato: togliendo la voce russa del tasto "Chiudi file" il
controllo passa lo stesso. Quel pezzo di buco lo chiude il lavoro già in elenco sui cinque componenti
da sistemare.
Novità 1.2.0 (traguardo 89, in lavorazione): nell'editor dei tag arriva il tasto **"Chiudi file"**,
rosso, a sinistra di Salva. Serviva: fino ad ora l'unico modo di togliere di mezzo un file aperto era
"Nuovo". Se ci sono modifiche non salvate chiede prima cosa farne, con tre strade (salva e chiudi,
chiudi senza salvare, annulla); se non c'è niente in sospeso chiude e basta. Importante: se il
salvataggio non riesce — cartella di rete che sparisce, finestra di salvataggio annullata — il file
**non** viene chiuso, altrimenti il lavoro sparirebbe in silenzio.
Preparato anche uno strumento per i **tag che mi manderai**: legge i file dell'editor (.txt o .json),
dice quali tag sono già nel dizionario e quali no, e inserisce solo quelli nuovi nella loro categoria.
Due tag scritti in modo diverso (maiuscole, trattini bassi, spazi doppi) vengono riconosciuti come lo
stesso tag, così non nascono doppioni.
Fatta la **copertina per Civitai**: là la scheda è verticale e ritaglia il centro dell'immagine, quindi
logo e nome stanno esattamente al centro. Il programma salva anche l'anteprima già ritagliata, per
vedere come verrà la scheda prima di caricarla.
Novità (traguardo 88): il progetto è ora **pubblico** su GitHub. Prima di aprirlo ho controllato
tutta la storia dei salvataggi: nessuna chiave e nessuna password è mai finita dentro.
(Correzione del 14 ottobre 2026: in questo registro era rimasto il percorso della cartella del
progetto sul disco; ora è tolto, ma resta leggibile nelle versioni precedenti della storia.) La cartella `Release` e le note di lavoro restano fuori. Chiunque ora può
vedere il programma, scaricare i due file e leggere anche questo registro.
Novità (traguardo 87): **pubblicata la 1.1.0 su GitHub**. Nella pagina delle release adesso c'è
**solo la 1.1.0**, con i due file pronti da scaricare (installer e portable) e una spiegazione di
quale scegliere; la vecchia release 3.7.0 di aprile e i suoi contrassegni sono stati tolti, come
richiesto. Dal testo della pagina sono sparite le istruzioni per compilare il programma da soli:
chi arriva lì scarica e basta. Il repository è poi stato reso **pubblico** (vedi sopra).
Novità (traguardo 86): **pagina di presentazione del progetto rifatta**. In cima c'è ora una
**copertina** (logo, nome del programma e la finestra vera inclinata in prospettiva) e sotto
**quindici schede**, una per ogni funzione: a sinistra il titolo con tre righe che spiegano, a destra
la schermata del programma intera e dritta — e ad ogni scheda testo e immagine si scambiano di
lato. Le schermate sono state prese con una **cartella vera già taggata** (Sisu), con il programma
in **inglese**. Non sono immagini fatte a mano: tre programmini le **rigenerano da sole**, quindi
se domani cambia un pulsante basta rilanciarli invece di rifare gli screenshot a mano. Copertina e
schede sono salvate in JPEG, così la pagina pesa 1,4 MB invece di 6.
Novità 1.1.0 (traguardo 85): **prima versione "tonda"**. Non è un cambiamento singolo: è il numero
che raccoglie tutto il lavoro fatto dalla 1.0.6 in poi (tre giri di controllo automatico con le
riparazioni, l'intelligenza artificiale portata a Gemini 3.6 Flash, il tasto "Elimina selezionate",
l'estetica uniforme dei pulsanti, la fascia laterale dell'installer con le foto a ventaglio) e che
segna il punto in cui il programma è considerato completo e stabile. Prima di chiudere la versione
è stato fatto un **controllo completo delle traduzioni**: tutte e 9 le lingue hanno le stesse
identiche voci, nessuna casella vuota, nessuna scritta rimasta in inglese per sbaglio (le poche
uguali all'inglese sono parole che in quelle lingue si scrivono davvero così, tipo "Zoom" e
"Original"); tolte due voci ormai inutilizzate.
Novità 1.0.15 (traguardo 84): nella **fascia laterale dell’installer** le tre fotografie sono ora
disposte a **ventaglio**, sovrapposte e inclinate come un mazzo di foto aperto in mano, con sopra
le righe dei tag fra il logo e le foto, centrate a coppie; la foto centrale copre le altre due. Tolto l’**avviso antivirus dalla schermata di avvio** del
programma: quella schermata dura pochi secondi e il testo la appesantiva. L’avviso resta dove c’è
il tempo di leggerlo, cioè nella prima pagina dell’installer.
Novità 1.0.13 (traguardo 83): estetica **uniforme dei pulsanti**. I tasti del pannello dei tag e
di quello di selezione avevano due aspetti diversi (alcuni pieni con ombra, altri piatti col
bordo): ora hanno tutti la stessa forma e cambia solo il colore. Nella **fascia laterale
dell’installer** la parte bassa non è più quasi vuota: sotto la nuvola di tag c’è una fila di
tre fotografie uguali in proporzione corretta 4:3, allineate e distanziate in modo regolare.
Novità 1.0.12 (traguardo 82): l'intelligenza artificiale passa a **Gemini 3.6 Flash** (la sigla è
stata verificata sulla documentazione ufficiale di Google: versione stabile, accetta le immagini).
Chi aveva già salvato il modello vecchio viene riportato in automatico su quello nuovo. Nel
pannello di selezione arriva il tasto **"Elimina selezionate"**, che sposta nel cestino tutte le
foto scelte: è reversibile, si ripristinano, e nessun file viene toccato su disco finché non si
svuota il cestino. La **legenda** dei tag è stata riscritta perché non diceva rispetto a cosa:
ora nomina le foto selezionate ("Sarà aggiunto a tutte le selezionate", "Già presente su alcune
selezionate", "Nel progetto, non su queste") ed è centrata. Tolte due scritte ridondanti e
l'icona di "Inverti selezione" non ha più la freccia che confondeva.
Novità 1.0.11 (traguardo 81): riparati i **5 difetti** che un secondo controllo agentico (14 agenti)
ha trovato **dentro le riparazioni della 1.0.10**. Il più serio: salvando un file nell'editor
veniva congelata la lista dei tag ma non il file di destinazione, così aprendo un altro file
durante la scrittura il progetto poteva abbinare i tag alla foto sbagliata e sovrascriverne il
`.txt` al salvataggio successivo. Poi: i tag aggiunti mentre l'editor rilegge dal disco non
vengono più buttati; il visualizzatore non rallenta più man mano che si sfoglia una ricerca lunga;
un recupero anti-crash lasciato dalla versione precedente non va più perso nell'aggiornamento. In
più, per correttezza verso chi legge, l'avviso antivirus ora dice che il programma **di serie** non
invia nulla su Internet: era vero appena installato ma non con la funzione Gemini attiva.
Novità 1.0.10 (traguardo 80): riparati i **9 difetti** trovati dal controllo agenti mirato sul
cambiamento 1.0.7 → 1.0.9 (18 agenti, arrivato in fondo). I tre importanti: **l'installer non
taglia più il testo** (l'avviso antivirus della 1.0.9 faceva sparire le ultime righe in russo,
tedesco e portoghese, invito a premere Avanti compreso); il **backup anti-crash** ora usa il
percorso completo, perché la riparazione precedente non bastava con sottocartelle omonime annidate
(`char_anna\10_face` e `char_bea\10_face` si scambiavano ancora i tag); la **barra degli strumenti**
non si sovrappone più nemmeno in russo, dove le parole sono più lunghe. Poi tre gare di tempistica
nell'**editor dei tag**, che scattavano su cartelle lente (OneDrive, dischi di rete, antivirus): una
modifica fatta durante il salvataggio non sparisce più, una rilettura lenta non riempie più
l'editor coi tag del file precedente, e Salva resta disabilitato finché la rilettura non finisce.
Infine tre minori: l'avviso "foto nascoste" non conta più foto cestinate, Annulla non riporta più a
schermo la foto prima del ritocco esterno, e nel visualizzatore le foto uscite dalla ricerca non
vengono più saltate.
**Ultima consegna:** 25 luglio 2026 — portable + installer **1.1.0** in `Release\` (solo questa
coppia, le 1.0.12 sono state tolte). Verificata guardando dentro al pacchetto: contiene i file
appena compilati, non una versione riciclata. La 1.1.0 comprende tutto il lavoro dalla 1.0.6 in
poi (le versioni da 1.0.13 a 1.0.17 erano rifiniture mai consegnate).
Novità 1.0.9 (traguardo 79): **avviso antivirus**. Il programma non ha una firma digitale (il
certificato costa centinaia di euro l'anno), quindi Windows può dire "editore sconosciuto" e
qualche antivirus può insospettirsi. Ora la cosa è spiegata in due punti: nella **pagina di
benvenuto dell'installer** (in cima, tradotta in 9 lingue) e nella **schermata di avvio del
programma** (una riga breve sotto la barra di caricamento), che è l'unico punto visto sia dalla
versione portable sia da quella installata. Il testo spiega il perché invece di dire "ignora
l'antivirus": è più onesto e più convincente. Attivato anche il controllo severo sulle traduzioni
dell'installer: se ne manca una, la build si ferma invece di produrre un testo in inglese in mezzo.
Novità 1.0.8 (traguardo 78): riparati i **7 problemi** trovati dal controllo agenti sulla 1.0.7 —
il più importante evitava che, dopo un blocco improvviso dell'app, i tag di una foto finissero su
un'altra foto con lo **stesso nome** in un'altra sottocartella (la struttura tipica dei dataset
LoRA). Sistemati anche: nell'editor dei tag lo "scarta modifiche" ora scarta davvero (il file
però **resta aperto**, e alla riapertura viene riletto dal disco), l'avviso quando i tag di gruppo
stanno per finire su foto nascoste dalla ricerca, il ricarico automatico che sporcava
annulla/ripeti e poteva partire due volte, "Seleziona tutte" che cancellava le selezioni nascoste,
e la foto aperta che spariva togliendole il tag cercato. In più la **barra degli strumenti** della
galleria non si accavalla più restringendo la finestra. Novità
1.0.7 (traguardo 77): **12 richieste** dell'autore — trascinamento immagini (con .txt
automatico), ricerca per tag nella pagina principale + "inverti selezione", editor tag potenziato
(tasto "aggiungi tag del progetto", aggiunta multipla con virgole, tag importati che entrano nella
palette, finestra "scarta" a tema), pannello selezione più largo/responsive con ricerca e legenda
degli stati, area tag che riempie lo spazio in vista "Intere", traduzione tag anche nel
visualizzatore, e aggiornamento automatico dell'immagine se modificata fuori dal software. Novità
1.0.6 (traguardo 76): sistemate le **ultime 2 lentezze** su dataset grandi senza cambiare le funzioni — la galleria ora ridisegna SOLO la foto
che cambia (non più tutte), e all'importazione le miniature si creano a piccoli gruppi in
parallelo invece che una alla volta. Novità 1.0.5: chiuso l'ultimo giro di controllo agenti
(vedi traguardo 75) — salvataggio del singolo .txt dal visualizzatore reso onesto come quello in
blocco, limiti di dimensione sugli import (tag di progetto ed editor), chiudere una foto non
rompe più l'annulla, protezione dei percorsi nei canali di sistema, **exe più leggero (~75 MB in
meno)**, e le **2 lentezze** su dataset enormi rese fluide (pannello selezione e lista statistiche)
senza cambiarne le funzioni. Novità 1.0.4: risolti 8 difetti del controllo agenti. Novità 1.0.3:
editor sincronizza solo il file GIUSTO. Novità 1.0.2: immagine installer arricchita. Restano
valide le novità 1.0.1: sfondi viola pieni, tasto lingua senza frangia, caricamento dopo la lingua.
**Regola versione:** ogni modifica alza la versione di 0.0.1, ma solo se arriva **dopo una
consegna**: quelle che rientrano in una versione ancora da costruire ci entrano dentro e il numero
resta fermo.
**Nota:** i numeri 3.x usati durante lo sviluppo erano interni (mai distribuiti);
la prima versione vera e propria è la 1.0.0. Le etichette "(v3.8.0)" / "(v3.9.0)"
nei traguardi qui sotto indicano solo l'ordine in cui le funzioni sono state fatte.

Questo file è il "diario" del progetto: a colpo d'occhio mostra cosa è già stato
fatto (✅) e cosa manca ancora (⏳). Scritto in italiano semplice.

---

## ✅ Traguardi completati

| # | Traguardo | In parole semplici |
|---|-----------|--------------------|
| 1 | AI in cloud con Google Gemini | L'app può generare i tag delle foto usando l'intelligenza artificiale di Google (a scelta, non obbligatoria). |
| 2 | Chiave API protetta | La chiave personale di Gemini viene salvata cifrata nel sistema, mai in chiaro. |
| 3 | Tagga tutte con AI + velocità | Pulsante per taggare in blocco tutte le immagini, con velocità regolabile e ritenta se il servizio è occupato. |
| 4 | Salta foto già taggate | Interruttore per non ri-taggare le immagini che hanno già dei tag. |
| 5 | Pulsante Annulla | Si può fermare l'analisi AI in blocco mentre è in corso (anche se una richiesta è appesa). |
| 6 | Correzione badge +18 | Il riconoscimento dei contenuti per adulti non segna più per sbaglio parole innocue (es. "grass", "class"). |
| 7 | 9 lingue | Interfaccia tradotta in italiano, inglese, francese, spagnolo, tedesco, cinese, giapponese, portoghese, russo. |
| 8 | Controllo sicurezza e stabilità | Verifica completa: risolti 4 problemi importanti (tag persi durante l'AI, analisi "fantasma", import bloccato, perdita modifiche a un crash). 0 vulnerabilità nel programma finale. |
| 9 | Salvataggio automatico anti-crash | Tag e didascalie vengono salvati di continuo: se l'app si chiude male, al riapri-cartella li recupera (solo per la stessa cartella). |
| 10 | AI spenta di default + badge "Beta" | Al primo avvio l'AI è spenta; accanto a "Strumenti AI" c'è un'etichetta "Beta" con spiegazione. |
| 11 | Pannello tag diviso in 2 (v3.8.0) | Nella finestra di una foto i tag sono in due zone: **sopra** quelli già su questa foto, **sotto** quelli delle altre foto non ancora messi qui. Clic sotto → sale sopra; togli da sopra → torna sotto (se è su altre foto) oppure sparisce (se era solo su questa — scelta B). |
| 12 | Suggerimenti → palette del progetto (v3.8.0) | Nella finestra di una foto, i tag scelti dai **"Tag Suggeriti"** non finiscono più diretti sull'immagine: entrano nella zona **sotto** (palette del progetto). Poi li applichi cliccandoli lì, una foto alla volta. |
| 13 | Rimossa la didascalia AI in linguaggio naturale (v3.8.0) | Tolta la scheda **"Caption"** (didascalia descrittiva in frasi). L'app ora fa **solo tag**. Nessun dato perso: le didascalie non erano mai salvate nei file `.txt`, che contengono solo i tag. |
| 14 | Avvio a finestra piena (v3.8.0) | All'apertura l'app si presenta **massimizzata** (finestra piena con barra del titolo, non a schermo intero). Riducendola torna alla dimensione normale (1280×800). |
| 15 | Installer multilingue (v3.8.0) | Oltre al portable ora c'è un vero **programma di installazione**: come prima cosa fa **scegliere la lingua** (9 lingue), permette di scegliere la cartella, e alla fine mostra le caselle **"Esegui l'app"** e **"Crea un collegamento sul desktop"**. Disinstallazione pulita. |
| 16 | Scelta lingua al primo avvio (v3.8.0) | Al **primissimo avvio** (sia portable sia installato) compare una schermata per scegliere la lingua, con già proposta quella del PC. La scelta ora **viene ricordata** (prima si riazzerava a italiano a ogni riavvio). |
| 17 | Rientro uniforme della finestra (v3.8.0) | La finestra interna ora ha lo **stesso margine su tutti e quattro i lati** (24px) e usa tutta la larghezza: prima i lati erano più stretti e su schermi larghi restavano grandi fasce vuote. |
| 18 | Anteprima lingua dal vivo (v3.8.0) | Nella schermata di scelta lingua al primo avvio, cliccando una bandiera **cambia lingua tutta la finestra** (titolo, sottotitolo, tasto di conferma, nota in basso), non più solo il tasto. Così si vede subito com'è la lingua prima di confermare. |
| 19 | Miniature veloci (v3.9.0) | **Grosso miglioramento di velocità.** Prima ogni miniatura caricava la foto a piena risoluzione: con tante foto il programma si impallava. Ora crea vere anteprime piccole; l'immagine grande si carica solo quando apri la singola foto. |
| 20 | Finestra foto a schermo pieno (v3.9.0) | Aprendo una foto singola, la finestra ora **riempie tutto lo schermo** anche sui monitor larghi (prima lasciava fasce vuote ai lati). |
| 21 | Contatore foto (v3.9.0) | A foto aperta compare in alto la **posizione** (es. "3 / 120"). |
| 22 | Tag scelti in ordine alfabetico (v3.9.0) | Nella foto aperta i tag scelti si mostrano sempre in **ordine alfabetico** (le trigger word restano prime). |
| 23 | Traduzione dei tag al passaggio del mouse (v3.9.0) | Passando sopra un tag (scelto o disponibile) compare la **traduzione nella lingua impostata**, come per i tag suggeriti. Vale per i tag del dizionario (per ora l'italiano è completo); per i tag scritti a mano non c'è traduzione. |
| 24 | Elimina e vai avanti (v3.9.0) | Cestinando la foto aperta si **passa direttamente alla successiva** senza chiudere la finestra (chiude solo se era l'ultima). |
| 25 | Copia e incolla tag (v3.9.0 / 1.0.0) | Due tasti per **copiare i tag** da una foto e **incollarli** su un'altra (li aggiunge senza doppioni). Disponibile sia nella finestra della foto sia **direttamente sulle miniature** (al passaggio del mouse). |
| 26 | Miniature più larghe (v3.9.0) | Le anteprime partono un po' **più grandi** (1-2 colonne in meno); regolabili col cursore dello zoom. |
| 27 | Contatore tag su ogni miniatura (v3.9.0) | Ogni anteprima mostra un **pallino col numero di tag** di quella foto. |
| 28 | Statistiche sulla pagina principale (v3.9.0) | Il tasto **Statistiche** è ora sulla pagina principale, fuori dal menu impostazioni. |
| 29 | Seleziona / Deseleziona tutte (v3.9.0) | Un tasto per **selezionare tutte** le foto (e deselezionarle). |
| 30 | Tag manuale sulle foto selezionate (v3.9.0) | Nel pannello delle foto selezionate si può **scrivere un tag nuovo** e applicarlo a tutte in una volta. |
| 31 | Chiudi progetto attuale (v3.9.0) | Un tasto **chiude il progetto**: toglie tutte le foto **e** cancella tutti i tag, riportando l'app come appena aperta. Se ci sono **modifiche non salvate** lo avvisa prima. I file su disco non si toccano. |
| 35 | Statistiche nel riquadro di destra (v3.9.0) | Il tasto **Statistiche** è stato spostato nel riquadro di destra, subito sotto "Visualizza tutti i tag del progetto". |
| 36 | Barra di avanzamento anche al salvataggio (1.0.0) | La barra di avanzamento (prima solo al caricamento) ora compare **anche quando si salva**, con la scritta "Salvataggio in corso..." e la percentuale. |
| 37 | Barra dei comandi bilanciata (1.0.0) | I due riquadri laterali dei comandi hanno la **stessa larghezza** e l'area centrale (trigger words + tag suggeriti) **riempie lo spazio** con margini uguali e costanti verso i lati, a ogni larghezza di finestra. |
| 40 | Sezione centrale in un riquadro (1.0.0) | La sezione centrale della barra comandi (trigger words + tag suggeriti) è ora dentro un **riquadro** con lo stesso stile dei due pannelli laterali: la barra comandi ha così tre riquadri coerenti. |
| 41 | Riquadro centrale con altezza limitata (1.0.0) | La sezione centrale era l'unica che si allungava aggiungendo tante trigger words, diventando **più alta dei due riquadri laterali**. Ora è **limitata in altezza**: le trigger words scorrono dentro il riquadro (come i tag delle miniature) e la barra comandi resta sempre bilanciata. |
| 42 | Tre riquadri della stessa altezza (1.0.0) | I tre riquadri della barra comandi ora si **allungano tutti alla stessa altezza** (quella del più alto): il riquadro di sinistra arriva in basso come quello di destra, per un aspetto ordinato e allineato. |
| 77 | 12 richieste utente: trascinamento, ricerche, editor, pannello (1.0.7) | **1)** **Trascinamento** immagini nel software: rilasci le foto e le carica; il file di testo dei tag viene abbinato da solo (sia se trascinato assieme, sia se già accanto su disco). **2)** **Ricerca per tag** nella pagina principale: scrivi uno o più tag (separati da virgola) e vedi solo le foto che li hanno; "Seleziona tutte" seleziona solo quelle filtrate. **3)** Tasto **"Inverti selezione"** accanto a "Seleziona tutte". **4)** Editor tag: tasto **"Aggiungi tag del progetto"** (inserisce tutti i tag conosciuti). **5)** Editor tag: scrivendo `tag1, tag2, tag3` li aggiunge **tutti insieme**. **6)** Editor tag: i tag di un file **aperto/importato** diventano disponibili anche nel pannello di selezione. **7)** Editor tag: la finestra **"scarta modifiche"** ora è **a tema** (non più quella grigia di sistema). **8)** Pannello di selezione in blocco: **più largo e responsive**, con un **motore di ricerca** interno e una **legenda** che spiega i tre stati delle pillole (da aggiungere / già su alcune / disponibile), ora anche visivamente distinti. **9)** In vista **"Intere"** l'area dei tag **riempie** lo spazio della card (niente più grosso vuoto). **10)** Traduzione dei tag al passaggio del mouse **anche nel visualizzatore**. **11)** Se modifichi un'immagine **fuori** dal software mentre è aperta, tornando sull'app si **aggiorna** da sola. **12)** Il pannello non copre più le ultime foto (si può scrivere nei loro tag anche in modalità selezione). |
| 76 | Prestazioni: galleria e importazione (1.0.6) | Sistemate le **ultime 2 lentezze** del to-do #12, senza cambiare le funzioni. **1) Galleria:** prima, ogni piccola modifica (anche mettere un tag a UNA sola foto) faceva **ridisegnare TUTTE** le anteprime, e con migliaia di foto la galleria scattava. Ora ogni miniatura è un pezzo "a sé" (memorizzato) e si ridisegna **solo se cambia lei**: modificando una foto si aggiorna solo la sua card. In più, le anteprime **fuori schermo non vengono più disegnate** finché non le scorri. **2) Importazione:** le miniature ora si creano a **piccoli gruppi in parallelo** (6 alla volta) invece che **una alla volta**, quindi aprire una cartella con tante foto è molto più rapido; la memoria resta sotto controllo perché il numero di immagini elaborate insieme è limitato. Con questo il to-do #12 è **completato**. |
| 75 | Ultimo giro controllo agenti + prestazioni (1.0.5) | Un secondo giro di verifica (28 controlli sul codice attuale) ha confermato che i critici/alti erano già a posto e ha scovato ancora qualcosa: sistemato. **1)** Il salvataggio del singolo file di testo dal visualizzatore (foto caricate con "Carica immagini") ora scrive DAVVERO sul posto ed è onesto sull'esito, come il salvataggio in blocco (prima poteva dire "salvato" senza scrivere). **2-3)** Aggiunti limiti di dimensione ai file importati (tag di progetto ed editor): niente file enormi/ostili che bloccano l'app. **4)** Chiudere una foto non "revoca" più la sua anteprima: così l'annulla (Ctrl+Z) la riporta senza immagine rotta. **5)** I canali di sistema (lettura/scrittura/cestino) ora rifiutano percorsi strani (di rete o con risalita di cartelle): protezione in più. **6)** **L'exe è più leggero di ~75 MB**: tolti dal pacchetto pezzi che erano doppi (già inclusi altrove). **7-8)** Le **2 lentezze** su dataset molto grandi sono state rese fluide senza cambiare le funzioni: il pannello di selezione in blocco calcola una volta sola, e la lista dei tag nelle statistiche disegna solo le righe visibili con ricerca più scattante. |
| 74 | Riparati 8 difetti dal controllo agenti (1.0.4) | Un controllo a più agenti sul codice attuale ha confermato 9 difetti (uno, i tag scambiati tra foto omonime, era già stato risolto). Sistemati gli altri 8: **1)** salvataggio delle foto caricate con "Carica immagini" ora scrive DAVVERO il file di testo sul posto e sa se è andato a buon fine (prima poteva dire "salvato" e poi cancellare il backup senza aver scritto nulla → perdita tag). **2)** Il salvataggio non si ferma più al primo file che dà errore: prova tutti, salva quelli riusciti e dice quali no. **3)** Le statistiche contano solo le foto attive, non quelle nel cestino. **4)** Le foto cestinate escono dalla selezione: non vengono più taggate in blocco né riscritte su disco. **5)** I tag "in preparazione" del pannello si azzerano quando svuoti la selezione. **6)** La torta delle statistiche mostra le categorie giuste (vestiti, capelli, occhi, calzature…) invece di ammucchiare tutto in "Generale". **7)** L'export ZIP non perde più i tag quando due foto hanno lo stesso nome in cartelle diverse (le distingue e avvisa). **8)** Il backup anti-crash non si scarta più da solo dopo aver cestinato una foto o con nomi ripetuti. |
| 73 | Editor tag: sincronizza col progetto solo il file GIUSTO (1.0.3) | L'editor dei tag apre qualsiasi file. Prima, salvando un file, l'app cercava nel progetto una foto **con lo stesso nome** e le sostituiva i tag: ma nei dataset LoRA capita spessissimo di avere foto con lo stesso nome in cartelle diverse (es. `10_viso\img.txt` e un `img.txt` scaricato altrove). Così poteva finire i tag sbagliati sulla foto sbagliata e, al salvataggio, **distruggerne il file di testo vero**. Ora l'app controlla l'**identità reale** del file (stessa cartella, non solo il nome) e aggiorna solo la foto il cui file di testo è **esattamente quello salvato**; se non può esserne certa, non tocca nulla. |
| 72 | Immagine installer arricchita + file più pulito (1.0.2) | L'immagine a sinistra del programma di installazione ora, **sotto il logo**, mostra una fitta **nuvola di tag viola** che riempie tutto lo spazio (prima era quasi vuota), tutta in tinta viola coordinata. Corretto anche un piccolo problema tecnico interno (un carattere invisibile fuori posto) che faceva vedere il file principale come "illeggibile" agli strumenti di controllo. |
| 71 | Controllo agenti + correzioni (1.0.0) | Un controllo automatico con tanti "revisori" indipendenti ha passato al setaccio tutto il programma; ogni problema segnalato è stato ri-verificato da 3 controllori prima di essere accettato. Da qui sono nate le correzioni dei traguardi 63-70 qui sotto. |
| 70 | Foto con lo stesso nome in cartelle diverse (1.0.0) | Due foto chiamate uguale ma in sottocartelle diverse (es. `10_viso\img.png` e `20_corpo\img.png`) si scambiavano i tag, e salvando si sovrascriveva il file di testo **vero** dell'altra foto. Ora ogni foto è abbinata solo al testo della **sua** cartella. |
| 69 | Editor di tag più sicuro (1.0.0) | Se si apriva un file illeggibile, "Salva" poteva sovrascrivere il file sbagliato coi tag di un altro: corretto. Un file JSON strano non diventa più un tag inutile. Le trigger word non vengono più cancellate risalvando. E prima di buttare via modifiche non salvate ora compare un avviso. |
| 68 | Cestino: niente falsi "fatto" (1.0.0) | Se una foto non riusciva a finire nel cestino (file bloccato), il programma diceva comunque "eliminata" e la toglieva dal progetto. Ora, se il cestino fallisce, lo segnala e prova una seconda strada. |
| 67 | Avvio a prova di blocco (1.0.0) | Se la finestra principale non partiva, la schermata di caricamento poteva restare per sempre e serviva il Task Manager. Ora, se qualcosa va storto o dopo 20 secondi, l'app si mostra comunque. La schermata di avvio ora è anche **tradotta** in tutte le 9 lingue. |
| 66 | Bandiere senza internet (1.0.0) | Le bandierine delle lingue venivano scaricate da un sito esterno a ogni avvio: senza internet si rompevano e, per un programma pensato offline, era una piccola fuga di privacy. Ora sono **dentro l'app**: nessuna richiesta a internet. |
| 65 | Ultimi testi tradotti (1.0.0) | Corretti alcuni testi che restavano in italiano o inglese in tutte le lingue (segnaposto "Scrivi tag...", avviso sulla chiave, nomi degli archivi zip). Tolte 51 scritte tradotte ma non più usate (residui delle funzioni vecchie). |
| 64 | Programma più leggero e sicuro (1.0.0) | Tolti ~100 MB di strumenti che servivano solo a costruire il programma e finivano inutilmente dentro l'exe. Le protezioni di sicurezza ora non sono più disattivabili dall'esterno. Rimosso codice vecchio non più raggiungibile e aggiornata la descrizione del progetto (README). |
| 63 | La schermata di avvio non riparte più (1.0.0) | La barra di caricamento poteva tornare improvvisamente a 0% quando l'app era pronta: ora conta dal vero momento di apertura e non "salta indietro". |
| 62 | Schermata di caricamento all'avvio (1.0.0) | All'apertura l'app mostra una **schermata di caricamento** dentro un riquadro, nello stesso stile della scelta lingua: logo che "respira", titolo, **numero di versione** e barra di avanzamento. Dura **almeno 3 secondi** anche se l'app è già pronta; se invece ci mette di più, resta finché il caricamento non è finito davvero. |
| 61 | Colori della schermata di avvio (1.0.0) | La schermata di caricamento è tutta sul **viola**: tolto ogni tono che tirava all'azzurro, tolto il bordino chiaro attorno al riquadro, e la fascia del copyright in basso è di un viola più scuro. Cliccandoci sopra si apre la **pagina GitHub** dell'autore nel browser. |
| 60 | Chiudi una singola foto (1.0.0) | Nuovo tasto per **togliere una sola foto dal progetto** senza cancellarla dal disco (prima si poteva solo cestinare). Se quella foto ha modifiche non salvate, l'app avvisa prima di toglierla. |
| 59 | "Esporta tutti" sempre in .Zip (1.0.0) | Il tasto ora si chiama **"Esporta tutti (.Zip)"** e crea sempre un archivio zip, senza scelte da fare. I quattro tasti piccoli della barra comandi sono ora **tutti della stessa larghezza**, in griglia 2×2. Scambiate le icone di esporta e importa, che erano invertite. |
| 58 | Salvataggio singolo: gli errori si vedono (1.0.0) | Salvando il .txt di una singola foto dal visualizzatore, se qualcosa andava storto (cartella spostata, disco pieno, file bloccato) **non compariva nulla**: sembrava tutto a posto. Ora l'errore viene segnalato. |
| 57 | Backup anti-crash legato alla cartella giusta (1.0.0) | Il backup automatico veniva riconosciuto **dal solo nome della cartella**. Siccome i dataset si chiamano quasi tutti uguale ("dataset", "img"), chiudendo l'app su un progetto e aprendone un altro, i tag del primo venivano ripristinati sul secondo e poi scritti su disco. Ora si controlla anche **quante foto ci sono e quali**. |
| 56 | Schermata di avvio: versione corretta (1.0.0) | La schermata iniziale mostrava sempre **"v2.1.0"** invece della versione vera, e solo nell'app installata (non in prova). |
| 55 | Editor di tag (1.0.0) | Nuova finestra grande per **aprire, creare e modificare file di tag**, sia .txt sia .json — compreso il file di una singola foto. I tag si vedono tutti insieme, se ne aggiungono scrivendoli e si tolgono con la X. Tasto accanto a "Statistiche progetto". |
| 54 | Cestino di Windows (1.0.0) | Eliminando le foto e svuotando il cestino, i file non spariscono più per sempre: finiscono nel **Cestino di Windows**, quindi si possono recuperare. |
| 53 | Sottocartelle (1.0.0) | Aprendo una cartella ora vengono lette anche le **sottocartelle**, e il file di testo di ogni foto viene riscritto nella sua sottocartella d'origine. |
| 52 | Selezione più comoda (1.0.0) | Con una foto già selezionata, **cliccando sulle altre** le si aggiunge alla selezione (prima bisognava centrare la casellina). Dopo "Conferma" il pannello si chiude e le foto si deselezionano da sole. |
| 51 | Statistiche più chiare (1.0.0) | Nel tema scuro i testi del grafico e delle **nuvolette** ora si leggono. Le fette della torta dicono **di cosa si tratta nella tua lingua** (prima mostravano sigle tecniche). Aggiunto il tasto per **copiare un singolo tag**. |
| 50 | I tag non si perdono più (1.0.0) | Corretti i problemi più gravi trovati dal controllo: aprendo **due cartelle insieme** i tag della prima venivano scritti nella seconda (distruggendone i file veri) · i tag modificati **durante** un salvataggio venivano dati per salvati e persi · "Salva e chiudi" svuotava il progetto **prima** di aver scritto i file · trascinare una foto sulla finestra **distruggeva l'app** con tutto il lavoro non salvato. |
| 49 | Un solo modello AI: Gemini 3.5 Flash (1.0.0) | Tolti gli altri modelli: ne resta **uno solo**, meno scelte da capire. Chi aveva già salvato uno dei modelli rimossi viene riportato in automatico su quello valido (altrimenti l'AI avrebbe smesso di funzionare). |
| 48 | Il tema chiaro ora funziona davvero (1.0.0) | I riquadri dei tag restavano **scuri anche scegliendo il tema chiaro**: seguivano il tema di Windows invece dell'interruttore dell'app. Ora tutti gli elementi obbediscono all'interruttore Tema. In chiaro i riquadri sono bianchi, in scuro grigio scuro. |
| 47 | Controllo completo delle traduzioni (1.0.0) | Verifica di tutte le 9 lingue. Trovato e corretto: **53 scritte della sezione Strumenti AI / chiave Gemini** che comparivano **in inglese** in francese, spagnolo, tedesco, cinese, giapponese, portoghese e russo (tradotte tutte); le 3 scritte del pannello Tag Suggeriti che restavano **in italiano in ogni lingua**; la **legenda dei modelli** ("gratis/limitato/a pagamento/consigliato") scritta a mano in italiano; e la **schermata di errore**, anch'essa tutta in italiano. Ora tutte e 9 le lingue hanno esattamente le stesse voci, senza doppioni né caselle vuote. |
| 46 | Chiudi progetto: salva, scarta o annulla (1.0.0) | Chiudendo il progetto con modifiche non salvate ora compare una finestra con **tre scelte**: **Salva e chiudi** (verde), **Chiudi senza salvare** (rosso), **Annulla** (arancio). Prima si poteva solo confermare o annullare, rischiando di perdere i tag. Se il salvataggio non riesce (es. cartella non più raggiungibile) il progetto **non viene chiuso**, così i tag non si perdono. |
| 45 | Miniature più nitide (1.0.0) | Le anteprime venivano create a 420 pixel ma la galleria può mostrarle fino a 500 e oltre: ingrandite così si vedevano **sfocate**. Ora sono generate a **640 pixel** e con compressione più leggera, quindi si vedono **più nitide** anche con lo zoom al massimo. Pesano poco di più (circa 80 MB invece di 43 ogni 1000 foto), quindi la galleria resta veloce. |
| 44 | Installer tutto nella lingua scelta + inglese di base (1.0.0) | L'ultima casella della schermata finale ("Crea un collegamento sul desktop") era rimasta **in inglese** anche con l'installer in italiano: ora è **tradotta in tutte e 9 le lingue**, così l'intero programma di installazione parla la lingua scelta. Inoltre l'installer ora si apre **in inglese di base**, qualunque sia la lingua di Windows (la lingua resta comunque scegliibile dall'elenco). |
| 43 | "Carica immagini": solo foto, tag automatici (1.0.0) | Nella finestra di scelta ora si vedono **solo le immagini** (i file di testo non compaiono più). Si scelgono le foto e basta: se accanto a una foto c'è un file di testo **con lo stesso nome** (foto.jpg → foto.txt), l'app lo trova e **abbina i tag da sola**; se non c'è (es. prima volta) la foto si carica semplicemente senza tag. |
| 39 | Miniature "Intere" con tag scorrevoli (1.0.0) | Anche in modalità **"Intere"** l'area dei tag sotto la foto è ora **limitata in altezza e scorrevole** (come in "Quadrate"): prima con tanti tag la miniatura diventava altissima. |
| 38 | Statistiche avanzate (1.0.0) | Le statistiche ora mostrano **6 dati** (immagini totali, tag unici, immagini con/senza tag, media tag per immagine, tag usati una volta sola), i grafici a torta e top-10, e soprattutto una **lista scorrevole di TUTTI i tag** con conteggio d'uso, barra di frequenza, **ricerca** e **ordinamento** (per frequenza o A-Z). |
| 32 | Carica singole immagini (v3.9.0) | Oltre alla cartella intera, si possono caricare **singole immagini** con i rispettivi file .txt (abbinati per nome). |
| 33 | Ricorda l'ultima cartella (v3.9.0) | Alla apertura, il selettore si riapre sull'**ultima cartella** usata. |
| 34 | Esporta / importa tag del progetto (v3.9.0 / 1.0.0) | Si possono **esportare** tutti i tag del progetto e **reimportarli** in un nuovo progetto. Un **unico tasto "Esporta"**: il formato (JSON completo o TXT lista) si sceglie nel menu a tendina della finestra di salvataggio del sistema. Tasti con etichetta a due righe più chiara. |

---

## ⏳ Traguardi da fare

| Priorità | Traguardo | In parole semplici | Versione |
|----------|-----------|--------------------|----------|
| Bassa | Sistemare il velo del trascinamento | Quando si trascinano file sopra la finestra compare la scritta "Rilascia qui le immagini". Se si annulla il trascinamento premendo Esc, quel velo può restare a schermo finché non si trascina di nuovo qualcosa. È **solo estetico** (non blocca i clic, perché è trasparente ai comandi). Per toglierlo serve un controllo a tempo sul trascinamento, che va provato bene per non far sfarfallare il velo mentre si trascina davvero. | 1.0.x |
| Bassa | Tradurre il dizionario dei tag | I ~1050 tag suggeriti (e i 27 nomi di categoria) hanno la traduzione solo in italiano e inglese: nelle altre 7 lingue restano in inglese. In 1.0.4 la **torta delle statistiche** è stata resa coerente (fuori da it/en è tutta in inglese, non più mezza tradotta e mezza no), ma **tradurre davvero tutti i ~1080 testi nelle 7 lingue** resta un lavoro grosso e delicato (va fatto bene, non a macchina): da decidere se e come affrontarlo (traduzione umana/professionale, oppure accettare l'inglese). | 1.0.x |

---

## Vincoli sempre validi del progetto

- **Consegna Windows:** i due file finali (portable + installer) vanno messi nella cartella
  `Release\` della radice del progetto (non dentro la cartella di lavoro git).
- **Dati dell'app:** sempre in `%APPDATA%\images-tag-manager` (mai accanto all'exe).
  È la cartella da cancellare per far ripartire l'app "da zero".
- **Privacy:** nessuna telemetria, nessun tracciamento. Con l'AI cloud le foto vanno a Google
  solo se l'utente attiva l'AI e mette la chiave.
- **Chiave API:** sempre cifrata nel sistema, mai in chiaro, mai dentro l'exe.
- **AI = opzionale e "Beta":** spenta di default, segnalata come sperimentale.
