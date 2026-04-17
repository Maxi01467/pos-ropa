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

4. **Configurar Supabase para PowerSync:**
   Recordar que PowerSync requiere **Replicación Lógica PostgreSQL**. Deberás ejecutar en el panel de SQL de Supabase la creación de publicaciones:
   ```sql
   CREATE PUBLICATION powersync FOR TABLE "Product", "Sale", "SaleItem", "CashSession", /* etc */;
   ```
   *Nota: PowerSync se conecta directo a Supabase a través del puerto 5432 (bypass de pooler IPv4).*