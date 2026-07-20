import { createSessionToken } from '../src/lib/auth/auth-core';
import { execSync } from 'child_process';

async function main() {
  console.log('Generating admin session token for Boneyard crawler...');
  const token = await createSessionToken({
    userId: 'boneyard-crawler',
    userName: 'Boneyard Crawler',
    role: 'ADMIN',
    clientType: 'desktop', // desktop allows full access to all screens
  });

  console.log('Token generated successfully.');
  console.log('Running Boneyard build with SESSION_TOKEN env variable...');

  try {
    execSync('npx boneyard-js build http://localhost:3000', {
      env: {
        ...process.env,
        SESSION_TOKEN: token,
      },
      stdio: 'inherit',
      cwd: '/home/maxi/proyectos/pos-ropa',
    });
    console.log('Boneyard skeletons built successfully!');
  } catch (error) {
    console.error('Error executing Boneyard build:', error);
    process.exit(1);
  }
}

main();
