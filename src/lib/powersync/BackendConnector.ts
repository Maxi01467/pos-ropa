import { PowerSyncBackendConnector, AbstractPowerSyncDatabase } from '@powersync/web';
import { getTerminalRequestHeaders } from '@/lib/terminal/terminal-headers';

export class BackendConnector implements PowerSyncBackendConnector {
  /**
   * Obtiene un token JWT desde nuestro backend Next.js para verificar
   * que el dispositivo está autorizado a conectarse al motor PowerSync.
   */
  async fetchCredentials() {
    const terminalHeaders = await getTerminalRequestHeaders();
    const response = await fetch('/api/powersync/auth', {
      cache: 'no-store',
      headers: terminalHeaders,
    });
    
    if (!response.ok) {
      const bodyText = await response.text();
      console.error('[POWERSYNC][AUTH] error', response.status, bodyText);
      throw new Error(`Could not fetch PowerSync credentials: ${response.statusText}`);
    }
    
    const body = await response.json();
    return {
      endpoint: body.endpoint,       // La URL de PowerSync (ej. https://xxx.powersync.com)
      token: body.token,             // El token firmado por tu backend
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined
    };
  }

  /**
   * Este método es llamado mágicamente por PowerSync cuando detecta que
   * volviste a tener internet y tienes ventas/cambios locales pendientes de subir.
   */
  async uploadData(database: AbstractPowerSyncDatabase) {
    let transaction = await database.getNextCrudTransaction();
    if (!transaction) {
      return;
    }

    try {
      while (transaction) {
        const operations = transaction.crud;
        const terminalHeaders = await getTerminalRequestHeaders();
        const response = await fetch('/api/powersync/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...terminalHeaders,
          },
          body: JSON.stringify(operations),
        });

        if (!response.ok) {
          const errText = await response.text();
          console.error(
            `[SYNC ERROR API] Batch size=${operations.length} Response:`,
            errText
          );
          throw new Error(
            `Fallo al sincronizar lote offline (${operations.length} operaciones). Details: ${errText}`
          );
        }

        await transaction.complete();

        if (!transaction.haveMore) {
          break;
        }

        transaction = await database.getNextCrudTransaction();
      }
    } catch (error) {
      console.error("Error subiendo datos offline a Next.js:", error);
      throw error;
    }
  }
}
