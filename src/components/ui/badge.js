'use client'

import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-accent/10 text-accent',
        secondary: 'bg-white/10 text-foreground',
        destructive: 'bg-red-600/10 text-red-400',
        success: 'bg-green-600/10 text-green-400',
        outline: 'border border-card-border text-muted',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

function Badge({ className, variant, ...props }) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
