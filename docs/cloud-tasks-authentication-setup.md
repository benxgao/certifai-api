# Cloud Tasks Authentication Setup for Protected Delegators Endpoint

## Overview

The delegators Cloud Function is protected with "Require authentication with custom audiences" set to:
`https://us-central1-certifai-prod.cloudfunctions.net/delegators`

This document outlines the required configuration to ensure Cloud Tasks can successfully authenticate and trigger the protected delegators endpoint.

## Required Configuration

### 1. Service Account Setup

The Cloud Tasks service account specified in `GCP_TASKS_SERVICE_ACCOUNT` must have the following IAM roles:

- **Cloud Tasks Enqueuer** (`roles/cloudtasks.enqueuer`)
- **Cloud Run Invoker** (`roles/run.invoker`) - Required for 2nd generation Cloud Functions (Firebase Functions v2)
- **Service Account Token Creator** (`roles/iam.serviceAccountTokenCreator`) - if using a different service account

> **Note**: Firebase Functions v2 (2nd generation) uses Cloud Run under the hood, so `roles/run.invoker` is required instead of the legacy `roles/cloudfunctions.invoker`.

### 2. Environment Variables

Ensure the following environment variables are properly set:

```bash
GCP_PROJECT_ID="your-project-id"
GCP_REGION="us-central1"
GCP_TASKS_SERVICE_ACCOUNT="your-service-account@your-project.iam.gserviceaccount.com"
GCP_TASKS_HOST="https://us-central1-your-project.cloudfunctions.net"
```

### 3. OIDC Token Configuration

The Cloud Tasks are configured with OIDC authentication:

- **Service Account**: Uses the service account specified in `GCP_TASKS_SERVICE_ACCOUNT`
- **Audience**: Must exactly match the protected function URL: `https://us-central1-certifai-prod.cloudfunctions.net/delegators`

## Code Implementation

The `createCloudTask` function automatically handles authentication by:

1. **Validating required environment variables** before creating tasks
2. **Setting OIDC token** with the correct service account and audience
3. **Including proper headers** for JSON content
4. **Providing detailed error logging** for authentication issues

## Verification Steps

### 1. Test Task Creation

Monitor the logs when creating Cloud Tasks to ensure:

- No missing environment variable errors
- Successful task creation with authentication
- No permission-related errors

### 2. Check Task Execution

Verify that tasks successfully trigger the delegators endpoint:

- Tasks should not fail with authentication errors
- Delegators endpoint should receive and process requests
- No 401/403 errors in function logs

### 3. Service Account Permissions

Verify the service account has the required roles:

```bash
gcloud projects get-iam-policy YOUR_PROJECT_ID --flatten="bindings[].members" --format="table(bindings.role)" --filter="bindings.members:YOUR_SERVICE_ACCOUNT_EMAIL"
```

## Troubleshooting

### Common Issues

1. **Missing Service Account Environment Variable**

   - Error: "Missing required environment variable: GCP_TASKS_SERVICE_ACCOUNT"
   - Solution: Ensure `GCP_TASKS_SERVICE_ACCOUNT` is set in environment

2. **Permission Denied Errors**

   - Error: Authentication Error in logs
   - Solution: Verify service account has Cloud Run Invoker role (`roles/run.invoker`) for 2nd generation Cloud Functions

3. **Audience Mismatch**

   - Error: 401 Unauthorized when tasks execute
   - Solution: Ensure audience URL exactly matches the protected function URL

4. **Wrong Project/Region**
   - Error: Queue not found or incorrect URL
   - Solution: Verify `GCP_PROJECT_ID` and `GCP_REGION` environment variables

### Debug Steps

1. **Check Environment Variables**:

   ```typescript
   console.log("GCP_PROJECT_ID:", process.env.GCP_PROJECT_ID);
   console.log("GCP_REGION:", process.env.GCP_REGION);
   console.log(
     "GCP_TASKS_SERVICE_ACCOUNT:",
     process.env.GCP_TASKS_SERVICE_ACCOUNT
   );
   console.log("GCP_TASKS_HOST:", process.env.GCP_TASKS_HOST);
   ```

2. **Review Task Creation Logs**: Look for detailed task creation logs with authentication details

3. **Monitor Delegators Function Logs**: Check for incoming authenticated requests and any authorization errors

## Security Considerations

- The service account should follow the principle of least privilege
- Regularly rotate service account keys if using JSON key files
- Monitor Cloud Tasks execution for any authentication failures
- Ensure the audience URL is correctly configured and matches the protected function
