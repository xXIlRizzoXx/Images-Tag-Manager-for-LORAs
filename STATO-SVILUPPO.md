# Stato di sviluppo — Images Tag Manager for LORAs

**Ultimo aggiornamento:** 20 luglio 2026
**Versione attuale:** 3.8.0 (in lavorazione sul branch)
**Ultima versione stabile:** 3.7.0 (su `main`)

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

---

## ⏳ Traguardi da fare

| Priorità | Traguardo | In parole semplici | Versione |
|----------|-----------|--------------------|----------|
| — | (nessuno in coda) | Il prossimo lo decidi tu. | — |

---

## Vincoli sempre validi del progetto

- **Portable Windows:** l'eseguibile finale va messo in
  `D:\SOFTWARE PERSONALI IN SVILUPPO\000 SOFTWARE AI STUDIO PASSATI A CLAUDE\Images-Tag-Manager-for-LORAs\Portable\`
  (radice del progetto, non dentro la cartella di lavoro git).
- **Privacy:** nessuna telemetria, nessun tracciamento. Con l'AI cloud le foto vanno a Google
  solo se l'utente attiva l'AI e mette la chiave.
- **Chiave API:** sempre cifrata nel sistema, mai in chiaro, mai dentro l'exe.
- **AI = opzionale e "Beta":** spenta di default, segnalata come sperimentale.
