# Stato di sviluppo — Images Tag Manager for LORAs

**Ultimo aggiornamento:** 25 luglio 2026
**Versione attuale:** 1.0.9
**Ultima consegna:** 25 luglio 2026 — portable + installer **1.0.9** in `Release\` (solo questa
coppia). Verificata guardando dentro al pacchetto: contiene i file appena compilati, non una
versione riciclata. La 1.0.9 comprende anche tutto il lavoro di 1.0.6, 1.0.7 e 1.0.8.
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
1.0.7 (traguardo 77): **12 richieste** di Matteo — trascinamento immagini (con .txt
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
**Regola versione:** da ora ogni modifica alza la versione di 0.0.1.
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
| Media | Abbellire la pagina di presentazione del progetto | La pagina che si vede aprendo il progetto su GitHub (il file `README.md`) è quella che descrive il programma a chi lo trova. Va resa bella e chiara: titolo con logo, qualche immagine del programma in funzione, elenco leggibile di cosa sa fare, come si installa, e le note importanti (dati in `%APPDATA%`, nessuna raccolta di dati, chiave Gemini cifrata). Richiesta di Matteo del 25 luglio 2026: da fare "prossimamente", non urgente. | 1.0.x |
| Bassa | Sistemare il velo del trascinamento | Quando si trascinano file sopra la finestra compare la scritta "Rilascia qui le immagini". Se si annulla il trascinamento premendo Esc, quel velo può restare a schermo finché non si trascina di nuovo qualcosa. È **solo estetico** (non blocca i clic, perché è trasparente ai comandi). Per toglierlo serve un controllo a tempo sul trascinamento, che va provato bene per non far sfarfallare il velo mentre si trascina davvero. | 1.0.x |
| Bassa | Tradurre il dizionario dei tag | I ~1050 tag suggeriti (e i 27 nomi di categoria) hanno la traduzione solo in italiano e inglese: nelle altre 7 lingue restano in inglese. In 1.0.4 la **torta delle statistiche** è stata resa coerente (fuori da it/en è tutta in inglese, non più mezza tradotta e mezza no), ma **tradurre davvero tutti i ~1080 testi nelle 7 lingue** resta un lavoro grosso e delicato (va fatto bene, non a macchina): da decidere se e come affrontarlo (traduzione umana/professionale, oppure accettare l'inglese). | 1.0.x |

---

## Vincoli sempre validi del progetto

- **Consegna Windows:** i due file finali (portable + installer) vanno messi in
  `D:\SOFTWARE PERSONALI IN SVILUPPO\000 SOFTWARE AI STUDIO PASSATI A CLAUDE\Images-Tag-Manager-for-LORAs\Release\`
  (radice del progetto, non dentro la cartella di lavoro git).
- **Dati dell'app:** sempre in `%APPDATA%\images-tag-manager` (mai accanto all'exe).
  È la cartella da cancellare per far ripartire l'app "da zero".
- **Privacy:** nessuna telemetria, nessun tracciamento. Con l'AI cloud le foto vanno a Google
  solo se l'utente attiva l'AI e mette la chiave.
- **Chiave API:** sempre cifrata nel sistema, mai in chiaro, mai dentro l'exe.
- **AI = opzionale e "Beta":** spenta di default, segnalata come sperimentale.
