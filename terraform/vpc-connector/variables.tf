variable "project_id" {
  description = "The Google Cloud project ID."
  type        = string
  default     = "ccertifai-prod"
}

variable "region" {
  description = "The Google Cloud region."
  type        = string
  default     = "us-central1"
}

variable "network_name" {
  description = "The name of the VPC network."
  type        = string
  default     = "default" # Assuming use of the default VPC network
}

variable "subnet_name" {
  description = "The name of the subnet."
  type        = string
  default     = "default" # Adjust default as needed
}

variable "connector_name" {
  description = "The name for the VPC Access Connector."
  type        = string
  default     = "firebase-connector"
}

variable "connector_ip_cidr_range" {
  description = "The IP CIDR range for the VPC Access Connector subnet."
  type        = string
  default     = "10.8.0.0/28" # Must be /28 and unused in the VPC
}

variable "router_name" {
  description = "The name for the Cloud Router."
  type        = string
  default     = "nat-router"
}

variable "nat_ip_name" {
  description = "The name for the static external IP address for Cloud NAT."
  type        = string
  default     = "cloud-functions-nat-ip"
}

variable "nat_gateway_name" {
  description = "The name for the Cloud NAT gateway."
  type        = string
  default     = "cloud-functions-nat-gateway"
}
