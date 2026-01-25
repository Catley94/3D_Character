const { app, BrowserWindow, ipcMain, Tray, Menu, screen } = require('electron');
const path = require('path');

let mainWindow;
let tray;
let isDev = process.argv.includes('--dev');
const FIXED_WIDTH = 350;
const FIXED_HEIGHT = 450;

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

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

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

function createTray() {
  // Use a simple tray icon (we'll create this later)
  const iconPath = path.join(__dirname, '../../assets/tray-icon.png');

  try {
    tray = new Tray(iconPath);
  } catch (e) {
    // Fallback: create tray without icon if not found
    console.log('Tray icon not found, using default');
    return;
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Character',
      click: () => mainWindow.show()
    },
    {
      label: 'Settings',
      click: () => mainWindow.webContents.send('open-settings')
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

// IPC Handlers for AI communication
ipcMain.handle('send-message', async (event, { message, config }) => {
  const fs = require('fs');
  const logPath = path.join(__dirname, '../../conversation_log.txt');

  // Log the user message
  const timestamp = new Date().toISOString();
  fs.appendFileSync(logPath, `\n[${timestamp}] USER: ${message}\n`);

  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');

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
  } catch (error) {
    console.error('AI Error:', error);
    fs.appendFileSync(logPath, `[${timestamp}] AI ERROR: ${error.message}\n[${timestamp}] FULL ERROR: ${JSON.stringify(error, null, 2)}\n`);
    return { error: error.message };
  }
});

function buildSystemPrompt(personality, characterName) {
  const traits = personality || ['helpful', 'quirky', 'playful'];
  return `You are ${characterName || 'Foxy'}, a cute and adorable AI companion that lives on the user's desktop.
Your personality traits are: ${traits.join(', ')}.
Keep responses SHORT (1-3 sentences max) since they appear in a small speech bubble.
Be expressive and use occasional emojis to convey emotion.
You were just poked/clicked by the user, so you might react to that playfully.`;
}

// Save and load config
ipcMain.handle('save-config', async (event, config) => {
  const fs = require('fs');
  const configPath = path.join(app.getPath('userData'), 'config.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  return { success: true };
});

ipcMain.handle('load-config', async () => {
  const fs = require('fs');
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
  createTray();

  // Handle window dragging - Using absolute position approach
  // WORKAROUND: On Linux with transparent windows, normal setPosition causes issues



  // Get current window bounds (for calculating initial position on drag start)
  ipcMain.handle('get-window-bounds', () => {
    if (mainWindow) {
      return mainWindow.getBounds();
    }
    return { x: 0, y: 0, width: FIXED_WIDTH, height: FIXED_HEIGHT };
  });

  // Set window size dynamically based on content
  ipcMain.on('set-window-size', (event, { width, height }) => {
    if (mainWindow) {
      mainWindow.setSize(width || FIXED_WIDTH, height || FIXED_HEIGHT);
    }
  });

  // Set window to absolute position (maintaining CURRENT size OR explicit size)
  ipcMain.on('set-window-position', (event, { x, y, width, height }) => {
    if (mainWindow) {
      // Use passed dimensions if available (prevent growth bug), else current bounds
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
