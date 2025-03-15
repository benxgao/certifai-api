# Notes

## Authenticate service account in local dev

```bash
gcloud config set project co-workout-next

export GOOGLE_APPLICATION_CREDENTIALS=/...

gcloud auth activate-service-account --key-file=...
```
