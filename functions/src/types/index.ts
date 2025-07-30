import { Request } from 'express';

export type FirebaseJwtToken = {
  iss: string; // 'https://securetoken.google.com/certifai-prod';
  aud: string; // 'rpoejct_id';
  auth_time: number;
  user_id?: string; // 'uid';
  sub: string; // 'uid';
  iat: number;
  exp: number;
  email?: string; // '@gmail.com';
  email_verified?: boolean;
  firebase: {
    identities: { [key: string]: any }; // { email: string[] };
    sign_in_provider: string; // 'password';
  };
  uid: string; // 'uid';
};

export type CustomRequest = Request & {
  firebase_user_info: FirebaseJwtToken;
  verified_user?: {
    user_id: string;
    firebase_user_id: string;
  };
};

// Re-export pagination types for convenience
export {
  PaginationParams,
  PaginationMeta,
  PaginatedResponse,
  PaginationOptions,
  PrismaFindManyWithCount,
} from '../utils/pagination';
