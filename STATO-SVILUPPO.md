# Stato di sviluppo — Images Tag Manager for LORAs

**Ultimo aggiornamento:** 4 luglio 2026
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
