import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando la carga de datos de prueba...')

  // 1. Crear un Usuario (Vendedora/Admin)
  const user = await prisma.user.upsert({
    where: { deviceId: 'test-device-1' },
    update: {},
    create: {
      name: 'Ana (Vendedora)',
      pin: '1234',
      role: 'ADMIN',
      deviceId: 'test-device-1'
    },
  })
  console.log(`👤 Usuario creado: ${user.name}`)

  // 2. Crear un Proveedor
  const supplier = await prisma.supplier.create({
    data: {
      name: 'Textil Buenos Aires',
      phone: '1122334455',
      notes: 'Envían por encomienda los martes'
    },
  })
  console.log(`🏢 Proveedor creado: ${supplier.name}`)

  // 3. Crear Producto 1: Remera Básica (con sus variantes)
  const product1 = await prisma.product.create({
    data: {
      name: 'Remera Lisa Algodón',
      priceNormal: 15000,     // Precio Transferencia
      priceWholesale: 12000,  // Precio Efectivo
      costPrice: 8000,
      variants: {
        create: [
          { size: 'S', color: 'Blanco', sku: 'REM-LIS-S-BLA', stock: 10 },
          { size: 'M', color: 'Blanco', sku: 'REM-LIS-M-BLA', stock: 15 },
          { size: 'L', color: 'Blanco', sku: 'REM-LIS-L-BLA', stock: 5 },
        ]
      }
    }
  })
  console.log(`👕 Producto creado: ${product1.name}`)

  // 4. Crear Producto 2: Pantalón Cargo
  const product2 = await prisma.product.create({
    data: {
      name: 'Pantalón Cargo Gabardina',
      priceNormal: 35000,
      priceWholesale: 29000,
      costPrice: 20000,
      variants: {
        create: [
          { size: '38', color: 'Negro', sku: 'CARGO-38-NEG', stock: 8 },
          { size: '40', color: 'Negro', sku: 'CARGO-40-NEG', stock: 12 },
          { size: '42', color: 'Verde', sku: 'CARGO-42-VER', stock: 6 },
        ]
      }
    }
  })
  console.log(`👖 Producto creado: ${product2.name}`)

  console.log('✅ ¡Base de datos poblada con éxito!')
}

main()
  .catch((e) => {
    console.error('❌ Error al cargar datos:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
