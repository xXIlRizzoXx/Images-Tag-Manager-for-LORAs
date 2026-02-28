import { GoogleGenAI, Type } from "@google/genai";

export const getGeminiTags = async (file: File, apiKey: string, modelName: string, maxTags: number): Promise<string[]> => {
    const ai = new GoogleGenAI({ apiKey });

    // Convert file to base64
    const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            if (typeof reader.result === 'string') {
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            } else {
                reject(new Error("Failed to convert file to base64"));
            }
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

    const response = await ai.models.generateContent({
        model: modelName,
        contents: {
            parts: [
                {
                    inlineData: {
                        data: base64Data,
                        mimeType: file.type,
                    },
                },
                {
                    text: `Analyze this image and provide a list of exactly ${maxTags} descriptive tags. The tags should be single words or short phrases describing the main subjects, style, colors, and objects in the image. Return ONLY a JSON array of strings.`,
                },
            ],
        },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.STRING,
                },
                description: "The list of tags for the image.",
            },
        },
    });

    try {
        const text = response.text;
        if (!text) return [];
        const tags = JSON.parse(text);
        if (Array.isArray(tags)) {
            return tags.map(t => t.toLowerCase().trim()).filter(t => t.length > 0);
        }
    } catch (e) {
        console.error("Failed to parse Gemini response", e);
    }
    return [];
};
