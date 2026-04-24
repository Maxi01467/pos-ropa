# Documentación: Migración a Arquitectura Offline (Local-First)

## Estado Actual
**Pausado y revertido en producción.**
Todo el código y los avances de la integración están guardados de forma segura en la rama de Git: `feature/offline`.

## Resumen de la Situación
Durante la implementación del modo Offline-First utilizando **PowerSync** y **SQLite local**, se modificó el esquema de la base de datos principal (Supabase).
El cambio más crítico fue cambiar el campo `ticketNumber` de la tabla `Sale` de `Int` (Autoincremental) a `String` (para permitir la generación de tickets offline con un prefijo de terminal, ej. "TERM1-154").

**Motivo de la reversión:**
Este cambio en el tipo de dato rompió la compatibilidad con una PC que ejecuta una versión antigua/legada del sistema POS. Para no detener la operación comercial, se revirtió la base de datos a su estado original (tickets numéricos) y se regresó el código a la rama `develop`.

---

## Avances Logrados (Guardados en `feature/offline`)

1. **Configuración de Dependencias:**
   - Se instalaron `@powersync/web`, `@powersync/react`, `@journeyapps/wa-sqlite` y `jose` (para la firma de tokens).

2. **Esquema de Base de Datos (Prisma):**
   - Se añadieron los campos obligatorios para PowerSync: `deletedAt` y `updatedAt` en todas las tablas principales.
   - `ticketNumber` se cambió a `String`.

3. **Estructura de PowerSync Creada (`src/lib/powersync/`):**
   - `AppSchema.ts`: Definición del esquema local de SQLite para PowerSync.
   - `BackendConnector.ts`: Lógica de sincronización de subida (PUT/PATCH/DELETE) usando Prisma Server Actions.
   - `db.ts`: Instancia del cliente PowerSync.

4. **Autenticación PowerSync (`src/app/api/powersync/`):**
   - Se generó el endpoint `/api/powersync/auth` para emitir JWTs firmados y permitir que PowerSync descargue los datos de Supabase.

5. **Actualización de la UI:**
   - Se corrigieron todos los conflictos de TypeScript en `src/app/(pos)/nueva-venta/page.tsx`, `checkout-dialog.tsx`, acciones e impresión para que soportaran `ticketNumber` como `String`.
   - Se añadió el `<PowerSyncProvider>` en el Layout principal.

---

## Cambios Realizados Ahora Para Mantener Compatibilidad

Como todavía **no** se quiere aplicar la migración de Prisma ni romper el sistema viejo en producción, en esta rama se dejó lo siguiente:

1. **Compatibilidad restaurada con producción actual:**
   - `ticketNumber` volvió a `Int` en `prisma/schema.prisma`.
   - Se retiraron del esquema activo los campos `deletedAt` y `updatedAt` que todavía no pueden exigirse en producción.
   - Se eliminó la generación experimental de tickets string por prefijo.

2. **PowerSync sigue presente, pero apagado por defecto:**
   - Se mantuvieron `src/lib/powersync/`, `src/app/api/powersync/auth/route.ts` y `src/app/api/powersync/sync/route.ts`.
   - La inicialización de PowerSync quedó protegida por flag para que la app no intente arrancar SQLite/PowerSync en todos los entornos.
   - Si PowerSync está deshabilitado, el provider no hace nada y los endpoints responden como feature no disponible.

3. **Configuración centralizada de offline:**
   - Se agregó `src/lib/offline-config.ts` para manejar los flags y variables de entorno.
   - Flag principal:
     - `NEXT_PUBLIC_POWERSYNC_ENABLED=1`

