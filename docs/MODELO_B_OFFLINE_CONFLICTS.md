# Idea Futura: Modelo B para Ventas Offline con Conflictos de Stock

## Objetivo

Documentar una estrategia futura para manejar conflictos de inventario cuando una caja opera offline y vende usando el stock local disponible, aunque el stock central haya cambiado mientras esa caja estaba desconectada.

---

## Qué es el Modelo B

El `Modelo B` prioriza la continuidad operativa del POS.

La regla principal es:

- la caja offline vende usando la mejor información local disponible
- si después aparece una diferencia con el servidor, el sistema no borra la venta
- en cambio, registra y reconcilia el conflicto de inventario

---

## Ejemplo típico

1. La caja local tiene stock `20` para una remera.
2. Se corta internet.
3. En el servidor, otro usuario ajusta esa remera a stock `0`.
4. La caja offline no se entera y vende `1`.
5. Localmente:
   - registra la venta
   - descuenta el stock a `19`
6. Cuando vuelve internet:
   - la venta se sincroniza
   - aparece una diferencia con el stock central

En `Modelo B`, la venta no se rechaza como si nunca hubiera ocurrido.

---

## Principio de negocio

La venta ocurrió en el mundo real.

Por lo tanto:

- no conviene eliminarla
- no conviene ocultarla
- no conviene fingir que no pasó

Lo correcto es:

- aceptar la venta como hecho comercial
- detectar el conflicto de stock
- registrar trazabilidad
- exigir revisión posterior

---

## Qué debería hacer el sistema en el futuro

### 1. Permitir venta offline contra stock local

Mientras la caja esté offline:

- la validación se hace con el stock local
- no se exige consistencia en tiempo real con el servidor

### 2. Marcar la venta como pendiente de reconciliación

Al sincronizar:

- si el stock central ya no alcanzaba
- o si hubo modificaciones externas incompatibles

la venta debe quedar marcada como:

- `conflicto de inventario`
- o `pendiente de revisión`

### 3. No rechazar silenciosamente la venta

El backend no debería simplemente descartar la venta offline.

Eso generaría un problema peor:

- la venta sí ocurrió
- pero el sistema central la perdería

### 4. Registrar conflicto explícito

El sistema debería guardar algo como:

- producto afectado
- stock local usado para vender
- stock central al momento de sincronizar
- diferencia detectada
- venta relacionada
- fecha de conflicto
- estado de resolución

### 5. Dejar trazabilidad visible para administración

La idea futura es mostrar en algún panel:

- ventas offline sincronizadas con conflicto
- productos con desajuste
- necesidad de corrección manual o ajuste automático

---

## Estrategias posibles de resolución futura

### Opción 1: aceptar venta y dejar stock negativo

El sistema:

- conserva la venta
- deja el stock en negativo
- obliga a revisión administrativa

Ventaja:

- nunca se pierde la venta

Riesgo:

- el stock puede quedar más sucio si no se revisa

### Opción 2: aceptar venta y generar ajuste automático

El sistema:

- conserva la venta
- registra automáticamente un movimiento de corrección
- marca el caso como conflicto resuelto automáticamente

Ventaja:

- menos trabajo manual

Riesgo:

- si se automatiza mal, puede tapar problemas de operación reales

### Opción 3: aceptar venta y abrir incidencia manual

El sistema:

- conserva la venta
- no corrige solo
- exige revisión explícita

Ventaja:

- máxima trazabilidad

Desventaja:

- más carga administrativa

---

## Recomendación inicial

Para este sistema, la estrategia futura más razonable parece:

1. permitir la venta offline con stock local
2. aceptar la venta al sincronizar
3. registrar conflicto explícito de inventario
4. mostrarlo en la administración
5. decidir después si la resolución será:
   - manual
   - automática
   - o híbrida

---

## Qué NO resuelve hoy el sistema

Actualmente, el sistema se comporta en la práctica más cerca de `Modelo B` al momento de vender offline:

- permite la venta usando stock local

Pero todavía **no implementa** la parte madura del modelo:

- detección formal de conflicto al sincronizar
- registro explícito de conflicto
- panel de revisión
- política clara de resolución

O sea:

- hoy la venta offline sí puede ocurrir
- pero el manejo completo del conflicto posterior sigue pendiente

---

## Estado

Este documento representa una **idea de diseño futuro**.

No debe asumirse como comportamiento terminado del sistema actual.
