// =============================================================================
// Ollama Service (ollama.ts)
// =============================================================================
//
// Handles interactions with a locally-running Ollama instance.
// Ollama provides a REST API at http://localhost:11434 by default.
// No API key required — it's all local! 🦙
//
// KEY ENDPOINTS:
// - POST /api/generate  — Generate a response from a model
// - GET  /api/tags      — List locally available models
//
// USAGE:
// ```typescript
// import { ollamaService } from './ollama';
//
// const result = await ollamaService.generateResponse('Hello!', config);
// const models = await OllamaService.listModels('http://localhost:11434');
// ```
//
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
     * @param config  - App config containing ollamaUrl, ollamaModel, personality, characterName
     * @returns Object with either a response string or an error string
     */
    public async generateResponse(message: string, config: any): Promise<{ response?: string; error?: string }> {
        const startTime = Date.now();

        // 1. Log User Message
        console.log(`[Ollama] ⏱️ REQUEST START`);
        console.log(`[Ollama] USER: ${message}`);

        // 2. Determine URL and Model
        const ollamaUrl = config.ollamaUrl || DEFAULT_OLLAMA_URL;
        const selectedModel = config.ollamaModel || DEFAULT_OLLAMA_MODEL;
        console.log(`[Ollama] USING MODEL: ${selectedModel} at ${ollamaUrl}`);

        // 3. Build System Prompt (same template as Gemini for consistency)
        const systemPrompt = this.buildSystemPrompt(config.personality, config.characterName);
        console.log(`[Ollama] SYSTEM PROMPT: ${systemPrompt}`);

        // 4. Set up a timeout (60 seconds) so we don't hang forever
        const TIMEOUT_MS = 60000;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            console.error(`[Ollama] ⏱️ TIMEOUT after ${TIMEOUT_MS / 1000}s — aborting request!`);
            controller.abort();
        }, TIMEOUT_MS);

        try {
            // 5. Build the request body
            const requestBody = {
                model: selectedModel,
                prompt: message,
                system: systemPrompt,
                stream: false  // We want the full response at once, not streaming
            };
            console.log(`[Ollama] 📤 Sending POST to ${ollamaUrl}/api/generate ...`);
            console.log(`[Ollama] Request body:`, JSON.stringify(requestBody, null, 2));

            // 6. Call Ollama's /api/generate endpoint
            const response = await fetch(`${ollamaUrl}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
                signal: controller.signal  // Attach the abort signal for timeout
            });

            const fetchDuration = Date.now() - startTime;
            console.log(`[Ollama] 📥 Response received in ${fetchDuration}ms (HTTP ${response.status})`);

            // 7. Clear the timeout since we got a response
            clearTimeout(timeoutId);

            // 8. Handle HTTP errors
            if (!response.ok) {
                const errorBody = await response.text();
                console.error(`[Ollama] ❌ HTTP ${response.status}: ${errorBody}`);

                if (response.status === 404) {
                    return { error: `Model "${selectedModel}" not found. Try: ollama pull ${selectedModel}` };
                }

                return { error: `Ollama error (${response.status}): ${errorBody}` };
            }

            // 9. Parse the JSON response
            console.log(`[Ollama] 🔄 Parsing JSON response...`);
            const data = await response.json();
            const responseText = data.response || '';
            const totalDuration = Date.now() - startTime;
            console.log(`[Ollama] ✅ AI RESPONSE (${totalDuration}ms): ${responseText}`);

            // Log Ollama's own performance stats if available
            if (data.total_duration) {
                console.log(`[Ollama] 📊 Ollama stats: total=${(data.total_duration / 1e9).toFixed(2)}s, eval=${(data.eval_duration / 1e9).toFixed(2)}s, tokens=${data.eval_count}`);
            }

            return { response: responseText };

        } catch (error: any) {
            clearTimeout(timeoutId);
            const errorDuration = Date.now() - startTime;
            console.error(`[Ollama] ❌ Error after ${errorDuration}ms:`, error);

            // Handle timeout specifically
            if (error.name === 'AbortError') {
                return {
                    error: `Ollama took too long (>${TIMEOUT_MS / 1000}s). Try a smaller model! 🦙`
                };
            }

            // Friendly error for connection failures
            if (error.message?.includes('fetch') || error.message?.includes('Failed') || error.message?.includes('ECONNREFUSED') || error.name === 'TypeError') {
                return {
                    error: `Can't reach Ollama at ${ollamaUrl}. Is it running? Start it with: ollama serve 🦙`
                };
            }

            return { error: error.message || 'Unknown Ollama Error' };
        }
    }

    /**
     * Build the system prompt from personality traits and character name.
     * Uses the same template as GeminiService for consistent character behavior.
     *
     * @param personality  - Array of personality trait strings
     * @param characterName - The character's display name
     * @returns Formatted system prompt string
     */
    private buildSystemPrompt(personality: string[], characterName: string): string {
        const traits = personality || DEFAULT_PERSONALITY;

        return SYSTEM_PROMPT_TEMPLATE
            .replace('{name}', characterName || DEFAULT_CHARACTER_NAME)
            .replace('{traits}', traits.join(', '));
    }

    /**
     * Fetch the list of locally available Ollama models.
     * Calls GET /api/tags on the Ollama instance.
     *
     * @param ollamaUrl - Base URL of the Ollama instance
     * @returns Array of model name strings, or empty array on failure
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
            // Ollama returns { models: [{ name: "llama3.2:latest", ... }, ...] }
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
     * Calls the root endpoint which returns "Ollama is running" on success.
     *
     * @param ollamaUrl - Base URL of the Ollama instance
     * @returns Object with success boolean and a message string
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

/** Singleton instance for use throughout the app */
export const ollamaService = new OllamaService();
