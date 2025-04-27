terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 6.32.0"
    }

    google-beta = {
      source  = "hashicorp/google-beta"
      version = ">= 6.32.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Optional: Configure backend for state storage
terraform {
  backend "gcs" {
    bucket  = "co-workout-next-tf-state"
    prefix  = "init"
  }
}
