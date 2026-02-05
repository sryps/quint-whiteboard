import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { execFile } from 'child_process'
import { writeFile, mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import type { IncomingMessage, ServerResponse } from 'http'

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString()))
    req.on('error', reject)
  })
}

function runQuint(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    execFile('quint', args, { timeout: 15000 }, (err, stdout, stderr) => {
      resolve({ stdout, stderr, code: err ? (err as NodeJS.ErrnoException & { code?: number }).code as unknown as number ?? 1 : 0 })
    })
  })
}

function quintApiPlugin(): Plugin {
  return {
    name: 'quint-api',
    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        if (!req.url?.startsWith('/api/quint')) return next()

        res.setHeader('Content-Type', 'application/json')
        const body = req.method === 'POST' ? JSON.parse(await readBody(req)) : {}

        try {
          const dir = await mkdtemp(join(tmpdir(), 'quint-wb-'))
          const file = join(dir, 'spec.qnt')
          await writeFile(file, body.code || '')

          let result: { stdout: string; stderr: string; code: number }

          if (req.url === '/api/quint/typecheck') {
            result = await runQuint(['typecheck', file])
            res.end(JSON.stringify({
              ok: result.code === 0,
              output: result.code === 0 ? 'Typecheck passed' : result.stderr || result.stdout,
            }))

          } else if (req.url === '/api/quint/eval') {
            const expr = body.expr || ''
            const moduleName = body.module || 'Module1'
            const input = `${expr}\n.exit\n`
            const child = await new Promise<{ stdout: string; stderr: string; code: number }>((resolve) => {
              const proc = execFile('quint', ['repl', '-r', `${file}::${moduleName}`], { timeout: 10000 }, (err, stdout, stderr) => {
                resolve({ stdout, stderr, code: err ? 1 : 0 })
              })
              proc.stdin?.write(input)
              proc.stdin?.end()
            })
            // Parse REPL output: skip the header lines, extract results
            const lines = child.stdout.split('\n')
            const results = lines
              .filter(l => !l.startsWith('Quint REPL') && !l.startsWith('Type "') && l.trim() !== '>>>' && l.trim() !== '')
              .map(l => l.replace(/^>>> ?/, '').trim())
              .filter(l => l.length > 0)
            res.end(JSON.stringify({
              ok: child.code === 0,
              output: results.join('\n') || child.stderr || 'No output',
            }))

          } else if (req.url === '/api/quint/run') {
            const init = body.init || 'init'
            const step = body.step || 'step'
            const invariant = body.invariant || 'true'
            const maxSteps = body.maxSteps || 20
            const maxSamples = body.maxSamples || 100
            result = await runQuint([
              'run', file,
              '--init', init,
              '--step', step,
              '--invariant', invariant,
              '--max-steps', String(maxSteps),
              '--max-samples', String(maxSamples),
              '--verbosity', '3',
            ])
            res.end(JSON.stringify({
              ok: result.code === 0,
              output: result.stdout || result.stderr,
            }))

          } else if (req.url === '/api/quint/test') {
            const match = body.match || '.*'
            result = await runQuint(['test', file, '--match', match, '--verbosity', '3'])
            res.end(JSON.stringify({
              ok: result.code === 0,
              output: result.stdout || result.stderr,
            }))

          } else {
            res.statusCode = 404
            res.end(JSON.stringify({ error: 'Unknown endpoint' }))
          }

          await rm(dir, { recursive: true }).catch(() => {})
        } catch (e) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: String(e) }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), quintApiPlugin()],
})
