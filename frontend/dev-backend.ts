// Bun loads frontend/.env.local (written by Clerk CLI) into this process.
// Forward environment directly to Go; never copy keys into source or log them.
const command = process.argv.slice(2)
if (command.length === 0) throw new Error('Pass a backend command to run.')
const child = Bun.spawn(command, {
  cwd: new URL('../backend', import.meta.url).pathname,
  env: {
    ...process.env,
    DATABASE_URL:
      process.env.DATABASE_URL ??
      'postgres://endorphins:endorphins_local@127.0.0.1:5548/endorphins?sslmode=disable',
  },
  stdin: 'inherit',
  stdout: 'inherit',
  stderr: 'inherit',
})
process.on('SIGINT', () => child.kill('SIGINT'))
process.on('SIGTERM', () => child.kill('SIGTERM'))
process.exit(await child.exited)
