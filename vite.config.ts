import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { handleSubmission } from './api/submissions';
import { handlePublicSchedule } from './api/public-schedule';

function apiDevPlugin(): Plugin {
  return {
    name: 'api-dev-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0];

        if (url === '/api/submissions') {
          let bodyStr = '';
          req.on('data', chunk => {
            bodyStr += chunk;
          });
          req.on('end', async () => {
            try {
              const body = bodyStr ? JSON.parse(bodyStr) : {};
              const customReq = {
                method: req.method,
                body,
                headers: req.headers,
                socket: req.socket,
              };
              const customRes = {
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
              };
              await handleSubmission(customReq, customRes);
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, message: err?.message || 'Server error' }));
            }
          });
          return;
        }

        if (url === '/api/public-schedule') {
          try {
            const customReq = {
              method: req.method,
              headers: req.headers,
            };
            const customRes = {
              status(code: number) {
                res.statusCode = code;
                return this;
              },
              json(data: unknown) {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(data));
              },
            };
            await handlePublicSchedule(customReq, customRes);
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
