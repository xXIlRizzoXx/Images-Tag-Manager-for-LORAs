/******************************************************************************
*******************************************************************************
**                                                                            **
**  ITALIANO: SERVIZIO GEMINI (GOOGLE GENAI)                                  **
**  Genera tag e didascalie chiamando l'API Gemini di Google. Sanitizza il    **
**  prompt personalizzato, valida la risposta come JSON array, tronca i tag   **
**  a lunghezza ragionevole e limita la dimensione del file in input.         **
**                                                                            **
**  ENGLISH: GEMINI SERVICE (GOOGLE GENAI)                                    **
**  Generates tags and captions via Google's Gemini API. Sanitizes the        **
**  custom prompt, validates JSON-array responses, clamps tag length, and     **
**  enforces a max input file size.                                           **
**                                                                            **
*******************************************************************************
*******************************************************************************/
import { GoogleGenAI, Type } from '@google/genai';
import { stripImageMetadata } from '../utils/imageMetadata';

const CUSTOM_PROMPT_MAX_LENGTH = 500;
const TAG_MAX_LENGTH = 60;
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
const ALLOWED_MIME_PREFIX = 'image/';
const REQUEST_TIMEOUT_MS = 90_000;
const VERIFY_TIMEOUT_MS = 30_000;

// ITALIANO: Combina il segnale chiamante (es. Annulla del batch) con un timeout di sicurezza:
//           nessuna richiesta può restare appesa per sempre su una connessione bloccata.
// ENGLISH: Combines the caller's signal (e.g. batch Cancel) with a safety timeout:
//          no request can hang forever on a stalled connection.
const buildAbortSignal = (signal?: AbortSignal, timeoutMs: number = REQUEST_TIMEOUT_MS): AbortSignal =>
    signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs);

const stripControlChars = (input: string): string => {
    let out = '';
    for (let i = 0; i < input.length; i++) {
        const code = input.charCodeAt(i);
        out += code < 32 || code === 127 ? ' ' : input.charAt(i);
    }
    return out;
};

const sanitizeCustomPrompt = (input?: string): string => {
    if (!input || typeof input !== 'string') return '';
    return stripControlChars(input).replace(/\s+/g, ' ').trim().slice(0, CUSTOM_PROMPT_MAX_LENGTH);
};

// ITALIANO: un problema della FOTO, trovato qui prima di chiamare Google (vuota, troppo grande, in un
//           formato che non si riesce a leggere). Il segno `geminiKind = 'photo'` non cambia il tipo
//           dell'errore (resta 'unknown'), ma permette all'app di dire che e' la foto e non la rete,
//           e alla taggatura in blocco di non contarlo come "Google non raggiungibile".
// ENGLISH: a problem of the PHOTO, found here before calling Google (empty, too large, in a format
//          that cannot be read). The `geminiKind = 'photo'` mark does not change the error kind (it
//          stays 'unknown'), but lets the app say it is the photo and not the network, and lets bulk
//          tagging not count it as "Google unreachable".
const fotoNonUsabile = (motivo: string): Error => {
    const e = new Error(motivo);
    (e as Error & { geminiKind?: string }).geminiKind = 'photo';
    return e;
};

// ITALIANO: una foto in un formato che non si sa pulire byte per byte (GIF, BMP, AVIF, ICO...) si
//           ridisegna e parte come PNG: restano i pixel, sparisce tutto il resto. Se non si puo'
//           ridisegnare (TIFF, SVG, file rovinato) non parte niente: mai il file originale.
// ENGLISH: a photo in a format that cannot be cleaned byte by byte (GIF, BMP, AVIF, ICO...) is
//          redrawn and sent as PNG: the pixels stay, everything else goes. If it cannot be redrawn
//          (TIFF, SVG, damaged file) nothing is sent: never the original file.
const redrawAsPng = async (file: File): Promise<Blob> => {
    if (typeof createImageBitmap !== 'function' || typeof OffscreenCanvas !== 'function') throw fotoNonUsabile('Unsupported file type');
    let bitmap: ImageBitmap | undefined;
    try {
        bitmap = await createImageBitmap(file);
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('no 2d context');
        ctx.drawImage(bitmap, 0, 0);
        const png = await canvas.convertToBlob({ type: 'image/png' });
        if (png.type !== 'image/png') throw new Error('not a png');
        return png;
    } catch {
        throw fotoNonUsabile('Unsupported file type');
    } finally {
        bitmap?.close();
    }
};

