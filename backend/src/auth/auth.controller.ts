import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { VerifyDto } from './dto/verify.dto';
import { LoginDto } from './dto/login.dto';
import { ResendDto } from './dto/resend.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtPayload } from './jwt.strategy';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Fix #3: strict rate limits on register (5/min), verify (10/min), login (10/min), resend (5/min)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('verify')
  async verify(@Body() dto: VerifyDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.verify(dto);
    res.cookie(
      this.authService.getRefreshCookieName(),
      result.refreshToken,
      this.authService.getRefreshCookieOptions(),
    );
    return { accessToken: result.accessToken, user: result.user };
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto);
    res.cookie(
      this.authService.getRefreshCookieName(),
      result.refreshToken,
      this.authService.getRefreshCookieOptions(),
    );
    return { accessToken: result.accessToken, user: result.user };
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('resend-code')
  async resend(@Body() dto: ResendDto) {
    return this.authService.resend(dto);
  }

  @SkipThrottle()
  @Post('refresh')
  async refresh(@Res({ passthrough: true }) res: Response, @Body('refreshToken') bodyToken?: string) {
    const tokenFromCookie = res.req.cookies?.[this.authService.getRefreshCookieName()];
    const refreshToken = bodyToken || tokenFromCookie;
    const result = await this.authService.refresh(refreshToken);
    res.cookie(
      this.authService.getRefreshCookieName(),
      result.refreshToken,
      this.authService.getRefreshCookieOptions(),
    );
    return { accessToken: result.accessToken, user: result.user };
  }

  @SkipThrottle()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: true }) res: Response, @Req() req: Request & { user?: JwtPayload }) {
    const cookieName = this.authService.getRefreshCookieName();
    const options = this.authService.getRefreshCookieOptions();
    res.clearCookie(cookieName, options);
    res.cookie(cookieName, '', { ...options, maxAge: 0 });
    // Revoke all refresh tokens for the user if authenticated
    const userId = req.user?.sub;
    if (userId) {
      await this.authService.logout(userId);
    }
    return { message: 'Logged out' };
  }

  @SkipThrottle()
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: Request & { user?: JwtPayload }) {
    const payload = req.user;
    if (!payload) throw new Error('Invalid request context');
    return this.authService.getProfile(payload);
  }
}
