import Image from 'next/image'
import { cn } from '@/lib/utils'

export function Logo({
  className,
  variant = 'red',
  priority,
}: {
  className?: string
  variant?: 'red' | 'white'
  priority?: boolean
}) {
  return (
    <Image
      src="/images/yummy-logo.webp"
      alt="Yummy"
      width={812}
      height={485}
      priority={priority}
      className={cn('h-10 w-auto', variant === 'white' && 'brightness-0 invert', className)}
    />
  )
}
