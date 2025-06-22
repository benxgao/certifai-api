# Firm Management

This document describes the new Firm functionality added to the CertifAI API. Firms represent the organizations that provide certifications (e.g., AWS, Google Cloud Platform, Microsoft Azure, etc.).

## Database Schema

### Firm Model

```prisma
model Firm {
  firm_id     Int    @id @default(autoincrement())
  name        String @unique
  code        String @unique // Short code like "AWS", "GCP", "IBM"
  description String?
  website_url String?
  logo_url    String?

  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  certifications Certification[]

  @@index([code])
}
```

### Updated Certification Model

The `Certification` model now includes a required `firm_id` field:

```prisma
model Certification {
  cert_id Int @id @default(autoincrement())
  firm_id Int // Foreign Key - NEW FIELD

  name            String
  exam_guide_url  String?
  min_quiz_counts Int
  max_quiz_counts Int
  pass_score      Float

  firm               Firm                @relation(fields: [firm_id], references: [firm_id], onDelete: Cascade)
  // ... other relations
}
```

## Pre-populated Firms

The system comes with the following firms pre-populated:

| Code    | Name                  | Description                                    |
| ------- | --------------------- | ---------------------------------------------- |
| AWS     | Amazon Web Services   | Amazon Web Services cloud computing platform   |
| GCP     | Google Cloud Platform | Google Cloud Platform services                 |
| AZURE   | Microsoft Azure       | Microsoft Azure cloud services                 |
| IBM     | IBM Cloud             | IBM Cloud and cognitive services               |
| ORACLE  | Oracle Cloud          | Oracle Cloud Infrastructure                    |
| SFDC    | Salesforce            | Salesforce CRM and cloud platform              |
| VMWARE  | VMware                | VMware virtualization and cloud infrastructure |
| CISCO   | Cisco                 | Cisco networking and security                  |
| REDHAT  | Red Hat               | Red Hat enterprise software                    |
| DOCKER  | Docker                | Docker containerization platform               |
| K8S     | Kubernetes            | Kubernetes container orchestration             |
| COMPTIA | CompTIA               | Computing Technology Industry Association      |
| PMI     | PMI                   | Project Management Institute                   |
| ITIL    | ITIL                  | Information Technology Infrastructure Library  |
| TOGAF   | TOGAF                 | The Open Group Architecture Framework          |
| GENERIC | Generic               | Generic certification provider                 |

## API Endpoints

### GET /api/firms

Get all firms.

**Query Parameters:**

- `includeCount` (boolean): Include certification count for each firm

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "firm_id": 1,
      "name": "Amazon Web Services",
      "code": "AWS",
      "description": "Amazon Web Services cloud computing platform",
      "website_url": "https://aws.amazon.com",
      "logo_url": null,
      "created_at": "2025-06-22T22:31:45.915Z",
      "updated_at": "2025-06-22T22:31:45.915Z",
      "_count": {
        "certifications": 3
      }
    }
  ]
}
```

### GET /api/firms/search

Search firms by name, code, or description.

**Query Parameters:**

- `q` (string, required): Search query

### GET /api/firms/:firmId

Get a specific firm by ID.

**Query Parameters:**

- `includeCertifications` (boolean): Include certifications for the firm

### POST /api/firms

Create a new firm (requires authentication).

**Request Body:**

```json
{
  "name": "New Firm",
  "code": "NEWFIRM",
  "description": "Description of the new firm",
  "website_url": "https://newfirm.com",
  "logo_url": "https://newfirm.com/logo.png"
}
```

### PUT /api/firms/:firmId

Update an existing firm (requires authentication).

**Request Body:** Same as POST, all fields optional.

### DELETE /api/firms/:firmId

Delete a firm (requires authentication). Will fail if the firm has associated certifications.

## Updated Certifications API

The `/api/certifications` endpoint now includes firm information in the response:

```json
{
  "success": true,
  "data": [
    {
      "cert_id": 1,
      "firm_id": 1,
      "name": "AWS Certified Solutions Architect",
      "exam_guide_url": "https://aws.amazon.com/certification/...",
      "min_quiz_counts": 10,
      "max_quiz_counts": 50,
      "pass_score": 75.0,
      "firm": {
        "firm_id": 1,
        "name": "Amazon Web Services",
        "code": "AWS",
        "description": "Amazon Web Services cloud computing platform",
        "website_url": "https://aws.amazon.com",
        "logo_url": null,
        "created_at": "2025-06-22T22:31:45.915Z",
        "updated_at": "2025-06-22T22:31:45.915Z"
      }
    }
  ],
  "pagination": {
    // ... pagination info
  }
}
```

## Service Layer

### FirmService

The `FirmService` provides the following methods:

- `createFirm(data: CreateFirmData): Promise<Firm>`
- `getAllFirms(): Promise<Firm[]>`
- `getFirmById(firm_id: number): Promise<Firm | null>`
- `getFirmByCode(code: string): Promise<Firm | null>`
- `updateFirm(firm_id: number, data: UpdateFirmData): Promise<Firm>`
- `deleteFirm(firm_id: number): Promise<Firm>`
- `getFirmsWithCertificationCounts(): Promise<(Firm & { _count: { certifications: number } })[]>`
- `getFirmWithCertifications(firm_id: number): Promise<(Firm & { certifications: Certification[] }) | null>`
- `searchFirms(query: string): Promise<Firm[]>`

## Migration Notes

The migration automatically:

1. Creates the `Firm` table with pre-populated data
2. Adds the `firm_id` column to the `Certification` table
3. Assigns existing certifications to appropriate firms based on naming patterns
4. Any unmatched certifications are assigned to the "Generic" firm

## Usage Examples

### Frontend Integration

```typescript
// Get all firms with certification counts
const firms = await fetch("/api/firms?includeCount=true");

// Search for AWS-related firms
const awsFirms = await fetch("/api/firms/search?q=aws");

// Get a specific firm with its certifications
const firm = await fetch("/api/firms/1?includeCertifications=true");

// Create a new firm (authenticated request)
const newFirm = await fetch("/api/firms", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: "Bearer " + token,
  },
  body: JSON.stringify({
    name: "HashiCorp",
    code: "HASHICORP",
    description: "Infrastructure automation company",
    website_url: "https://www.hashicorp.com",
  }),
});
```

This firm management system provides a structured way to organize certifications by their providing organizations, making it easier for users to browse and filter certifications by vendor.
