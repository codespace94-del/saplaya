// Frees a TCP port held by a leftover Node dev server (fixes "EADDRINUSE").
// Usage: node scripts/free-port.mjs 3001
import { execSync } from 'node:child_process';

const port = Number(process.argv[2] ?? 3001);
if (!Number.isInteger(port)) process.exit(0);

const pids = new Set();
try {
  if (process.platform === 'win32') {
    const out = execSync('netstat -ano -p tcp', { encoding: 'utf8' });
    for (const line of out.split(/\r?\n/)) {
      const cols = line.trim().split(/\s+/);
      if (cols[3] === 'LISTENING' && cols[1]?.endsWith(`:${port}`)) pids.add(cols[4]);
    }
  } else {
    const out = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN || true`, { encoding: 'utf8' });
    out.split(/\s+/).filter(Boolean).forEach((p) => pids.add(p));
  }
} catch {
  process.exit(0);
}

for (const pid of pids) {
  if (!pid || pid === '0' || Number(pid) === process.pid) continue;
  let name = '';
  try {
    name = process.platform === 'win32'
      ? execSync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, { encoding: 'utf8' })
      : execSync(`ps -p ${pid} -o comm=`, { encoding: 'utf8' });
  } catch {}
  if (!/node/i.test(name)) {
    console.log(`Port ${port} is used by a non-Node process (PID ${pid}); leaving it alone.`);
    continue;
  }
  try {
    process.kill(Number(pid));
    console.log(`Stopped old dev server on port ${port} (PID ${pid}).`);
  } catch (e) {
    console.log(`Could not stop PID ${pid}: ${e.message}`);
  }
}
