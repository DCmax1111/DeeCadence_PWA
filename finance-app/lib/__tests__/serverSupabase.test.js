const OLD_ENV = process.env;

describe('serverSupabase helper', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  test('returns false when server config is missing', () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    const { hasServerSupabaseConfig, getServerSupabase } = require('../serverSupabase');

    expect(hasServerSupabaseConfig()).toBe(false);
    expect(() => getServerSupabase()).toThrow('Supabase server environment is not configured');
  });
});
