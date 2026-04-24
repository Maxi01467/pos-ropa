export {};

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
        };
    }
}
