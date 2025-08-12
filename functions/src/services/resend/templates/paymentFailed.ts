import { baseStyles } from './baseStyles';

export function PaymentFailedTemplate({
  userName,
  subscriptionId,
  amount,
  retryDate,
  billingUrl,
}: {
  userName: string;
  subscriptionId: string;
  amount: string;
  retryDate?: string;
  billingUrl: string;
}) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Failed - Certestic</title>
        ${baseStyles}
      </head>
      <body>
        <div class="container">
          <div class="card">
            <div class="header">
              <div class="logo">Certestic</div>
              <h1 class="title">Payment Failed</h1>
              <p class="subtitle">Action required to continue your subscription</p>
            </div>

            <div class="content">
              <p>Hi ${userName},</p>

              <p>We were unable to process your payment of <strong>${amount}</strong> for your Certestic subscription.</p>

              <div class="warning-box">
                <p style="margin: 0; font-weight: 600;">⚠️ Action Required</p>
                <p style="margin: 8px 0 0 0; font-size: 14px;">Please update your payment method to avoid interruption of your service.</p>
              </div>

              <p>Common reasons for payment failures:</p>
              <ul style="color: #475569; margin: 16px 0;">
                <li>Expired credit card</li>
                <li>Insufficient funds</li>
                <li>Bank declined the transaction</li>
                <li>Billing address mismatch</li>
              </ul>

              ${
                retryDate
                  ? `<p>We'll automatically retry the payment on <strong>${retryDate}</strong>, but you can update your payment method now to resolve this immediately.</p>`
                  : ''
              }

              <div style="text-align: center;">
                <a href="${billingUrl}" class="button">Update Payment Method</a>
              </div>

              <div class="details">
                <strong>Subscription ID:</strong> ${subscriptionId}<br>
                <strong>Failed Amount:</strong> ${amount}
                ${
                  retryDate
                    ? `<br><strong>Retry Date:</strong> ${retryDate}`
                    : ''
                }
              </div>
            </div>

            <div class="footer">
              <p>Questions? <a href="mailto:support@certestic.com">Contact our support team</a></p>
              <p>© 2025 Certestic. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}
