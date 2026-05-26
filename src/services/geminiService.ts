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

const CUSTOM_PROMPT_MAX_LENGTH = 500;
const TAG_MAX_LENGTH = 60;
const CAPTION_MAX_LENGTH = 2000;
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
const ALLOWED_MIME_PREFIX = 'image/';

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

const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    if (!file || file.size === 0) { reject(new Error('Invalid or empty file')); return; }
    if (file.size > MAX_FILE_SIZE_BYTES) { reject(new Error('Image too large (> 20 MB)')); return; }
    if (!file.type || !file.type.startsWith(ALLOWED_MIME_PREFIX)) { reject(new Error('Unsupported file type')); return; }
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
        const cleaned = item.toLowerCase().trim().slice(0, TAG_MAX_LENGTH);
        if (!cleaned) continue;
        if (seen.has(cleaned)) continue;
        seen.add(cleaned);
        out.push(cleaned);
        if (out.length >= maxTags) break;
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

const buildCaptionPrompt = (customPrompt?: string): string => {
    const safeCustom = sanitizeCustomPrompt(customPrompt);
    if (safeCustom) {
        return `User preference: ${safeCustom}\n\nTask: provide a single detailed descriptive caption for this image. Focus on main subject, action, setting and style. Return plain text only, no JSON, no markdown.`;
    }
    return `Provide a single detailed descriptive caption for this image. Focus on main subject, action, setting and style. Return plain text only, one sentence.`;
};

export type GeminiOptions = {
    apiKey: string;
    modelName: string;
    customPrompt?: string;
};

export type GeminiTagOptions = GeminiOptions & {
    maxTags: number;
};

export const getGeminiTags = async (file: File, opts: GeminiTagOptions): Promise<string[]> => {
    if (!opts.apiKey || typeof opts.apiKey !== 'string') {
        throw new Error('Missing API key');
    }
    const ai = new GoogleGenAI({ apiKey: opts.apiKey });
    const base64Data = await fileToBase64(file);

    const response = await ai.models.generateContent({
        model: opts.modelName,
        contents: {
            parts: [
                { inlineData: { data: base64Data, mimeType: file.type } },
                { text: buildTagPrompt(opts.maxTags, opts.customPrompt) },
            ],
        },
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'The list of tags for the image.',
            },
        },
    });

    const text = response.text;
    if (!text) return [];
    try {
        const parsed = JSON.parse(text);
        return validateAndCleanTags(parsed, Math.max(1, Math.floor(opts.maxTags) || 30));
    } catch {
        console.error('Gemini response was not valid JSON.');
        return [];
    }
};

export const getGeminiCaption = async (file: File, opts: GeminiOptions): Promise<string> => {
    if (!opts.apiKey || typeof opts.apiKey !== 'string') {
        throw new Error('Missing API key');
    }
    const ai = new GoogleGenAI({ apiKey: opts.apiKey });
    const base64Data = await fileToBase64(file);

    const response = await ai.models.generateContent({
        model: opts.modelName,
        contents: {
            parts: [
                { inlineData: { data: base64Data, mimeType: file.type } },
                { text: buildCaptionPrompt(opts.customPrompt) },
            ],
        },
    });

    const text = (response.text || '').trim();
    return text.slice(0, CAPTION_MAX_LENGTH);
};

// ITALIANO: Modelli vision di Gemini disponibili (default 2.5 Flash)
// ENGLISH: Available Gemini vision models (default 2.5 Flash)
export type GeminiTier = 'free' | 'limited' | 'paid';
export const GEMINI_MODELS: ReadonlyArray<{ id: string; label: string; tier: GeminiTier; recommended: boolean }> = [
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', tier: 'free', recommended: true },
    { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite', tier: 'free', recommended: false },
    { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash', tier: 'limited', recommended: false },
    { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (Preview)', tier: 'paid', recommended: false },
];

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

export const isFreeTierModel = (modelId: string): boolean => {
    const m = GEMINI_MODELS.find(x => x.id === modelId);
    return m ? m.tier === 'free' : false;
};

export const getModelTier = (modelId: string): GeminiTier => {
    const m = GEMINI_MODELS.find(x => x.id === modelId);
    return m ? m.tier : 'paid';
};

// ITALIANO: Classifica un errore restituito da Gemini in modo leggibile per l'utente
// ENGLISH: Classify a Gemini error into a human-readable category
export type GeminiErrorKind = 'invalid_key' | 'billing_required' | 'rate_limit' | 'model_unavailable' | 'unknown';
export const classifyGeminiError = (err: any): { kind: GeminiErrorKind; message: string } => {
    const msg = String(err?.message || err || '');
    if (msg.includes('API key not valid') || msg.includes('API_KEY_INVALID') || msg.includes('401')) {
        return { kind: 'invalid_key', message: msg };
    }
    if (msg.includes('FAILED_PRECONDITION') || msg.includes('billing') || msg.includes('SERVICE_DISABLED') || msg.includes('does not have access')) {
        return { kind: 'billing_required', message: msg };
    }
    if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429') || msg.toLowerCase().includes('quota')) {
        return { kind: 'rate_limit', message: msg };
    }
    if (msg.includes('NOT_FOUND') || msg.includes('404') || msg.toLowerCase().includes('model') && msg.toLowerCase().includes('not found')) {
        return { kind: 'model_unavailable', message: msg };
    }
    if (msg.includes('PERMISSION_DENIED') || msg.includes('403')) {
        return { kind: 'billing_required', message: msg };
    }
    return { kind: 'unknown', message: msg };
};

// ITALIANO: Test rapido della API key per verifica (call leggera)
// ENGLISH: Quick API key validation call
export const verifyGeminiApiKey = async (apiKey: string, modelId: string = DEFAULT_GEMINI_MODEL): Promise<{ ok: boolean; error?: string; errorKind?: GeminiErrorKind }> => {
    if (!apiKey || typeof apiKey !== 'string' || apiKey.length < 20) {
        return { ok: false, error: 'API key looks invalid (too short)', errorKind: 'invalid_key' };
    }
    try {
        const ai = new GoogleGenAI({ apiKey });
        await ai.models.generateContent({
            model: modelId,
            contents: { parts: [{ text: 'ping' }] },
        });
        return { ok: true };
    } catch (err: any) {
        const { kind, message } = classifyGeminiError(err);
        return { ok: false, error: message.slice(0, 200), errorKind: kind };
    }
};
