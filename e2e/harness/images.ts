import { fileURLToPath } from 'node:url'
import { GenericContainer } from 'testcontainers'

const root = fileURLToPath(new URL('../../', import.meta.url))

export async function buildImages() {
  console.log('[stack] Building backend and frontend test images')
  // Testcontainers labels these images for cleanup; Docker keeps reusable build layers.
  const results = await Promise.allSettled(
    ['backend', 'frontend'].map((service) =>
      GenericContainer.fromDockerfile(root, `e2e/docker/${service}.Dockerfile`).build(),
    ),
  )
  const images = results.map((result) => {
    if (result.status === 'rejected') throw result.reason
    return result.value
  })
  return { backend: images[0], frontend: images[1] }
}
