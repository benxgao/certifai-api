import { baseStyles } from './baseStyles';

export function SubscriptionCanceledTemplate({
  userName,
  subscriptionId,
  accessEndDate,
  reactivateUrl,
}: {
  userName: string;
  subscriptionId: string;
  accessEndDate: string;
  reactivateUrl: string;
}) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Subscription Canceled - Certestic</title>
        ${baseStyles}
      </head>
      <body>
        <div class="container">
          <div class="card">
            <div class="header">
              <div class="logo">Certestic</div>
              <h1 class="title">Subscription Canceled</h1>
              <p class="subtitle">We're sorry to see you go</p>
            </div>

            <div class="content">
              <p>Hi ${userName},</p>

              <p>Your Certestic subscription has been successfully canceled. You'll continue to have access to all features until <strong>${accessEndDate}</strong>.</p>

              <div class="info-box">
                <p style="margin: 0; font-weight: 600;">📅 Access continues until ${accessEndDate}</p>
                <p style="margin: 8px 0 0 0; font-size: 14px;">You can still use all features and download your progress data until your current period ends.</p>
              </div>

              <p>What happens next:</p>
              <ul style="color: #475569; margin: 16px 0;">
                <li>Your access continues until ${accessEndDate}</li>
                <li>No future charges will be made</li>
                <li>You can reactivate anytime before ${accessEndDate}</li>
                <li>Your progress and data will be preserved for 30 days after cancellation</li>
              </ul>

              <p>Changed your mind? You can reactivate your subscription at any time:</p>

              <div style="text-align: center;">
                <a href="${reactivateUrl}" class="button">Reactivate Subscription</a>
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
