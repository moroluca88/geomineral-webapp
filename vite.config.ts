import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig, loadEnv} from 'vite';

// Helper to auto-generate .env from firebase-applet-config.json if it exists
try {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const envPath = path.resolve(process.cwd(), '.env');
    let existingEnv = '';
    if (fs.existsSync(envPath)) {
      existingEnv = fs.readFileSync(envPath, 'utf8');
    }

    const vars: Record<string, string> = {
      VITE_FIREBASE_API_KEY: config.apiKey,
      VITE_FIREBASE_AUTH_DOMAIN: config.authDomain,
      VITE_FIREBASE_PROJECT_ID: config.projectId,
      VITE_FIREBASE_STORAGE_BUCKET: config.storageBucket,
      VITE_FIREBASE_MESSAGING_SENDER_ID: config.messagingSenderId,
      VITE_FIREBASE_APP_ID: config.appId,
      VITE_FIREBASE_FIRESTORE_DATABASE_ID: config.firestoreDatabaseId || '(default)'
    };

    let updatedEnv = existingEnv;
    let modified = false;

    for (const [key, val] of Object.entries(vars)) {
      if (!existingEnv.includes(`${key}=`)) {
        updatedEnv += `\n${key}="${val}"`;
        modified = true;
      }
    }

    if (modified) {
      fs.writeFileSync(envPath, updatedEnv.trim() + '\n', 'utf8');
    }
  }
} catch (err) {
  console.error('Error auto-populating .env from Firebase config:', err);
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
