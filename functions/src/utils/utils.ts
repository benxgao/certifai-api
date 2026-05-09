// Utility helpers

export type GcpEnv = 'production' | 'uat';

export const getGcpEnv = (): GcpEnv => {
  const projectId = (process.env.GCP_PROJECT_ID || '').toLowerCase().trim();
  return projectId.includes('uat') ? 'uat' : 'production';
};

export const isProduction = getGcpEnv() === 'production';

export const isGcpUat = getGcpEnv() === 'uat';
