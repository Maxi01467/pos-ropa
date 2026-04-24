# Plan: Pestañas de Venta en Electron

## Objetivo

Agregar en `nueva-venta` un sistema de pestañas internas para la app de escritorio (`Electron`) que permita mantener hasta `3` ventas en borrador al mismo tiempo, sin mezclar carritos entre clientes y sin depender del servidor para esa funcionalidad.

Caso de uso principal:

- un cliente está cerca de pagar pero quiere seguir viendo productos
- llega otro cliente que sí quiere pagar en ese momento
- el cajero abre otra pestaña de venta y cobra ahí
- la venta anterior queda preservada con su carrito y su contexto

---

## Alcance

Esta funcionalidad debe existir solo en `Electron`.

No debe activarse en la versión web/servidor.

La primera versión debe ser:

- local-only
- sin dependencia de server actions para manejar las pestañas
- sin persistir borradores en PowerSync
- con stock reservado visualmente entre pestañas

---

## Reglas funcionales

### 1. Cantidad máxima de pestañas

- máximo `3` pestañas abiertas al mismo tiempo
- siempre debe existir al menos `1` pestaña activa

### 2. Aislamiento por pestaña

Cada pestaña representa una venta en borrador independiente.

Cada pestaña debe mantener su propio:

- carrito
- vendedor seleccionado
- búsqueda de productos
- modo de precio
- flujo de cambio/devolución
- datos de creación rápida
- estado visual de checkout

Nada de ese estado debe compartirse accidentalmente con otra pestaña.

### 3. Stock reservado localmente entre pestañas

Las pestañas deben compartir información local de reserva visual de stock.

Ejemplo:

- una variante tiene stock local real = `1`
- en la `Pestaña A` se agrega `1` unidad al carrito
- en la `Pestaña B`, esa variante debe aparecer con stock disponible `0`

Importante:

- esto no es una reserva real en base de datos
- es una reserva local de UI para evitar vender dos veces el mismo stock dentro de la misma terminal y sesión de trabajo

### 4. Validación final de stock

Aunque exista reserva visual entre pestañas, al confirmar la venta igualmente se debe volver a validar stock local real.

Esto protege contra:

- cambios concurrentes dentro de la app
- cambios externos sincronizados por PowerSync
- estados visuales desactualizados

### 5. Ticket number

El número de ticket no debe generarse al abrir una pestaña.

El número de ticket debe generarse recién al confirmar/facturar la venta.

Motivo:

- evita consumir números en borradores que nunca se cobran
- evita huecos innecesarios
- evita conflictos entre varias pestañas abiertas

Las pestañas son solo borradores de UI.

El ticket real sigue naciendo en la lógica actual de `createSale` / `createExchangeSale`.

### 6. Cierre de pestañas

Si una pestaña está vacía:

- puede cerrarse directamente

Si una pestaña tiene datos:

- debe pedir confirmación antes de cerrar

Cuando una pestaña se cierra:

- se elimina su borrador
- se liberan sus reservas locales de stock
- el stock vuelve a estar disponible visualmente en las demás pestañas

---

## Alcance técnico

### Solo Electron

Esta feature debe renderizarse solo cuando la app detecte que está corriendo en desktop.

Condición esperada:

- `window.posDesktop` disponible
- o el snapshot de terminal indique `isDesktop === true`

En web:

- no deben aparecer las pestañas
- debe mantenerse el flujo actual de una sola venta

---

## Modelo propuesto

### `SaleDraftTab`

```ts
type SaleDraftTab = {
  id: string;
  label: string;
  status: "active" | "idle";
  createdAt: string;
  updatedAt: string;

  sellerId: string;
  searchQuery: string;
  priceMode: "retail" | "wholesale";

  cart: DraftCartItem[];

  exchange: {
    enabled: boolean;
    originalSaleId: string | null;
    selectedItems: Array<{
      saleItemId: string;
      quantity: number;
    }>;
  };

  quickCreate: {
    name: string;
    price: string;
    wholesalePrice: string;
    initialStock: string;
  };
};
```

### `DraftCartItem`

```ts
type DraftCartItem = {
  lineId: string;
  variantId: string;
  productId: string;
  code: string;
  name: string;
  size: string;
  color: string;
  unitPrice: number;
  priceType: "NORMAL" | "WHOLESALE";
  quantity: number;
};
```

### `ReservedStockIndex`

```ts
type ReservedStockIndex = Record<string, number>;
```

Uso:

- `key = variantId`
- `value = cantidad reservada por carritos abiertos`

