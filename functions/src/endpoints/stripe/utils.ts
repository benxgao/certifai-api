import { firebaseAuth } from '../../services/firebase/admin';
import logger from '../../services/firebase/logger';

export async function updateFirebaseCustomClaims(
  firebaseUid: string,
  claims: Record<string, any>,
): Promise<void> {
  try {
    const userRecord = await firebaseAuth.getUser(firebaseUid);

    await firebaseAuth.setCustomUserClaims(firebaseUid, {
      ...userRecord.customClaims,
      ...claims,
    });

    logger.info('FIREBASE_CUSTOM_CLAIMS_UPDATED', {
      firebase_uid: firebaseUid,
      claims,
    });
  } catch (error) {
    logger.error('FIREBASE_CUSTOM_CLAIMS_UPDATE_ERROR', {
      error,
      firebase_uid: firebaseUid,
      claims,
    });
    throw new Error(`Failed to update Firebase custom claims: ${error}`);
  }
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validatePrice(amount: number, currency: string): boolean {
  return amount > 0 && ['usd', 'aud', 'nzd'].includes(currency.toLowerCase());
}
