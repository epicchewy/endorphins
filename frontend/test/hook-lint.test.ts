import { afterAll, expect, test } from 'bun:test'
import { $ } from 'bun'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

const root = resolve(import.meta.dir, '..')
const directory = await mkdtemp(resolve(tmpdir(), 'endorphins-hook-lint-'))
afterAll(() => rm(directory, { recursive: true, force: true }))

async function lint(name: string, source: string) {
  const file = resolve(directory, `${name}.tsx`)
  await writeFile(file, source)
  return $`${resolve(root, 'node_modules/.bin/oxlint')} --config ${resolve(root, '.oxlintrc.json')} --deny-warnings ${file}`
    .cwd(root)
    .quiet()
    .nothrow()
}

const forbidden = [
  ['state-import', "export { useState } from 'react'"],
  ['effect-import', "export { useEffect } from 'react'"],
  ['state-alias', "import { useState as state } from 'react'; export { state }"],
  ['effect-alias', "import { useEffect as effect } from 'react'; export { effect }"],
  ['namespace-state', "import * as React from 'react'; export const hook = React.useState"],
  ['namespace-effect', "import * as R from 'react'; export const hook = R['useEffect']"],
  ['default-state', "import R from 'react'; export const hook = R.useState"],
  ['default-destructure', "import R from 'react'; export const { useEffect: effect } = R"],
  ['namespace-export', "export * from 'react'"],
  ['dynamic-state', "const R = await import('react'); export const { useState: state } = R"],
  ['dynamic-effect', "const R = await import('react'); export const hook = R['useEffect']"],
] as const

test.each(forbidden)('frontend lint rejects %s', async (name, source) => {
  const result = await lint(name, source)
  expect(result.exitCode).toBe(1)
  expect(result.text()).toContain('no-restricted-')
})

test('frontend lint allows the supported hooks and React types', async () => {
  const result = await lint(
    'supported',
    `
    export { useReducer, useRef, useSyncExternalStore, useCallback, useTransition } from 'react'
    export type { ReactNode, RefCallback } from 'react'
  `,
  )
  expect(result.text()).toBe('')
  expect(result.stderr.length).toBe(0)
  expect(result.exitCode).toBe(0)
})
