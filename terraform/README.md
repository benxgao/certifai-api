# Terraform

## init

```sh
export GOOGLE_APPLICATION_CREDENTIALS
gcloud auth application-default login
gcloud auth application-default set-quota-project [PROJECT_ID]
gsutil mb -p [PROJECT_ID] -l us-central1 gs://[BUCKET_NAME]
terraform init
terraform plan
terraform apply
terraform destroy
```
