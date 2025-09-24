import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import logger from '../firebase/logger';

interface CachedSecret {
  value: string;
  expiresAt: number;
}

let googleGenAIApiKeyCache: CachedSecret | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000 * 24 * 30; // 30 days

/**
 * Retrieves a secret from Google Cloud Secret Manager.
 *
 * @param {string} secretName The name of the secret to retrieve.
 * @param {string} version The version of the secret to retrieve (optional, defaults to 'latest').
 * @return {Promise<string>} The secret value as a string.
 * @throws {Error} If the secret cannot be accessed or retrieved.
 */
export async function getSecret(
  secretName: string,
  version?: string,
): Promise<string> {
  // Check cache for Google GenAI API key
  if (secretName === 'GOOGLE_GENAI_API_KEY' && !version) {
    if (
      googleGenAIApiKeyCache &&
      googleGenAIApiKeyCache.expiresAt > Date.now()
    ) {
      logger.info(`Using cached GOOGLE_GENAI_API_KEY:
        | valid for ${Math.round(
          (googleGenAIApiKeyCache.expiresAt - Date.now()) /
            (1000 * 60 * 60 * 24),
        )} days`);

      return googleGenAIApiKeyCache.value;
    }
  }

  const client = new SecretManagerServiceClient();

  const name = `projects/${
    process.env.GCP_PROJECT_NUMBER
  }/secrets/${secretName}/versions/${version || 'latest'}`;

  const [secretVersion] = await client.accessSecretVersion({
    name,
  });

  if (!secretVersion?.payload?.data) {
    throw new Error(`unable to retrieve secret: ${secretName}`);
  }

  const secret = secretVersion.payload.data.toString();

  // Cache Google GenAI API key
  if (secretName === 'GOOGLE_GENAI_API_KEY' && !version) {
    googleGenAIApiKeyCache = {
      value: secret,
      expiresAt: Date.now() + CACHE_TTL_MS,
    };
  }

  return secret;
}

/**
 * Clears the cached Google GenAI API key (useful for key rotation)
 */
export function clearGoogleGenAICache(): void {
  googleGenAIApiKeyCache = null;
}
