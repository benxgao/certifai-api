# Environment Variables for Resend Email Service

# Add this to your environment configuration (.env or Firebase Functions config)

# Resend API Key (required)

RESEND_API_KEY=re_your_api_key_here

# Frontend URL for email links (optional, defaults to https://certifai.com)

FRONTEND_URL=https://certifai.com

# Example .env.local file content:

# RESEND_API_KEY=re_123abc456def789ghi012jkl345mno678pqr

# FRONTEND_URL=https://app.certifai.com

# For Firebase Functions, set using:

# firebase functions:config:set resend.api_key="re_your_api_key_here"

# firebase functions:config:set app.frontend_url="https://certifai.com"

# Then access in code as:

# process.env.RESEND_API_KEY

# process.env.FRONTEND_URL
