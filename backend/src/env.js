// .env is optional: real deployments set these variables directly.
try { process.loadEnvFile(); } catch {}

const missing = ['MONGODB_URI', 'REDIS_URL', 'ACCESS_TOKEN_SECRET', 'REFRESH_TOKEN_SECRET'].filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing settings: ${missing.join(', ')}. Copy backend/.env.example to backend/.env and fill them in.`);
  process.exit(1);
}
