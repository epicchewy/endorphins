import { useEffect, useRef } from 'react'

// Some browsers omit closed <details> when printing, even with print CSS.
// Restore the reader's disclosure state after the print dialog closes.
export function usePrintDetails() {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const original = new Map<HTMLDetailsElement, boolean>()
    const beforePrint = () => {
      for (const detail of ref.current?.querySelectorAll('details') ?? []) {
        if (!original.has(detail)) original.set(detail, detail.open)
        detail.open = true
      }
    }
    const afterPrint = () => {
      for (const [detail, open] of original) detail.open = open
      original.clear()
    }
    window.addEventListener('beforeprint', beforePrint)
    window.addEventListener('afterprint', afterPrint)
    return () => {
      window.removeEventListener('beforeprint', beforePrint)
      window.removeEventListener('afterprint', afterPrint)
      afterPrint()
    }
  }, [])
  return ref
}