// ITALIANO: prepara la foto da mandare a Google: solo l'immagine, senza i dati nascosti del file
//           (posizione GPS, numero di serie della fotocamera, autore, storia delle modifiche).
//           Il tipo mandato e' quello vero dei byte, non quello dichiarato dal nome del file.
// ENGLISH: prepares the photo to send to Google: only the picture, without the file's hidden data
//          (GPS position, camera serial number, author, editing history). The type sent is the
//          real one of the bytes, not the one the file name declares.
const imageForGemini = async (file: File): Promise<{ data: string; mimeType: string }> => {
    if (!file || file.size === 0) throw fotoNonUsabile('Invalid or empty file');
    if (file.size > MAX_FILE_SIZE_BYTES) throw fotoNonUsabile('Image too large (> 20 MB)');
    if (!file.type || !file.type.startsWith(ALLOWED_MIME_PREFIX)) throw fotoNonUsabile('Unsupported file type');
    const pulita = stripImageMetadata(new Uint8Array(await file.arrayBuffer()));
    const blob = pulita
        ? new Blob([pulita.bytes as Uint8Array<ArrayBuffer>], { type: pulita.mimeType })
        : await redrawAsPng(file);
    if (blob.size > MAX_FILE_SIZE_BYTES) throw fotoNonUsabile('Image too large (> 20 MB)');
    return { data: await blobToBase64(blob), mimeType: blob.type };
};

const blobToBase64 = (file: Blob): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
        if (typeof reader.result === 'string') {
            const comma = reader.result.indexOf(',');
            resolve(comma >= 0 ? reader.result.slice(comma + 1) : reader.result);
        } else {
            reject(new Error('Failed to convert file to base64'));
        }
    };
    reader.onerror = () => reject(reader.error ?? new Error('FileReader error'));
    reader.readAsDataURL(file);
});

const validateAndCleanTags = (raw: unknown, maxTags: number): string[] => {
    if (!Array.isArray(raw)) return [];
    const out: string[] = [];
    const seen = new Set<string>();
    for (const item of raw) {
        if (typeof item !== 'string') continue;
        // ITALIANO: un elemento puo' contenere piu' tag separati da virgola o a capo ("red hair,
        //           blue eyes"): si spezza qui come fanno incolla, importazione ed editor,
        //           altrimenti nel .txt finiscono due tag mostrati come una pillola sola, la
        //           deduplica non li vede e il limite di tag conta gli elementi invece dei tag.
        // ENGLISH: one element may hold several tags split by comma or newline ("red hair, blue
        //          eyes"): split here as paste, import and the editor do, or the .txt gets two
        //          tags shown as a single pill, the dedupe cannot see them and the tag limit
        //          counts elements instead of tags.
        for (const pezzo of item.split(/[,\n\r]+/)) {
            const cleaned = pezzo.toLowerCase().trim().slice(0, TAG_MAX_LENGTH);
            if (!cleaned) continue;
            if (seen.has(cleaned)) continue;
            seen.add(cleaned);
            out.push(cleaned);
            if (out.length >= maxTags) return out;
        }
    }
    return out;
};

const buildTagPrompt = (maxTags: number, customPrompt?: string): string => {
    const safeCustom = sanitizeCustomPrompt(customPrompt);
    const safeMaxTags = Math.max(1, Math.min(80, Math.floor(maxTags) || 30));
    if (safeCustom) {
        return `User preference: ${safeCustom}\n\nTask: analyze the image and return exactly ${safeMaxTags} short descriptive tags as a JSON array of lowercase strings. Single words or short phrases describing main subjects, expressions, clothing, environment, lighting, style. Output JSON only.`;
    }
    return `Analyze this image and return exactly ${safeMaxTags} short descriptive tags as a JSON array of lowercase strings. Tags should be single words or short phrases describing main subjects, expressions, clothing, environment, lighting, style. Useful for LoRA/Stable Diffusion training datasets. Return ONLY a JSON array of lowercase strings.`;
};

export type GeminiOptions = {
    apiKey: string;
    modelName: string;
    customPrompt?: string;
    // ITALIANO: Segnale di annullamento opzionale (es. pulsante Annulla del bulk tagging)
    // ENGLISH: Optional cancellation signal (e.g. the bulk-tagging Cancel button)
    signal?: AbortSignal;
};

export type GeminiTagOptions = GeminiOptions & {
    maxTags: number;
};

export const getGeminiTags = async (file: File, opts: GeminiTagOptions): Promise<string[]> => {
    if (!opts.apiKey || typeof opts.apiKey !== 'string') {
        throw new Error('Missing API key');
    }
    const ai = new GoogleGenAI({ apiKey: opts.apiKey });
    const immagine = await imageForGemini(file);

    const response = await ai.models.generateContent({
        model: opts.modelName,
        contents: {
            parts: [
                { inlineData: { data: immagine.data, mimeType: immagine.mimeType } },
                { text: buildTagPrompt(opts.maxTags, opts.customPrompt) },
            ],
        },
        config: {
            abortSignal: buildAbortSignal(opts.signal),
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'The list of tags for the image.',
            },
        },
    });

    // ITALIANO: una foto che Google rifiuta (filtro dei contenuti) arriva come risposta NORMALE,
    //           senza testo: la libreria non lancia niente. Restituire [] la faceva contare fra le
    //           "taggate", con suono e messaggio verde. Rifiutata, vuota, illeggibile o non un
    //           elenco: e' un errore riconoscibile ('blocked'), e nessun pezzo diventa un tag.
    //           Il messaggio non contiene cifre: non puo' sembrare un altro tipo di errore.
    // ENGLISH: a photo Google refuses (content filter) arrives as a NORMAL answer with no text:
    //          the library throws nothing. Returning [] counted it as "tagged", with the chime
    //          and a green message. Refused, empty, unreadable or not a list: it is a recognisable
    //          error ('blocked'), and no piece of it becomes a tag. The message holds no digits:
    //          it cannot look like another kind of error.
    const nessunTag = (motivo: string): Error => {
        const e = new Error('AI_RESPONSE_BLOCKED: ' + motivo);
        (e as Error & { geminiKind?: string }).geminiKind = 'blocked';
        return e;
    };
    const text = response.text;
    if (!text) {
        throw nessunTag(String(response.promptFeedback?.blockReason || response.candidates?.[0]?.finishReason || 'empty answer'));
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        throw nessunTag('the answer was not valid JSON');
    }
    if (!Array.isArray(parsed)) throw nessunTag('the answer was not a JSON list');
    return validateAndCleanTags(parsed, Math.max(1, Math.floor(opts.maxTags) || 30));
};

