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

describe('examReportGenerator phase 1.2 flow shape', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    const mockAi = {
      defineFlow: jest.fn((_config, handler) => handler),
    };

    createAiInstancePromiseMock.mockResolvedValue(mockAi);
    generateWithValidationMock.mockResolvedValue({
      report: 'Mocked report from model output.',
    });
  });

  it('returns report and locally computed difficulty_adjustments', async () => {
    const { createExamReportGeneratorFlow } = await import(
      '../src/services/genkit/examReportGenerator.js'
    );

    const flow = await createExamReportGeneratorFlow();

    const result = await flow({
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
          correct_answers: 7,
          total_attempts: 10,
          accuracy_rate: 0.7,
          current_difficulty_level: 3,
          average_difficulty_attempted: 3.0,
        },
        {
          topic: 'Storage',
          correct_answers: 4,
          total_attempts: 10,
          accuracy_rate: 0.4,
          current_difficulty_level: 2,
          average_difficulty_attempted: 2.4,
        },
      ],
      overall_score: 63,
      total_questions: 30,
      correct_answers: 19,
    });

    expect(result).toEqual({
      report: 'Mocked report from model output.',
      difficulty_adjustments: {
        increase_difficulty: ['Networking'],
        maintain_difficulty: ['Security'],
        decrease_difficulty: ['Storage'],
      },
    });

    expect(generateWithValidationMock).toHaveBeenCalledTimes(1);
  });
});
