import { useEffect, useRef, useState, useCallback } from 'react'
import lottie, { type AnimationItem } from 'lottie-web'
import pako from 'pako'

type Props = {
  src: string
  size?: number
  loop?: boolean
  autoplay?: boolean
  className?: string
  onClick?: () => void
}

export function TgsPlayer({ src, size = 128, loop = true, autoplay = true, className = '', onClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<AnimationItem | null>(null)
  const mountedRef = useRef(true)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)

  const destroyAnimation = useCallback(() => {
    if (animationRef.current) {
      try {
        animationRef.current.destroy()
      } catch {
        // Ignore destroy errors
      }
      animationRef.current = null
    }
    // Clear container manually to avoid React conflicts
    if (containerRef.current) {
      containerRef.current.innerHTML = ''
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true

    if (!containerRef.current) return

    const container = containerRef.current

    const loadAnimation = async () => {
      try {
        if (!mountedRef.current) return

        setIsLoading(true)
        setError(false)

        // Fetch the TGS file
        const response = await fetch(src)
        if (!response.ok) throw new Error('Failed to fetch')

        const arrayBuffer = await response.arrayBuffer()
        const uint8Array = new Uint8Array(arrayBuffer)

        // Decompress gzip
        let jsonString: string
        try {
          const decompressed = pako.inflate(uint8Array)
          jsonString = new TextDecoder().decode(decompressed)
        } catch {
          // Maybe it's not gzipped, try as-is
          jsonString = new TextDecoder().decode(uint8Array)
        }

        // Parse JSON
        const animationData = JSON.parse(jsonString)

        if (!mountedRef.current) return

        // Clear previous animation
        destroyAnimation()

        // Create new animation
        animationRef.current = lottie.loadAnimation({
          container,
          renderer: 'svg',
          loop,
          autoplay,
          animationData,
        })

        if (mountedRef.current) {
          setIsLoading(false)
        }
      } catch (err) {
        console.error('Failed to load TGS:', err)
        if (mountedRef.current) {
          setError(true)
          setIsLoading(false)
        }
      }
    }

    loadAnimation()

    return () => {
      mountedRef.current = false
      destroyAnimation()
    }
  }, [src, loop, autoplay, destroyAnimation])

  // Play on hover
  const handleMouseEnter = () => {
    if (animationRef.current && !autoplay) {
      animationRef.current.play()
    }
  }

  const handleMouseLeave = () => {
    if (animationRef.current && !autoplay) {
      animationRef.current.stop()
    }
  }

  if (error) {
    return (
      <div
        className={`flex items-center justify-center bg-white/[0.04] rounded-lg ${className}`}
        style={{ width: size, height: size }}
        onClick={onClick}
      >
        <span className="text-white/30 text-xs">Error</span>
      </div>
    )
  }

  return (
    <div
      className={`relative ${className}`}
      style={{ width: size, height: size }}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Lottie container - separate from React-managed content */}
      <div ref={containerRef} className="w-full h-full" />
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" />
        </div>
      )}
    </div>
  )
}
