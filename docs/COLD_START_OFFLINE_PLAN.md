# Documento: Cold Start Offline en el POS Local-First

## Qué problema existe hoy

Aunque gran parte del sistema ya opera con SQLite local + PowerSync, todavía existe un problema importante de arquitectura: el **cold start offline**.

`Cold start offline` significa este escenario:

- una PC nueva o recién instalada
- o una base local vacía / dañada / no inicializada
- y el usuario intenta abrir el sistema sin internet

En ese caso, hoy el sistema **no puede garantizar** funcionamiento completo offline.

---

## Implementación Actual Del Bootstrap

Ya quedó implementada una **primera versión funcional** del bootstrap offline.

### Qué se agregó

- `src/lib/offline/offline-bootstrap.ts`
- integración del estado de bootstrap en:
  - `src/components/powersync-provider.tsx`
  - `src/app/login/page.tsx`
  - `src/components/pos-layout-client.tsx`
  - `src/components/app-header.tsx`
- endurecimiento de runtimes críticos para que no hagan fallback silencioso al servidor cuando el equipo está offline y nunca fue preparado

### Qué hace esta primera versión

La capa de bootstrap ahora:

- calcula si el equipo está listo para trabajar offline
- persiste ese estado en `localStorage`
- distingue entre:
  - `unknown`
  - `checking`
  - `ready_offline`
  - `requires_initial_sync`
- guarda metadata básica:
  - `hasSynced`
  - `minimumDatasetReady`
  - `activeUsers`
  - `productCount`
  - `checkedAt`
  - `lastSuccessfulSyncAt`

### Comportamiento actual

- si PowerSync está activo y la base local ya tiene dataset mínimo, el sistema marca el equipo como `ready_offline`
- si la PC está offline y todavía no tiene bootstrap suficiente, el sistema:
  - bloquea login offline
  - bloquea acceso operativo en el shell del POS
  - muestra mensaje claro de sincronización inicial requerida
- además se agregó un indicador visible en el header con:
  - estado online/offline
  - si falta sync inicial
  - usuarios/productos detectados
  - última sincronización exitosa registrada

### Qué mejora concreta aporta

Antes:

- el sistema podía caer al servidor de forma silenciosa
- el usuario no sabía si el equipo estaba realmente listo para offline
- una PC sin preparar podía quedar en estado ambiguo

Ahora:

- el comportamiento es explícito
- el equipo sabe si está listo o no para operar offline
- el usuario ve el estado
- los módulos críticos ya no intentan “disimular” la falta de bootstrap con un fallback opaco

### Limitación actual de esta primera versión

Esta implementación **no es todavía el bootstrap final completo**.

El criterio de dataset mínimo actual es todavía conservador y simple:

- hoy se toma principalmente la existencia de `usuarios activos` como señal mínima de readiness

Eso alcanza para ordenar el sistema y evitar estados rotos, pero para una versión de producción más cerrada conviene endurecerlo para incluir también:

- productos
- variantes / stock
- vendedores
- metadata de versión de dataset
- validación de sincronización exitosa más robusta

---

## Por qué pasa

Actualmente varias partes del sistema usan esta lógica:

1. intentar leer desde SQLite/PowerSync
2. si no hay datos locales o falla algo, hacer fallback al servidor

Eso sirve para una etapa de transición, pero no resuelve offline real desde cero.

### Ejemplos concretos en el sistema actual

- `login offline` solo funciona si los usuarios ya fueron sincronizados antes en la base local
- `nueva-venta` puede caer al servidor si todavía no hay catálogo local suficiente
- `caja` puede caer al servidor si aún no hay vendedores sincronizados

Entonces hoy el sistema es:

- **offline-capable**
- pero no completamente **cold-start offline ready**

---

## Diferencia importante

### Lo que sí funciona hoy

Si la máquina ya sincronizó antes y tiene datos locales cargados:

- login local
- ventas
- caja
- stock
- inventario
- boletas
- arqueos
- reportes
- proveedores
- asistencia
- empleados

pueden operar en gran medida sobre SQLite local.

### Lo que no está garantizado hoy

Si la máquina arranca con base local vacía y sin internet:

- no hay garantía de que existan usuarios locales para login
- no hay garantía de que exista catálogo local para vender
- no hay garantía de que existan vendedores para caja
- varias pantallas podrían intentar fallback al servidor

---

## Problema de fondo

El problema real no es PowerSync ni SQLite en sí.

El problema es que todavía no existe una política explícita de:

- **bootstrap inicial**
- **estado de preparación offline**
- **criterio mínimo para permitir operación offline**

Sin eso, el sistema queda en un punto ambiguo:

- “si hay datos locales, funciona”
- “si no, intenta pedir al servidor”

Eso no alcanza para un POS local-first robusto.

---

## Solución recomendada

La solución correcta es implementar un esquema de **bootstrap offline obligatorio**.

### Idea principal

El sistema debe distinguir entre:

1. equipo nunca inicializado offline
2. equipo inicializado y listo para operar offline
3. equipo inicializado pero con datos viejos

