import * as admin from 'firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';

if (!admin.apps.length) {
  const config: admin.AppOptions = {};

  // if (process.env.FIREBASE_DATABASE_EMULATOR_HOST) {
  //   config.databaseURL = `http://${process.env.FIREBASE_DATABASE_EMULATOR_HOST}/?ns=certifai-prod-default-rtdb`;
  // } else {
  config.databaseURL = `https://${process.env.GCP_PROJECT_ID}-default-rtdb.firebaseio.com/`;
  // }

  admin.initializeApp(config);
}

export const firebaseAdmin = admin;
export const firebaseAuth = getAuth();
export const firebaseDatabase = getDatabase();
