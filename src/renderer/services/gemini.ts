import { GoogleGenerativeAI } from '@google/generative-ai';
import { DEFAULT_CHARACTER_NAME, DEFAULT_GEMINI_MODEL, DEFAULT_PERSONALITY, SYSTEM_PROMPT_TEMPLATE } from '../constants';

/**
 * Handles interactions with Google's Gemini AI.
 * Running directly in the Frontend (Renderer).
 */
export class GeminiService {

    public async generateResponse(message: string, config: any): Promise<{ response?: string; error?: string }> {
        const timestamp = new Date().toISOString();

        // 1. Log User Message
        console.log(`[Gemini] USER: ${message}`);

        // 2. Validate API Key
        if (!config.geminiApiKey) { // Changed locally to match config key
            const errorMsg = 'Please set your API key in settings!';
            console.warn(`[Gemini] ERROR: ${errorMsg}`);
            return { error: errorMsg };
        }

        try {
            // 3. Initialize AI
            const genAI = new GoogleGenerativeAI(config.geminiApiKey);
            const selectedModel = config.geminiModel || DEFAULT_GEMINI_MODEL;
            const model = genAI.getGenerativeModel({ model: selectedModel });
            console.log(`[Gemini] USING MODEL: ${selectedModel}`);

            // 4. Build System Prompt
            const systemPrompt = this.buildSystemPrompt(config.personality, config.characterName);
            console.log(`[Gemini] SYSTEM PROMPT: ${systemPrompt}`);

            // 5. Generate Content
            const result = await model.generateContent([
                { text: systemPrompt },
                { text: message }
            ]);

            const responseText = result.response.text();
            console.log(`[Gemini] AI RESPONSE: ${responseText}`);

            return { response: responseText };

        } catch (error: any) {
            console.error('AI Error:', error);
            return { error: error.message || 'Unknown AI Error' };
        }
    }

    private buildSystemPrompt(personality: string[], characterName: string): string {
        const traits = personality || DEFAULT_PERSONALITY;

        return SYSTEM_PROMPT_TEMPLATE
            .replace('{name}', characterName || DEFAULT_CHARACTER_NAME)
            .replace('{traits}', traits.join(', '));
    }
}

export const geminiService = new GeminiService();
