'use client'

import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

const Input = forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        'flex h-10 w-full rounded-lg bg-background/50 border border-card-border/60 px-3.5 py-2 text-sm text-foreground placeholder:text-muted/40 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50 focus-visible:border-accent/30 focus-visible:bg-background/80 disabled:cursor-not-allowed disabled:opacity-50 [color-scheme:dark]',
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Input.displayName = 'Input'

export { Input }
