# Terraform

## init

```sh
export GOOGLE_APPLICATION_CREDENTIALS
gcloud auth application-default login
gcloud auth application-default set-quota-project [PROJECT_ID]
gsutil mb -p coworkout-250306 -l us-central1 gs://coworkout-250306
terraform init
terraform plan
terraform apply
terraform destroy
```