// ITALIANO: Modello vision di Gemini usato dall'app. Ne teniamo UNO SOLO (Gemini 3.6
//           Flash): meno scelte da spiegare e un solo comportamento da collaudare.
//           Sostituisce Gemini 3.5 Flash. La sigla 'gemini-3.6-flash' e' quella ufficiale
//           dell'API (versione stabile, non anteprima) e il modello accetta immagini e
//           risposte strutturate in JSON, che e' esattamente cio' che serve qui.
//           Il livello resta 'limited': il piano gratuito ha limiti di frequenza bassi e
//           per un uso intenso serve la fatturazione attiva.
// ENGLISH: Gemini vision model used by the app. We keep exactly ONE (Gemini 3.6 Flash):
//          fewer choices to explain and a single behaviour to test. It replaces Gemini 3.5
//          Flash. The id 'gemini-3.6-flash' is the official API one (stable, not preview)
//          and the model takes image input and structured JSON output, exactly what is
//          needed here. Tier stays 'limited': the free tier has low rate limits and heavy
//          use requires billing to be enabled.
// ITALIANO: 'unknown' = dal nome non si puo' sapere se c'e' un piano gratuito: nessun simbolo e
//           nessun avviso, invece di una promessa che puo' essere falsa.
// ENGLISH: 'unknown' = the name cannot tell whether there is a free tier: no badge and no notice,
//          instead of a promise that may be false.
export type GeminiTier = 'free' | 'limited' | 'paid' | 'unknown';
// ITALIANO: Questo elenco NON e' piu' la gabbia del programma: e' la RISERVA, cio' che si usa
//           quando non si e' ancora potuto chiedere l'elenco vero a Google (nessuna chiave,
//           niente rete, primo avvio). Appena si puo', i modelli disponibili li dice Google.
// ENGLISH: This list is NOT the program's cage any more: it is the FALLBACK, what gets used
//          until the real list can be asked of Google (no key, no network, first run). As
//          soon as possible, Google is the one that says which models exist.
export const GEMINI_MODELS: ReadonlyArray<{ id: string; label: string; tier: GeminiTier; recommended: boolean }> = [
    { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash', tier: 'limited', recommended: true },
];

export const DEFAULT_GEMINI_MODEL = 'gemini-3.6-flash';

// ITALIANO: Si controlla solo che il nome abbia la FORMA giusta, non che sia in un elenco
//           deciso qui dentro: i modelli veri li scopre `aggiornaModelloAutomatico` da
//           Google, e un elenco fisso li butterebbe via a ogni avvio riportando tutti
//           indietro. Un id storto o vuoto torna comunque alla riserva. Chi usa un modello
//           che nel frattempo Google ha chiuso non resta a piedi: al primo errore "non
//           esisto" il programma cerca il sostituto e lo dice.
// ENGLISH: We only check the SHAPE of the name, not membership of a list decided in here:
//          the real models are discovered from Google by `aggiornaModelloAutomatico`, and a
//          fixed list would throw them away on every launch, dragging everyone back. A
//          malformed or empty id still falls back to the built-in one. Anyone on a model
//          Google has since retired is not stranded: on the first "I do not exist" error the
//          program looks for the replacement and says so.
export const normalizeModelId = (modelId: string | null | undefined): string =>
    (typeof modelId === 'string' && /^gemini-[a-z0-9.-]+$/i.test(modelId)) ? modelId : DEFAULT_GEMINI_MODEL;

export const isFreeTierModel = (modelId: string): boolean => {
    const m = GEMINI_MODELS.find(x => x.id === modelId);
    return m ? m.tier === 'free' : false;
};

export const getModelTier = (modelId: string): GeminiTier => {
    const m = GEMINI_MODELS.find(x => x.id === modelId);
    if (m) return m.tier;
    // ITALIANO: un modello scoperto da Google e non presente nella riserva: se e' della linea
    //           flash vale 'limited' come gli altri. Dargli 'paid' farebbe comparire l'avviso
    //           "serve la fatturazione" a chi invece sta benissimo sul piano gratuito.
    // ENGLISH: a model discovered from Google and absent from the fallback list: if it is on
    //          the flash line it counts as 'limited' like the rest. Calling it 'paid' would
    //          show a "billing required" notice to someone who is perfectly fine on the free plan.
    // ITALIANO: un flash-lite, o un id senza versione (es. la linea video omni), e' 'unknown':
    //           dal solo nome 2.5-flash-lite ha il piano gratuito e 3.5-flash-lite no.
    // ENGLISH: a flash-lite, or an id with no version (e.g. the omni video line), is 'unknown':
    //          by name alone 2.5-flash-lite has a free tier and 3.5-flash-lite does not.
    const id = String(modelId || '').toLowerCase();
    if (!id.includes('flash')) return 'paid';
    if (id.includes('lite') || versioneDi(id).length === 0) return 'unknown';
    return 'limited';
};

// ITALIANO: Classifica un errore restituito da Gemini in modo leggibile per l'utente
// ENGLISH: Classify a Gemini error into a human-readable category
// ITALIANO: 'busy' = Google sovraccarico o con un guasto interno (500/502/503/504): passa da solo.
//           'blocked' = la risposta non porta tag (foto rifiutata dal filtro, vuota, illeggibile).
//           `quotaGiorno` = il limite superato e' la quota del GIORNO: riprovare fra un minuto non
//           serve. Resta 'rate_limit' per tutto il resto (prova del modello compresa: un modello
//           con la quota del giorno finita esiste eccome, non va scartato).
// ENGLISH: 'busy' = Google overloaded or with an internal fault (500/502/503/504): it passes.
//          'blocked' = the answer carries no tags (photo refused by the filter, empty, unreadable).
//          `quotaGiorno` = the limit hit is the DAILY quota: retrying in a minute is pointless. It
//          stays 'rate_limit' for everything else (model probe included: a model whose daily
//          quota is used up exists just fine and must not be discarded).
export type GeminiErrorKind = 'invalid_key' | 'billing_required' | 'rate_limit' | 'model_unavailable' | 'busy' | 'blocked' | 'unknown';
export type GeminiErrore = { kind: GeminiErrorKind; message: string; quotaGiorno?: boolean };
export const classifyGeminiError = (err: any): GeminiErrore => {
    const msg = String(err?.message || err || '');
    if (err?.geminiKind === 'blocked') return { kind: 'blocked', message: msg };
    // ITALIANO: il "troppe richieste" VERO di Google (429 RESOURCE_EXHAUSTED) dice "check your
    //           plan and billing details": deciso sulla parola 'billing' diventava "serve la
    //           fatturazione", e la taggatura in blocco si fermava invece di aspettare e
    //           riprovare. Per questo: prima lo stato HTTP numerico che la libreria mette
    //           sull'errore (il testo e' tutto il corpo JSON, con cifre a caso nell'attesa che
    //           possono contenere "401"), poi nel testo il limite viene prima della parola
    //           'billing'. Limite 0 invece vuol dire che il modello NON ha un piano gratuito:
    //           non e' "di corsa" e non e' "fatturazione", e' "non usabile": cosi' la prova lo
    //           scarta e la riparazione cerca un modello gratuito.
    // ENGLISH: Google's REAL "too many requests" (429 RESOURCE_EXHAUSTED) says "check your plan
    //          and billing details": decided on the word 'billing' it became "billing
    //          required", and bulk tagging stopped instead of waiting and retrying. Hence: first
    //          the numeric HTTP status the library puts on the error (the text is the whole
    //          JSON body, with random digits in the wait that may contain "401"), then in the
    //          text the limit comes before the word 'billing'. A limit of 0 instead means the
    //          model has NO free tier: not "too fast" and not "billing", but "not usable": so the
    //          probe discards it and the repair looks for a free model.
    // ITALIANO: con uno stato numerico le cifre "401" e "429" del testo NON si leggono come stato:
    //           sono numeri di progetto o di richiesta (una fatturazione spenta sul progetto
    //           842942901234 diventava "troppe richieste"). Solo un errore senza stato (testo
    //           semplice) si riconosce ancora dalle cifre.
    // ENGLISH: with a numeric status the "401" and "429" digits of the text are NOT read as a
    //          status: they are project or request numbers (billing disabled on project
    //          842942901234 became "too many requests"). Only an error with no status (plain text)
    //          is still recognised by its digits.
    const stato = typeof err?.status === 'number' ? err.status : undefined;
    const senzaStato = stato === undefined;
    const limite = (): GeminiErrore => {
        const senzaGratuito = /limit:\s*0(?![\d.])/i.test(msg) || /quotaValue[^0-9]{0,6}0(?![\d.])/.test(msg);
        if (senzaGratuito) return { kind: 'model_unavailable', message: msg };
        // ITALIANO: la quota superata e' del giorno (quotaId "...PerDay...") e non del minuto.
        // ENGLISH: the quota hit is the daily one (quotaId "...PerDay...") and not the per-minute one.
        return { kind: 'rate_limit', message: msg, quotaGiorno: /PerDay/i.test(msg) };
    };
    if (stato === 429) return limite();
    // ITALIANO: Google sovraccarico ("The model is overloaded") o guasto interno: si decide sullo
    //           stato numerico, o senza stato sulla parola di stato di Google, mai sulle cifre.
    //           La rete assente resta 'unknown'.
    // ENGLISH: Google overloaded ("The model is overloaded") or an internal fault: decided on the
    //          numeric status, or with no status on Google's status word, never on digits. A
    //          missing network stays 'unknown'.
    if (stato === 500 || stato === 502 || stato === 503 || stato === 504
        || (senzaStato && (/"status":\s*"(UNAVAILABLE|INTERNAL)"/.test(msg) || /overloaded/i.test(msg)))) {
        return { kind: 'busy', message: msg };
    }
    // ITALIANO: una chiave che Google ha spento perche' trapelata, scaduta o bloccata per questa API
    //           e' un problema della CHIAVE (403): con la fatturazione non c'entra.
    // ENGLISH: a key Google switched off because it leaked, expired or is blocked for this API is a
    //          KEY problem (403): billing has nothing to do with it.
    if (msg.includes('API key not valid') || msg.includes('API_KEY_INVALID')
        || /reported as leaked|API_KEY_[A-Z_]*BLOCKED|API_KEY_EXPIRED|API key expired/i.test(msg)
        || stato === 401 || (senzaStato && msg.includes('401'))) {
        return { kind: 'invalid_key', message: msg };
    }
    if (msg.includes('FAILED_PRECONDITION') || msg.includes('SERVICE_DISABLED') || msg.includes('does not have access')) {
        return { kind: 'billing_required', message: msg };
    }
    if (msg.includes('RESOURCE_EXHAUSTED') || (senzaStato && msg.includes('429')) || msg.toLowerCase().includes('quota')) {
        return limite();
    }
    if (msg.includes('billing')) {
        return { kind: 'billing_required', message: msg };
    }
    // ITALIANO: come per 401 e 429, le cifre "404" e "403" del testo contano solo senza stato
    //           numerico: un 403 "progetto 840412345678 sospeso" diventava "modello non
    //           disponibile", e partiva la riparazione del modello per un problema della chiave.
    // ENGLISH: as for 401 and 429, the "404" and "403" digits of the text count only with no
    //          numeric status: a 403 "project 840412345678 suspended" became "model unavailable",
    //          and the model repair started for a key problem.
    if (msg.includes('NOT_FOUND') || stato === 404 || (senzaStato && msg.includes('404')) || msg.toLowerCase().includes('model') && msg.toLowerCase().includes('not found')) {
        return { kind: 'model_unavailable', message: msg };
    }
    if (msg.includes('PERMISSION_DENIED') || stato === 403 || (senzaStato && msg.includes('403'))) {
        return { kind: 'billing_required', message: msg };
    }
    return { kind: 'unknown', message: msg };
};

// ITALIANO: VERIFICA DELLA CHIAVE, SENZA LEGARSI A NESSUN MODELLO.
//   Prima la chiave si provava chiedendo una risposta a un modello preciso. Il giorno che
//   Google lo chiude, la prova torna "modello non trovato" e una chiave BUONA viene
//   rifiutata: non si riesce nemmeno a salvarla. Cioe' proprio il vincolo che la scelta
//   automatica del modello esiste per togliere, rimasto vivo nel punto d'ingresso.
//   Adesso si chiede la prima pagina dell'elenco dei modelli: dimostra che la chiave e'
//   valida, non consuma token e non dipende da quali modelli esistano oggi.
// ENGLISH: KEY VERIFICATION, WITHOUT BINDING TO ANY MODEL.
//   The key used to be tested by asking one specific model for an answer. The day Google
//   retires it, the test returns "model not found" and a GOOD key is rejected: it cannot
//   even be saved. That is exactly the tie the automatic model selection exists to remove,
//   still alive at the front door. Now we ask for the first page of the model list: it
//   proves the key is valid, costs no tokens, and does not depend on which models exist.
export const verifyGeminiApiKey = async (apiKey: string): Promise<{ ok: boolean; error?: string; errorKind?: GeminiErrorKind }> => {
    if (!apiKey || typeof apiKey !== 'string' || apiKey.length < 20) {
        return { ok: false, error: 'API key looks invalid (too short)', errorKind: 'invalid_key' };
    }
    try {
        const ai = new GoogleGenAI({ apiKey });
        await ai.models.list({
            config: { queryBase: true, pageSize: 1, abortSignal: buildAbortSignal(undefined, VERIFY_TIMEOUT_MS) },
        });
        return { ok: true };
    } catch (err: any) {
        const { kind, message } = classifyGeminiError(err);
        return { ok: false, error: message.slice(0, 200), errorKind: kind };
    }
};

/* ITALIANO: SCELTA AUTOMATICA DEL MODELLO
   Il programma non e' legato a un modello preciso: l'elenco lo chiede a Google (ListModels,
   stesso indirizzo gia' permesso dalla CSP, non consuma token) e sceglie da se' il piu'
   recente della linea gratuita.

   Quattro cose imparate scrivendola, e ognuna sarebbe stata un difetto silenzioso:
   1. I NOMI NON SI ORDINANO DA SOLI. In ordine alfabetico "gemini-3.10-flash" viene PRIMA di
      "gemini-3.6-flash", perche' '1' < '6'. La versione va confrontata come NUMERO, pezzo per
      pezzo, altrimenti il giorno che Google supera il .9 il programma torna indietro da solo.
   2. NELL'ELENCO C'E' DI TUTTO: anteprime, modelli sperimentali, per l'audio, per generare
      immagini, per gli embedding. Alcuni non accettano nemmeno una foto in ingresso, cioe'
      esattamente il mestiere che serve qui. Si tengono solo quelli stabili della linea flash.
   3. ESSERE NELL'ELENCO NON VUOL DIRE POTERLO USARE: un modello puo' comparire e poi
      rispondere "serve la fatturazione" sul tuo account. Per questo, prima di adottarne uno,
      GLIELO SI FA FARE: una chiamata vera con un'immagine di un pixel e lo stesso schema JSON
      del tagging. Adottarlo sperando che funzioni sarebbe di nuovo dichiarare un successo
      senza averlo controllato.
   4. UN LIMITE DI FREQUENZA NON DICE NIENTE SUL MODELLO. Se la prova torna "troppe richieste",
      il modello esiste eccome: siamo solo di corsa. Trattarlo come uno scarto farebbe scendere
      il programma di versione al primo momento di traffico.

   Se qualunque cosa non torna - rete assente, risposta di forma inattesa, nessun candidato che
   passi la prova - NON si cambia niente e resta il modello di adesso. Meglio fermi che spostati
   su qualcosa che non sappiamo se funziona.

   ENGLISH: AUTOMATIC MODEL SELECTION
   The program is not tied to one specific model: the list comes from Google (ListModels, the
   same host the CSP already allows, and it costs no tokens) and it picks the newest of the
   free line by itself.

   Four things learned writing it, each of which would have been a silent defect:
   1. NAMES DO NOT SORT THEMSELVES. Alphabetically "gemini-3.10-flash" comes BEFORE
      "gemini-3.6-flash", because '1' < '6'. Versions must be compared as NUMBERS, part by
      part, or the day Google passes .9 the program quietly downgrades itself.
   2. THE LIST CONTAINS EVERYTHING: previews, experiments, audio models, image generators,
      embedding models. Some do not even accept an image as input - which is precisely the job
      needed here. Only stable models of the flash line are kept.
   3. BEING IN THE LIST DOES NOT MEAN YOU CAN USE IT: a model can appear and then answer
      "billing required" on your account. So before adopting one, WE MAKE IT DO THE JOB: a real
      call with a one-pixel image and the same JSON schema the tagging uses. Adopting it and
      hoping would be declaring success without checking, all over again.
   4. A RATE LIMIT SAYS NOTHING ABOUT THE MODEL. If the probe comes back "too many requests",
      the model exists just fine - we are simply going too fast. Treating that as a rejection
      would downgrade the program at the first busy moment.

   If anything does not add up - no network, an unexpected response shape, no candidate passing
   the probe - NOTHING changes and the current model stays. Better still than moved onto
   something we do not know works. */

export type ModelloTrovato = { id: string; label: string; versione: number[]; lite: boolean };

// ITALIANO: pezzi di nome che escludono un modello: anteprime, sperimentali, e tutto cio' che
//           fa un altro mestiere (audio, immagini, embedding, video...).
// ENGLISH: name fragments that rule a model out: previews, experiments, and anything doing a
//          different job (audio, images, embeddings, video...).
const MODELLI_ESCLUSI = [
    'preview', 'exp', 'thinking', 'tts', 'audio', 'image', 'imagen', 'embedding', 'embed',
    'live', 'aqa', 'learnlm', 'veo', 'robotics', 'computer-use', 'dialog', 'native',
];

const PROVA_TIMEOUT_MS = 25_000;
const MODELLI_MAX = 400;
const PROVE_MAX = 3;

// ITALIANO: un PNG di un pixel trasparente: basta a dimostrare che il modello accetta immagini.
// ENGLISH: a one-pixel transparent PNG: enough to prove the model takes images at all.
const PIXEL_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

// ITALIANO: la versione e' SOLO il numero subito dopo "gemini-": "gemini-3.6-flash" -> [3, 6].
//           Gli altri numeri del nome NON sono versioni: "-8b" e' la taglia (un modello
//           piu' piccolo) e "-001" e' un'istantanea. Leggerli tutti metteva
//           "gemini-3.6-flash-8b" [3,6,8] DAVANTI a "gemini-3.6-flash" [3,6], cioe' faceva
//           scegliere il modello piu' debole. Senza numero dopo "gemini-" torna [] (e
//           scegliCandidati lo scarta).
// ENGLISH: the version is ONLY the number right after "gemini-": "gemini-3.6-flash" -> [3, 6].
//          The other numbers in the name are NOT versions: "-8b" is the size (a smaller model)
//          and "-001" is a snapshot. Reading them all put "gemini-3.6-flash-8b" [3,6,8] AHEAD of
//          "gemini-3.6-flash" [3,6], i.e. it picked the weaker model. With no number after
//          "gemini-" it returns [] (and scegliCandidati drops it).
export const versioneDi = (id: string): number[] => {
    const m = /^gemini-(\d+(?:\.\d+)*)/i.exec(String(id || ''));
    return m ? m[1].split('.').map(p => parseInt(p, 10)).filter(n => Number.isFinite(n)) : [];
};

export const confrontaVersioni = (a: number[], b: number[]): number => {
    const quanti = Math.max(a.length, b.length);
    for (let i = 0; i < quanti; i++) {
        const x = i < a.length ? a[i] : -1;
        const y = i < b.length ? b[i] : -1;
        if (x !== y) return x - y;
    }
    return 0;
};

// ITALIANO: dall'elenco grezzo di Google ai soli candidati sensati, gia' in ordine: prima la
//           versione piu' alta, e a parita' di versione il flash pieno prima del flash-lite.
// ENGLISH: from Google's raw list to the sensible candidates only, already ordered: highest
//          version first, and at equal version the full flash before flash-lite.
export const scegliCandidati = (grezzi: any[]): ModelloTrovato[] => {
    const buoni: ModelloTrovato[] = [];
    const visti = new Set<string>();
    for (const m of Array.isArray(grezzi) ? grezzi : []) {
        const pieno = String((m && m.name) || '');
        const id = pieno.startsWith('models/') ? pieno.slice(7) : pieno;
        if (!id.startsWith('gemini-')) continue;
        if (visti.has(id)) continue;
        // ITALIANO: se Google dichiara le azioni, deve saper generare contenuti. Se non le
        //           dichiara non si scarta a priori: ci pensa la prova sul campo.
        // ENGLISH: if Google states the actions, it must be able to generate content. If it
        //          states none we do not rule it out here: the real probe will decide.
        const azioni = (m && Array.isArray(m.supportedActions)) ? m.supportedActions : [];
        if (azioni.length > 0 && !azioni.includes('generateContent')) continue;
        const minuscolo = id.toLowerCase();
        if (!minuscolo.includes('flash')) continue;
        if (MODELLI_ESCLUSI.some(p => minuscolo.includes(p))) continue;
        // ITALIANO: senza un numero subito dopo "gemini-" non e' la linea flash numerata: e' un
        //           alias o un'altra famiglia (es. "gemini-omni-1.1-flash", che genera video).
        // ENGLISH: with no number right after "gemini-" it is not the numbered flash line: it is an
        //          alias or another family (e.g. "gemini-omni-1.1-flash", which generates video).
        if (versioneDi(id).length === 0) continue;
        visti.add(id);
        buoni.push({
            id,
            label: String((m && m.displayName) || id),
            versione: versioneDi(id),
            // ITALIANO: "lite" e le taglie ridotte ("-8b") sono varianti piu' piccole: a
            //           parita' di versione vengono DOPO il flash pieno.
            // ENGLISH: "lite" and reduced sizes ("-8b") are smaller variants: at equal version
            //          they come AFTER the full flash.
            lite: minuscolo.includes('lite') || /-\d+b(?=-|$)/.test(minuscolo),
        });
    }
    buoni.sort((a, b) => {
        const v = confrontaVersioni(b.versione, a.versione);
        if (v !== 0) return v;
        if (a.lite !== b.lite) return a.lite ? 1 : -1;
        return a.id.localeCompare(b.id);
    });
    return buoni;
};

export const elencaModelliRemoti = async (apiKey: string): Promise<ModelloTrovato[]> => {
    const ai = new GoogleGenAI({ apiKey });
    // ITALIANO: anche l'elenco ha il suo limite di tempo, come ogni altra chiamata: senza, su una
    //           connessione che non risponde il controllo del modello restava appeso per tutta la
    //           sessione. Le pagine successive riusano lo stesso segnale: un solo limite per tutto.
    // ENGLISH: the listing has its time limit too, like every other call: without it, on a
    //          connection that never answers the model check hung for the whole session. The
    //          next pages reuse the same signal: one budget for the whole listing.
    const pagine = await ai.models.list({
        config: { queryBase: true, pageSize: 200, abortSignal: buildAbortSignal(undefined, VERIFY_TIMEOUT_MS) },
    });
    const grezzi: any[] = [];
    for await (const m of pagine) {
        grezzi.push(m);
        if (grezzi.length >= MODELLI_MAX) break;
    }
    return scegliCandidati(grezzi);
};

// ITALIANO: la prova sul campo. 'incerto' quando l'esito non dice niente sul modello;
//           'sovraccarico' quando Google ha risposto ma il modello e' sovraccarico (503/500).
// ENGLISH: the real probe. 'incerto' when the outcome says nothing about the model itself;
//          'sovraccarico' when Google answered but the model is overloaded (503/500).
export const provaModello = async (apiKey: string, id: string): Promise<'ok' | 'no' | 'occupato' | 'sovraccarico' | 'incerto'> => {
    try {
        const ai = new GoogleGenAI({ apiKey });
        const risposta = await ai.models.generateContent({
            model: id,
            contents: {
                parts: [
                    { inlineData: { data: PIXEL_PNG, mimeType: 'image/png' } },
                    { text: 'Reply with the JSON array ["ok"] and nothing else.' },
                ],
            },
            config: {
                abortSignal: buildAbortSignal(undefined, PROVA_TIMEOUT_MS),
                responseMimeType: 'application/json',
                responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
        });
        return risposta.text ? 'ok' : 'no';
    } catch (err: any) {
        const { kind } = classifyGeminiError(err);
        if (kind === 'rate_limit') return 'occupato';
        if (kind === 'busy') return 'sovraccarico';
        if (kind === 'unknown') return 'incerto';
        return 'no';
    }
};

export type EsitoModello = {
    modello: string;
    precedente: string;
    cambiato: boolean;
    // ITALIANO: quando non si cambia per un problema, il PERCHE' decide il messaggio. Un'unica
    //           voce "non riuscito" costringeva l'interfaccia a dire la stessa frase per tre
    //           cose diverse - e per due su tre era sbagliata.
    // ENGLISH: when nothing changes because of a problem, the WHY decides the message. A single
    //          "failed" value forced the interface to say one sentence for three different
    //          things - wrong for two of them.
    // ITALIANO: 'chiaveNonValida' = Google ha rifiutato la chiave (scaduta, revocata, sbagliata):
    //           non e' "non raggiungibile", e l'utente deve sapere che il problema e' la chiave.
    // ENGLISH: 'chiaveNonValida' = Google refused the key (expired, revoked, wrong): it is not
    //          "unreachable", and the user must know the key is the problem.
    esito: 'invariato' | 'aggiornato' | 'riparato' | 'nonRaggiungibile' | 'chiaveNonValida' | 'occupato' | 'nessunoValido';
    disponibili: ModelloTrovato[];
};

// ITALIANO: il giro completo. `rotto` = il modello di adesso ha appena risposto "non esisto":
//           in quel caso si cerca comunque, anche se e' gia' in cima all'elenco.
// ENGLISH: the whole round. `rotto` = the current model has just answered "I do not exist":
//          in that case we look anyway, even if it is already at the top of the list.
export const aggiornaModelloAutomatico = async (
    apiKey: string,
    attuale: string,
    rotto: boolean = false,
): Promise<EsitoModello> => {
    const fermo = (esito: EsitoModello['esito'], disponibili: ModelloTrovato[] = []): EsitoModello =>
        ({ modello: attuale, precedente: attuale, cambiato: false, esito, disponibili });

    if (!apiKey || typeof apiKey !== 'string') return fermo('nonRaggiungibile');

    let candidati: ModelloTrovato[];
    try {
        candidati = await elencaModelliRemoti(apiKey);
    } catch (err) {
        console.warn('[AI] Elenco dei modelli non ottenuto:', err);
        if (classifyGeminiError(err).kind === 'invalid_key') return fermo('chiaveNonValida');
        return fermo('nonRaggiungibile');
    }
    if (candidati.length === 0) return fermo('nonRaggiungibile');

    // ITALIANO: gia' sul piu' recente e funzionante: non si spende nemmeno una chiamata.
    // ENGLISH: already on the newest one and working: not a single call is spent.
    if (!rotto && candidati[0].id === attuale) return { ...fermo('invariato', candidati), disponibili: candidati };

    let sovraccarico = false;
    for (const c of candidati.slice(0, PROVE_MAX)) {
        const esito = await provaModello(apiKey, c.id);
        // ITALIANO: non si sa niente del modello: ci si ferma dove si e', dicendo il perche'.
        // ENGLISH: nothing is known about the model: stay put, and say why.
        if (esito === 'occupato') return { ...fermo('occupato', candidati), disponibili: candidati };
        // ITALIANO: un modello sovraccarico. Nel controllo normale si resta dove si e' (niente
        //           discesa). In una RIPARAZIONE invece il modello di adesso e' gia' morto: restare
        //           vuol dire restare rotti, quindi si prova il candidato dopo. Se nessuno passa,
        //           il motivo e' "Google occupato", non "Google non raggiungibile".
        // ENGLISH: an overloaded model. In the routine check we stay put (no downgrade). In a
        //          REPAIR instead the current model is already dead: staying means staying broken,
        //          so the next candidate is tried. If none passes, the reason is "Google busy",
        //          not "Google unreachable".
        if (esito === 'sovraccarico') {
            if (!rotto) return { ...fermo('occupato', candidati), disponibili: candidati };
            sovraccarico = true;
            continue;
        }
        if (esito === 'incerto') return { ...fermo('nonRaggiungibile', candidati), disponibili: candidati };
        if (esito !== 'ok') continue;
        if (c.id === attuale) return { modello: attuale, precedente: attuale, cambiato: false, esito: 'invariato', disponibili: candidati };
        return {
            modello: c.id,
            precedente: attuale,
            cambiato: true,
            esito: rotto ? 'riparato' : 'aggiornato',
            disponibili: candidati,
        };
    }
    return { ...fermo(sovraccarico ? 'occupato' : 'nessunoValido', candidati), disponibili: candidati };
};
