import { Resend } from 'resend';
import logger from '../firebase/logger';
import {
  TrialEndingTemplate,
  SubscriptionCanceledTemplate,
  SubscriptionCreatedTemplate,
  SubscriptionUpdatedTemplate,
  PaymentFailedTemplate,
} from './templates/index.js';

export class ResendService {
  private static resend: Resend | null = null;

  private static getClient(): Resend {
    if (!this.resend) {
      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) {
        throw new Error(
          'RESEND_API_KEY environment variable is not configured',
        );
      }
      this.resend = new Resend(apiKey);
    }
    return this.resend;
  }

  /**
   * Send an email using Resend
   */
  static async sendEmail({
    to,
    subject,
    html,
    from = 'Certestic <noreply@certestic.com>',
    replyTo,
  }: {
    to: string | string[];
    subject: string;
    html: string;
    from?: string;
    replyTo?: string;
  }) {
    try {
      const client = this.getClient();

      const result = await client.emails.send({
        from,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        replyTo,
      });

      logger.info('RESEND_EMAIL_SENT', {
        to: Array.isArray(to) ? to : [to],
        subject,
        result,
      });

      return result;
    } catch (error) {
      logger.error('RESEND_EMAIL_ERROR', {
        error,
        to: Array.isArray(to) ? to : [to],
        subject,
      });
      throw error;
    }
  }

  /**
   * Send subscription created (welcome) notification
   */
  static async sendSubscriptionCreated({
    email,
    userName,
    planName,
  }: {
    email: string;
    userName?: string;
    planName: string;
  }) {
    const html = SubscriptionCreatedTemplate({
      userName: userName || 'there',
      planName,
      welcomeUrl: `${process.env.FRONTEND_URL || 'https://certestic.com'}/main`,
    });

    return this.sendEmail({
      to: email,
      subject: 'Welcome to Certestic - Your subscription is ready! 🎉',
      html,
    });
  }

  /**
   * Send trial ending notification
   */
  static async sendTrialEndingNotification({
    email,
    userName,
    subscriptionId,
    trialEndDate,
  }: {
    email: string;
    userName?: string;
    subscriptionId: string;
    trialEndDate: Date;
  }) {
    const html = TrialEndingTemplate({
      userName: userName || 'there',
      trialEndDate: trialEndDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      subscriptionId,
      upgradeUrl: `${
        process.env.FRONTEND_URL || 'https://certestic.com'
      }/pricing`,
    });

    return this.sendEmail({
      to: email,
      subject: 'Your Certestic trial is ending soon - Action required',
      html,
    });
  }

  /**
   * Send subscription canceled notification
   */
  static async sendSubscriptionCanceled({
    email,
    userName,
    subscriptionId,
    currentPeriodEnd,
  }: {
    email: string;
    userName?: string;
    subscriptionId: string;
    currentPeriodEnd: Date;
  }) {
    const html = SubscriptionCanceledTemplate({
      userName: userName || 'there',
      subscriptionId,
      accessEndDate: currentPeriodEnd.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      reactivateUrl: `${
        process.env.FRONTEND_URL || 'https://certestic.com'
      }/pricing`,
    });

    return this.sendEmail({
      to: email,
      subject: 'Your Certestic subscription has been canceled',
      html,
    });
  }

  /**
   * Send subscription updated notification
   */
  static async sendSubscriptionUpdated({
    email,
    userName,
    subscriptionId,
    planName,
    amount,
    currency,
    nextBillingDate,
  }: {
    email: string;
    userName?: string;
    subscriptionId: string;
    planName: string;
    amount: number;
    currency: string;
    nextBillingDate: Date;
  }) {
    const formattedAmount = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);

    const html = SubscriptionUpdatedTemplate({
      userName: userName || 'there',
      subscriptionId,
      planName,
      amount: formattedAmount,
      nextBillingDate: nextBillingDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      billingUrl: `${
        process.env.FRONTEND_URL || 'https://certestic.com'
      }/billing`,
    });

    return this.sendEmail({
      to: email,
      subject: `Your Certestic subscription has been updated`,
      html,
    });
  }

  /**
   * Send payment failed notification
   */
  static async sendPaymentFailed({
    email,
    userName,
    subscriptionId,
    amount,
    currency,
    retryDate,
  }: {
    email: string;
    userName?: string;
    subscriptionId: string;
    amount: number;
    currency: string;
    retryDate?: Date;
  }) {
    const formattedAmount = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);

    const html = PaymentFailedTemplate({
      userName: userName || 'there',
      subscriptionId,
      amount: formattedAmount,
      retryDate: retryDate?.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      billingUrl: `${
        process.env.FRONTEND_URL || 'https://certestic.com'
      }/billing`,
    });

    return this.sendEmail({
      to: email,
      subject: 'Payment failed for your Certestic subscription',
      html,
    });
  }
}

export default ResendService;
