/**
 * Certification Summary Service - Clean export interface
 *
 * This service provides a clean interface for generating certification summaries.
 * All interfaces and service functions are centralized here for easy reuse.
 */

export {
  CertificationSummary,
  TopicMastery,
  CertSummaryDocument,
  CertSummaryPrerequisiteError,
  generateCertSummary,
  certSummaryFirestore,
} from './firebase/certSummaryFirestore';
