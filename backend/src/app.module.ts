import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { EmailModule } from './email/email.module';
import { MeModule } from './me/me.module';
import { AdminQuizzesModule } from './admin/quizzes/admin-quizzes.module';
import { AdminAssignmentsModule } from './admin/assignments/admin-assignments.module';
import { AdminUsersModule } from './admin/users/admin-users.module';
import { AdminAttemptsModule } from './admin/attempts/admin-attempts.module';
import { AdminAnalyticsModule } from './admin/analytics/admin-analytics.module';
import { PhishingCampaignsModule } from './phishing/phishing-campaigns.module';
import { AdminTeamsModule } from './admin/teams/admin-teams.module';
import { AdminOrgModule } from './admin/org/admin-org.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Fix #3: global rate limiting (overridable per-route with @Throttle)
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: Number(config.get('THROTTLE_TTL_MS') ?? 60000),
            limit: Number(config.get('THROTTLE_LIMIT') ?? 60),
          },
        ],
      }),
    }),
    PrismaModule,
    HealthModule,
    EmailModule,
    AuthModule,
    MeModule,
    AdminQuizzesModule,
    AdminAssignmentsModule,
    AdminUsersModule,
    AdminAttemptsModule,
    AdminAnalyticsModule,
    PhishingCampaignsModule,
    AdminTeamsModule,
    AdminOrgModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