---

## Propuesta de diseño

### 1. Definir un dataset mínimo offline

Hay que definir qué datos son obligatorios para que el POS pueda arrancar sin internet.

Mi recomendación mínima:

- usuarios activos
- productos
- variantes
- stock actual
- caja / sesiones necesarias para operación
- configuración básica del negocio

Sin ese dataset mínimo, el sistema no debería prometer operación offline.

### 2. Crear un estado persistente de bootstrap

Agregar un estado local, por ejemplo:

- `never_synced`
- `bootstrapping`
- `ready_offline`
- `stale_offline`

Con eso el sistema puede saber si:

- nunca descargó datos mínimos
- está preparando la base local
- ya está listo para trabajar sin red
- está trabajando con una copia vieja pero usable

### 3. Cambiar la regla de arranque

La regla recomendada es:

- si el equipo **nunca sincronizó** y está offline:
  - bloquear acceso operativo
  - mostrar mensaje claro: “Este equipo necesita una sincronización inicial online”
- si el equipo **ya sincronizó al menos una vez**:
  - permitir trabajo offline
- si el dataset está viejo:
  - permitir operar, pero mostrar advertencia

### 4. Dejar de usar fallback silencioso al servidor en módulos críticos

Hoy el fallback ayuda a que la app siga funcionando, pero oculta el problema real.

En módulos críticos, la estrategia final debería ser:

- si el dataset offline está listo: usar solo local
- si no está listo: fallar con error controlado
- no depender de un fallback silencioso al servidor

Esto aplica especialmente a:

- login
- catálogo POS
- vendedores
- caja

### 5. Agregar UI de estado offline

Conviene mostrar al usuario:

- última sincronización exitosa
- si el equipo está listo para offline
- si hay cola pendiente de subida
- si está operando con datos desactualizados

Eso hace al sistema mucho más confiable y entendible.

---

## Estrategia operativa recomendada

La política final debería ser esta:

### Primer uso de una PC nueva

- requiere internet
- descarga snapshot inicial
- deja la base local preparada

### Usos posteriores

- puede trabajar offline
- las escrituras quedan locales y luego sincronizan

### Si la base local está vacía o dañada

- no se debe dejar entrar “como si offline estuviera listo”
- se debe pedir reconexión para rebootstrap

---

## Beneficios de esta solución

- elimina ambigüedad sobre si la app realmente puede trabajar offline
- evita fallos raros en máquinas nuevas
- hace predecible el comportamiento del POS
- permite auditar cuándo un equipo está listo o no para operación offline
- reduce dependencia accidental del servidor en momentos críticos

---

## Qué recomiendo implementar en código

### Nueva capa

Crear algo como:

- `src/lib/offline/offline-bootstrap.ts`

### Ese módulo debería manejar

- si la base local ya tuvo una sincronización válida
- si existe dataset mínimo suficiente
- fecha de última sincronización exitosa
- estado general de readiness offline

### Metadata sugerida

- `hasMinimumDataset`
- `lastSuccessfulSyncAt`
- `bootstrapState`
- `datasetVersion`

### Estado real hoy

Esto ya está parcialmente implementado.

Hoy existen en código:

- `lastSuccessfulSyncAt`
- `state`
- `hasSynced`
- `minimumDatasetReady`
- contadores básicos de dataset (`activeUsers`, `productCount`)

Todavía falta una versión más estricta de:

- `datasetVersion`
- validación más completa del dataset mínimo
- políticas de `stale_offline`

### Después aplicar ese estado a

- login offline
- layout POS
- runtime de ventas
- runtime de caja
- runtime de catálogo

---

## Recomendación final

No recomiendo seguir agregando más features offline sin resolver antes este punto.

El sistema ya está bastante avanzado como local-first, pero el siguiente salto de calidad no es otra pantalla: es cerrar correctamente el **bootstrap offline inicial**.

Ese es el paso que convierte una app “que muchas veces funciona offline” en una app “operativamente confiable offline”.

---

## Resumen corto

### Problema

Hoy el sistema funciona offline **solo si ya existe una base local previamente sincronizada**.

### Riesgo

Una PC nueva o una base local vacía no pueden garantizar operación offline completa.

### Solución recomendada

Implementar:

- dataset mínimo offline
- estado persistente de bootstrap
- bloqueo controlado si nunca hubo sync inicial
- UI clara de readiness offline
- eliminación progresiva de fallbacks silenciosos al servidor

---

## Próximo paso sugerido

Si se decide avanzar, el siguiente paso técnico correcto es:

1. crear `offline-bootstrap.ts`
2. persistir el estado de readiness offline
3. integrar ese estado en login + layout + runtimes críticos
4. recién después endurecer la operación offline total

### Avance real respecto a esa lista

Los pasos `1`, `2` y `3` ya quedaron implementados en una primera versión.

Lo que sigue pendiente es:

4. endurecer el criterio del dataset mínimo
5. modelar mejor `stale_offline`
6. validar todo con pruebas operativas reales en Electron
