/* eslint-disable @typescript-eslint/no-require-imports */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("posDesktop", {
    isAvailable: () => ipcRenderer.invoke("pos-desktop:is-available"),
    printHtml: (payload) => ipcRenderer.invoke("pos-desktop:print-html", payload),
    getTerminalConfig: () => ipcRenderer.invoke("pos-desktop:get-terminal-config"),
    setTerminalConfig: (payload) => ipcRenderer.invoke("pos-desktop:set-terminal-config", payload),
    resetTerminalConfig: () => ipcRenderer.invoke("pos-desktop:reset-terminal-config"),
});
