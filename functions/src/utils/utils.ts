// Utility helpers

export type GcpEnv = 'production' | 'uat';

function getGcpEnv(): GcpEnv {
  const projectId = (process.env.GCP_PROJECT_ID || '').toLowerCase().trim();
  return projectId.includes('uat') ? 'uat' : 'production';
}

export const isProduction = getGcpEnv() === 'production';
