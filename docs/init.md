# Project init checklist

## Get started

Create .env

Create secrets/envvars on Github Actions

- secrets.GCP_CREDENTIALS_JSON
- secrets.DATABASE_URL
- vars.GCP_PROJECT_NUMBER

Update admin IAM roles

- compute

  - Secret Manager Secret Accessor (otherwise it would report SecretManager access error when /healthcheck of prod is requested locally)
  - Cloud Run Invoker (otherwise Cloud-tasks requests would have 401 error)

- adminsdk

  - Editor
  - Secret Manager Secret Accessor (otherwise it would report SecretManager access error when /healthcheck of prod is requested locally)
  - Cloud Functions Admin
  - Service Account Token Creator
  - Vertex AI administrator
  - Cloud Tasks Enqueuer

- apphosting
  - Secret Manager Secret Accessor

Generate API API key - https://aistudio.google.com/app/apikey
Add GOOGLE_GENAI_API_KEY to secret manager

Enable Cloud Billing API - https://console.cloud.google.com/apis/library/cloudbilling.googleapis.com?project=certifai-prod&inv=1&invt=Abx-ew

```sh
firebase functions:artifacts:setpolicy --location us-central1 --project certifai-prod --days 2
```

## Local dev

```bash
gcloud config set project certifai-prod
export GOOGLE_APPLICATION_CREDENTIALS=/...
gcloud auth activate-service-account --key-file=...
```
