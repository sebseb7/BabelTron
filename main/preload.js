const { contextBridge, ipcRenderer } = require('electron');

// Expose logging utility
const logger = {
  log: (message, data) => ipcRenderer.send('renderer:log', { level: 'log', message, data }),
  info: (message, data) => ipcRenderer.send('renderer:log', { level: 'info', message, data }),
  warn: (message, data) => ipcRenderer.send('renderer:log', { level: 'warn', message, data }),
  error: (message, data) => ipcRenderer.send('renderer:log', { level: 'error', message, data }),
};

contextBridge.exposeInMainWorld('electronAPI', {
  // --- Settings --- 
  getApiKey: () => ipcRenderer.invoke('settings:get-api-key'),
  setApiKey: (apiKey) => ipcRenderer.invoke('settings:set-api-key', apiKey),
  getAudioDevice: () => ipcRenderer.invoke('settings:get-audio-device'),
  setAudioDevice: (deviceId) => ipcRenderer.invoke('settings:set-audio-device', deviceId),
  getTtsModel: () => ipcRenderer.invoke('settings:get-tts-model'),
  setTtsModel: (model) => ipcRenderer.invoke('settings:set-tts-model', model),
  getTranscribeModel: () => ipcRenderer.invoke('settings:get-transcribe-model'),
  setTranscribeModel: (model) => ipcRenderer.invoke('settings:set-transcribe-model', model),
  
  // --- OpenAI --- 
  transcribeAudio: (audioDataArrayBuffer) => ipcRenderer.invoke('openai:transcribe', audioDataArrayBuffer),
  detectLanguage: (text) => ipcRenderer.invoke('openai:detect-language', text),
  translateText: (text, sourceLangCode, targetLangCode) => ipcRenderer.invoke('openai:translate', text, sourceLangCode, targetLangCode),
  synthesizeSpeech: (text, languageCode) => ipcRenderer.invoke('openai:tts', text, languageCode),

  // --- Logging ---
  logger: logger,

  // Example: Handle message back from main if needed
  // handleUpdate: (callback) => ipcRenderer.on('update-counter', (_event, value) => callback(value))
});

// Override console methods to also send to main process
const originalConsole = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error
};

// Replace console methods to also send to main process
console.log = (...args) => {
  originalConsole.log(...args);
  if (args.length > 0) logger.log(args[0], args.slice(1));
};

console.info = (...args) => {
  originalConsole.info(...args);
  if (args.length > 0) logger.info(args[0], args.slice(1));
};

console.warn = (...args) => {
  originalConsole.warn(...args);
  if (args.length > 0) logger.warn(args[0], args.slice(1));
};

console.error = (...args) => {
  originalConsole.error(...args);
  if (args.length > 0) logger.error(args[0], args.slice(1));
};

console.log('Preload script loaded.'); 