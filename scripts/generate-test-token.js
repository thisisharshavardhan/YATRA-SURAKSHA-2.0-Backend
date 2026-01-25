/**
 * Generate a test Firebase custom token for API testing
 * 
 * Usage: node scripts/generate-test-token.js
 * 
 * Note: Custom tokens need to be exchanged for ID tokens via Firebase Auth REST API
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

dotenv.config({ path: resolve(projectRoot, '.env') });

import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    const serviceAccountPath = resolve(
        projectRoot,
        process.env.FIREBASE_SERVICE_ACCOUNT_PATH || 'config/yatrasuraksha-firebase-adminsdk-fbsvc-5bf7c876a4.json'
    );
    
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
    
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const TEST_UID = 'test-user-' + Date.now();

async function generateToken() {
    try {
        // Create a custom token
        const customToken = await admin.auth().createCustomToken(TEST_UID, {
            email: 'testuser@example.com',
            name: 'Test User'
        });

        console.log('\n========================================');
        console.log('🔑 Firebase Custom Token Generated');
        console.log('========================================\n');
        console.log('Test UID:', TEST_UID);
        console.log('\nCustom Token (copy this):');
        console.log('----------------------------------------');
        console.log(customToken);
        console.log('----------------------------------------\n');
        
        console.log('⚠️  IMPORTANT: Custom tokens cannot be used directly!');
        console.log('   You need to exchange it for an ID token.\n');
        console.log('Option 1: Use the test HTML page at http://localhost:3000/test-auth.html');
        console.log('Option 2: Use Firebase REST API to exchange token\n');
        
        // Also provide the curl command to exchange token
        const apiKey = process.env.FIREBASE_API_KEY;
        if (apiKey) {
            console.log('Exchange via curl:');
            console.log(`curl -X POST "https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}" \\`);
            console.log(`  -H "Content-Type: application/json" \\`);
            console.log(`  -d '{"token":"${customToken}","returnSecureToken":true}'`);
        } else {
            console.log('💡 Add FIREBASE_API_KEY to .env to get curl command for token exchange');
        }
        
        console.log('\n========================================\n');
        
    } catch (error) {
        console.error('Error generating token:', error.message);
        process.exit(1);
    }
}

generateToken();
