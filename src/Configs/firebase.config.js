import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const serviceAccountPath = resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH || 'config/yatrasuraksha-firebase-adminsdk-fbsvc-5bf7c876a4.json');

let serviceAccount;

try {
    serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
} catch (error) {
    console.error('Failed to load FIREBASE service account file:', error.message);
    process.exit(1);
}

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID || 'yatrasuraksha'
    });
    console.log('FIREBASE Admin initialized');
}

export default admin;
