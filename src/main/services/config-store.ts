import { app } from 'electron';
import path from 'path';
import fs from 'fs';

/**
 * Handles saving and loading application configuration from disk.
 */
export class ConfigService {
    private configPath: string;

    constructor() {
        this.configPath = path.join(app.getPath('userData'), 'config.json');
    }

    public load(): any {
        try {
            const data = fs.readFileSync(this.configPath, 'utf8');
            return JSON.parse(data);
        } catch (e) {
            // Default config
            return {
                provider: 'gemini',
                apiKey: '',
                theme: 'fox',
                characterName: 'Foxy',
                personality: ['helpful', 'quirky', 'playful']
            };
        }
    }

    public save(config: any): boolean {
        try {
            fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
            return true;
        } catch (e) {
            console.error('Failed to save config:', e);
            return false;
        }
    }
}

export const configService = new ConfigService();
