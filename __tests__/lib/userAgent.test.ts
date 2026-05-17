import { USER_AGENT } from '@/lib/user-agent';

describe('USER_AGENT', () => {
  it('starts with Podhomme/', () => {
    expect(USER_AGENT).toMatch(/^Podhomme\//);
  });

  it('is a non-empty string', () => {
    expect(typeof USER_AGENT).toBe('string');
    expect(USER_AGENT.length).toBeGreaterThan(0);
  });
});
