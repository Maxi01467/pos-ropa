import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { getPowerSyncServerConfig } from '@/lib/offline-config';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // 1. Autenticar quién hace la petición.
    // Ejemplo: const user = await getCurrentUser();
    // Si no hay user, return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const config = getPowerSyncServerConfig();
    if (!config.enabled) {
      return NextResponse.json(
        { error: 'PowerSync deshabilitado por configuración' },
        { status: 503 }
      );
    }

    if (!config.endpoint || !config.audience || !config.privateKey || !config.keyId) {
      return NextResponse.json(
        {
          error:
            'Falta configuración de PowerSync. Revisá NEXT_PUBLIC_POWERSYNC_URL, POWERSYNC_JWT_AUDIENCE, POWERSYNC_PRIVATE_KEY y POWERSYNC_KID.',
        },
        { status: 500 }
      );
    }

    const syncSubject = await resolveSyncSubject(request, config.syncSubject);

    // 2. Importar la KEY RSA privada.
    const privateKey = await importPKCS8(
      Buffer.from(config.privateKey, 'base64').toString('ascii'),
      'RS256'
    );

    // 3. Firmamos el token JWT indicándole a PowerSync que "esta caja"
    // tiene permisos con el subject (sub) = identidad estable por terminal.
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: config.keyId })
      .setSubject(syncSubject)
      .setIssuedAt()
      .setIssuer(config.issuer)
      .setExpirationTime('5m')
      .setAudience(config.audience)
      .sign(privateKey);

    return NextResponse.json({
      token,
      endpoint: config.endpoint,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString()
    });

  } catch (error) {
    console.error('Error generando token de PowerSync:', error);
    return NextResponse.json({ error: 'Error del servidor firmando JWT' }, { status: 500 });
  }
}

async function resolveSyncSubject(request: Request, fallbackSubject: string) {
  const terminalId = request.headers.get('x-pos-terminal-id')?.trim() || '';
  const deviceId = request.headers.get('x-pos-device-id')?.trim() || '';

  const terminal = terminalId
    ? await prisma.terminal.findFirst({
        where: {
          id: terminalId,
          active: true,
          deletedAt: null,
        },
        select: {
          id: true,
        },
      })
    : deviceId
      ? await prisma.terminal.findFirst({
          where: {
            deviceId,
            active: true,
            deletedAt: null,
          },
          select: {
            id: true,
          },
        })
      : null;

  if (terminal) {
    return `terminal:${terminal.id}`;
  }

  return fallbackSubject;
}

// Función auxiliar para parsear PEM
async function importPKCS8(pem: string, alg: string) {
  const { importPKCS8 } = await import('jose');
  return importPKCS8(pem, alg);
}
