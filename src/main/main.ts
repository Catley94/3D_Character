import { app, BrowserWindow, ipcMain, Tray, Menu, screen, IpcMainInvokeEvent } from 'electron';
import path from 'path';
import fs from 'fs';
import { GoogleGenerativeAI } from '@google/generative-ai';

let mainWindow: BrowserWindow | null;
let tray: Tray;
let isDev = process.env.NODE_ENV === 'development';
const FIXED_WIDTH = 350;
const FIXED_HEIGHT = 450;
const DIST = path.join(__dirname, '../dist');
const PUBLIC = app.isPackaged ? DIST : path.join(DIST, '../public');

// Vite Dev Server URL
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  mainWindow = new BrowserWindow({
    width: FIXED_WIDTH,
    height: FIXED_HEIGHT,
    x: width - 340,
    y: height - 300,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(DIST, 'index.html'));
  }

  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // Redirect renderer console to main terminal
  mainWindow.webContents.on('console-message', (event, ...args: any[]) => {
    // Electron 35+ sends (event, detailsObject)
    // Older versions send (event, level, message, line, sourceId)

    let message = '';
    if (args.length === 1 && typeof args[0] === 'object') {
      message = args[0].message;
    } else if (args.length > 1) {
      message = args[1]; // arg[0] is level, arg[1] is message
    }

    console.log(`[Renderer] ${message}`);
  });
}

function createTray() {
  const iconPath = path.join(app.getAppPath(), 'assets/tray-icon.png');
  // Check if icon exists, otherwise handle it (electron might crash if tray icon is missing)
  // In dev, assets are in root. In prod, they are copied.
  // We'll trust the path for now or use a try-catch blocks like the original code.

  // NOTE: In production, assets might need to be in resources or handled differently.
  // For now we assume they are accessible from app path.

  try {
    // Adjust path based on environment if necessary. 
    // The original code used `../../assets/tray-icon.png` relative to `src/main/main.js`.
    // New `main.ts` is in `src/main`. `../../assets` is `root/assets`.
    // `app.getAppPath()` usually points to built resource.
    // Let's stick to a robust path resolution.
    const assetPath = app.isPackaged ? path.join(process.resourcesPath, 'assets') : path.join(app.getAppPath(), 'assets');
    const trayIcon = path.join(assetPath, 'tray-icon.png');

    if (fs.existsSync(trayIcon)) {
      tray = new Tray(trayIcon);
    } else {
      console.log('Tray icon not found at:', trayIcon);
      // Create empty tray or handle error
      return;
    }

  } catch (e) {
    console.log('Tray icon creation failed', e);
    return;
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Character',
      click: () => mainWindow?.show()
    },
    {
      label: 'Settings',
      click: () => mainWindow?.webContents.send('open-settings')
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => app.quit()
    }
  ]);

  tray.setToolTip('AI Character Assistant');
  tray.setContextMenu(contextMenu);
}

// IPC Handlers
ipcMain.handle('send-message', async (event: IpcMainInvokeEvent, { message, config }: { message: string, config: any }) => {
  const logPath = path.join(app.getPath('userData'), 'conversation_log.txt');
  const timestamp = new Date().toISOString();

  try {
    fs.appendFileSync(logPath, `\n[${timestamp}] USER: ${message}\n`);
  } catch (e) { console.error("Error writing log", e) }

  try {
    if (!config.apiKey) {
      const errorMsg = 'Please set your API key in settings!';
      fs.appendFileSync(logPath, `[${timestamp}] ERROR: ${errorMsg}\n`);
      return { error: errorMsg };
    }

    const genAI = new GoogleGenerativeAI(config.apiKey);
    const selectedModel = config.geminiModel || 'gemini-2.0-flash';
    const model = genAI.getGenerativeModel({ model: selectedModel });
    fs.appendFileSync(logPath, `[${timestamp}] USING MODEL: ${selectedModel}\n`);

    const systemPrompt = buildSystemPrompt(config.personality, config.characterName);
    fs.appendFileSync(logPath, `[${timestamp}] SYSTEM PROMPT: ${systemPrompt}\n`);

    const result = await model.generateContent([
      { text: systemPrompt },
      { text: message }
    ]);

    const responseText = result.response.text();
    fs.appendFileSync(logPath, `[${timestamp}] AI RESPONSE: ${responseText}\n`);

    return { response: responseText };
  } catch (error: any) {
    console.error('AI Error:', error);
    try {
      fs.appendFileSync(logPath, `[${timestamp}] AI ERROR: ${error.message}\n[${timestamp}] FULL ERROR: ${JSON.stringify(error, null, 2)}\n`);
    } catch (e) { }
    return { error: error.message };
  }
});

function buildSystemPrompt(personality: string[], characterName: string) {
  const traits = personality || ['helpful', 'quirky', 'playful'];
  return `You are ${characterName || 'Foxy'}, a cute and adorable AI companion that lives on the user's desktop.
Your personality traits are: ${traits.join(', ')}.
Keep responses SHORT (1-3 sentences max) since they appear in a small speech bubble.
Be expressive and use occasional emojis to convey emotion.
You were just poked/clicked by the user, so you might react to that playfully.`;
}

// Save and load config
ipcMain.handle('save-config', async (event: IpcMainInvokeEvent, config: any) => {
  const configPath = path.join(app.getPath('userData'), 'config.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  return { success: true };
});

ipcMain.handle('load-config', async () => {
  const configPath = path.join(app.getPath('userData'), 'config.json');
  try {
    const data = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return {
      provider: 'gemini',
      apiKey: '',
      theme: 'fox',
      characterName: 'Foxy',
      personality: ['helpful', 'quirky', 'playful']
    };
  }
});

app.whenReady().then(() => {
  createWindow();
  // createTray(); // Delay tray creation or handle it carefully
  setTimeout(createTray, 500);

  ipcMain.handle('get-window-bounds', () => {
    if (mainWindow) {
      return mainWindow.getBounds();
    }
    return { x: 0, y: 0, width: FIXED_WIDTH, height: FIXED_HEIGHT };
  });

  ipcMain.on('set-window-size', (event, { width, height }) => {
    if (mainWindow) {
      mainWindow.setSize(width || FIXED_WIDTH, height || FIXED_HEIGHT);
    }
  });

  ipcMain.on('set-window-position', (event, { x, y, width, height }) => {
    if (mainWindow) {
      const currentBounds = mainWindow.getBounds();
      const w = width || currentBounds.width;
      const h = height || currentBounds.height;

      mainWindow.setBounds({
        x: Math.round(x),
        y: Math.round(y),
        width: w,
        height: h
      });
    }
  });

  ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win?.setIgnoreMouseEvents(ignore, options);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
