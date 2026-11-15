const { describe, it } = require('node:test');
const assert = require('node:assert');
const app = require('../../src/app');

describe('Google OAuth routes', () => {
  it('does not mount Google routes when GOOGLE_CLIENT_ID is missing', async () => {
    const res = await require('supertest').agent(app)
      .get('/api/v1/auth/google')
      .set('Accept', 'application/json')
      .redirects(false);

    assert.notEqual(res.status, 302, 'expected Google route to be unavailable without env config');
  });

  it('returns 400 on missing Google env via callback failure route', async () => {
    const res = await require('supertest').agent(app)
      .get('/api/v1/auth/google/failure')
      .set('Accept', 'application/json');

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.message, 'Google authentication failed');
  });
});
