/**
 * Base styles for email templates
 * Based on Certifai Design System & Style Guide
 */

export const baseStyles = `
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.6;
      color: #0f172a;
      background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #f1f5f9 100%);
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .card {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      border-radius: 16px;
      border: 1px solid rgba(226, 232, 240, 0.6);
      padding: 40px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 32px;
    }
    .logo {
      background: linear-gradient(135deg, #7c3aed, #2563eb);
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 24px;
      font-weight: bold;
      letter-spacing: -0.5px;
      display: inline-block;
      margin-bottom: 16px;
    }
    .title {
      font-size: 28px;
      font-weight: bold;
      color: #0f172a;
      margin: 0 0 8px 0;
      letter-spacing: -0.5px;
    }
    .subtitle {
      font-size: 16px;
      color: #64748b;
      margin: 0;
    }
    .content {
      margin: 32px 0;
    }
    .content p {
      margin: 16px 0;
      color: #475569;
      font-size: 16px;
      line-height: 1.6;
    }
    .button {
      display: inline-block;
      background: linear-gradient(135deg, #7c3aed, #2563eb);
      color: white;
      text-decoration: none;
      padding: 14px 28px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      margin: 24px 0;
      transition: all 0.3s ease;
    }
    .button:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 25px -5px rgba(124, 58, 237, 0.4);
    }
    .button-secondary {
      background: rgba(100, 116, 139, 0.1);
      color: #475569;
      border: 1px solid rgba(100, 116, 139, 0.2);
    }
    .info-box {
      background: rgba(37, 99, 235, 0.05);
      border: 1px solid rgba(37, 99, 235, 0.1);
      border-radius: 12px;
      padding: 20px;
      margin: 24px 0;
    }
    .warning-box {
      background: rgba(245, 101, 101, 0.05);
      border: 1px solid rgba(245, 101, 101, 0.1);
      border-radius: 12px;
      padding: 20px;
      margin: 24px 0;
    }
    .success-box {
      background: rgba(34, 197, 94, 0.05);
      border: 1px solid rgba(34, 197, 94, 0.1);
      border-radius: 12px;
      padding: 20px;
      margin: 24px 0;
    }
    .footer {
      text-align: center;
      margin-top: 40px;
      padding-top: 24px;
      border-top: 1px solid rgba(226, 232, 240, 0.6);
      color: #64748b;
      font-size: 14px;
    }
    .footer a {
      color: #7c3aed;
      text-decoration: none;
    }
    .details {
      background: rgba(248, 250, 252, 0.8);
      border-radius: 8px;
      padding: 16px;
      margin: 20px 0;
      font-size: 14px;
      color: #64748b;
    }
  </style>
`;
