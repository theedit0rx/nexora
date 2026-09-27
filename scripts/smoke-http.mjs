import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
const dir = await mkdtemp(join(tmpdir(), 'nexora-http-'));
const port = 32000 + Math.floor(Math.random() * 20000);
const base = `http://127.0.0.1:${port}`;
const env = { ...process.env, NEXORA_DATA_DIR: dir, NEXORA_DB_FILE: join(dir, 'db.json'), NEXORA_SESSION_SECRET: randomBytes(48).toString('hex'), NEXORA_MODE: 'live', NEXORA_AUTH_PROVIDER: 'local', NEXORA_ENABLE_DEMO: 'false', NEXT_PUBLIC_SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '' };
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', String(port)], { env, stdio: ['ignore', 'pipe', 'pipe'] });
let logs = '';
child.stderr.on('data', b => { logs += b; });
child.stdout.on('data', b => { logs += b; });
const post = (path, body, extra = {}) => fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', ...extra }, body: JSON.stringify(body), redirect: 'manual' });
try {
  await new Promise((resolve, reject) => {
    const deadline = setTimeout(() => reject(new Error('Server startup timeout')), 20000);
    child.stdout.on('data', b => { if (b.toString().includes('Ready in')) { clearTimeout(deadline); resolve(); } });
    child.once('exit', code => { clearTimeout(deadline); reject(new Error(`Server exited ${code}: ${logs}`)); });
  });
  assert.equal((await fetch(base + '/api/leads')).status, 401);
  assert.equal((await post('/api/auth/signup', { email: 7 })).status, 400);
  assert.equal((await post('/api/auth/signup', {}, { origin: 'https://untrusted.example' })).status, 403);
  assert.equal((await post('/api/auth/demo', {})).status, 403);
  const account = { email: 'http-test@example.com', password: 'test-only-password-123', fullName: 'HTTP Test', organizationName: 'HTTP Test Agency' };
  const signup = await post('/api/auth/signup', account);
  assert.equal(signup.status, 200);
  const cookie = signup.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie);
  assert.equal((await fetch(base + '/dashboard', { headers: { cookie }, redirect: 'manual' })).status, 200);
  assert.equal((await post('/api/auth/login', { ...account, password: 'wrong' })).status, 401);
  const login = await post('/api/auth/login', { ...account, next: '//untrusted.example' });
  assert.equal(login.status, 200);
  assert.equal((await login.json()).next, '/dashboard');
  const logout = await post('/api/auth/logout', {}, { cookie });
  assert.equal(logout.status, 303);
  assert.equal(new URL(logout.headers.get('location'), base).origin, base);
  console.log('HTTP smoke passed: authentication, dashboard, validation, CSRF, redirects, demo restriction and logout.');
} finally {
  child.kill('SIGTERM');
  await new Promise(resolve => { if (child.exitCode !== null || child.signalCode !== null) resolve(); else child.once('exit', resolve); });
  await rm(dir, { recursive: true, force: true });
}
