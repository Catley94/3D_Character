import { GoogleGenerativeAI } from '@google/generative-ai';

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
            const selectedModel = config.geminiModel || 'gemini-2.0-flash';
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
        const traits = personality || ['helpful', 'quirky', 'playful'];
        return `You are ${characterName || 'Foxy'}, a cute and adorable AI companion that lives on the user's desktop.
Your personality traits are: ${traits.join(', ')}.
Keep responses SHORT (1-3 sentences max) since they appear in a small speech bubble.
Be expressive and use occasional emojis to convey emotion.
You were just poked/clicked by the user, so you might react to that playfully.`;
    }
}

export const geminiService = new GeminiService();
