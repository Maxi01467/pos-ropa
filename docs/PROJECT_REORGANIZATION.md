# Reorganizacion del Proyecto

## Objetivo

Se reorganizo la estructura del proyecto para que el codigo quede mas facil de leer, mantener y extender.

Los criterios usados fueron:

- agrupar archivos por responsabilidad
- separar mejor layout, impresion, terminal, auth y utilidades base
- dejar la documentacion fuera de la raiz
- mover datasets/manuales de migracion a una carpeta dedicada
- eliminar archivos de prueba, parches temporales y logs que ya no aportaban valor

---

## Nueva Estructura

### Documentacion

Los documentos tecnicos pasaron a `docs/`:

- `docs/COLD_START_OFFLINE_PLAN.md`
- `docs/MODELO_B_OFFLINE_CONFLICTS.md`
- `docs/OFFLINE_MIGRATION_NOTES.md`

---

### Datos de migracion

Los archivos de datos/manuales se concentraron en `data-migration/`:

- `data-migration/productos.json`
- `data-migration/productsviejos.json`
- `data-migration/codigobarras.json`
- `data-migration/productosdefinitivo.json`

Ademas, `prisma/migrate-productos.ts` fue ajustado para leer desde esta carpeta.

---

### `src/lib`

Se dividio `src/lib` en carpetas mas claras:

- `src/lib/auth/`
  - `auth.ts`
  - `auth-core.ts`

- `src/lib/core/`
  - `cache-tags.ts`
  - `permissions.ts`
  - `pos-palette.ts`
  - `utils.ts`

- `src/lib/printing/`
  - `barcodes.ts`
  - `desktop-print.ts`
  - `printing.ts`
  - `receipt-printing.ts`

- `src/lib/session/`
  - `cash-session-client.ts`
  - `session-client.ts`

- `src/lib/terminal/`
  - `terminal-client.ts`
  - `tickets.ts`

- `src/lib/pwa/`
  - `pwa-icon.tsx`

- `src/lib/sync/`
  - `data-sync-client.ts`

Se dejaron igual, porque ya estaban bien agrupadas:

- `src/lib/offline/`
- `src/lib/powersync/`

---

### `src/components`

Se separaron los componentes por tipo:

- `src/components/layout/`
  - `app-header.tsx`
  - `pos-layout-client.tsx`
  - `powersync-provider.tsx`
  - `pwa-register.tsx`
  - `route-guard.tsx`
  - `sidebar.tsx`
  - `theme-provider.tsx`

- `src/components/printing/`
  - `barcode-labels.tsx`
  - `ticket-receipt.tsx`

- `src/components/sales/`
  - `checkout-dialog.tsx`

Se mantuvo igual:

- `src/components/ui/`

---

### `src/app/actions`

Las server actions se agruparon por dominio:

- `src/app/actions/attendance/attendance-actions.ts`
- `src/app/actions/auth/auth-actions.ts`
- `src/app/actions/cash/cash-actions.ts`
- `src/app/actions/employees/employee-actions.ts`
- `src/app/actions/inventory/inventory-actions.ts`
- `src/app/actions/pos/pos-actions.ts`
- `src/app/actions/sales/sales-actions.ts`
- `src/app/actions/stock/stock-actions.ts`
- `src/app/actions/suppliers/supplier-actions.ts`
- `src/app/actions/terminal/terminal-actions.ts`

---

## Archivos Eliminados

### Eliminados por no usarse en el sistema actual

- `src/lib/mock-data.ts`
- `src/lib/offline/reports-runtime.ts`
- `src/app/actions/test-caja.ts`

### Logs temporales eliminados

- `server.log`
- `server2.log`

### Scripts manuales / temporales eliminados

- `clear-caja.ts`
- `create-user.js`
- `fix-migration.js`
- `fix-to-ticket.js`
- `patch-sidebar.js`
- `patch_schema.js`
- `test-barcode.js`
- `test-prisma.cjs`
- `test-prisma.ts`
- `test.js`
- `update-caches.js`

### Archivos de datos basura o sin uso real

- `migracion/baddsdsdsd.json`

---

## Ajustes Tecnicos Hechos Durante la Reorganizacion

Ademas del movimiento de archivos, se hicieron estos ajustes para dejar el proyecto consistente:

- se actualizaron imports en `src/app`, `src/components`, `src/lib`, `middleware.ts` y scripts de Prisma
- se corrigio `prisma/migrate-productos.ts` para usar `data-migration/`
- se ajusto `src/lib/core/cache-tags.ts` para mantener compatibilidad de tipos con `unstable_cache`
- se limpio un warning por import no usado en `src/components/layout/sidebar.tsx`

---

## Que No Se Reorganizo

Estas zonas se mantuvieron igual porque ya tenian una separacion razonable:

- `src/app/(pos)/`
- `src/lib/offline/`
- `src/lib/powersync/`
- `src/components/ui/`
- `electron/`
- `prisma/`

---

## Resultado

Despues de esta reorganizacion:

- la raiz del repo quedo mas limpia
- es mas facil ubicar responsabilidades del sistema
- los imports reflejan mejor el dominio de cada archivo
- los archivos temporales y basura salieron del proyecto
- el proyecto sigue compilando correctamente

Validacion realizada:

- `npx tsc --noEmit`
- `npx eslint src/app src/components src/lib prisma middleware.ts`
