import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

// Pre-load .env for dev server endpoints
try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
} catch (err) {
  // Ignore
}

import { handleSubmission } from './api/submissions';
import { handlePublicSchedule } from './api/public-schedule';
import { handleAdminData } from './api/admin-data';
import { handleAdminAction } from './api/admin-action';

function apiDevPlugin(): Plugin {
  return {
    name: 'api-dev-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0];

        // Helper to parse JSON body
        const readBody = (): Promise<any> =>
          new Promise((resolve) => {
            let bodyStr = '';
            req.on('data', (chunk) => {
              bodyStr += chunk;
            });
            req.on('end', () => {
              try {
                resolve(bodyStr ? JSON.parse(bodyStr) : {});
              } catch {
                resolve({});
              }
            });
          });

        const makeRes = () => ({
          status(code: number) {
            res.statusCode = code;
            return this;
          },
          json(data: unknown) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(data));
          },
          setHeader(name: string, val: string) {
            res.setHeader(name, val);
          },
        });

        if (url === '/api/submissions') {
          try {
            const body = await readBody();
            const customReq = {
              method: req.method,
              body,
              headers: req.headers,
              socket: req.socket,
            };
            await handleSubmission(customReq, makeRes());
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, message: err?.message || 'Server error' }));
          }
          return;
        }

        if (url === '/api/public-schedule') {
          try {
            const customReq = {
              method: req.method,
              url: req.url,
              headers: req.headers,
            };
            await handlePublicSchedule(customReq, makeRes());
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, message: err?.message || 'Server error' }));
          }
          return;
        }

        if (url === '/api/admin-data') {
          try {
            const customReq = {
              method: req.method,
              headers: req.headers,
            };
            await handleAdminData(customReq, makeRes());
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, message: err?.message || 'Server error' }));
          }
          return;
        }

        if (url === '/api/admin-action') {
          try {
            const body = await readBody();
            const customReq = {
              method: req.method,
              body,
              headers: req.headers,
            };
            await handleAdminAction(customReq, makeRes());
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, message: err?.message || 'Server error' }));
          }
          return;
        }

        next();
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), apiDevPlugin()],
  server: {
    port: 5173,
    host: true,
  },
});

