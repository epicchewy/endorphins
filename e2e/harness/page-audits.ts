import { mkdtemp, rm } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { chromium, type Cookie } from '@playwright/test'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { createServer } from 'node:net'

export async function auditPages(origin: string, cookies: Cookie[], outputDir: string) {
  const socket = createServer()
  await new Promise<void>((ready) => socket.listen(0, '127.0.0.1', ready))
  const address = socket.address()
  if (!address || typeof address === 'string') throw new Error('Audit port unavailable')
  const port = address.port
  await new Promise<void>((closed) => socket.close(() => closed()))
  const profile = await mkdtemp(resolve(tmpdir(), 'endorphins-audit-'))
  try {
    const browser = await chromium.launchPersistentContext(profile, {
      headless: true,
      args: [`--remote-debugging-port=${port}`],
    })
    const auditEnv = { ...process.env }
    // An outer npm --call must not become the nested audit command.
    delete auditEnv.npm_config_call
    try {
      const cdp = await browser.newCDPSession(await browser.newPage())
      for (const [name, path] of [
        ['landing', '/'],
        ['dashboard', '/app'],
      ]) {
        if (name === 'dashboard') await browser.addCookies(cookies)
        await cdp.send('Network.clearBrowserCache')
        await promisify(execFile)(
          'npx',
          [
            '--yes',
            '--package=lighthouse@13.5.0',
            '--',
            'lighthouse',
            origin + path,
            `--port=${port}`,
            '--disable-storage-reset',
            '--quiet',
            '--no-enable-error-reporting',
            `--only-categories=performance,accessibility,best-practices${name === 'landing' ? ',seo' : ''}`,
            '--output=html',
            '--output=json',
            `--output-path=${resolve(outputDir, `lighthouse-${name}`)}`,
          ],
          { timeout: 80_000, env: auditEnv },
        )
      }
    } finally {
      await browser.close()
    }
  } finally {
    await rm(profile, { recursive: true, force: true })
  }
}
