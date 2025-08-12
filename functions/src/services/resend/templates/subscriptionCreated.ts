import { baseStyles } from './baseStyles';

export function SubscriptionCreatedTemplate({
  userName,
  planName,
  welcomeUrl,
}: {
  userName: string;
  planName: string;
  welcomeUrl: string;
}) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Certifai - Subscription Created</title>
        ${baseStyles}
      </head>
      <body>
        <div class="container">
          <div class="card">
            <div class="header">
              <div class="logo">Certifai</div>
              <h1 class="title">Welcome to Certifai! 🎉</h1>
              <p class="subtitle">Your subscription has been created successfully</p>
            </div>

            <div class="content">
              <p>Hi ${userName},</p>

              <p>Welcome to Certifai! We're excited to have you on board. Your <strong>${planName}</strong> subscription is now active and ready to use.</p>

              <div class="success-box">
                <p style="margin: 0; font-weight: 600;">🚀 You're all set!</p>
                <p style="margin: 8px 0 0 0; font-size: 14px;">Start your certification journey today</p>
              </div>

              <p>With your subscription, you now have access to:</p>
              <ul style="color: #475569; margin: 16px 0;">
                <li>🎯 Comprehensive certification study guides</li>
                <li>📝 Unlimited practice exams with detailed explanations</li>
                <li>📊 Advanced progress tracking and analytics</li>
                <li>🤖 AI-powered adaptive learning recommendations</li>
                <li>🏆 Certification roadmaps and career guidance</li>
                <li>💬 24/7 community support</li>
              </ul>

              <p><strong>Ready to get started?</strong></p>
              <p>Jump into your learning dashboard and begin exploring the certification paths that match your career goals.</p>

              <div class="button-container">
                <a href="${welcomeUrl}" class="button">Start Learning Now</a>
              </div>

              <div style="margin-top: 32px; padding: 20px; background-color: #f8fafc; border-radius: 8px; border-left: 4px solid #0ea5e9;">
                <p style="margin: 0; font-weight: 600; color: #0f172a;">💡 Pro Tip</p>
                <p style="margin: 8px 0 0 0; font-size: 14px; color: #475569;">
                  Start with our <strong>Certification Roadmap Quiz</strong> to get personalized recommendations based on your experience and career goals.
                </p>
              </div>

              <p>If you have any questions or need help getting started, our support team is here to assist you.</p>

              <p>Happy learning!</p>
              <p style="margin: 0;">The Certifai Team</p>
            </div>

            <div class="footer">
              <p>Need help? <a href="mailto:support@certifai.com">Contact our support team</a></p>
              <p>
                <a href="${welcomeUrl}">Dashboard</a> •
                <a href="${welcomeUrl}/profile">Manage Account</a> •
                <a href="https://certifai.com/support">Help Center</a>
              </p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}
