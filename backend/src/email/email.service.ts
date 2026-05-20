import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { SendMailOptions } from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('SMTP_HOST');
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASSWORD');
    const port = Number(this.configService.get<string>('SMTP_PORT') ?? 587);

    if (!host || !user || !pass) {
      throw new Error(
        'Email is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASSWORD in your .env file.\n' +
        'For Gmail: SMTP_HOST=smtp.gmail.com  SMTP_PORT=587  SMTP_USER=you@gmail.com  SMTP_PASSWORD=<app-password>',
      );
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  }

  private get defaultFrom(): string {
    return (
      this.configService.get<string>('EMAIL_FROM') ??
      `"Phishing Training" <${this.configService.get<string>('SMTP_USER')}>`
    );
  }

  async sendMail(options: SendMailOptions): Promise<void> {
    try {
      await this.transporter.sendMail({ from: this.defaultFrom, ...options });
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error('[EmailService] Failed to send email:', err);
      const detail = err?.message ?? String(err);
      throw new InternalServerErrorException(`Failed to send email: ${detail}`);
    }
  }

  // Send using caller-supplied Gmail credentials (used by phishing campaigns)
  async sendMailAs(
    credentials: { user: string; password: string },
    options: SendMailOptions,
  ): Promise<void> {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: { user: credentials.user, pass: credentials.password },
    });
    try {
      await transporter.sendMail(options);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[EmailService] sendMailAs failed:', err);
      throw new InternalServerErrorException('Failed to send email. Check Gmail credentials and App Password.');
    }
  }

  async sendVerificationCode(email: string, code: string): Promise<void> {
    await this.sendMail({
      to: email,
      subject: 'Your verification code',
      text: `Your verification code is ${code}. It expires in 10 minutes.`,
      html: `<p>Your verification code is <strong>${code}</strong>. It expires in 10 minutes.</p>`,
    });
  }
}
