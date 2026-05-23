/**
 * Phase 7.1 — Backend regression tests for:
 *   - Schema mismatch fix: LLM output missing `difficulty_adjustments` still succeeds (Phase 1)
 *   - LLM output missing `report` fails with typed error
 *   - Task handler returns correct HTTP status for permanent vs retriable failures (Phase 4)
 */

jest.mock('@genkit-ai/firebase', () => ({
  enableFirebaseTelemetry: jest.fn(),
}));

jest.mock('../src/services/firebase/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const createAiInstancePromiseMock = jest.fn();
const generateWithValidationMock = jest.fn();
const handleGenerationErrorMock = jest.fn();
const logGenerationStartMock = jest.fn();
const logGenerationCompleteMock = jest.fn();

jest.mock('../src/services/genkit/utils', () => ({
  createAiInstancePromise: createAiInstancePromiseMock,
  generateWithValidation: generateWithValidationMock,
  handleGenerationError: handleGenerationErrorMock,
  logGenerationStart: logGenerationStartMock,
  logGenerationComplete: logGenerationCompleteMock,
  DEFAULT_GENERATION_CONFIG: {
    maxOutputTokens: 4096,
    temperature: 0.3,
    topP: 0.8,
    topK: 40,
  },
  DEFAULT_GENAI_MODEL: 'gemini-2.5-flash',
  googleAI: {
    model: jest.fn(() => ({ name: 'mock-model' })),
  },
}));

const generateExamReportMock = jest.fn();

jest.mock('../src/endpoints/api/ai/examReportGenerator', () => ({
  generateExamReport: (...args: unknown[]) => generateExamReportMock(...args),
}));

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

const baseInput = {
  user_id: 'user-1',
  exam_id: 'exam-1',
  certification_name: 'AWS Solutions Architect',
  performance_data: [
    {
      topic: 'Networking',
      correct_answers: 8,
      total_attempts: 10,
      accuracy_rate: 0.8,
      current_difficulty_level: 3,
      average_difficulty_attempted: 3.2,
    },
    {
      topic: 'Security',
      correct_answers: 6,
      total_attempts: 10,
      accuracy_rate: 0.6,
      current_difficulty_level: 3,
      average_difficulty_attempted: 3.0,
    },
    {
      topic: 'Storage',
      correct_answers: 3,
      total_attempts: 10,
      accuracy_rate: 0.3,
      current_difficulty_level: 2,
      average_difficulty_attempted: 2.4,
    },
  ],
  overall_score: 57,
  total_questions: 30,
  correct_answers: 17,
};

// ---------------------------------------------------------------------------
// Fixture 1 – Schema fix (Phase 1)
// LLM only returns `report`. Flow still succeeds and merges locally computed
// `difficulty_adjustments` from performanceData.
// ---------------------------------------------------------------------------
describe('Phase 1 — LLM schema fix', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    const mockAi = {
      defineFlow: jest.fn((_config: unknown, handler: unknown) => handler),
    };
    createAiInstancePromiseMock.mockResolvedValue(mockAi);
  });

  it('succeeds when LLM output contains only `report` (no difficulty_adjustments)', async () => {
    generateWithValidationMock.mockResolvedValue({
      report: 'Great performance on Networking.',
    });

    const { createExamReportGeneratorFlow } = await import(
      '../src/services/genkit/examReportGenerator'
    );

    const flow = await createExamReportGeneratorFlow();
    const result = await flow(baseInput);

    expect(result.report).toBe('Great performance on Networking.');
    expect(result.difficulty_adjustments).toBeDefined();
    expect(Array.isArray(result.difficulty_adjustments.increase_difficulty)).toBe(true);
    expect(Array.isArray(result.difficulty_adjustments.maintain_difficulty)).toBe(true);
    expect(Array.isArray(result.difficulty_adjustments.decrease_difficulty)).toBe(true);
  });

  it('places high-accuracy topics in increase_difficulty and low-accuracy in decrease_difficulty', async () => {
    generateWithValidationMock.mockResolvedValue({
      report: 'You are doing well.',
    });

    const { createExamReportGeneratorFlow } = await import(
      '../src/services/genkit/examReportGenerator'
    );

    const flow = await createExamReportGeneratorFlow();
    const result = await flow(baseInput);

    // Networking 80% ≥ 0.75 → increase
    expect(result.difficulty_adjustments.increase_difficulty).toContain('Networking');
    // Storage 30% ≤ 0.55 → decrease
    expect(result.difficulty_adjustments.decrease_difficulty).toContain('Storage');
    // Security 60% → maintain
    expect(result.difficulty_adjustments.maintain_difficulty).toContain('Security');
  });

  it('fails with error when LLM output is missing `report` field', async () => {
    generateWithValidationMock.mockResolvedValue({
      // deliberately omit `report`
    });

    handleGenerationErrorMock.mockImplementation(() => {
      throw new Error('Report field missing from LLM output');
    });

    const { createExamReportGeneratorFlow } = await import(
      '../src/services/genkit/examReportGenerator'
    );

    const flow = await createExamReportGeneratorFlow();

    await expect(flow(baseInput)).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Fixture 2 – Task handler HTTP status semantics (Phase 4)
// Permanent input errors → 4xx; transient generation failures → 5xx.
// ---------------------------------------------------------------------------
describe('Phase 4 — Task handler failure classification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 400 for permanent "exam not found" failures (non-retriable)', async () => {
    generateExamReportMock.mockRejectedValue(
      new Error('Exam not found for the given exam_id'),
    );

    const handler = (await import('../src/delegators/tasks/examReport')).default;
    const req = {
      body: {
        exam_id: 'exam-missing',
        user_id: 'user-1',
        cert_id: 42,
        certification_name: 'CompTIA Security+',
        trigger_source: 'api',
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(400);
    const body = res.body as { success: boolean; error: { retriable: boolean; permanent_failure: boolean } };
    expect(body.success).toBe(false);
    expect(body.error.permanent_failure).toBe(true);
    expect(body.error.retriable).toBe(false);
  });

  it('returns 500 for retriable transient failures', async () => {
    generateExamReportMock.mockRejectedValue(
      new Error('Network timeout connecting to Firestore'),
    );

    const handler = (await import('../src/delegators/tasks/examReport')).default;
    const req = {
      body: {
        exam_id: 'exam-transient',
        user_id: 'user-1',
        cert_id: 42,
        certification_name: 'CompTIA Security+',
        trigger_source: 'api',
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(500);
    const body = res.body as { success: boolean; error: { retriable: boolean; permanent_failure: boolean } };
    expect(body.success).toBe(false);
    expect(body.error.permanent_failure).toBe(false);
    expect(body.error.retriable).toBe(true);
  });

  it('returns 400 for invalid task payload without exam_id', async () => {
    const handler = (await import('../src/delegators/tasks/examReport')).default;
    const req = { body: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(400);
    const body = res.body as { success: boolean };
    expect(body.success).toBe(false);
  });

  it('returns 200 with already_existed true when report already exists', async () => {
    generateExamReportMock.mockResolvedValue({
      report: 'previously generated report',
      already_existed: true,
      generated_at: '2026-05-23T00:00:00.000Z',
    });

    const handler = (await import('../src/delegators/tasks/examReport')).default;
    const req = {
      body: {
        exam_id: 'exam-already-done',
        user_id: 'user-1',
        cert_id: 42,
        certification_name: 'CompTIA Security+',
        trigger_source: 'api',
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(200);
    const body = res.body as {
      success: boolean;
      data: { already_existed: boolean };
    };
    expect(body.success).toBe(true);
    expect(body.data.already_existed).toBe(true);
  });
});
