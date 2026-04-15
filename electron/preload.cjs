const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("posDesktop", {
    isAvailable: () => ipcRenderer.invoke("pos-desktop:is-available"),
    printHtml: (payload) => ipcRenderer.invoke("pos-desktop:print-html", payload),
});
