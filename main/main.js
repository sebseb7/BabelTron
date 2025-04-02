const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// --- Dynamic Import electron-store --- 
let store;

async function initializeStore() {
  if (!store) {
    try {
      const { default: Store } = await import('electron-store');
      store = new Store();
      console.log('Electron Store initialized successfully.');
    } catch (error) {
      console.error('Failed to dynamically import or initialize electron-store:', error);
      // Handle the error appropriately - maybe quit the app or disable features
      // For now, we'll just log it.
    }
  }
  return store; // Return the initialized store instance
}

// --- Initialize store before setting up IPC handlers that need it ---
async function setupIpcHandlers() {
  const store = await initializeStore();
  if (!store) {
    console.error('Store initialization failed, some IPC handlers may not work.');
    // Decide how to handle this - perhaps return early or disable handlers
  }

  // --- IPC Handlers ---

  // Add a dedicated channel for renderer-to-main logging
  ipcMain.on('renderer:log', (event, { level, message, data }) => {
    const levels = ['debug', 'log', 'info', 'warn', 'error'];
    const prefix = data ? `[Renderer:${data.split('/').pop()}:${data.split(':')[1]}]` : '[Renderer]';
    
    switch (level) {
      case 0: // debug
        console.debug(`${prefix} ${message}`);
        break;
      case 1: // log
        console.log(`${prefix} ${message}`);
        break;
      case 2: // info
        console.info(`${prefix} ${message}`);
        break;
      case 3: // warn
        console.warn(`${prefix} ${message}`);
        break;
      case 4: // error
        console.error(`${prefix} ${message}`);
        break;
      default:
        console.log(`${prefix} [${levels[level] || level}] ${message}`);
    }
  });

  // Settings using store (ensure store is available)
  ipcMain.handle('settings:get-api-key', async () => {
    if (!store) return ''; // Handle case where store failed to load
    return store.get('openai-api-key', '');
  });
  ipcMain.handle('settings:set-api-key', async (event, apiKey) => {
    if (!store) return { success: false, error: 'Store not initialized' };
    store.set('openai-api-key', apiKey);
    console.log('API Key updated (storage)');
    return { success: true };
  });

  // --- TTS Model Storage Handlers --- 
  ipcMain.handle('settings:get-tts-model', async () => {
    if (!store) return 'tts-1-hd'; 
    return store.get('tts-model', 'tts-1-hd');
  });
  ipcMain.handle('settings:set-tts-model', async (event, model) => {
    if (!store) return { success: false, error: 'Store not initialized' };
    store.set('tts-model', model);
    console.log('TTS Model saved:', model);
    return { success: true };
  });
  // ----------------------------------------

  // --- Transcribe Model Storage Handlers --- 
  ipcMain.handle('settings:get-transcribe-model', async () => {
    if (!store) return 'whisper-1'; 
    return store.get('transcribe-model', 'whisper-1');
  });
  ipcMain.handle('settings:set-transcribe-model', async (event, model) => {
    if (!store) return { success: false, error: 'Store not initialized' };
    store.set('transcribe-model', model);
    console.log('Transcribe Model saved:', model);
    return { success: true };
  });
  // ----------------------------------------

  // --- Audio Device Storage Handlers --- 
  ipcMain.handle('settings:get-audio-device', async () => {
    if (!store) return ''; 
    return store.get('audio-device-id', '');
  });
  ipcMain.handle('settings:set-audio-device', async (event, deviceId) => {
    if (!store) return { success: false, error: 'Store not initialized' };
    store.set('audio-device-id', deviceId);
    console.log('Audio Device ID saved:', deviceId);
    return { success: true };
  });
  // ----------------------------------------

  // OpenAI handlers using store
  ipcMain.handle('openai:transcribe', async (event, audioDataArrayBuffer) => {
    if (!store) return { error: 'Store not initialized' };
    // ... rest of transcribe logic using store.get('openai-api-key') etc.
    const apiKey = store.get('openai-api-key');
    // ... (keep existing transcribe logic below)
    if (!apiKey) {
      return { error: 'API key not set.' };
    }
    if (!audioDataArrayBuffer || audioDataArrayBuffer.byteLength === 0) {
      return { error: 'No audio data received.' };
    }

    try {
      const openai = new OpenAI({ apiKey });
      const transcribeModel = store.get('transcribe-model', 'whisper-1');
      console.log(`Using transcription model: ${transcribeModel}`);
      const audioBuffer = Buffer.from(audioDataArrayBuffer);
      let fileName, mimeType;
      if (transcribeModel.includes('gpt-4o')) {
        fileName = 'audio.webm';
        mimeType = 'audio/webm';
        console.log('Using webm format for GPT-4o model');
      } else {
        fileName = 'audio.mp3';
        mimeType = 'audio/mp3';
        console.log('Using mp3 format for non-GPT-4o model');
      }
      const file = await toFile(audioBuffer, fileName, { type: mimeType });
      console.log(`Sending audio file (${mimeType}) to OpenAI API...`);
      const response = await openai.audio.transcriptions.create({
        model: transcribeModel,
        file: file,
      });
      console.log('Transcription response:', response);
      return { transcription: response.text };
    } catch (error) {
      console.error('Transcription API error:', error);
      return { error: error.message || 'Transcription failed.' };
    }
  });

  ipcMain.handle('openai:detect-language', async (event, text) => {
    if (!store) return { error: 'Store not initialized' };
    // ... rest of detect logic using store.get('openai-api-key')
    const apiKey = store.get('openai-api-key');
    // ... (keep existing detect logic below)
    if (!apiKey) {
      return { error: 'API key not set.' };
    }
    if (!text || text.trim().length === 0) {
      return { error: 'No text provided for language detection.' };
    }

    try {
      const openai = new OpenAI({ apiKey });
      console.log('Sending text to GPT for language detection (JSON mode)...');
      const systemPrompt = `You are a helpful assistant designed to output JSON.\nIdentify the primary language of the following text.\nRespond with a JSON object containing a single key \"languageCode\"\nwhose value is the ISO 639-1 code for the identified language\n(e.g., \"en\" for English, \"es\" for Spanish, \"ja\" for Japanese).\nIf the language cannot be determined, use \"und\" (Undetermined).`;
      const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" }, 
          messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: text }
          ],
          max_tokens: 20, 
          temperature: 0.1, 
      });
      console.log('Language detection JSON response content:', response.choices[0]?.message?.content);
      let languageCode = 'und'; 
      try {
          if (response.choices[0]?.message?.content) {
              const jsonResponse = JSON.parse(response.choices[0].message.content);
              languageCode = jsonResponse.languageCode || 'und';
          }
      } catch (parseError) {
          console.error('Failed to parse language detection JSON response:', parseError);
      }
      return { languageCode: languageCode }; 
    } catch (error) {
      console.error('Language detection error:', error);
      return { error: error.message || 'Language detection failed.' }; 
    }
  });

  ipcMain.handle('openai:translate', async (event, text, sourceLangCode, targetLangCode) => {
    if (!store) return { error: 'Store not initialized' };
    // ... rest of translate logic using store.get('openai-api-key')
    const apiKey = store.get('openai-api-key');
    // ... (keep existing translate logic below)
    if (!apiKey) {
      return { error: 'API key not set.' };
    }
    if (!text || !sourceLangCode || !targetLangCode || sourceLangCode === targetLangCode) {
      return { error: 'Missing text, source/target language, or languages are the same.' };
    }

    try {
      const openai = new OpenAI({ apiKey });
      console.log(`Sending text for translation from ${sourceLangCode} to ${targetLangCode}...`);
      const sourceLangName = LANGUAGES[sourceLangCode] || sourceLangCode;
      const targetLangName = LANGUAGES[targetLangCode] || targetLangCode;
      const systemPrompt = `You are a helpful assistant. Translate the following text accurately from ${sourceLangName} to ${targetLangName}. Output only the translated text.`;
      const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: text }
          ],
          temperature: 0.3,
      });
      console.log('Translation response:', response);
      const translatedText = response.choices[0]?.message?.content?.trim() || '';
      return { translation: translatedText };
    } catch (error) {
      console.error('Translation error:', error);
      return { error: error.message || 'Translation failed.' };
    }
  });

  ipcMain.handle('openai:tts', async (event, text, languageCode) => {
    if (!store) return { error: 'Store not initialized' };
    // ... rest of tts logic using store.get('openai-api-key') etc.
    const apiKey = store.get('openai-api-key');
    const ttsModel = store.get('tts-model', 'tts-1-hd');
    // ... (keep existing tts logic below)
    if (!apiKey) {
      return { error: 'API key not set.' };
    }
    if (!text || text.trim().length === 0) {
      return { error: 'No text provided for speech synthesis.' };
    }

    try {
      const openai = new OpenAI({ apiKey });
      console.log(`Sending text for speech synthesis - Using model: ${ttsModel}, Language code: "${languageCode || 'not provided'}"`);
      const languageName = languageCode && LANGUAGES[languageCode] 
                          ? LANGUAGES[languageCode] 
                          : 'the appropriate language';
      const instructions = `Speak in ${languageName}`;
      const response = await openai.audio.speech.create({
          model: ttsModel,
          input: text,
          voice: "onyx",
          response_format: "mp3",
          instructions: instructions,
      });
      console.log('TTS response received (type):', response.headers.get('content-type'));
      const audioArrayBuffer = await response.arrayBuffer();
      return { audioData: audioArrayBuffer };
    } catch (error) {
      console.error('TTS error:', error);
      return { error: error.message || 'Speech synthesis failed.' };
    }
  });
  // ---------------------
}

