'use client'

export default function ZatrovoLoader({ message, size = 'default', className = '' }) {
  const sizeClasses = size === 'full'
    ? 'min-h-screen'
    : size === 'section'
      ? 'min-h-[400px]'
      : 'min-h-[200px]'

  return (
    <div className={`flex flex-col items-center justify-center bg-background ${sizeClasses} ${className}`}>
      <svg viewBox="0 0 24 24" className="w-8 h-8 animate-spin">
        <circle cx="12" cy="12" r="10" fill="none" stroke="var(--accent)" strokeWidth="2" opacity="0.2" />
        <path
          d="M12,2 A10,10 0 0,1 22,12"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      {message && (
        <p className="mt-4 text-sm text-muted animate-pulse">{message}</p>
      )}
    </div>
  )
}
