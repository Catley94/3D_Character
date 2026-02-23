// =============================================================================
// Ollama Service (ollama.ts)
// =============================================================================

import { DEFAULT_OLLAMA_URL, DEFAULT_OLLAMA_MODEL, DEFAULT_CHARACTER_NAME, DEFAULT_PERSONALITY, SYSTEM_PROMPT_TEMPLATE } from '../constants';

/**
 * Service class for interacting with a local Ollama instance.
 * Mirrors the GeminiService interface for easy provider switching.
 */
export class OllamaService {

    /**
     * Generate a response from the local Ollama model.
     *
     * @param message - The user's chat message
     * @param history - Array of previous messages (short-term memory)
     * @param longTermSummary - Summarized long-term memory string
     * @param config  - App config containing ollamaUrl, ollamaModel, personality, characterName
     * @returns Object with either a response string or an error string
     */
    public async generateResponse(message: string, history: any[], longTermSummary: string, config: any): Promise<{ response?: string; error?: string }> {
        const startTime = Date.now();

        // 1. Log User Message
        console.log(`[Ollama] ⏱️ REQUEST START`);
        console.log(`[Ollama] USER: ${message}`);

        // 2. Determine URL and Model
        const ollamaUrl = config.ollamaUrl || DEFAULT_OLLAMA_URL;
        const selectedModel = config.ollamaModel || DEFAULT_OLLAMA_MODEL;
        console.log(`[Ollama] USING MODEL: ${selectedModel} at ${ollamaUrl}`);

        // 3. Build System Prompt
        const systemPrompt = this.buildSystemPrompt(config.personality, config.characterName, longTermSummary);

        // 4. Prepare Context (History)
        // Ollama /api/chat format: { role: 'user' | 'assistant' | 'system', content: string }
        const messages = [
            { role: 'system', content: systemPrompt },
            ...history.map(msg => ({ role: msg.role === 'model' ? 'assistant' : 'user', content: msg.content })),
            { role: 'user', content: message }
        ];

        // 4. Set up a timeout (60 seconds) so we don't hang forever
        const TIMEOUT_MS = 60000;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            console.error(`[Ollama] ⏱️ TIMEOUT after ${TIMEOUT_MS / 1000}s — aborting request!`);
            controller.abort();
        }, TIMEOUT_MS);

        try {
            // 5. Build the request body for /api/chat
            const requestBody = {
                model: selectedModel,
                messages: messages,
                stream: false
            };
            console.log(`[Ollama] 📤 Sending POST to ${ollamaUrl}/api/chat ...`);

            // 6. Call Ollama's /api/chat endpoint
            const response = await fetch(`${ollamaUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
                signal: controller.signal
            });

            const fetchDuration = Date.now() - startTime;
            console.log(`[Ollama] 📥 Response received in ${fetchDuration}ms (HTTP ${response.status})`);

            // 7. Clear the timeout since we got a response
            clearTimeout(timeoutId);

            // 8. Handle HTTP errors
            if (!response.ok) {
                const errorBody = await response.text();
                // ... same error handling ...
                if (response.status === 404) {
                    return { error: `Model "${selectedModel}" not found. Try: ollama pull ${selectedModel}` };
                }
                return { error: `Ollama error (${response.status}): ${errorBody}` };
            }

            // 9. Parse the JSON response
            const data = await response.json();
            const responseText = data.message?.content || '';
            const totalDuration = Date.now() - startTime;
            console.log(`[Ollama] ✅ AI RESPONSE (${totalDuration}ms): ${responseText}`);

            return { response: responseText };

        } catch (error: any) {
            // ... same catch block ...
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') return { error: `Ollama took too long.` };
            if (error.message?.includes('fetch')) return { error: `Can't reach Ollama at ${ollamaUrl}.` };
            return { error: error.message || 'Unknown Ollama Error' };
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
        const ollamaUrl = config.ollamaUrl || DEFAULT_OLLAMA_URL;
        const selectedModel = config.ollamaModel || DEFAULT_OLLAMA_MODEL;

        try {
            const response = await fetch(`${ollamaUrl}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: selectedModel,
                    prompt: `Summarize the following chat conversation into a concise memory log:\n\n${text}`,
                    stream: false
                })
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            return data.response || '';

        } catch (error) {
            console.error('[Ollama] Summarize failed:', error);
            return '';
        }
    }

    /**
     * Fetch the list of locally available Ollama models.
     */
    static async listModels(ollamaUrl: string = DEFAULT_OLLAMA_URL): Promise<string[]> {
        try {
            console.log(`[Ollama] Fetching models from ${ollamaUrl}/api/tags`);
            const response = await fetch(`${ollamaUrl}/api/tags`);

            if (!response.ok) {
                console.warn(`[Ollama] Failed to list models: HTTP ${response.status}`);
                return [];
            }

            const data = await response.json();
            const models = (data.models || []).map((m: any) => m.name as string);
            console.log(`[Ollama] Available models:`, models);
            return models;

        } catch (error) {
            console.warn('[Ollama] Could not fetch models (is Ollama running?):', error);
            return [];
        }
    }

    /**
     * Test the connection to an Ollama instance.
     */
    static async testConnection(ollamaUrl: string = DEFAULT_OLLAMA_URL): Promise<{ success: boolean; message: string }> {
        try {
            const response = await fetch(ollamaUrl);

            if (response.ok) {
                return { success: true, message: 'Ollama is running! 🦙✨' };
            } else {
                return { success: false, message: `Unexpected status: ${response.status}` };
            }
        } catch (error: any) {
            return {
                success: false,
                message: `Can't reach Ollama at ${ollamaUrl}. Make sure it's running! 🦙`
            };
        }
    }
}

export const ollamaService = new OllamaService();
