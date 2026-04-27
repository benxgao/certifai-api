import { baseStyles } from './baseStyles';

export function TrialEndingTemplate({
  userName,
  trialEndDate,
  subscriptionId,
  upgradeUrl,
}: {
  userName: string;
  trialEndDate: string;
  subscriptionId: string;
  upgradeUrl: string;
}) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your Certestic trial is ending soon</title>
        ${baseStyles}
      </head>
      <body>
        <div class="container">
          <div class="card">
            <div class="header">
              <div class="logo">Certestic</div>
              <h1 class="title">Your trial is ending soon</h1>
              <p class="subtitle">Continue your certification journey</p>
            </div>

            <div class="content">
              <p>Hi ${userName},</p>

              <p>Your Certestic trial will end on <strong>${trialEndDate}</strong>. We hope you've enjoyed exploring our platform and preparing for your certification exams!</p>

              <div class="warning-box">
                <p style="margin: 0; font-weight: 600;">⏰ Don't lose access to your progress</p>
                <p style="margin: 8px 0 0 0; font-size: 14px;">Upgrade now to keep all your study materials, practice exams, and progress tracking.</p>
              </div>

              <p>With a subscription, you'll continue to have access to:</p>
              <ul style="color: #475569; margin: 16px 0;">
                <li>Unlimited practice exams</li>
                <li>Detailed explanations and study guides</li>
                <li>Progress tracking and analytics</li>
                <li>New content and certifications</li>
              </ul>

              <div style="text-align: center;">
                <a href="${upgradeUrl}" class="button">Upgrade Now</a>
              </div>

              <div class="details">
                <strong>Subscription ID:</strong> ${subscriptionId}
              </div>
            </div>

            <div class="footer">
              <p>Questions? <a href="mailto:support@certestic.com">Contact our support team</a></p>
              <p>© 2025-2026 Certestic. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}
