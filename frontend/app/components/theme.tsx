import {
  createContext,
  useContext,
  useEffect,
  useId,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { Select } from '~/components/ui/field'
import { cn } from '~/components/ui/cn'

type Theme = 'system' | 'light' | 'dark'
const ThemeContext = createContext<{ theme: Theme; setTheme: (theme: Theme) => void }>({
  theme: 'system',
  setTheme: () => {},
})
let memoryTheme: Theme = 'system'
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
  window.addEventListener('storage', listener)
  window.addEventListener('endorphins-theme', listener)
  return () => {
    window.removeEventListener('storage', listener)
    window.removeEventListener('endorphins-theme', listener)
  }
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
  const theme = useSyncExternalStore(subscribe, readTheme, () => 'system' as const)
  const [themeColor, setThemeColor] = useState<string>()
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      document.documentElement.dataset.theme = readTheme()
      setThemeColor(getComputedStyle(document.documentElement).backgroundColor)
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])
  return (
    <ThemeContext value={{ theme, setTheme }}>
      {themeColor && <meta name="theme-color" content={themeColor} />}
      {children}
    </ThemeContext>
  )
}
export function ThemeControl({
  compact = true,
  className,
}: { compact?: boolean; className?: string } = {}) {
  const id = useId()
  const { theme, setTheme } = useContext(ThemeContext)
  const Icon = theme === 'system' ? Monitor : theme === 'dark' ? Moon : Sun
  return (
    <label
      className={cn(
        'relative inline-flex min-h-11 items-center gap-1.5 rounded-control focus-within:outline-3 focus-within:outline-offset-3 focus-within:outline-focus',
        compact && 'max-[1150px]:w-11 max-[1150px]:justify-center',
        className,
      )}
      htmlFor={id}
    >
      <Icon size={17} aria-hidden="true" />
      <span className="sr-only">Color theme</span>
      <Select
        className={cn(
          'w-auto appearance-none border-0 bg-transparent px-0.5 py-2.5 text-xs text-muted focus-visible:outline-none',
          compact &&
            'max-[1150px]:absolute max-[1150px]:inset-0 max-[1150px]:w-11 max-[1150px]:opacity-0',
        )}
        id={id}
        name="theme"
        value={theme}
        onChange={(event) => {
          const value = event.target.value
          if (value === 'system' || value === 'light' || value === 'dark') setTheme(value)
        }}
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </Select>
    </label>
  )
}
