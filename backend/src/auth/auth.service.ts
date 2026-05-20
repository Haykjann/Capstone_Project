import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomInt } from 'crypto';
import { Prisma, Role, User, Org, UserStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { RegisterDto } from './dto/register.dto';
import { VerifyDto } from './dto/verify.dto';
import { LoginDto } from './dto/login.dto';
import { ResendDto } from './dto/resend.dto';
import { JwtPayload } from './jwt.strategy';

const REFRESH_COOKIE_NAME = 'refresh_token';
const RESEND_WINDOW_MS = 15 * 60 * 1000;
const RESEND_LIMIT = 3;
const MAX_CODE_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {
    this.ensureJwtSecrets();
  }

  private buildRefreshCookieOptions() {
    const isSecure = this.configService.get<boolean>('REFRESH_COOKIE_SECURE') ?? false;
    const domain = this.configService.get<string>('REFRESH_COOKIE_DOMAIN');
    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: isSecure,
      domain: domain || undefined,
      path: '/',
      maxAge: this.parseDurationToMs(
        this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d',
      ),
    };
  }

  private parseDurationToMs(duration: string): number {
    const match = /^(\d+)([smhd])?$/.exec(duration);
    if (!match) return 0;
    const value = Number(match[1]);
    const unit = match[2] ?? 's';
    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return value * 1000;
    }
  }

  private async hashPassword(password: string) {
    return bcrypt.hash(password, 10);
  }

  private async comparePassword(password: string, hash: string) {
    return bcrypt.compare(password, hash);
  }

  // Fix #1: use cryptographically secure randomInt instead of Math.random()
  private generateCode(): string {
    return randomInt(100000, 1000000).toString();
  }

  private async hashCode(code: string) {
    return bcrypt.hash(code, 10);
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async validateVerificationCode(userId: string, code: string) {
    const record = await this.prisma.emailVerification.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      throw new ForbiddenException('Verification code not found');
    }

    // Fix #4: lock after too many failed attempts
    if (record.failedAttempts >= MAX_CODE_ATTEMPTS) {
      throw new ForbiddenException('Too many failed attempts. Request a new code.');
    }

    const isExpired = record.expiresAt < new Date();
    if (isExpired) {
      throw new ForbiddenException('Verification code expired');
    }

    const match = await bcrypt.compare(code, record.codeHash);
    if (!match) {
      await this.prisma.emailVerification.update({
        where: { id: record.id },
        data: { failedAttempts: { increment: 1 } },
      });
      throw new ForbiddenException('Invalid verification code');
    }

    return record;
  }

  // Fix #2: store refresh token hash in DB for rotation/revocation
  private async signTokens(payload: { sub: string; orgId: string; role: Role }) {
    const accessSecret = this.getRequiredSecret('JWT_ACCESS_SECRET');
    const refreshSecret = this.getRequiredSecret('JWT_REFRESH_SECRET');
    const refreshExpiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: accessSecret,
        expiresIn: (this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m') as any,
      }),
      this.jwtService.signAsync(payload, {
        secret: refreshSecret,
        expiresIn: refreshExpiresIn as any,
      }),
    ]);

    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + this.parseDurationToMs(refreshExpiresIn));

    await this.prisma.refreshToken.create({
      data: {
        userId: payload.sub,
        tokenHash,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  async register(dto: RegisterDto) {
    const passwordHash = await this.hashPassword(dto.password);
    const code = this.generateCode();
    const codeHash = await this.hashCode(code);

    // Send email BEFORE writing to DB — if delivery fails the user can
    // retry with the same credentials without hitting a duplicate-key error.
    await this.emailService.sendVerificationCode(dto.email, code);

    try {
      await this.prisma.$transaction(async (tx) => {
        const org = await tx.org.create({ data: { name: dto.orgName } });
        const user = await tx.user.create({
          data: {
            orgId: org.id,
            email: dto.email.toLowerCase(),
            passwordHash,
            fullName: dto.fullName,
            role: Role.ADMIN,
            status: UserStatus.PENDING_VERIFICATION,
          },
        });
        await tx.emailVerification.create({
          data: {
            userId: user.id,
            codeHash,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          },
        });
      });
      return { message: 'Verification code sent. Check your email.' };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ForbiddenException('Email or org already exists');
      }
      throw err;
    }
  }

  async verify(dto: VerifyDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user) throw new UnauthorizedException('Invalid credentials');

    await this.validateVerificationCode(user.id, dto.code);

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { status: UserStatus.ACTIVE, emailVerifiedAt: new Date() },
      include: { org: true },
    });

    const tokens = await this.signTokens({
      sub: updated.id,
      orgId: updated.orgId,
      role: updated.role,
    });

    return {
      ...this.buildProfileResponse(updated),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: { org: true },
    });

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const validPassword = await this.comparePassword(dto.password, user.passwordHash);
    if (!validPassword) throw new UnauthorizedException('Invalid credentials');

    if (user.status === UserStatus.PENDING_VERIFICATION) {
      throw new ForbiddenException('EMAIL_NOT_VERIFIED');
    }
    if (user.status === UserStatus.DEACTIVATED) {
      throw new ForbiddenException('User is deactivated');
    }

    const tokens = await this.signTokens({
      sub: user.id,
      orgId: user.orgId,
      role: user.role,
    });

    return {
      ...this.buildProfileResponse(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async resend(dto: ResendDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user) throw new ForbiddenException('User not found');
    if (user.status !== UserStatus.PENDING_VERIFICATION) {
      throw new ForbiddenException('User already verified');
    }

    const existing = await this.prisma.emailVerification.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    const now = Date.now();
    let resendCount = 0;
    if (existing && now - existing.lastSentAt.getTime() < RESEND_WINDOW_MS) {
      resendCount = existing.resendCount;
      if (resendCount >= RESEND_LIMIT) {
        throw new ForbiddenException('Resend limit reached. Try again later.');
      }
    }

    const code = this.generateCode();
    const codeHash = await this.hashCode(code);

    await this.prisma.emailVerification.create({
      data: {
        userId: user.id,
        codeHash,
        expiresAt: new Date(now + 10 * 60 * 1000),
        resendCount: resendCount + 1,
        lastSentAt: new Date(),
      },
    });

    await this.emailService.sendVerificationCode(user.email, code);
    return { message: 'Verification code resent.' };
  }

  // Fix #2: validate stored token hash, revoke on use (rotation)
  async refresh(refreshToken: string | undefined) {
    if (!refreshToken) throw new UnauthorizedException('Missing refresh token');

    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        orgId: string;
        role: Role;
      }>(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      const tokenHash = this.hashToken(refreshToken);
      const storedToken = await this.prisma.refreshToken.findUnique({
        where: { tokenHash },
      });

      if (!storedToken || storedToken.revokedAt || storedToken.expiresAt < new Date()) {
        // If token is already revoked, revoke entire family (token reuse attack)
        if (storedToken?.revokedAt) {
          await this.prisma.refreshToken.updateMany({
            where: { userId: payload.sub, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }
        throw new UnauthorizedException('Invalid or expired refresh token');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: { org: true },
      });
      if (!user || user.status !== UserStatus.ACTIVE) {
        throw new UnauthorizedException('Invalid user');
      }

      // Revoke the used token before issuing a new one
      await this.prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: new Date() },
      });

      const tokens = await this.signTokens({
        sub: user.id,
        orgId: user.orgId,
        role: user.role,
      });

      return {
        ...this.buildProfileResponse(user),
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  getRefreshCookieName() {
    return REFRESH_COOKIE_NAME;
  }

  getRefreshCookieOptions() {
    return this.buildRefreshCookieOptions();
  }

  private getRequiredSecret(key: 'JWT_ACCESS_SECRET' | 'JWT_REFRESH_SECRET'): string {
    const value = this.configService.get<string>(key);
    if (!value) throw new Error(`Missing required environment variable: ${key}`);
    return value;
  }

  private ensureJwtSecrets() {
    this.getRequiredSecret('JWT_ACCESS_SECRET');
    this.getRequiredSecret('JWT_REFRESH_SECRET');
  }

  async getProfile(payload: JwtPayload) {
    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, orgId: payload.orgId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        orgId: true,
        status: true,
        emailVerifiedAt: true,
        createdAt: true,
        org: { select: { id: true, name: true } },
      },
    });

    if (!user) throw new UnauthorizedException('User not found');

    const { org, ...userSafe } = user;
    return { user: userSafe, org };
  }

  private buildProfileResponse(
    user: (User & { org?: Org | null }) | (Prisma.UserGetPayload<{ include: { org: true } }>),
  ) {
    return {
      user: {
        id: user.id,
        orgId: user.orgId,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        status: user.status,
        emailVerifiedAt: user.emailVerifiedAt,
        createdAt: user.createdAt,
      },
      org: user.org ? { id: user.org.id, name: user.org.name } : undefined,
    };
  }
}
