import { createSessionToken, verifySessionToken } from '../src/lib/auth/auth-core';

async function test() {
  const token = await createSessionToken({
    userId: 'boneyard-crawler',
    userName: 'Boneyard Crawler',
    role: 'ADMIN',
    clientType: 'desktop',
  });
  console.log('Generated token:', token);
  const session = await verifySessionToken(token);
  console.log('Verified session:', session);
}
test();
