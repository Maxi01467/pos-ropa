'use client';

import { PowerSyncContext } from '@powersync/react';
import { useEffect, useState } from 'react';
import { db, initPowerSync } from '@/lib/powersync/db';
import { isOfflineModeEnabled } from '@/lib/offline-config';
import { refreshOfflineBootstrapState } from '@/lib/offline/offline-bootstrap';
import { Loader2 } from 'lucide-react';

export function PowerSyncProvider({ children }: { children: React.ReactNode }) {
  const offlineEnabled = isOfflineModeEnabled();
  const [initialized, setInitialized] = useState(() => !offlineEnabled);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!offlineEnabled) {
      return;
    }

    let isMounted = true;

    const refreshBootstrap = () => {
      void refreshOfflineBootstrapState().catch((bootstrapError) => {
        console.warn("No se pudo refrescar el estado de bootstrap offline", bootstrapError);
      });
    };

    initPowerSync()
      .then(() => {
        if (isMounted) {
          setInitialized(true);
        }
        refreshBootstrap();
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Error inicializando base de datos local (Offline)', err);
          setError(err);
        }
      });

    window.addEventListener("online", refreshBootstrap);
    window.addEventListener("offline", refreshBootstrap);
      
    // Cleanup: En React Strict Mode o HMR esto evita montar múltiples conexiones web socket
    return () => {
      isMounted = false;
      window.removeEventListener("online", refreshBootstrap);
      window.removeEventListener("offline", refreshBootstrap);
      // No desconectar db brutalmente si compartimos global singleton, pero previene setState
    };
  }, [offlineEnabled]);

  if (!offlineEnabled) {
    return <>{children}</>;
  }

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center p-4">
        <h1 className="text-xl font-bold text-destructive mb-2">Error Crítico Offline</h1>
        <p className="text-center text-muted-foreground">
          No se pudo crear la base de datos local SQLite: {error.message}
        </p>
      </div>
    );
  }

  if (!initialized) {
    return (
      <div className="flex h-screen flex-col items-center justify-center">
        <Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" />
        <p className="mt-4 text-sm text-muted-foreground animate-pulse">
          Inicializando base de datos local...
        </p>
      </div>
    );
  }

  return (
    <PowerSyncContext.Provider value={db}>
      {children}
    </PowerSyncContext.Provider>
  );
}
