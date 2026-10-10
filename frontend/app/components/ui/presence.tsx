import type { ReactNode } from 'react'
import { AnimatePresence, domAnimation, LazyMotion, useReducedMotion } from 'motion/react'
import { div as MotionDiv } from 'motion/react-m'

// The same timing as --motion-standard in app.css, expressed in seconds for Motion.
const transition = { duration: 0.18, ease: [0.2, 0.65, 0.3, 1] } as const

export function Presence({
  present = true,
  identity,
  children,
  className,
  direction = 0,
}: {
  present?: boolean
  identity?: string | number
  children: ReactNode
  className?: string
  direction?: -1 | 0 | 1
}) {
  const reducedMotion = useReducedMotion()
  return (
    <LazyMotion features={domAnimation} strict>
      <AnimatePresence initial={false} mode="wait">
        {present && (
          <MotionDiv
            key={identity}
            className={className}
            initial={{ opacity: 0, x: reducedMotion ? 0 : direction * 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: reducedMotion ? 0 : direction * -12 }}
            transition={reducedMotion ? { duration: 0 } : transition}
          >
            {children}
          </MotionDiv>
        )}
      </AnimatePresence>
    </LazyMotion>
  )
}
