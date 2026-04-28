/**
 * Example test file demonstrating Jest setup
 *
 * Test files should be placed in __tests__/ directory with .test.ts extension
 * Example: __tests__/utils/helper.test.ts
 */

describe('Example Test Suite', () => {
  it('should pass a basic assertion', () => {
    const value = 1 + 1;
    expect(value).toBe(2);
  });

  describe('nested suite', () => {
    it('should work with string assertions', () => {
      const message = 'Hello Jest';
      expect(message).toContain('Jest');
    });
  });
});