4. **Preparación para seguir con la implementación local-first sin migrar Prisma todavía:**
   - Se empezó a separar la lectura de datos del POS detrás de una capa de abstracción para que en el futuro pueda leer desde servidor o desde SQLite/PowerSync sin reescribir toda la UI.
   - Se agregó `src/lib/offline/pos-runtime-data.ts` para encapsular lecturas del POS.
   - `src/app/(pos)/nueva-venta/page.tsx` ya consume esa capa para catálogo, vendedores e historial de ventas.
   - Cuando PowerSync está habilitado, esa capa intenta leer desde SQLite local y hace fallback a servidor si la base local todavía no está lista.
   - Se agregó `src/lib/offline/pos-runtime-mutations.ts` para encapsular mutaciones del POS.
   - La venta simple (`createSale`) ya tiene una implementación preliminar local en SQLite/PowerSync con boleta provisoria reservada y descuento de stock local.
   - El flujo de `cambio` (`createExchangeSale`) ya tiene implementación local preliminar:
     - actualiza `returnedQuantity`
     - devuelve stock de los productos cambiados
     - registra la nueva venta local
     - vuelve a descontar stock por los productos nuevos
   - La `creación rápida de producto` también ya tiene implementación local preliminar:
     - crea `Product`
     - crea `ProductVariant`
     - registra `StockMovement` inicial
   - El POS principal de `nueva-venta` ya opera contra la capa de runtime tanto para lecturas como para mutaciones.
   - Se agregó `src/lib/offline/cash-runtime.ts` para encapsular lecturas y mutaciones de caja.
   - `src/app/(pos)/caja/page.tsx` ya opera contra esa capa runtime.
   - La caja ya tiene implementación local preliminar para:
     - obtener sesión actual
     - abrir caja
     - registrar ingresos/egresos manuales
     - cerrar con arqueo
     - cerrar sin arqueo
   - Se agregó `src/lib/offline/stock-runtime.ts` para encapsular lecturas y movimientos de stock.
   - `src/app/(pos)/stock/page.tsx` ya opera contra esa capa runtime.
   - El módulo de stock ya tiene implementación local preliminar para:
     - obtener productos, proveedores, variantes y movimientos
     - registrar ingresos
     - registrar salidas
     - ajustar stock
   - Se agregó `src/lib/offline/inventory-runtime.ts` para encapsular lecturas y CRUD de inventario.
   - `src/app/(pos)/inventario/page.tsx` ya opera contra esa capa runtime.
   - El módulo de inventario ya tiene implementación local preliminar para:
     - listar productos
     - crear producto
     - editar producto
     - eliminar producto
     - marcar producto revisado
   - Se agregó `src/lib/offline/cash-history-runtime.ts` para encapsular consultas históricas y arqueos diferidos.
   - `src/app/(pos)/boletas/page.tsx` y `src/app/(pos)/arqueos/page.tsx` ya operan contra esa capa runtime.
   - El historial de caja ya puede leerse localmente desde SQLite/PowerSync con fallback a servidor.
   - El arqueo diferido (`submitArqueo`) ya tiene implementación local preliminar.
   - Se agregó `src/lib/offline/reports-runtime.ts` para consolidar reportes desde datos locales.
   - Se recreó `src/app/(pos)/reportes/page.tsx` en esta rama.
   - El módulo de reportes ya puede calcular localmente:
     - productos estrella
     - stock crítico y faltante
     - horas pico de ventas
   - Se agregó `src/lib/offline/suppliers-runtime.ts` para encapsular lectura y CRUD de proveedores.
   - `src/app/(pos)/proveedores/page.tsx` ya opera contra esa capa runtime.
   - El módulo de proveedores ya tiene implementación local preliminar para:
     - listar proveedores
     - crear proveedor
     - editar proveedor
     - eliminar proveedor
   - Se agregó `src/lib/offline/attendance-runtime.ts` para encapsular fichaje y tablero de asistencia.
   - `src/app/(pos)/asistencia/page.tsx` ya opera contra esa capa runtime.
   - El módulo de asistencia ya tiene implementación local preliminar para:
     - listar empleados activos
     - cargar dashboard por empleado
     - cargar tablero del turno según caja abierta
     - marcar entrada
     - marcar salida
   - Se agregó una primera capa de bootstrap offline en `src/lib/offline/offline-bootstrap.ts`.
   - Ese bootstrap ya:
     - persiste estado local de readiness
     - diferencia entre equipo listo para offline y equipo que requiere sync inicial
     - registra metadata básica (`hasSynced`, `minimumDatasetReady`, `activeUsers`, `productCount`, `lastSuccessfulSyncAt`)
   - El bootstrap ya está integrado en:
     - `src/components/powersync-provider.tsx`
     - `src/app/login/page.tsx`
     - `src/components/pos-layout-client.tsx`
     - `src/components/app-header.tsx`
   - Los runtimes críticos ya no hacen fallback silencioso al servidor cuando el equipo está offline y todavía no fue preparado.
   - También se agregó visibilidad del estado offline/sync en el header del sistema.

