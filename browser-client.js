'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE = path.join(process.env.HOME, 'phone-browser-agent');

function getSocketPath() {
  return process.env.BROWSER_DAEMON_SOCK || path.join(BASE, 'browser-daemon.sock');
}

function getDaemonPort() {
  return Number(process.env.BROWSER_DAEMON_PORT) || 9225;
}

function isDaemonAlive(timeoutMs = 250) {
  const socketPath = getSocketPath();
  const daemonPort = getDaemonPort();

  return new Promise((resolve) => {
    // Check unix domain socket first if it exists
    if (fs.existsSync(socketPath)) {
      const req = http.request({
        socketPath: socketPath,
        path: '/health',
        method: 'GET',
        timeout: timeoutMs
      }, (res) => {
        resolve(res.statusCode === 200);
      });
      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.on('error', () => {
        // Socket file might be stale, check TCP
        checkTcp(resolve, daemonPort, timeoutMs);
      });
      req.end();
      return;
    }
    checkTcp(resolve, daemonPort, timeoutMs);
  });
}

function checkTcp(resolve, port, timeoutMs) {
  const req = http.request({
    hostname: '127.0.0.1',
    port: port,
    path: '/health',
    method: 'GET',
    timeout: timeoutMs
  }, (res) => {
    resolve(res.statusCode === 200);
  });
  req.on('timeout', () => { req.destroy(); resolve(false); });
  req.on('error', () => resolve(false));
  req.end();
}

function sendToDaemon(payload, timeoutMs = 60000) {
  const socketPath = getSocketPath();
  const daemonPort = getDaemonPort();

  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const useSocket = fs.existsSync(socketPath);
    const options = useSocket ? {
      socketPath: socketPath,
      path: '/exec',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: timeoutMs
    } : {
      hostname: '127.0.0.1',
      port: daemonPort,
      path: '/exec',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: timeoutMs
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve(parsed);
        } catch (e) {
          resolve({
            ok: false,
            exitCode: 1,
            stdout: '',
            stderr: 'Invalid response from daemon: ' + body
          });
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        ok: false,
        exitCode: 1,
        stdout: '',
        stderr: 'Daemon request timed out after ' + timeoutMs + 'ms.'
      });
    });

    req.on('error', (err) => {
      resolve({
        ok: false,
        exitCode: 1,
        stdout: '',
        stderr: 'Daemon communication error: ' + err.message
      });
    });

    req.write(data);
    req.end();
  });
}

module.exports = {
  isDaemonAlive,
  sendToDaemon,
  getSocketPath,
  getDaemonPort,
  SOCKET_PATH: path.join(BASE, 'browser-daemon.sock'),
  DAEMON_PORT: 9225
};
