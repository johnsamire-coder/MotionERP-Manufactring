// Ensures the API can boot inside tests without a real `.env` file.
// These are non-secret local/CI defaults; a real database is only needed for
// the /health/db path, which the tests do not exercise.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgresql://motion:motion@localhost:5432/motion_erp_test';
process.env.API_CORS_ORIGINS ??= 'http://localhost:5173';
