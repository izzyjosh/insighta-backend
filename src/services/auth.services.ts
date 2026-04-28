import { config } from '../config/config';
import { AppDataSource } from '../config/datasource';
import { User } from '../models/User.model';
import { RefreshToken } from '../models/RefreshToken';
import {
  generateCodeChallenge,
  generateCodeVerifier,
  generateToken,
  hash,
} from '../utils/auth_helper';
import crypto from 'crypto';
import { redisClient } from '../config/redis';
import axios from 'axios';
import { UserSchema } from '../schemas/user.schemas';

class AuthService {
  private readonly userRepository = AppDataSource.getRepository(User);
  private readonly refreshTokenRepository =
    AppDataSource.getRepository(RefreshToken);

  async githubRedirect(): Promise<string> {
    const state = crypto.randomBytes(16).toString('hex');
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    await redisClient.set(`oauth:${state}`, codeVerifier, {
      EX: 600, // Expires in 5 minutes
    });

    const redirectUri = new URL(
      '/api/auth/github/callback',
      config.url.base,
    ).toString();
    const url = new URL('https://github.com/login/oauth/authorize');

    url.searchParams.set('client_id', config.github.clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');

    return url.toString();
  }

  async githubCallback(code: string, state: string) {
    const data = await redisClient.get(`oauth:${state}`);
    if (!data) {
      throw new Error('Invalid or expired state parameter');
    }

    const codeVerifier = data;

    await redisClient.del(`oauth:${state}`);

    const tokenResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: config.github.clientId,
        client_secret: config.github.clientSecret,
        code,
        code_verifier: codeVerifier,
      },
      {
        headers: {
          Accept: 'application/json',
        },
      },
    );

    const accessToken = tokenResponse.data.access_token;

    const userResponse = await axios.get('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const {
      id: github_id,
      login: username,
      email,
      avatar_url,
    } = userResponse.data;

    let user = await this.userRepository.findOne({ where: { github_id } });
    if (!user) {
      user = this.userRepository.create({
        github_id: github_id.toString(),
        username,
        email,
        avatar_url,
        last_login: new Date(),
      });
      user.is_active = true;
      await this.userRepository.save(user);
    } else {
      if (user.is_active === true) {
        user.last_login = new Date();
        await this.userRepository.save(user);
      } else {
        throw new Error('User account is inactive. Please contact support.');
      }
    }

    const payload = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    };

    const { token, refreshToken } = generateToken(payload);

    await this.refreshTokenRepository.create({
      user_id: user.id,
      token_hash: hash(refreshToken),
      expires_at: new Date(Date.now() + 5 * 1000),
    });

    return { token, refreshToken, user: UserSchema.parse(user) };
  }

  async refreshToken(oldRefreshToken: string) {
    const tokenHash = hash(oldRefreshToken);
    const storedToken = await this.refreshTokenRepository.findOne({
      where: { token_hash: tokenHash },
    });

    if (
      !storedToken ||
      storedToken.revoked ||
      storedToken.expires_at < new Date()
    ) {
      throw new Error('Invalid or expired refresh token');
    }
    const user = await this.userRepository.findOne({
      where: { id: storedToken.user_id },
    });
    if (!user) {
      throw new Error('User not found');
    }

    storedToken.revoked = true;
    storedToken.revoked_at = new Date();
    await this.refreshTokenRepository.save(storedToken);

    const payload = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    };
    const { token, refreshToken } = generateToken(payload);
    await this.refreshTokenRepository.create({
      user_id: user.id,
      token_hash: hash(refreshToken),
      expires_at: new Date(Date.now() + 5 * 1000),
    });

    return { token, refreshToken };
  }

  async logout(refreshToken: string) {
    const tokenHash = hash(refreshToken);
    const storedToken = await this.refreshTokenRepository.findOne({
      where: { token_hash: tokenHash },
    });
    if (storedToken) {
      storedToken.revoked = true;
      storedToken.revoked_at = new Date();
      await this.refreshTokenRepository.save(storedToken);
    }
  }
}

export const authService = new AuthService();
