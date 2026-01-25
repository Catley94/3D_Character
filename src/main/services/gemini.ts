import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Handles interactions with Google's Gemini AI.
 * Also maintains a local conversation log for debugging/review.
 */
export class GeminiService {
    private logPath: string;

    constructor() {
        this.logPath = path.join(app.getPath('userData'), 'conversation_log.txt');
    }

    public async generateResponse(message: string, config: any): Promise<{ response?: string; error?: string }> {
        const timestamp = new Date().toISOString();

        // 1. Log User Message
        this.log(`\n[${timestamp}] USER: ${message}`);

        // 2. Validate API Key
        if (!config.apiKey) {
            const errorMsg = 'Please set your API key in settings!';
            this.log(`[${timestamp}] ERROR: ${errorMsg}`);
            return { error: errorMsg };
        }

        try {
            // 3. Initialize AI
            const genAI = new GoogleGenerativeAI(config.apiKey);
            const selectedModel = config.geminiModel || 'gemini-2.0-flash';
            const model = genAI.getGenerativeModel({ model: selectedModel });
            this.log(`[${timestamp}] USING MODEL: ${selectedModel}`);

            // 4. Build System Prompt
            const systemPrompt = this.buildSystemPrompt(config.personality, config.characterName);
            this.log(`[${timestamp}] SYSTEM PROMPT: ${systemPrompt}`);

            // 5. Generate Content
            const result = await model.generateContent([
                { text: systemPrompt },
                { text: message }
            ]);

            const responseText = result.response.text();
            this.log(`[${timestamp}] AI RESPONSE: ${responseText}`);

            return { response: responseText };

        } catch (error: any) {
            console.error('AI Error:', error);
            this.log(`[${timestamp}] AI ERROR: ${error.message}\n[${timestamp}] FULL ERROR: ${JSON.stringify(error, null, 2)}`);
            return { error: error.message };
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

    private log(message: string) {
        try {
            fs.appendFileSync(this.logPath, message + '\n');
        } catch (e) {
            console.error("Error writing log", e);
        }
    }
}

export const geminiService = new GeminiService();
