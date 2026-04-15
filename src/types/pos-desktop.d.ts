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
        };
    }
}
