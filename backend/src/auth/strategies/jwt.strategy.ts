import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

const fromCookieOrBearer = (req: Request): string | null => {
  const cookie =
    (req?.cookies as Record<string, string> | undefined)?.['access_token'] ??
    null;
  if (cookie) return cookie;
  const auth = req?.headers?.authorization;
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  return null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private prisma: PrismaService,
    config: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([fromCookieOrBearer]),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET', 'default-dev-secret'),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });
    if (!user || !user.isActive)
      throw new UnauthorizedException('User not found or inactive');
    return user;
  }
}
