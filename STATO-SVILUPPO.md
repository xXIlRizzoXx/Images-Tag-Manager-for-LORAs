# Stato di sviluppo — Images Tag Manager for LORAs

**Ultimo aggiornamento:** 22 luglio 2026
**Versione attuale:** 1.0.0 (prima versione pubblica ufficiale)
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
| 39 | Miniature "Intere" con tag scorrevoli (1.0.0) | Anche in modalità **"Intere"** l'area dei tag sotto la foto è ora **limitata in altezza e scorrevole** (come in "Quadrate"): prima con tanti tag la miniatura diventava altissima. |
| 38 | Statistiche avanzate (1.0.0) | Le statistiche ora mostrano **6 dati** (immagini totali, tag unici, immagini con/senza tag, media tag per immagine, tag usati una volta sola), i grafici a torta e top-10, e soprattutto una **lista scorrevole di TUTTI i tag** con conteggio d'uso, barra di frequenza, **ricerca** e **ordinamento** (per frequenza o A-Z). |
| 32 | Carica singole immagini (v3.9.0) | Oltre alla cartella intera, si possono caricare **singole immagini** con i rispettivi file .txt (abbinati per nome). |
| 33 | Ricorda l'ultima cartella (v3.9.0) | Alla apertura, il selettore si riapre sull'**ultima cartella** usata. |
| 34 | Esporta / importa tag del progetto (v3.9.0 / 1.0.0) | Si possono **esportare** tutti i tag del progetto e **reimportarli** in un nuovo progetto. Un **unico tasto "Esporta"**: il formato (JSON completo o TXT lista) si sceglie nel menu a tendina della finestra di salvataggio del sistema. Tasti con etichetta a due righe più chiara. |

---

## ⏳ Traguardi da fare

| Priorità | Traguardo | In parole semplici | Versione |
|----------|-----------|--------------------|----------|
| — | (nessuno in coda) | Il prossimo lo decidi tu. | — |

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
