import { createRemoteJWKSet, jwtVerify, SignJWT } from 'jose';
import { randomUUID } from 'node:crypto';
import { URL } from 'node:url';
import { TextEncoder } from 'node:util';
import { Admin } from '../types/index';

const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];
const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const SESSION_ISSUER = 'united-hatzalah-shoham-branch';
const SESSION_AUDIENCE = 'admin-api';

const getSessionKey = () => {
  const secret = process.env.SESSION_SECRET;
  if (typeof secret !== 'string' || secret.length < 32) return null;
  return new TextEncoder().encode(secret);
};

export interface GoogleAdminIdentity {
  email: string;
  name: string;
  picture?: string;
}

export interface AdminSession {
  adminId: string;
  email: string;
}

export class AuthTokenService {
  static async verifyGoogleIdToken(credential: string): Promise<GoogleAdminIdentity> {
    const audience = process.env.GOOGLE_CLIENT_ID;
    if (!audience) throw new Error('Google authentication is unavailable');

    const { payload } = await jwtVerify(credential, GOOGLE_JWKS, {
      audience,
      issuer: GOOGLE_ISSUERS,
    });

    if (typeof payload.email !== 'string' || payload.email_verified !== true) {
      throw new Error('Google credential is invalid');
    }

    return {
      email: payload.email.toLowerCase(),
      name:
        typeof payload.name === 'string' && payload.name.trim()
          ? payload.name.trim()
          : payload.email,
      picture: typeof payload.picture === 'string' ? payload.picture : undefined,
    };
  }

  static async issueAdminSession(admin: Admin): Promise<string> {
    const key = getSessionKey();
    if (!key) throw new Error('Admin sessions are unavailable');

    return new SignJWT({ email: admin.email.toLowerCase() })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(SESSION_ISSUER)
      .setAudience(SESSION_AUDIENCE)
      .setSubject(admin.id)
      .setJti(randomUUID())
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(key);
  }

  static async verifyAdminSession(token: string): Promise<AdminSession | null> {
    const key = getSessionKey();
    if (!token || !key) return null;

    try {
      const { payload } = await jwtVerify(token, key, {
        algorithms: ['HS256'],
        issuer: SESSION_ISSUER,
        audience: SESSION_AUDIENCE,
      });
      if (!payload.sub || typeof payload.email !== 'string') return null;
      return { adminId: payload.sub, email: payload.email.toLowerCase() };
    } catch {
      return null;
    }
  }
}
