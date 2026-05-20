import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EmailService } from '../../email/email.service';
import { CreateUserDto } from './dto/create-user.dto';
import { Role, UserStatus } from '@prisma/client';

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  async create(orgId: string, dto: CreateUserDto) {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const role: Role = (dto.role as Role) ?? Role.EMPLOYEE;

    const code = randomInt(100000, 1000000).toString();
    const codeHash = await bcrypt.hash(code, 10);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          orgId,
          fullName: dto.fullName,
          email: dto.email.toLowerCase(),
          passwordHash,
          role,
          status: UserStatus.PENDING_VERIFICATION,
        },
        select: {
          id: true,
          orgId: true,
          email: true,
          fullName: true,
          role: true,
          status: true,
          emailVerifiedAt: true,
          createdAt: true,
        },
      });

      await tx.emailVerification.create({
        data: {
          userId: created.id,
          codeHash,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        },
      });

      return created;
    });

    await this.emailService.sendVerificationCode(user.email, code);
    return user;
  }

  async updateStatus(orgId: string, requestingUserId: string, targetUserId: string, status: 'ACTIVE' | 'DEACTIVATED') {
    if (requestingUserId === targetUserId) {
      throw new ForbiddenException('You cannot change your own status');
    }
    const user = await this.prisma.user.findFirst({
      where: { id: targetUserId, orgId },
      select: { id: true, status: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.status === UserStatus.PENDING_VERIFICATION) {
      throw new BadRequestException('Cannot change status of a user pending email verification');
    }
    return this.prisma.user.update({
      where: { id: targetUserId },
      data: { status: status as UserStatus },
      select: { id: true, orgId: true, email: true, fullName: true, role: true, status: true, createdAt: true },
    });
  }

  async list(orgId: string) {
    return this.prisma.user.findMany({
      where: { orgId },
      select: {
        id: true,
        orgId: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
