import { PowerSyncDatabase } from '@powersync/web';
import { AppSchema } from './AppSchema';
import { BackendConnector } from './BackendConnector';

declare global {
  var _powersync_db: PowerSyncDatabase | undefined;
  var _powersync_backend_connector: BackendConnector | undefined;
  var _powersync_initPromise: Promise<void> | null | undefined;
}

export const db: PowerSyncDatabase = globalThis._powersync_db || new PowerSyncDatabase({
  schema: AppSchema,
  database: {
    // Nombre nuevo para no reusar un IndexedDB potencialmente roto de pruebas previas.
    dbFilename: 'pos_ropa_local_v2.db',
  },
  flags: {
    // En dev/HMR, el worker de SQLite mete bastante ruido y estados duplicados.
    useWebWorker: false,
    disableSSRWarning: true,
    enableMultiTabs: false,
  },
});

// El conector que hemos creado para autorizar y escribir datos
export const backendConnector = globalThis._powersync_backend_connector || new BackendConnector();

if (process.env.NODE_ENV !== 'production') {
  globalThis._powersync_db = db;
  globalThis._powersync_backend_connector = backendConnector;
}

let statusListenerRegistered = false;

function ensureStatusLogging() {
  if (statusListenerRegistered) {
    return;
  }

  statusListenerRegistered = true;
  db.registerListener({});
}

export const initPowerSync = async () => {
  if (globalThis._powersync_initPromise) return globalThis._powersync_initPromise;

  const initPromise = (async () => {
    try {
      ensureStatusLogging();
      await db.init();
      await db.connect(backendConnector);
    } catch (err) {
      console.error("[POWERSYNC] Error crítico en initPowerSync:", err);
      globalThis._powersync_initPromise = null;
      throw err;
    }
  })();

  globalThis._powersync_initPromise = initPromise;
  return initPromise;
};
