import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config/config';

export function generateCodeVerifier(): string {
  return crypto.randomBytes(64).toString('hex');
}

export function generateCodeChallenge(codeVerifier: string): string {
  return crypto.createHash('sha256').update(codeVerifier).digest('base64url');
}

type User = {
  id: string;
  username: string;
  email: string;
  role: string;
};

export function generateToken(user: User) {
  const token = jwt.sign(user, config.secret.jwtsecret, { expiresIn: '3m' });
  const refreshToken = crypto.randomBytes(64).toString('hex');
  return { token, refreshToken };
}

export function hash(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function verifyToken(token: string) {
  try {
    return jwt.verify(token, config.secret.jwtsecret) as User;
  } catch (error) {
    const wrappedError = new Error('Invalid or expired token') as Error & {
      cause?: unknown;
    };
    wrappedError.cause = error;
    throw wrappedError;
  }
}
