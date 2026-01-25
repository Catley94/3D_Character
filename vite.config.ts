import { defineConfig } from 'vite'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'

export default defineConfig({
    // Copy assets folder to dist output
    publicDir: 'assets',
    base: './',  // Use relative paths for packaged app
    plugins: [
        electron([
            {
                entry: 'src/main/main.ts',
            },
            {
                entry: 'src/main/preload.ts',
                onstart({ reload }) {
                    reload()
                },
            },
        ]),
        renderer(),
    ],
})