---

## Cómo retomar el proyecto en el futuro

Cuando decidas volver a implementar el sistema Offline, debes seguir estos pasos para evitar afectar las operaciones:

1. **Estrategia de Actualización Homogénea:**
   Asegúrate de que **TODOS los equipos** (PCs, laptops) estén listos para actualizar a la nueva versión al mismo tiempo. Ninguna versión vieja del sistema que espere `ticketNumber` numérico debe quedar operando.

2. **Recuperar el Código:**
   ```bash
   git checkout feature/offline
   git pull # si hay cambios en remoto
   # o fusionarlo con los últimos cambios de develop:
   git merge develop
   ```

3. **Migrar la Base de Datos:**
   Ejecutar las migraciones de Prisma que añaden los campos `deletedAt`, `updatedAt` y transforman `ticketNumber` a String.
   ```bash
   npx prisma migrate deploy
   ```

   Antes de eso habrá que volver a activar en el código:
   - `ticketNumber` como `String`
   - generación de ticket offline con prefijo de caja/terminal
   - uso real de `deletedAt` y `updatedAt` en los modelos replicados

4. **Configurar Supabase para PowerSync:**
   Recordar que PowerSync requiere **Replicación Lógica PostgreSQL**. Deberás ejecutar en el panel de SQL de Supabase la creación de publicaciones:
   ```sql
   CREATE PUBLICATION powersync FOR TABLE "Product", "Sale", "SaleItem", "CashSession", /* etc */;
   ```
   *Nota: PowerSync se conecta directo a Supabase a través del puerto 5432 (bypass de pooler IPv4).*

5. **Activar PowerSync por configuración:**
   Cuando llegue el momento, definir como mínimo:
   ```env
   NEXT_PUBLIC_POWERSYNC_ENABLED=1
   NEXT_PUBLIC_POWERSYNC_URL=https://tu-instancia.powersync.com
   POWERSYNC_PRIVATE_KEY=BASE64_O_PEM
   POWERSYNC_KID=tu-key-id
   POWERSYNC_JWT_ISSUER=pos-ropa-nextjs
   POWERSYNC_SYNC_SUBJECT=fallback-dev-solamente
   ```

6. **Subject y dataset recomendados para bajar egress:**
   - El `subject` real de PowerSync debe salir de la terminal registrada de la PC y no de un valor fijo compartido.
   - La app ahora envía identidad de terminal al pedir credenciales y el backend firma el JWT con `terminal:<id>`.
   - `POWERSYNC_SYNC_SUBJECT` debe quedar solo como fallback transitorio de desarrollo si todavía no existe terminal registrada.
   - Dataset mínimo offline recomendado:
     - `User`
     - `Product`
     - `ProductVariant`
     - `Supplier`
     - `BarcodeAlias`
     - estado operativo vigente de `CashSession`, `CashMovement`, `Shift`, `Sale` y `SaleItem`
   - Dataset histórico no mínimo:
     - histórico amplio de boletas
     - reportes completos
     - movimientos antiguos de caja/stock
   - Recomendación operativa:
     - limitar la replicación de histórico pesado
     - medir requests a `/api/powersync/sync`, tamaño de lotes y frecuencia de fallback a server actions

---

## Próximo Paso Recomendado

Continuar la implementación **sin tocar todavía Prisma productivo** con esta estrategia:

1. Crear una capa de acceso a datos del POS que permita cambiar entre:
   - servidor actual (Prisma/Supabase)
   - SQLite local con PowerSync

2. Mover primero las **lecturas** a esa abstracción:
   - catálogo de productos
   - vendedores
   - historial de ventas para cambios

3. Luego cubrir también los **módulos administrativos e históricos**:
   - boletas
   - arqueos
   - reportes

4. Después reforzar las **escrituras offline** y estados pendientes de sincronización:
   - ventas
   - movimientos de stock
   - caja
   - productos creados localmente

5. Recién al final, cuando todos los equipos estén listos, hacer la migración de esquema y activar sincronización real con Supabase.
