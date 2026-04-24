import { column, Schema, Table } from '@powersync/web';

// ------------------------------------------------------
// 👥 PERSONAL Y ASISTENCIA
// ------------------------------------------------------
const users = new Table({
  name: column.text,
  pin: column.text,
  role: column.text,
  active: column.integer, // boolean se suele manejar como 0 o 1
  deviceId: column.text,
  createdAt: column.text,
  updatedAt: column.text,
  deletedAt: column.text,
});

const shifts = new Table({
  userId: column.text,
  checkIn: column.text,
  checkOut: column.text,
  totalHours: column.real,
  notes: column.text,
  createdAt: column.text,
  updatedAt: column.text,
  deletedAt: column.text,
});

// ------------------------------------------------------
// 💰 GESTIÓN DE CAJA (ARQUEO)
// ------------------------------------------------------
const cashSessions = new Table({
  openedById: column.text,
  closedById: column.text,
  status: column.text,
  openingDate: column.text,
  closingDate: column.text,
  countedById: column.text,
  countingDate: column.text,
  initialAmount: column.real, // Decimal se guarda como real (float) en SQLite
  expectedAmount: column.real,
  actualAmount: column.real,
  difference: column.real,
  createdAt: column.text,
  updatedAt: column.text,
  deletedAt: column.text,
});

const cashMovements = new Table({
  sessionId: column.text,
  amount: column.real,
  type: column.text,
  reason: column.text,
  createdAt: column.text,
  updatedAt: column.text,
  deletedAt: column.text,
});

// ------------------------------------------------------
// 📦 INVENTARIO Y PRODUCTOS
// ------------------------------------------------------
const suppliers = new Table({
  name: column.text,
  phone: column.text,
  notes: column.text,
  createdAt: column.text,
  updatedAt: column.text,
  deletedAt: column.text,
});

const products = new Table({
  name: column.text,
  quickCreated: column.integer,
  pendingReview: column.integer,
  quickCreatedAt: column.text,
  quickCreatedByName: column.text,
  quickCreatedByRole: column.text,
  quickNotificationSeen: column.integer,
  reviewedAt: column.text,
  reviewedByName: column.text,
  priceNormal: column.real,
  priceWholesale: column.real,
  costPrice: column.real,
  createdAt: column.text,
  updatedAt: column.text,
  deletedAt: column.text,
});

const productVariants = new Table({
  productId: column.text,
  size: column.text,
  color: column.text,
  sku: column.text,
  stock: column.integer,
  createdAt: column.text,
  updatedAt: column.text,
  deletedAt: column.text,
});

const stockMovements = new Table({
  variantId: column.text,
  supplierId: column.text,
  quantity: column.integer,
  type: column.text,
  notes: column.text,
  createdAt: column.text,
  updatedAt: column.text,
  deletedAt: column.text,
});

// ------------------------------------------------------
// 🧾 VENTAS Y BOLETAS (TICKETS)
// ------------------------------------------------------
const sales = new Table({
  ticketNumber: column.text,
  total: column.real,
  paymentMethod: column.text,
  cashAmount: column.real,
  transferAmount: column.real,
  userId: column.text,
  cashSessionId: column.text,
  createdAt: column.text,
  updatedAt: column.text,
  deletedAt: column.text,
});

const saleItems = new Table({
  saleId: column.text,
  variantId: column.text,
  quantity: column.integer,
  priceAtTime: column.real,
  priceType: column.text,
  returnedQuantity: column.integer,
  createdAt: column.text,
  updatedAt: column.text,
  deletedAt: column.text,
});

// ------------------------------------------------------
// 🏷️ CÓDIGOS DE BARRAS ALTERNATIVOS 
// ------------------------------------------------------
const barcodeAliases = new Table({
  barcode: column.text,
  variantId: column.text,
  createdAt: column.text,
  updatedAt: column.text,
  deletedAt: column.text,
});

export const AppSchema = new Schema({
  // En Prisma, los nombres de tablas por defecto arrancan en mayúsculas (si no se usa @@map)
  User: users,
  Shift: shifts,
  CashSession: cashSessions,
  CashMovement: cashMovements,
  Supplier: suppliers,
  Product: products,
  ProductVariant: productVariants,
  StockMovement: stockMovements,
  Sale: sales,
  SaleItem: saleItems,
  BarcodeAlias: barcodeAliases
});

export type Database = (typeof AppSchema)['types'];