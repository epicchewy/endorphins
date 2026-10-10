// The identity fixture must never become an authentication option in a release.
const forbidden = /endorphins_test_session|\/api\/__fixture\/|Continue with test identity/
let bundles = 0
for await (const path of new Bun.Glob('build/**/*.{js,html}').scan('.')) {
  bundles++
  const code = await Bun.file(path).text()
  const marker = code.match(forbidden)?.[0]
  if (marker) throw new Error(`Test identity leaked into ${path}: ${marker}`)
}
if (bundles === 0) throw new Error('Build the release before checking its identity boundary')
console.log(`Release identity boundary passed (${bundles} bundles).`)
