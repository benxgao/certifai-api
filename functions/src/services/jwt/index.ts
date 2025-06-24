import { SignJWT, jwtVerify } from 'jose';

export interface JWTPayload {
  sub: string; // subject (user id or app id)
  iat: number; // issued at
  exp: number; // expiration time
  scope?: string; // optional scope for permissions
}

class JWTService {
  private secretKey: Uint8Array;

  constructor() {
    const secret = process.env.PUBLIC_JWT_SECRET;
    if (!secret) {
      throw new Error('PUBLIC_JWT_SECRET environment variable is required');
    }
    this.secretKey = new TextEncoder().encode(secret);
  }

  /**
   * Generate a JWT token
   */
  async generateToken(
    payload: Omit<JWTPayload, 'iat' | 'exp'>,
    expiresIn: string = '24h',
  ): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const expiration = this.parseExpiration(expiresIn);

    return await new SignJWT({
      sub: payload.sub,
      scope: payload.scope || 'public:read',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(now)
      .setExpirationTime(now + expiration)
      .sign(this.secretKey);
  }

  /**
   * Verify a JWT token
   */
  async verifyToken(token: string): Promise<JWTPayload> {
    try {
      const { payload } = await jwtVerify(token, this.secretKey);

      return {
        sub: payload.sub as string,
        iat: payload.iat as number,
        exp: payload.exp as number,
        scope: payload.scope as string,
      };
    } catch {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Parse expiration string to seconds
   */
  private parseExpiration(expiresIn: string): number {
    const units: { [key: string]: number } = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
    };

    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new Error(
        'Invalid expiration format. Use format like "1h", "30m", "7d"',
      );
    }

    const [, value, unit] = match;
    return parseInt(value, 10) * units[unit];
  }
}

export const jwtService = new JWTService();
