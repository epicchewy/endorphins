import { fileURLToPath } from 'node:url'
import { GenericContainer } from 'testcontainers'

const root = fileURLToPath(new URL('../../', import.meta.url))

export async function buildImages() {
  console.log('[stack] Building backend and frontend test images')
  // Testcontainers labels these images for cleanup; Docker keeps reusable build layers.
  // BuildKit runs stages in parallel; Testcontainers' default legacy builder is 2-4x slower.
  const results = await Promise.allSettled([
    GenericContainer.fromDockerfile(root, 'backend/Dockerfile')
      .withBuildkit()
      .withBuildArgs({ GO_BUILD_TAGS: 'e2e' })
      .build(),
    GenericContainer.fromDockerfile(root, 'frontend/Dockerfile')
      .withBuildkit()
      .withBuildArgs({
        BUILD_MODE: 'e2e',
        VITE_CLERK_PUBLISHABLE_KEY: 'pk_test_c21va2UuY2xlcmsuYWNjb3VudHMuZGV2JA',
      })
      .build(),
  ])
  const images = results.map((result) => {
    if (result.status === 'rejected') throw result.reason
    return result.value
  })
  return { backend: images[0], frontend: images[1] }
}
