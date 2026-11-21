#!/data/data/com.termux/files/usr/bin/node
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const puppeteer = require('puppeteer-core');
const { executeAction, ensureCdp, CDP_URL, BASE } = require('./browser-actions');
const { isDaemonAlive, SOCKET_PATH, DAEMON_PORT } = require('./browser-client');

const PID_FILE = path.join(BASE, 'browser-daemon.pid');
const LOG_FILE = path.join(BASE, 'browser-daemon.log');

function log(...args) {
  const line = `[${new Date().toISOString()}] ${args.join(' ')}`;
  try {
    fs.appendFileSync(LOG_FILE, line + '\n', 'utf8');
  } catch {}
  if (process.env.DAEMON_FOREGROUND || !process.env.DAEMON_SPAWNED) {
    console.log(line);
  }
}

class BrowserDaemon {
  constructor() {
    this.browser = null;
    this.isConnecting = false;
    this.stats = {
      startTime: Date.now(),
      requestsServed: 0,
      errors: 0
    };
    this.server = null;
    this.tcpServer = null;
  }

  async getBrowser() {
    if (this.browser && this.browser.isConnected()) {
      return this.browser;
    }
    if (this.isConnecting) {
      // Wait for in-flight connection
      for (let i = 0; i < 40; i++) {
        await new Promise(r => setTimeout(r, 250));
        if (this.browser && this.browser.isConnected()) return this.browser;
      }
    }
    this.isConnecting = true;
    try {
      ensureCdp();
      log('Connecting persistent Puppeteer to CDP at', CDP_URL);
      this.browser = await puppeteer.connect({
        browserURL: CDP_URL,
        defaultViewport: null,
        protocolTimeout: 60000
      });
      this.browser.on('disconnected', () => {
        log('Browser CDP connection disconnected.');
        this.browser = null;
      });
      log('Puppeteer connected successfully. Session warm.');
      return this.browser;
    } finally {
      this.isConnecting = false;
    }
  }

  async handleExec(payload) {
    this.stats.requestsServed++;
    const stdout = [];
    const stderr = [];

    const scopedLogger = {
      log: (...args) => {
        const text = args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ');
        stdout.push(text);
      },
      error: (...args) => {
        const text = args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ');
        stderr.push(text);
      }
    };

    try {
      const browser = await this.getBrowser();
      const result = await executeAction(browser, payload, scopedLogger);
      return {
        ok: true,
        exitCode: 0,
        stdout: stdout.length ? stdout.join('\n') + '\n' : '',
        stderr: stderr.length ? stderr.join('\n') + '\n' : '',
        result
      };
    } catch (err) {
      this.stats.errors++;
      const errPrefix = payload.isSemantic ? 'SEMANTIC_BROWSER_ERROR: ' : 'BROWSER_CONTROL_ERROR: ';
      stderr.push(errPrefix + err.message);
      return {
        ok: false,
        exitCode: 1,
        stdout: stdout.length ? stdout.join('\n') + '\n' : '',
        stderr: stderr.join('\n') + '\n',
        error: err.message
      };
    }
  }

  requestHandler(req, res) {
    const url = req.url || '/';
    if (req.method === 'GET' && (url === '/health' || url === '/status')) {
      const pagesCount = (this.browser && this.browser.isConnected()) ? 'CONNECTED' : 'STANDBY';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'OK',
        cdp: pagesCount,
        pid: process.pid,
        uptimeSeconds: Math.floor((Date.now() - this.stats.startTime) / 1000),
        stats: this.stats,
        memory: process.memoryUsage()
      }, null, 2));
      return;
    }

    if (req.method === 'POST' && url === '/reconnect') {
      if (this.browser) {
        try { this.browser.disconnect(); } catch {}
        this.browser = null;
      }
      this.getBrowser().then(() => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'RECONNECTED', ok: true }));
      }).catch(err => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ERROR', error: err.message }));
      });
      return;
    }

    if (req.method === 'POST' && url === '/stop') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'STOPPING' }));
      setTimeout(() => this.shutdown(), 200);
      return;
    }

    if (req.method === 'POST' && url === '/exec') {
      let body = '';
      req.setEncoding('utf8');
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}');
          const response = await this.handleExec(payload);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(response));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            ok: false,
            exitCode: 1,
            stdout: '',
            stderr: 'Invalid request payload: ' + err.message
          }));
        }
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }

  start() {
    // Write PID file
    fs.mkdirSync(BASE, { recursive: true });
    fs.writeFileSync(PID_FILE, String(process.pid), 'utf8');

    // Clean up stale socket file if present
    if (fs.existsSync(SOCKET_PATH)) {
      try { fs.unlinkSync(SOCKET_PATH); } catch {}
    }

    // Unix Domain Socket Server
    this.server = http.createServer((req, res) => this.requestHandler(req, res));
    this.server.listen(SOCKET_PATH, () => {
      try { fs.chmodSync(SOCKET_PATH, 0o700); } catch {}
      log(`Browser Daemon listening on Unix socket: ${SOCKET_PATH}`);
    });

    // TCP Localhost Server
    this.tcpServer = http.createServer((req, res) => this.requestHandler(req, res));
    this.tcpServer.listen(DAEMON_PORT, '127.0.0.1', () => {
      log(`Browser Daemon listening on TCP: http://127.0.0.1:${DAEMON_PORT}`);
    });

    // Clean up on termination
    const cleanExit = () => this.shutdown();
    process.on('SIGINT', cleanExit);
    process.on('SIGTERM', cleanExit);
    process.on('exit', () => {
      try { if (fs.existsSync(SOCKET_PATH)) fs.unlinkSync(SOCKET_PATH); } catch {}
      try { if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE); } catch {}
    });

    // Try pre-warming the browser connection in background (non-blocking)
    setTimeout(() => {
      this.getBrowser().catch(e => {
        log('Initial pre-warm standby (will connect on demand):', e.message);
      });
    }, 500);
  }

  shutdown() {
    log('Shutting down Browser Daemon (PID: ' + process.pid + ')...');
    if (this.browser) {
      try { this.browser.disconnect(); } catch {}
      this.browser = null;
    }
    if (this.server) {
      try { this.server.close(); } catch {}
    }
    if (this.tcpServer) {
      try { this.tcpServer.close(); } catch {}
    }
    try { if (fs.existsSync(SOCKET_PATH)) fs.unlinkSync(SOCKET_PATH); } catch {}
    try { if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE); } catch {}
    log('Browser Daemon shutdown complete.');
    process.exit(0);
  }
}

