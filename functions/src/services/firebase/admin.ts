import * as admin from 'firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';
import { getFirestore } from 'firebase-admin/firestore';

if (!admin.apps.length) {
  const config: admin.AppOptions = {
    projectId: process.env.GCP_PROJECT_ID || 'certifai-uat',
  };

  // Add service account credentials if available
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // When running with service account credentials
    config.credential = admin.credential.applicationDefault();
  } else if (process.env.FUNCTIONS_EMULATOR) {
    // When running in Firebase emulator
    config.credential = admin.credential.applicationDefault();
  } else {
    // When running in production (Firebase Functions automatically have credentials)
    config.credential = admin.credential.applicationDefault();
  }

  // if (process.env.FIREBASE_DATABASE_EMULATOR_HOST) {
  //   config.databaseURL = `http://${process.env.FIREBASE_DATABASE_EMULATOR_HOST}/?ns=${process.env.GCP_PROJECT_ID}-default-rtdb`;
  // } else {
  config.databaseURL = `https://${process.env.GCP_PROJECT_ID}-default-rtdb.firebaseio.com/`;
  // }

  admin.initializeApp(config);
}

export const firebaseAdmin = admin;
export const firebaseAuth = getAuth();
export const firebaseDatabase = getDatabase();
export const firebaseFirestore = getFirestore();
