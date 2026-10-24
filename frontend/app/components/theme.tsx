import {
  createContext,
  useContext,
  useId,
  useSyncExternalStore,
  type ChangeEvent,
  type ReactNode,
} from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { Field, FieldDescription, FieldLabel } from '~/components/ui/field'
import { NativeSelect, NativeSelectOption } from '~/components/ui/native-select'
import { cn } from '~/lib/utils'

type Theme = 'system' | 'light' | 'dark'
const ThemeContext = createContext<Theme>('system')
let memoryTheme: Theme = 'system'
const serverSnapshot: { theme: Theme; themeColor?: string } = { theme: 'system' }
let browserSnapshot = serverSnapshot
// Apply the saved theme before first paint. This script contains no user data.
export const themeScript = `(()=>{try{const t=localStorage.getItem('endorphins-theme');document.documentElement.dataset.theme=t==='dark'||t==='light'?t:'system'}catch{}})()`
function readTheme(): Theme {
  try {
    const saved = localStorage.getItem('endorphins-theme')
    return saved === 'light' || saved === 'dark' ? saved : 'system'
  } catch {
    return memoryTheme
  }
}
function subscribe(listener: () => void) {
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const refresh = () => {
    document.documentElement.dataset.theme = readTheme()
    listener()
  }
  window.addEventListener('storage', refresh)
  window.addEventListener('endorphins-theme', refresh)
  media.addEventListener('change', refresh)
  refresh()
  return () => {
    window.removeEventListener('storage', refresh)
    window.removeEventListener('endorphins-theme', refresh)
    media.removeEventListener('change', refresh)
  }
}
function readSnapshot() {
  const theme = readTheme()
  const themeColor = getComputedStyle(document.documentElement).backgroundColor
  // React needs the same snapshot object until a browser value changes.
  if (browserSnapshot.theme !== theme || browserSnapshot.themeColor !== themeColor)
    browserSnapshot = { theme, themeColor }
  return browserSnapshot
}
function setTheme(next: Theme) {
  memoryTheme = next
  try {
    localStorage.setItem('endorphins-theme', next)
  } catch {
    /* In-memory preference works when storage is disabled. */
  }
  window.dispatchEvent(new Event('endorphins-theme'))
}
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { theme, themeColor } = useSyncExternalStore(subscribe, readSnapshot, () => serverSnapshot)
  return (
    <ThemeContext value={theme}>
      {themeColor && <meta name="theme-color" content={themeColor} />}
      {children}
    </ThemeContext>
  )
}
const themes = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const
function chooseTheme(event: ChangeEvent<HTMLSelectElement>) {
  const value = event.target.value
  if (value === 'system' || value === 'light' || value === 'dark') setTheme(value)
}
export function ThemeField() {
  const id = useId()
  const theme = useContext(ThemeContext)
  return (
    <Field>
      <FieldLabel htmlFor={id}>Color theme</FieldLabel>
      <NativeSelect
        id={id}
        className="w-full"
        aria-describedby={`${id}-hint`}
        name="theme"
        value={theme}
        onChange={chooseTheme}
      >
        {themes.map((item) => (
          <NativeSelectOption key={item.value} value={item.value}>
            {item.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <FieldDescription id={`${id}-hint`}>System follows your device setting.</FieldDescription>
    </Field>
  )
}
export function ThemeControl({
  compact = true,
  className,
}: { compact?: boolean; className?: string } = {}) {
  const id = useId()
  const theme = useContext(ThemeContext)
  const Icon = theme === 'system' ? Monitor : theme === 'dark' ? Moon : Sun
  return (
    <label
      className={cn(
        'relative inline-flex min-h-11 items-center gap-1.5 rounded-lg focus-within:outline-3 focus-within:outline-offset-3 focus-within:outline-ring',
        compact && 'max-[1150px]:w-11 max-[1150px]:justify-center',
        className,
      )}
      htmlFor={id}
    >
      <Icon size={17} aria-hidden="true" />
      <span className="sr-only">Color theme</span>
      <select
        className={cn(
          'min-h-11 w-auto cursor-pointer appearance-none border-0 bg-transparent px-0.5 py-2.5 text-xs text-muted-foreground focus-visible:outline-none [&_option]:bg-[Canvas] [&_option]:text-[CanvasText]',
          compact &&
            'max-[1150px]:absolute max-[1150px]:inset-0 max-[1150px]:w-11 max-[1150px]:opacity-0',
        )}
        id={id}
        name="theme"
        value={theme}
        onChange={chooseTheme}
      >
        {themes.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  )
}
