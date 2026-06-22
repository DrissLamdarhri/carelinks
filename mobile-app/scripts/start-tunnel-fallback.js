#!/usr/bin/env node
// Wrapper: try expo start --tunnel, on failure fallback to expo start --lan
const { spawn } = require('child_process');

function exec(cmd, args) {
  return new Promise((resolve) => {
    const ps = spawn(cmd, args, { shell: true });
    let out = '';
    let err = '';
    ps.stdout.on('data', (d) => {
      process.stdout.write(d);
      out += d.toString();
    });
    ps.stderr.on('data', (d) => {
      process.stderr.write(d);
      err += d.toString();
    });
    ps.on('close', (code) => resolve({ code, out, err }));
    ps.on('error', (e) => resolve({ code: 1, out, err: e.message }));
  });
}

(async function main() {
  console.log('Attempting: expo start --tunnel (will fallback to --lan if ngrok/tunnel fails)');
  const tryTunnel = await exec('npx', ['expo', 'start', '--tunnel']);
  if (tryTunnel.code === 0) return;

  const combined = (tryTunnel.out || '') + '\n' + (tryTunnel.err || '');
  if (/ngrok|Cannot read properties of undefined \(reading \'body\'\)|TypeError: Cannot read properties of undefined/.test(combined)) {
    console.warn('\nTunnel startup failed (ngrok). Falling back to LAN mode...');
  } else {
    console.warn('\nexpo start --tunnel exited with code', tryTunnel.code, '- falling back to LAN.');
  }

  // Run with LAN host (uses package.json "start" conventions if preferred)
  const fallback = await exec('npx', ['expo', 'start', '--lan']);
  if (fallback.code !== 0) {
    console.error('\nFallback also failed. See output above.');
    process.exit(fallback.code || 1);
  }
})();
