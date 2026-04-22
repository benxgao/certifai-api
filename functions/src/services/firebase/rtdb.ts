import { firebaseDatabase } from './admin';
import logger from './logger';

/**
 * import { getRtdbValue, setRtdbValue } from '../services/firebase/rtdb';

    await setRtdbValue('users/123', { name: 'John', email: 'johnm' });

    const userData = await getRtdbValue('users/123');
 */

/**
 * Firebase Realtime Database service
 * Provides simple get and set operations for storing and retrieving data
 */

/**
 * Wraps a promise with a timeout, rejecting if it takes longer than specified milliseconds
 * @param promise - The promise to wrap
 * @param timeoutMs - Timeout in milliseconds
 * @param label - Optional label for error messages
 * @returns Promise that rejects with TimeoutError if timeout exceeded
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string = 'Operation'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label} exceeded timeout of ${timeoutMs}ms`)),
        timeoutMs
      )
    ),
  ]);
}

/**
 * Get data from Firebase Realtime Database
 * @param path - The database path to read from (e.g., 'users/123' or 'config/settings')
 * @returns Promise resolving to the data at the specified path, or null if not found
 */
export async function getRtdbValue(path: string): Promise<any> {
  try {
    const snapshot = await firebaseDatabase.ref(path).once('value');
    const data = snapshot.val();

    logger.info('RTDB getRtdbValue', {
      path,
      hasData: data !== null,
      dataType: typeof data,
    });

    return data;
  } catch (error) {
    logger.error('RTDB getRtdbValue error', {
      path,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Remove undefined values from an object recursively
 * Firebase doesn't accept undefined values
 */
function removeUndefinedValues(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(removeUndefinedValues);
  } else if (obj && typeof obj === 'object') {
    return Object.entries(obj).reduce((acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = removeUndefinedValues(value);
      }
      return acc;
    }, {} as any);
  }
  return obj;
}

/**
 * Set data in Firebase Realtime Database
 * @param path - The database path to write to (e.g., 'users/123' or 'config/settings')
 * @param payload - The data to store at the specified path
 * @returns Promise resolving when the data is successfully written
 */
export async function setRtdbValue(path: string, payload: any): Promise<void> {
  try {
    // Remove undefined values to prevent Firebase errors
    const cleanedPayload = removeUndefinedValues(payload);
    await firebaseDatabase.ref(path).set(cleanedPayload);

    logger.info('RTDB setRtdbValue', {
      path,
      payloadType: typeof cleanedPayload,
      payloadSize: JSON.stringify(cleanedPayload).length,
    });
  } catch (error) {
    logger.error('RTDB setRtdbValue error', {
      path,
      payloadType: typeof payload,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Update specific fields in Firebase Realtime Database
 * @param path - The database path to update
 * @param updates - Object containing the fields to update
 * @returns Promise resolving when the data is successfully updated
 */
export async function updateRtdbValue(
  path: string,
  updates: Record<string, any>,
): Promise<void> {
  try {
    // Remove undefined values to prevent Firebase errors
    const cleanedUpdates = removeUndefinedValues(updates);
    await firebaseDatabase.ref(path).update(cleanedUpdates);

    logger.info('RTDB updateRtdbValue', {
      path,
      updateFields: Object.keys(cleanedUpdates),
      updatesSize: JSON.stringify(cleanedUpdates).length,
    });
  } catch (error) {
    logger.error('RTDB updateRtdbValue error', {
      path,
      updateFields: Object.keys(updates),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Delete data from Firebase Realtime Database
 * @param path - The database path to delete
 * @returns Promise resolving when the data is successfully deleted
 */
export async function deleteRtdbValue(path: string): Promise<void> {
  try {
    await firebaseDatabase.ref(path).remove();

    logger.info('RTDB deleteRtdbValue', {
      path,
    });
  } catch (error) {
    logger.error('RTDB deleteRtdbValue error', {
      path,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Push data to a list in Firebase Realtime Database
 * @param path - The database path to push to
 * @param payload - The data to push to the list
 * @returns Promise resolving to the generated key for the new data
 */
export async function pushRtdbValue(
  path: string,
  payload: any,
): Promise<string> {
  try {
    const ref = await firebaseDatabase.ref(path).push(payload);
    const key = ref.key;

    if (!key) {
      throw new Error('Failed to generate key for pushed data');
    }

    logger.info('RTDB pushRtdbValue', {
      path,
      generatedKey: key,
      payloadType: typeof payload,
    });

    return key;
  } catch (error) {
    logger.error('RTDB pushRtdbValue error', {
      path,
      payloadType: typeof payload,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Check if a path exists in Firebase Realtime Database
 * @param path - The database path to check
 * @returns Promise resolving to true if the path exists, false otherwise
 */
export async function rtdbPathExists(path: string): Promise<boolean> {
  try {
    const snapshot = await firebaseDatabase.ref(path).once('value');
    const exists = snapshot.exists();

    logger.info('RTDB rtdbPathExists', {
      path,
      exists,
    });

    return exists;
  } catch (error) {
    logger.error('RTDB rtdbPathExists error', {
      path,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}
