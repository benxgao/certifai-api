# Certifai API: Firms & Certifications Endpoints Summary

This document provides a simple summary of the main API endpoints related to **firms** and **certifications** in the `certifai-api` project.

---

## Firms Endpoints

- **GET /api/public/firms/search**

  - **Description:** Search for firms. Typically used by public certification pages.
  - **Auth:** JWT required (handled internally).
  - **Response:** List of firms matching search criteria.

- **GET /api/public/firms/:id**

  - **Description:** Get details of a specific firm by its ID.
  - **Auth:** May require JWT or be public, depending on implementation.
  - **Response:** Firm details object.

- **GET /api/public/firms**

  - **Description:** List all firms.
  - **Auth:** May require JWT or be public, depending on implementation.
  - **Response:** List of all firms.

- **GET /api/public/firms/:firm_id/certifications**
  - **Description:** Get all certifications for a specific firm by `firm_id`.
  - **Auth:** May require JWT or be public, depending on implementation.
  - **Response:** List of certifications belonging to the firm.

---

## Certifications Endpoints

- **GET /api/public/certifications/search**

  - **Description:** Search for certifications. Used for public access to certification data.
  - **Auth:** May require JWT or be public, depending on implementation.
  - **Response:** List of certifications matching search criteria.

- **GET /api/public/certifications/:id**

  - **Description:** Get details of a specific certification by its ID.
  - **Auth:** May require JWT or be public, depending on implementation.
  - **Response:** Certification details object.

- **GET /api/public/certifications**
  - **Description:** List all certifications.
  - **Auth:** May require JWT or be public, depending on implementation.
  - **Response:** List of all certifications.

---

## Notes

- Endpoints are typically under `/api/public/` for public access.
- Authentication and access control are enforced for sensitive endpoints.
- For more details, refer to the implementation in the `app/api/public/firms/` and `app/api/public/certifications/` directories.

---

_This is a high-level summary. For request/response formats and advanced usage, see the code or API documentation._