// Global error handlers for the main process
process.on('uncaughtException', (error) => {
  console.error('[Main] Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Main] Unhandled Promise Rejection:', reason);
});

function createWindow () {
  const mainWindow = new BrowserWindow({
    width: 950,
    height: 950,
    resizable: false, // Make the window non-resizable
    // icon: path.join(__dirname, '../assets/icon.png'), // Uncomment when you have the icon
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), // Re-enabled preload script
      nodeIntegration: false, // Keep disabled for security
      contextIsolation: true, // Explicitly true (default, but good practice)
      webSecurity: process.env.NODE_ENV !== 'development' // Keep this or adjust as needed
    }
  });

  // Forward console logs from renderer to main process terminal
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    const levels = ['debug', 'log', 'info', 'warn', 'error'];
    const prefix = sourceId ? `[Renderer:${sourceId.split('/').pop()}:${line}]` : '[Renderer]';
    
    switch (level) {
      case 0: // debug
        console.debug(`${prefix} ${message}`);
        break;
      case 1: // log
        console.log(`${prefix} ${message}`);
        break;
      case 2: // info
        console.info(`${prefix} ${message}`);
        break;
      case 3: // warn
        console.warn(`${prefix} ${message}`);
        break;
      case 4: // error
        console.error(`${prefix} ${message}`);
        break;
      default:
        console.log(`${prefix} [${levels[level] || level}] ${message}`);
    }
  });

  // Capture uncaught errors and exceptions from renderer
  mainWindow.webContents.on('crashed', () => {
    console.error('[Renderer] WebContents crashed');
  });

  mainWindow.on('unresponsive', () => {
    console.error('[Renderer] Window became unresponsive');
  });

  // Remove menu bar in production
  if (app.isPackaged) {
    mainWindow.removeMenu();
    console.log('Removed menu bar for packaged app.');
  }

  // Load index.html generated by Webpack
  // Use loadFile for development, loadURL for production build with file protocol
  // mainWindow.loadFile(path.join(__dirname, '../renderer/index.html')); // Old path
  if (process.env.NODE_ENV === 'development') {
    // In development, load from the webpack dev server or watcher output
    // Use loadFile assuming webpack watch outputs to renderer/dist
    mainWindow.loadFile(path.join(__dirname, '../renderer/dist/index.html')); 
  } else {
    // In production, load the bundled HTML file from within app.asar
    // Path relative to main.js (which is in app.asar/main)
    mainWindow.loadFile(path.join(__dirname, '../renderer/dist/index.html'));
  }

  // Open DevTools in development mode
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => { // Make the handler async
  await setupIpcHandlers(); // Wait for handlers (and store) to be ready
  createWindow();

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Ensure OpenAI and other requires are still available where needed
// If they are only used within IPC handlers, they can stay there.
// If needed elsewhere, ensure they are required appropriately.
const { OpenAI } = require("openai");
const { toFile } = require("openai/uploads");
const { LANGUAGES } = require("../renderer/src/languages"); 