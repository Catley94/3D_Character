import { GoogleGenerativeAI } from '@google/generative-ai';
import { DEFAULT_CHARACTER_NAME, DEFAULT_GEMINI_MODEL, DEFAULT_PERSONALITY, SYSTEM_PROMPT_TEMPLATE } from '../constants';

/**
 * Handles interactions with Google's Gemini AI.
 * Running directly in the Frontend (Renderer).
 */
export class GeminiService {

    public async generateResponse(message: string, history: any[], longTermSummary: string, config: any): Promise<{ response?: string; error?: string }> {
        const timestamp = new Date().toISOString();

        // 1. Log User Message
        console.log(`[Gemini] USER: ${message}`);

        // 2. Validate API Key
        if (!config.geminiApiKey) {
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
            const systemPrompt = this.buildSystemPrompt(config.personality, config.characterName, longTermSummary);
            console.log(`[Gemini] SYSTEM PROMPT LENGTH: ${systemPrompt.length} chars`);

            // 5. Convert History to Gemini Format
            // Gemini expects: { role: 'user' | 'model', parts: [{ text: string }] }
            const chatHistory = history.map(msg => ({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }]
            }));

            // 6. Start Chat Session
            const chat = model.startChat({
                history: chatHistory,
                systemInstruction: systemPrompt,
            });

            // 7. Generate Response
            const result = await chat.sendMessage(message);
            const responseText = result.response.text();

            console.log(`[Gemini] AI RESPONSE: ${responseText}`);

            return { response: responseText };

        } catch (error: any) {
            console.error('AI Error:', error);
            return { error: error.message || 'Unknown AI Error' };
        }
    }

    private buildSystemPrompt(personality: string[], characterName: string, longTermSummary: string): string {
        const traits = personality || DEFAULT_PERSONALITY;

        let prompt = SYSTEM_PROMPT_TEMPLATE
            .replace('{name}', characterName || DEFAULT_CHARACTER_NAME)
            .replace('{traits}', traits.join(', '));

        if (longTermSummary && longTermSummary.trim().length > 0) {
            prompt += `\n\nLONG-TERM MEMORY (Things you know/remember from past conversations):\n${longTermSummary}\n`;
        }

        return prompt;
    }

    public async summarize(text: string, config: any): Promise<string> {
        if (!config.geminiApiKey) return '';
        try {
            const genAI = new GoogleGenerativeAI(config.geminiApiKey);
            const model = genAI.getGenerativeModel({ model: config.geminiModel || DEFAULT_GEMINI_MODEL });

            const prompt = `Summarize the following chat conversation history into a concise, narrative form for long-term memory. Focus on facts, user preferences, and important events. \n\n${text}`;

            const result = await model.generateContent(prompt);
            return result.response.text();
        } catch (error) {
            console.error('[Gemini] Summarize failed:', error);
            return '';
        }
    }
}

export const geminiService = new GeminiService();
