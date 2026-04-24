import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPowerSyncServerConfig } from '@/lib/offline-config';

type SyncModel = {
  upsert(args: {
    where: { id: string };
    update: Record<string, unknown>;
    create: Record<string, unknown>;
  }): Promise<unknown>;
  update(args: {
    where: { id: string };
    data: Record<string, unknown>;
  }): Promise<unknown>;
};

/**
 * Este endpoint recibe las "colas de sincronización" (CRUD = Create, Read, Update, Delete)
 * que se hicieron en la tablet/computadora cuando estuvo sin internet.
 * Nuestra labor aquí es guardar todo en Postgres (Prisma).
 */
export async function POST(request: Request) {
  try {
    const config = getPowerSyncServerConfig();
    if (!config.enabled) {
      return NextResponse.json(
        { error: 'PowerSync deshabilitado por configuración' },
        { status: 503 }
      );
    }

    // Para entornos reales asegurate de verificar la sesión de la caja.
    // const session = await auth(); if (!session) return auth error.

    const rawPayload = await request.json();
    const operations = normalizeCrudPayloads(rawPayload);

    await prisma.$transaction(async (tx) => {
      for (const operation of operations) {
        await applyCrudOperation(tx, operation, rawPayload);
      }
    });

    return NextResponse.json({ ok: true, processed: operations.length });

  } catch (error) {
    console.error('Local-First Sync Error:', error);
    return NextResponse.json({ error: 'Error procesando sincronización', details: String(error) }, { status: 500 });
  }
}

function normalizeCrudPayload(raw: Record<string, unknown>) {
  const op = String(raw.op ?? "");
  const table = String(raw.table ?? raw.type ?? "");
  const id = String(raw.id ?? "");
  const opData =
    raw.opData && typeof raw.opData === "object"
      ? (raw.opData as Record<string, unknown>)
      : raw.data && typeof raw.data === "object"
        ? (raw.data as Record<string, unknown>)
        : {};

  if (!op || !table || !id) {
    throw new Error(`Payload CRUD inválido: ${JSON.stringify(raw)}`);
  }

  return { op, table, id, opData };
}

function normalizeCrudPayloads(raw: unknown) {
  if (Array.isArray(raw)) {
    return raw.map((item) => normalizeCrudPayload(item as Record<string, unknown>));
  }

  return [normalizeCrudPayload(raw as Record<string, unknown>)];
}

async function applyCrudOperation(
  tx: unknown,
  operation: ReturnType<typeof normalizeCrudPayload>,
  rawPayload: unknown
) {
  const { op, table, opData, id } = operation;
  const modelName = getPrismaModelName(table);

  if (!modelName) {
    console.warn(`[POWERSYNC][SYNC] Tabla no reconocida`, rawPayload);
    throw new Error(`Tabla local-first ${table} no reconocida`);
  }

  const dbModel = (tx as Record<string, unknown>)[modelName] as SyncModel | undefined;

  if (!dbModel) {
    throw new Error(`Modelo Prisma no disponible para la tabla ${table}`);
  }

  if (op === 'PUT') {
    const sanitizedData = sanitizeData(opData || {}, table);
    await dbModel.upsert({
      where: { id },
      update: sanitizedData,
      create: {
        id,
        ...sanitizedData,
      },
    });
    return;
  }

  if (op === 'PATCH') {
    const sanitizedData = sanitizeData(opData || {}, table);
    await dbModel.update({
      where: { id },
      data: sanitizedData,
    });
    return;
  }

  if (op === 'DELETE') {
    await dbModel.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return;
  }

  throw new Error(`Operación CRUD no soportada: ${op}`);
}

function getPrismaModelName(sqliteTable: string) {
  const map: Record<string, string> = {
    // Nombres exactos desde AppSchema (Singulares Capitalizados)
    'User': 'user',
    'Shift': 'shift',
    'CashSession': 'cashSession',
    'CashMovement': 'cashMovement',
    'Supplier': 'supplier',
    'Product': 'product',
    'ProductVariant': 'productVariant',
    'StockMovement': 'stockMovement',
    'Sale': 'sale',
    'SaleItem': 'saleItem',
    'BarcodeAlias': 'barcodeAlias',
    // Fallback de plurales por si acaso
    'users': 'user',
    'shifts': 'shift',
    'cashsessions': 'cashSession',
    'cashmovements': 'cashMovement',
    'suppliers': 'supplier',
    'products': 'product',
    'productvariants': 'productVariant',
    'stockmovements': 'stockMovement',
    'sales': 'sale',
    'saleitems': 'saleItem',
    'barcodealiases': 'barcodeAlias'
  };
  return map[sqliteTable] || map[sqliteTable.toLowerCase()];
}

function sanitizeData(data: Record<string, unknown>, table: string) {
  const clean = { ...data };

  // Manejo de nulos en timestamps
  if (clean.updatedAt === null || clean.updatedAt === "") delete clean.updatedAt;
  if (clean.createdAt === null || clean.createdAt === "") delete clean.createdAt;
  if (clean.deletedAt === null || clean.deletedAt === "") delete clean.deletedAt;

  // Prisma espera Date para campos DateTime; PowerSync envía ISO strings.
  const dateFields = [
    "createdAt",
    "updatedAt",
    "deletedAt",
    "quickCreatedAt",
    "reviewedAt",
    "checkIn",
    "checkOut",
    "openingDate",
    "closingDate",
    "countingDate",
  ];
  for (const field of dateFields) {
    const value = clean[field];
    if (typeof value === "string") {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        clean[field] = parsed;
      }
    }
  }

  // Manejo manual de Booleanos (SQLite envía 1 y 0 para los de tipo INTEGER)
  const booleanFields = ["active", "quickCreated", "pendingReview", "quickNotificationSeen"];
  for (const field of booleanFields) {
    if (clean[field] !== undefined) {
      if (clean[field] === 1 || clean[field] === "1" || clean[field] === "true") clean[field] = true;
      if (clean[field] === 0 || clean[field] === "0" || clean[field] === "false") clean[field] = false;
    }
  }

  // Prisma espera string en el schema offline actual para Sale.ticketNumber.
  if (table === "Sale" && clean.ticketNumber != null) {
    clean.ticketNumber = String(clean.ticketNumber);
  }

  delete clean._metadata;

  return clean;
}