---

## Store propuesto

Primera recomendación:

- store local de frontend
- sin guardar esto en PowerSync

Puede implementarse con:

- `zustand`
- o `useReducer + Context`

Interfaz sugerida:

```ts
type SalesTabsState = {
  tabs: SaleDraftTab[];
  activeTabId: string | null;

  createTab(): void;
  closeTab(tabId: string): void;
  switchTab(tabId: string): void;

  updateTab(tabId: string, patch: Partial<SaleDraftTab>): void;

  addItem(tabId: string, item: ProductVariantLike): void;
  removeItem(tabId: string, lineId: string): void;
  setItemQuantity(tabId: string, lineId: string, quantity: number): void;
  clearTab(tabId: string): void;

  getReservedStockByVariant(): ReservedStockIndex;
  getAvailableStock(variantId: string, forTabId: string, dbStock: number): number;

  finalizeTab(tabId: string): Promise<void>;
};
```

---

## Regla de stock entre pestañas

El stock disponible visual para una pestaña debe calcularse así:

```ts
availableStock = localDbStock - reservedInOtherTabs
```

Donde:

```ts
reservedInOtherTabs(variantId, currentTabId) =
  suma de quantity para esa variante en todas las tabs abiertas
  excepto la tab actual
```

Esto permite:

- ver el carrito actual sin descontarse a sí mismo
- bloquear la misma unidad en las demás pestañas

---

## Persistencia

### Fase 1

- estado en memoria local del frontend

### Fase 2 recomendada

- persistencia en `localStorage` o `IndexedDB`

Objetivo:

- sobrevivir refresh accidental
- restaurar borradores al reabrir la pantalla o la app

No recomendado para primera versión:

- guardar estos borradores en PowerSync
- sincronizarlos con servidor

Motivo:

- son borradores operativos de una terminal
- no son una entidad de negocio consolidada
- agregar sincronización real complica mucho la feature sin necesidad inicial

---

## Integración con la lógica actual de ventas

La lógica de facturación actual debe mantenerse como fuente de verdad:

- `createSale`
- `createExchangeSale`

La pestaña solo prepara el borrador.

Al confirmar:

1. se valida el stock disponible local otra vez
2. se arma el payload final
3. se llama a la mutación actual
4. se genera el ticket real
5. se imprime
6. se limpia o cierra la pestaña

---

## UX propuesta

### Barra de pestañas

Encima del carrito o encima del área principal de venta:

- `Venta 1`
- `Venta 2`
- `Venta 3`

Cada tab puede mostrar:

- nombre
- cantidad de ítems
- total parcial
- indicador de cambios activos

### Acciones

- botón `Nueva pestaña`
- botón `Cerrar pestaña`
- confirmación si tiene contenido

### Comportamiento recomendado

- abrir con una pestaña inicial por defecto
- al facturar, limpiar esa pestaña o cerrarla automáticamente
- si se cierra una pestaña activa, pasar a otra existente

---

## Riesgos y decisiones

### 1. No es una reserva real

La reserva entre pestañas es solo local/visual.

No debe interpretarse como:

- stock bloqueado en base de datos
- stock reservado para otro dispositivo

### 2. Validación final obligatoria

Aunque el stock visual ya esté ajustado entre pestañas, la venta final debe revalidar.

### 3. No generar ticket antes de tiempo

No se debe preasignar `ticketNumber` al crear la pestaña.

Ese punto debe seguir ocurriendo en la venta confirmada.

### 4. Límite de 3 pestañas

Buena decisión para evitar:

- desorden visual
- demasiadas ventas en espera
- complejidad operativa innecesaria

---

## Fases sugeridas

### Fase 1

- Electron-only
- máximo 3 pestañas
- borradores aislados
- reserva visual de stock entre pestañas
- confirmación antes de cerrar
- ticket generado solo al facturar

### Fase 2

- persistencia local de pestañas
- restauración al reabrir app
- alias opcional por pestaña

### Fase 3 opcional

- “ventas suspendidas” como entidad más formal
- persistidas fuera del estado UI

---

## Conclusión

La idea es sólida para operación de mostrador y resuelve un problema real.

La implementación recomendada es:

- solo para Electron
- con un store local de borradores
- con máximo 3 pestañas
- con stock reservado visualmente entre pestañas
- sin generar ticket hasta el momento de facturar

Eso reduce riesgo, mantiene compatibilidad con la arquitectura actual y evita complicar innecesariamente PowerSync o el backend en una primera etapa.
