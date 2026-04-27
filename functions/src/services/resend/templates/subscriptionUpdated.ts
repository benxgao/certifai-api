import { baseStyles } from './baseStyles';

export function SubscriptionUpdatedTemplate({
  userName,
  subscriptionId,
  planName,
  amount,
  nextBillingDate,
  billingUrl,
}: {
  userName: string;
  subscriptionId: string;
  planName: string;
  amount: string;
  nextBillingDate: string;
  billingUrl: string;
}) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Subscription Updated - Certestic</title>
        ${baseStyles}
      </head>
      <body>
        <div class="container">
          <div class="card">
            <div class="header">
              <div class="logo">Certestic</div>
              <h1 class="title">Subscription Updated</h1>
              <p class="subtitle">Your plan has been successfully updated</p>
            </div>

            <div class="content">
              <p>Hi ${userName},</p>

              <p>Great news! Your Certestic subscription has been updated successfully.</p>

              <div class="success-box">
                <p style="margin: 0; font-weight: 600;">✅ ${planName} - ${amount}</p>
                <p style="margin: 8px 0 0 0; font-size: 14px;">Next billing date: ${nextBillingDate}</p>
              </div>

              <p>Your new plan includes:</p>
              <ul style="color: #475569; margin: 16px 0;">
                <li>Access to all certification materials</li>
                <li>Unlimited practice exams</li>
                <li>Detailed progress analytics</li>
                <li>Priority customer support</li>
              </ul>

              <div style="text-align: center;">
                <a href="${billingUrl}" class="button">Manage Billing</a>
              </div>

              <div class="details">
                <strong>Subscription ID:</strong> ${subscriptionId}<br>
                <strong>Plan:</strong> ${planName}<br>
                <strong>Amount:</strong> ${amount}<br>
                <strong>Next Billing:</strong> ${nextBillingDate}
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