// CLI Management Subcommands
async function cli() {
  const cmd = process.argv[2] || 'status';

  if (cmd === 'start') {
    const alive = await isDaemonAlive(300);
    if (alive) {
      console.log('Browser Daemon is ALREADY RUNNING.');
      const statusRes = await fetchStatus();
      console.log(statusRes);
      return;
    }

    console.log('Starting Browser Daemon in background...');
    const child = spawn(process.execPath, [__filename, 'run'], {
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, DAEMON_SPAWNED: '1' }
    });
    child.unref();

    // Poll until healthy or 5s timeout
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 250));
      if (await isDaemonAlive(300)) {
        console.log('Browser Daemon STARTED successfully.');
        const statusRes = await fetchStatus();
        console.log(statusRes);
        return;
      }
    }
    console.error('Browser Daemon failed to respond within 5s. Check keeper.log or browser-daemon.log.');
    process.exitCode = 1;
    return;
  }

  if (cmd === 'stop') {
    if (fs.existsSync(PID_FILE)) {
      const pid = Number(fs.readFileSync(PID_FILE, 'utf8').trim());
      if (pid) {
        try {
          process.kill(pid, 'SIGTERM');
          console.log(`Sent SIGTERM to Daemon PID ${pid}.`);
        } catch (e) {
          console.log(`Daemon PID ${pid} was not running.`);
        }
      }
      try { fs.unlinkSync(PID_FILE); } catch {}
      try { if (fs.existsSync(SOCKET_PATH)) fs.unlinkSync(SOCKET_PATH); } catch {}
      console.log('Browser Daemon STOPPED.');
      return;
    }
    console.log('No PID file found. Checking socket...');
    if (await isDaemonAlive(300)) {
      // try sending POST /stop
      const req = http.request({
        socketPath: SOCKET_PATH,
        path: '/stop',
        method: 'POST'
      }, () => console.log('Daemon stop requested.'));
      req.on('error', () => {});
      req.end();
    } else {
      console.log('Browser Daemon is not running.');
    }
    return;
  }

  if (cmd === 'restart') {
    await cliStop();
    await new Promise(r => setTimeout(r, 600));
    process.argv[2] = 'start';
    await cli();
    return;
  }

  if (cmd === 'status') {
    const alive = await isDaemonAlive(400);
    if (!alive) {
      console.log(JSON.stringify({ status: 'STOPPED', daemon: false, socket: SOCKET_PATH }, null, 2));
      return;
    }
    const info = await fetchStatus();
    console.log(info);
    return;
  }

  if (cmd === 'run' || cmd === '--foreground') {
    process.env.DAEMON_FOREGROUND = '1';
    const daemon = new BrowserDaemon();
    daemon.start();
    return;
  }

  console.log('Usage: node browser-daemon.js [start|stop|restart|status|run]');
}

function fetchStatus() {
  return new Promise(resolve => {
    const req = http.request({
      socketPath: fs.existsSync(SOCKET_PATH) ? SOCKET_PATH : undefined,
      hostname: fs.existsSync(SOCKET_PATH) ? undefined : '127.0.0.1',
      port: fs.existsSync(SOCKET_PATH) ? undefined : DAEMON_PORT,
      path: '/status',
      method: 'GET',
      timeout: 2000
    }, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve(data));
    });
    req.on('error', err => resolve(JSON.stringify({ status: 'ERROR', error: err.message }, null, 2)));
    req.end();
  });
}

function cliStop() {
  return new Promise(resolve => {
    if (fs.existsSync(PID_FILE)) {
      const pid = Number(fs.readFileSync(PID_FILE, 'utf8').trim());
      if (pid) {
        try { process.kill(pid, 'SIGTERM'); } catch {}
      }
      try { fs.unlinkSync(PID_FILE); } catch {}
      try { if (fs.existsSync(SOCKET_PATH)) fs.unlinkSync(SOCKET_PATH); } catch {}
    }
    setTimeout(resolve, 500);
  });
}

if (require.main === module) {
  cli().catch(e => {
    console.error('DAEMON_CLI_ERROR:', e.message);
    process.exitCode = 1;
  });
}

module.exports = BrowserDaemon;
