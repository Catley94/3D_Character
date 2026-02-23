import { GoogleGenAI } from '@google/genai';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { DEFAULT_CHARACTER_NAME, DEFAULT_GEMINI_MODEL, DEFAULT_PERSONALITY, SYSTEM_PROMPT_TEMPLATE } from '../constants';

/**
 * Handles interactions with Google's Gemini AI.
 * Running directly in the Frontend (Renderer).
 */
export class GeminiService {
    private currentInteractionId: string | null = null;

    // Allow clearing the interactions ID if memory is wiped
    public clearMemory() {
        this.currentInteractionId = null;
    }

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
            // We use tauriFetch to bypass CORS restrictions on the experimental Interactions API
            const ai = new GoogleGenAI({
                apiKey: config.geminiApiKey,
                httpOptions: { fetch: tauriFetch } as any
            });
            const selectedModel = config.geminiModel || DEFAULT_GEMINI_MODEL;
            console.log(`[Gemini] USING MODEL: ${selectedModel}`);

            // 4. Build System Prompt
            const systemPrompt = this.buildSystemPrompt(config.personality, config.characterName, longTermSummary);
            console.log(`[Gemini] SYSTEM PROMPT LENGTH: ${systemPrompt.length} chars`);

            // 5. Generate Response using the new Interactions API (Stateful)
            // Notice we do NOT pass the local short-term `history` array! 
            // The Interactions SDK remembers everything tied to the `interaction.id` automatically.

            const interactionConfig: any = {
                model: selectedModel,
                input: message,
                config: {
                    systemInstruction: systemPrompt
                }
            };

            // If we have a previous interaction ID from this session, we pass it to continue the state
            if (this.currentInteractionId) {
                interactionConfig.previous_interaction_id = this.currentInteractionId;
            }

            console.log(`[Gemini] Sending Request via Interactions API (Previous ID: ${this.currentInteractionId || 'None'})...`);
            const interaction = await ai.interactions.create(interactionConfig);

            // 6. Extract Response and Save Interaction ID
            // The AI response is located in the outputs array. We grab the text of the last output.
            let responseText = '';
            const outputs = interaction.outputs;
            if (outputs && outputs.length > 0) {
                const lastOutput = outputs[outputs.length - 1];
                if ('text' in lastOutput && typeof lastOutput.text === 'string') {
                    responseText = lastOutput.text;
                }
            }

            // Critically: Save the new interaction ID to persist the state across the next turn!
            this.currentInteractionId = interaction.id;

            console.log(`[Gemini] AI RESPONSE: ${responseText}`);
            console.log(`[Gemini] NEW INTERACTION ID SAVED: ${this.currentInteractionId}`);

            return { response: responseText };

        } catch (error: any) {
            console.error('AI Error:', error);
            // On failure, we probably shouldn't keep a broken interaction id, but let's let the user try again.
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
            const ai = new GoogleGenAI({
                apiKey: config.geminiApiKey,
                httpOptions: { fetch: tauriFetch } as any
            });
            const selectedModel = config.geminiModel || DEFAULT_GEMINI_MODEL;

            const prompt = `Summarize the following chat conversation history into a concise, narrative form for long-term memory. Focus on facts, user preferences, and important events. \n\n${text}`;

            const response = await ai.models.generateContent({
                model: selectedModel,
                contents: prompt,
            });

            return response.text || '';
        } catch (error) {
            console.error('[Gemini] Summarize failed:', error);
            return '';
        }
    }
}

export const geminiService = new GeminiService();
