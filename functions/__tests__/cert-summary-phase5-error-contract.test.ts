jest.mock('../src/services/firebase/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const getCertSummaryMock = jest.fn();
const generateCertSummaryMock = jest.fn();

jest.mock('../src/services/certSummaryService', () => {
  class MockCertSummaryPrerequisiteError extends Error {
    public readonly code = 'INSUFFICIENT_EXAM_REPORTS';
    public readonly status = 400;
    public readonly retriable = false;
    public readonly details: {
      required_reports: number;
      available_reports: number;
      cert_id: string;
    };

    constructor(details: {
      required_reports: number;
      available_reports: number;
      cert_id: string;
    }) {
      super('Certification summary requires at least 2 completed exam reports');
      this.name = 'CertSummaryPrerequisiteError';
      this.details = details;
    }
  }

  return {
    CertSummaryPrerequisiteError: MockCertSummaryPrerequisiteError,
    certSummaryFirestore: {
      getCertSummary: (...args: unknown[]) => getCertSummaryMock(...args),
    },
    generateCertSummary: (...args: unknown[]) => generateCertSummaryMock(...args),
  };
});

const createMockResponse = () => {
  const response: {
    statusCode?: number;
    body?: unknown;
    status: jest.Mock;
    json: jest.Mock;
  } = {
    statusCode: undefined,
    body: undefined,
    status: jest.fn((code: number) => {
      response.statusCode = code;
      return response;
    }),
    json: jest.fn((payload: unknown) => {
      response.body = payload;
      return response;
    }),
  };

  return response;
};

describe('cert summary phase 5 error contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns INSUFFICIENT_EXAM_REPORTS with details on prerequisite failure', async () => {
    const { CertSummaryPrerequisiteError } = await import(
      '../src/services/certSummaryService'
    );
    const { getCertSummary } = await import(
      '../src/endpoints/api/users/certifications/getCertSummary'
    );

    getCertSummaryMock.mockResolvedValue(null);
    generateCertSummaryMock.mockRejectedValue(
      new CertSummaryPrerequisiteError({
        required_reports: 2,
        available_reports: 1,
        cert_id: '93',
      }),
    );

    const req = {
      params: { user_id: 'user-1', cert_id: '93' },
      firebase_user_info: { uid: 'firebase-user-1' },
    };
    const res = createMockResponse();
    const next = jest.fn();

    await getCertSummary(req as never, res as never, next);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      success: false,
      error_code: 'INSUFFICIENT_EXAM_REPORTS',
      retriable: false,
      details: {
        required_reports: 2,
        available_reports: 1,
        cert_id: '93',
      },
    });
  });

  it('preserves transient generation failure as 500 REPORT_GENERATION_TRANSIENT', async () => {
    const { getCertSummary } = await import(
      '../src/endpoints/api/users/certifications/getCertSummary'
    );

    getCertSummaryMock.mockResolvedValue(null);
    generateCertSummaryMock.mockRejectedValue(new Error('GenAI timeout'));

    const req = {
      params: { user_id: 'user-1', cert_id: '93' },
      firebase_user_info: { uid: 'firebase-user-1' },
    };
    const res = createMockResponse();
    const next = jest.fn();

    await getCertSummary(req as never, res as never, next);

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      error_code: 'REPORT_GENERATION_TRANSIENT',
      retriable: true,
      details: {
        original_error: 'GenAI timeout',
      },
    });
  });
});
