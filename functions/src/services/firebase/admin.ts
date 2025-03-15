import * as admin from 'firebase-admin';
import { getAuth } from 'firebase-admin/auth';
// import { cert } from 'firebase-admin/app';
// import serviceAccount from '../../../gcp_credentials.json';

if (!admin.apps.length) {
  admin.initializeApp({
    // credential: cert(serviceAccount as admin.ServiceAccount),
  });
}

export const firebaseAdmin = admin;
export const firebaseAuth = getAuth();
