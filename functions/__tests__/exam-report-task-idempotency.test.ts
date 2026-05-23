jest.mock('../src/services/firebase/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
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

describe('exam report task idempotency behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    generateExamReportMock.mockResolvedValue({
      report: 'existing report text',
      already_existed: true,
      generated_at: '2026-05-23T00:00:00.000Z',
    });
  });

  it('returns 200 and already_existed on repeated task delivery', async () => {
    const module = await import('../src/delegators/tasks/examReport');
    const handler = module.default as (
      req: unknown,
      res: unknown,
    ) => Promise<void>;

    const payload = {
      exam_id: 'exam-duplicate-1',
      user_id: 'user-1',
      cert_id: 93,
      certification_name: 'CompTIA PenTest+',
      trigger_source: 'retry' as const,
      submitted_at: new Date().toISOString(),
      priority: 'normal' as const,
    };

    const req = { body: payload };

    const firstRes = createMockResponse();
    await handler(req as never, firstRes as never);

    expect(firstRes.statusCode).toBe(200);
    expect(firstRes.body).toMatchObject({
      success: true,
      data: {
        exam_id: payload.exam_id,
        report_generated: true,
        already_existed: true,
      },
    });

    const secondRes = createMockResponse();
    await handler(req as never, secondRes as never);

    expect(secondRes.statusCode).toBe(200);
    expect(secondRes.body).toMatchObject({
      success: true,
      data: {
        exam_id: payload.exam_id,
        report_generated: true,
        already_existed: true,
      },
    });

    expect(generateExamReportMock).toHaveBeenCalledTimes(2);
  });
});
