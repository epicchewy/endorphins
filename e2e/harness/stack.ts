import { createWriteStream } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { finished } from 'node:stream/promises'
import { PostgreSqlContainer } from '@testcontainers/postgresql'
import { Network, Wait, type GenericContainer } from 'testcontainers'
import { buildImages } from './images'

export async function startStack() {
  const logDir = new URL('../../output/playwright/', import.meta.url)
  await mkdir(logDir, { recursive: true })
  const logs = createWriteStream(new URL('stack.log', logDir))
  const cleanup: (() => Promise<unknown>)[] = []
  const stop = async () => {
    const errors: unknown[] = []
    for (const close of cleanup.reverse()) {
      try {
        await close()
      } catch (error) {
        errors.push(error)
      }
    }
    logs.end()
    await finished(logs)
    if (errors.length) throw new AggregateError(errors, 'Test stack cleanup failed')
  }
  const start = async (name: string, container: GenericContainer) => {
    console.log(`[stack] Starting ${name}`)
    const started = await container
      .withLabels({ 'app.endorphins.test': 'e2e', 'app.endorphins.service': name })
      .withLogConsumer((stream) => {
        stream.on('data', (chunk) => logs.write(`[${name}] ${chunk}`))
        stream.on('error', (error) => logs.write(`[${name}] ${error}\n`))
      })
      .withStartupTimeout(120_000)
      .start()
    cleanup.push(() => started.stop({ timeout: 10_000 }))
    return started
  }
  try {
    const images = await buildImages()
    const network = await new Network().start()
    cleanup.push(() => network.stop())
    await start(
      'postgres',
      new PostgreSqlContainer('postgres:17-alpine')
        .withDatabase('endorphins_e2e')
        .withUsername('test')
        .withPassword('test')
        .withNetwork(network)
        .withNetworkAliases('postgres'),
    )
    // The public landing page can start without the API. Its allocated origin
    // becomes the exact allowed party for the API's signed test sessions.
    const frontend = await start(
      'frontend',
      images.frontend
        .withNetwork(network)
        .withNetworkAliases('web')
        .withEnvironment({ API_ORIGIN: 'http://api:8088' })
        .withExposedPorts(3100)
        .withWaitStrategy(Wait.forHttp('/', 3100).forStatusCode(200)),
    )
    const baseURL = `http://${frontend.getHost()}:${frontend.getMappedPort(3100)}`
    const backend = await start(
      'backend',
      images.backend
        .withNetwork(network)
        .withNetworkAliases('api')
        .withEnvironment({
          DATABASE_URL: 'postgres://test:test@postgres:5432/endorphins_e2e?sslmode=disable',
          CLERK_SECRET_KEY: 'sk_test_fixture',
          VITE_CLERK_PUBLISHABLE_KEY: 'pk_test_c21va2UuY2xlcmsuYWNjb3VudHMuZGV2JA',
          APP_ORIGINS: baseURL,
        })
        .withExposedPorts(8088)
        .withWaitStrategy(Wait.forHttp('/readyz', 8088).forStatusCode(200)),
    )
    console.log(`[stack] Ready at ${baseURL}`)
    return { baseURL, backend, stop }
  } catch (error) {
    try {
      await stop()
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], 'Test stack startup and cleanup failed')
    }
    throw error
  }
}
