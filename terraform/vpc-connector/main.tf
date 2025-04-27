# Enable necessary APIs
resource "google_project_service" "compute" {
  project = var.project_id
  service = "compute.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "vpcaccess" {
  project = var.project_id
  service = "vpcaccess.googleapis.com"
  disable_on_destroy = false
}

# --- VPC Access Connector ---
# Remove the data source for existing connector, always create the connector resource.
resource "google_vpc_access_connector" "connector" {
  project       = var.project_id
  name          = var.connector_name
  region        = var.region
  network       = var.network_name
  ip_cidr_range = var.connector_ip_cidr_range
  min_instances = 2
  max_instances = 10 # Adjust as needed
  depends_on = [
    google_project_service.vpcaccess,
    data.google_compute_subnetwork.connector_subnet,
  ]
}

# --- NAT IP Address ---
# Attempt to find existing NAT IP
data "google_compute_address" "existing_nat_ip" {
  project = var.project_id
  name    = var.nat_ip_name
  region  = var.region
  # Provider argument might be needed if not default
}

# Reserve a static external IP address for NAT only if it doesn't exist
resource "google_compute_address" "nat_ip" {
  count   = data.google_compute_address.existing_nat_ip.id == null ? 1 : 0
  project = var.project_id
  name    = var.nat_ip_name
  region  = var.region
}

# --- Cloud Router ---
# Attempt to find existing Cloud Router
data "google_compute_router" "existing_router" {
  project = var.project_id
  name    = var.router_name
  region  = var.region
  network = var.network_name # Ensure network matches if looking up
  # Provider argument might be needed if not default
}

# Create a Cloud Router only if it doesn't exist
resource "google_compute_router" "router" {
  count   = data.google_compute_router.existing_router.id == null ? 1 : 0
  project = var.project_id
  name    = var.router_name
  region  = var.region
  network = var.network_name
  depends_on = [
    google_project_service.compute,
  ]
}

# --- Locals for Resource References ---
locals {
  # Use the created connector's id

  connector_id   = google_vpc_access_connector.connector.id

  # Use existing NAT IP self_link if found, otherwise use the created one
  nat_ip_self_link = coalesce(data.google_compute_address.existing_nat_ip.self_link, try(google_compute_address.nat_ip[0].self_link, null))

  # Use existing router name/region if found, otherwise use the created one
  router_name   = coalesce(data.google_compute_router.existing_router.name, try(google_compute_router.router[0].name, null))
  router_region = coalesce(data.google_compute_router.existing_router.region, try(google_compute_router.router[0].region, null))
}

# --- Subnetwork Data Source ---
# This subnetwork is used by both the VPC connector and the Cloud NAT.
data "google_compute_subnetwork" "connector_subnet" {
  project = var.project_id
  name    = var.subnet_name
  region  = var.region
}

# Create Cloud NAT Gateway
# Note: This assumes you always want Terraform to manage the NAT *configuration*.
# If the NAT gateway itself might pre-exist and you want to reuse it, apply the data/resource pattern here too.
resource "google_compute_router_nat" "nat" {
  # Ensure required components exist before attempting to create NAT
  # count = local.router_name != null && local.nat_ip_self_link != null && data.google_compute_subnetwork.connector_subnet.self_link != null ? 1 : 0

  project                            = var.project_id
  name                               = var.nat_gateway_name
  router                             = local.router_name           # Use local var
  region                             = local.router_region         # Use local var
  source_subnetwork_ip_ranges_to_nat = "LIST_OF_SUBNETWORKS"     # Specify that we list subnetworks below
  subnetwork {
    # Reference the actual subnetwork's self_link using the data source
    name                    = data.google_compute_subnetwork.connector_subnet.self_link
    source_ip_ranges_to_nat = ["ALL_IP_RANGES"]
  }
  nat_ip_allocate_option             = "MANUAL_ONLY"
  nat_ips                            = [local.nat_ip_self_link]    # Use local var
  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }

  depends_on = [
    # Explicitly depend on the potential resource creation and data source
    google_vpc_access_connector.connector,
    google_compute_address.nat_ip,
    google_compute_router.router,
    data.google_compute_subnetwork.connector_subnet, # Depend on the data source
  ]
}

# Note: When deploying Cloud Functions, you will need to configure them
# to use this VPC connector and set egress settings to 'all-traffic'.
# This ensures all egress from Cloud Functions goes through the VPC connector,
# then through the specified subnetwork, and finally out via the static NAT IP.
#
# resource "google_cloudfunctions_function" "my_function" {
#   ... other configuration ...
#   vpc_connector                  = local.connector_id # Use local var
#   vpc_connector_egress_settings = "ALL_TRAFFIC"
#   ... other configuration ...
# }
