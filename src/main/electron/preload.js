const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
    quit: () => ipcRenderer.send('desktop:quit'),
    restart: () => ipcRenderer.send('desktop:restart'),
    getLogPath: () => ipcRenderer.invoke('desktop:get-log-path'),
});
