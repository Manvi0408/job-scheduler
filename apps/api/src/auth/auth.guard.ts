import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { AuthService } from './auth.service';
import { getJwtSecret } from './jwt.config';

interface JwtPayload {
  id: string;
  email: string;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const authHeader: string | undefined =
      request.headers['authorization'] || request.headers['Authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or malformed Authorization header');
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    let payload: JwtPayload;
    try {
      payload = jwt.verify(token, getJwtSecret()) as JwtPayload;
    } catch {
      // Covers expired, malformed, and forged (bad-signature) tokens.
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (!payload?.id) {
      throw new UnauthorizedException('Invalid token payload');
    }

    // Ensure the user still exists (handles deleted accounts / stale tokens).
    const user = await this.authService.validateUserById(payload.id);
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    request.user = { id: user.id, email: user.email };
    return true;
  }
}
