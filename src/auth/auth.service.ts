import {
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.module';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { LoginDto, RegisterDto } from './dto/auth.dto';

const BCRYPT_ROUNDS = 10;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult extends AuthTokens {
  user: Omit<User, 'passwordHash'>;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(dto: RegisterDto, meta: { userAgent?: string; ip?: string }): Promise<AuthResult> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new UnauthorizedException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        name: dto.name,
      },
    });

    // every new user gets a FREE subscription with the default monthly quota
    await this.prisma.subscription.create({
      data: {
        userId: user.id,
        plan: 'FREE',
        status: 'ACTIVE',
        monthlyLimit: 100,
        currentPeriodEnd: this.nextMonth(),
      },
    });

    return this.issueTokens(user, meta);
  }

  async login(dto: LoginDto, meta: { userAgent?: string; ip?: string }): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    // same error for unknown email and wrong password — no user enumeration
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Account is disabled');
    }
    return this.issueTokens(user, meta);
  }

  /**
   * Refresh-token rotation: the presented refresh token is revoked and a
   * fresh pair is issued. Reuse of a revoked token is rejected.
   */
  async refresh(refreshToken: string, meta: { userAgent?: string; ip?: string }): Promise<AuthResult> {
    let payload: JwtPayload & { type?: string };
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const session = await this.prisma.session.findUnique({
      where: { refreshToken },
      include: { user: true },
    });
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(session.user, meta);
  }

  async logout(refreshToken: string): Promise<{ message: string }> {
    const session = await this.prisma.session.findUnique({
      where: { refreshToken },
    });
    if (session && !session.revokedAt) {
      await this.prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
    }
    // idempotent: logging out with an unknown/already-revoked token still succeeds
    return { message: 'Logged out' };
  }

  async logoutAll(userId: string): Promise<{ message: string }> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { message: 'Logged out everywhere' };
  }

  private async issueTokens(
    user: User,
    meta: { userAgent?: string; ip?: string },
  ): Promise<AuthResult> {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES', '15m'),
    });

    // opaque-ish refresh token: jwt with a distinct secret + short random suffix
    const jti = randomBytes(16).toString('hex');
    const refreshToken = await this.jwtService.signAsync(
      { ...payload, type: 'refresh', jti },
      {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES', '7d'),
      },
    );

    const refreshTtl = this.parseExpires(this.configService.get<string>('JWT_REFRESH_EXPIRES', '7d'));
    await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshToken,
        userAgent: meta.userAgent,
        ipAddress: meta.ip,
        expiresAt: new Date(Date.now() + refreshTtl),
      },
    });

    const { passwordHash: _ph, ...safeUser } = user;
    return { user: safeUser, accessToken, refreshToken };
  }

  /** Parses simple durations like "15m", "7d", "12h" into milliseconds. */
  private parseExpires(value: string): number {
    const match = /^(\d+)([smhd])$/.exec(value);
    if (!match) return 7 * 24 * 60 * 60 * 1000;
    const amount = Number(match[1]);
    const unitMs: Record<string, number> = {
      s: 1000,
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
    };
    return amount * unitMs[match[2]];
  }

  private nextMonth(): Date {
    return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }
}
