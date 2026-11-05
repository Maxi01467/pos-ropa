export {};

export type DesktopUpdateStatus = {
    status: "idle" | "checking" | "available" | "downloading" | "ready-to-install" | "not-available" | "error";
    percent?: number;
    version?: string | null;
    currentVersion?: string | null;
    message?: string | null;
};

declare global {
    interface Window {
        posDesktop?: {
            isAvailable: () => Promise<boolean>;
            printHtml: (payload: {
                html: string;
                jobName: string;
                printerName?: string | null;
            }) => Promise<{
                printerName: string;
            }>;
            getTerminalConfig: () => Promise<{
                deviceId: string;
                terminalId: string | null;
                terminalPrefix: string | null;
                terminalName: string | null;
            }>;
            setTerminalConfig: (payload: {
                deviceId?: string;
                terminalId: string;
                terminalPrefix: string;
                terminalName: string;
            }) => Promise<{
                deviceId: string;
                terminalId: string | null;
                terminalPrefix: string | null;
                terminalName: string | null;
            }>;
            resetTerminalConfig: () => Promise<void>;
            checkForUpdates: () => Promise<{
                updateAvailable: boolean;
                currentVersion?: string;
                version: string | null;
            }>;
            installUpdate?: () => Promise<void>;
            getAppVersion?: () => Promise<string>;
            getUpdateStatus?: () => Promise<DesktopUpdateStatus>;
            onUpdateStatus?: (callback: (status: DesktopUpdateStatus) => void) => () => void;
        };
    }
}
