/* eslint-disable @typescript-eslint/no-require-imports */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("posDesktop", {
    isAvailable: () => ipcRenderer.invoke("pos-desktop:is-available"),
    printHtml: (payload) => ipcRenderer.invoke("pos-desktop:print-html", payload),
    getTerminalConfig: () => ipcRenderer.invoke("pos-desktop:get-terminal-config"),
    setTerminalConfig: (payload) => ipcRenderer.invoke("pos-desktop:set-terminal-config", payload),
    resetTerminalConfig: () => ipcRenderer.invoke("pos-desktop:reset-terminal-config"),
    checkForUpdates: () => ipcRenderer.invoke("pos-desktop:check-for-updates"),
    installUpdate: () => ipcRenderer.invoke("pos-desktop:install-update"),
    getAppVersion: () => ipcRenderer.invoke("pos-desktop:get-app-version"),
    getUpdateStatus: () => ipcRenderer.invoke("pos-desktop:get-update-status"),
    onUpdateStatus: (callback) => {
        const handler = (_event, data) => callback(data);
        ipcRenderer.on("pos-desktop:update-status", handler);
        return () => ipcRenderer.removeListener("pos-desktop:update-status", handler);
    },
});
