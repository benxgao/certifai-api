/**
 * Certification API types
 *
 * Request and response types for certification-related endpoints:
 * - GET /api/public/certifications
 * - GET /api/users/{userId}/certifications
 * - POST /api/users/{userId}/certifications/{certId}
 * - DELETE /api/users/{userId}/certifications/{certId}
 */

import { DataResponse, ListResponse } from './common';
import { CertificationStatus } from '../enums';

/**
 * GET /api/public/certifications
 *
 * Retrieves all available certifications (public, no auth required)
 */
export type GetCertificationsRequest = Record<string, never>; // No params

export type GetCertificationsResponse = ListResponse<CertificationListItem>;

/**
 * Basic certification information in list view
 */
export interface CertificationListItem {
  /** Certification ID @guaranteed */
  cert_id: number;
  /** Certification name @guaranteed */
  name: string;
  /** URL-friendly slug for this certification @guaranteed */
  slug: string;
  /** Firm/provider ID @guaranteed */
  firm_id: number;
  /** Firm/provider name @guaranteed */
  firm_name: string;
  /** URL to exam preparation guide @optional */
  exam_guide_url?: string;
  /** Minimum number of practice questions @guaranteed */
  min_quiz_counts: number;
  /** Maximum number of exam questions @guaranteed */
  max_quiz_counts: number;
  /** Passing score percentage @guaranteed */
  pass_score: number;
}

/**
 * GET /api/public/certifications/{certId}
 *
 * Retrieves detailed information about a specific certification
 */
export type GetCertificationDetailRequest = Record<string, never>; // URL params only

export type GetCertificationDetailResponse = DataResponse<CertificationDetail>;

/**
 * Full certification details
 */
export interface CertificationDetail {
  /** Certification ID @guaranteed */
  cert_id: number;
  /** Certification name @guaranteed */
  name: string;
  /** URL-friendly slug @guaranteed */
  slug: string;
  /** Firm ID @guaranteed */
  firm_id: number;
  /** Firm information @guaranteed */
  firm: FirmInfo;
  /** Preparation guide URL @optional */
  exam_guide_url?: string;
  /** Minimum practice questions @guaranteed */
  min_quiz_counts: number;
  /** Maximum exam questions @guaranteed */
  max_quiz_counts: number;
  /** Passing score percentage @guaranteed */
  pass_score: number;
  /** When this certification was created @guaranteed */
  created_at: string;
}

/**
 * Firm/provider information
 */
export interface FirmInfo {
  /** Firm ID @guaranteed */
  firm_id: number;
  /** Firm name @guaranteed */
  name: string;
  /** Short firm code (e.g., "AWS", "GCP") @guaranteed */
  code: string;
  /** Description of firm @optional */
  description?: string;
  /** Firm website @optional */
  website_url?: string;
  /** Firm logo URL @optional */
  logo_url?: string;
}

/**
 * GET /api/users/{userId}/certifications
 *
 * Retrieves all certifications registered by the user
 */
export type GetUserCertificationsRequest = Record<string, never>; // URL params only

export type GetUserCertificationsResponse = ListResponse<UserRegisteredCertification>;

/**
 * User's registered certification with progress information
 */
export interface UserRegisteredCertification {
  /** Certification ID @guaranteed */
  cert_id: number;
  /** Certification name @guaranteed */
  name: string;
  /** Current registration status @guaranteed */
  status: CertificationStatus;
  /** When user registered @guaranteed */
  assigned_at: string;
  /** Last status update @guaranteed */
  updated_at: string;
  /** Certification details @guaranteed */
  certification: {
    cert_id: number;
    name: string;
    slug: string;
    exam_guide_url?: string;
    pass_score: number;
  };
}

/**
 * POST /api/users/{userId}/certifications/{certId}
 *
 * Registers user for a certification
 */
export type RegisterCertificationRequest = Record<string, never>; // URL params only

export type RegisterCertificationResponse = DataResponse<CertificationRegistration>;

export interface CertificationRegistration {
  /** Whether registration was successful @guaranteed */
  success: boolean;
  /** User's ID @guaranteed */
  user_id: string;
  /** Certification ID @guaranteed */
  cert_id: number;
  /** Initial registration status @guaranteed */
  status: CertificationStatus;
  /** Registration timestamp @guaranteed */
  registered_at: string;
}

/**
 * DELETE /api/users/{userId}/certifications/{certId}
 *
 * Unregisters user from a certification
 */
export type UnregisterCertificationRequest = Record<string, never>; // URL params only

export interface UnregisterCertificationResponse {
  success: true;
}

/**
 * GET /api/public/firms
 *
 * Retrieves all certification providers (firms)
 */
export type GetFirmsRequest = Record<string, never>; // No params

export type GetFirmsResponse = ListResponse<FirmSummary>;

/**
 * Basic firm information in list view
 */
export interface FirmSummary {
  /** Firm ID @guaranteed */
  firm_id: number;
  /** Firm name @guaranteed */
  name: string;
  /** Short code @guaranteed */
  code: string;
  /** Description @optional */
  description?: string;
  /** Website URL @optional */
  website_url?: string;
  /** Logo URL @optional */
  logo_url?: string;
}
