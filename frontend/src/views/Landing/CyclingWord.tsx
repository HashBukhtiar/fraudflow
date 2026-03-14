import { useEffect, useState } from 'react'

const WORDS = ['detect.', 'protect.', 'explain.', 'block.']
const INTERVAL = 2400
const CHAR_DELAY = 0.045  // seconds between each letter
const CHAR_DURATION = 0.3 // seconds per letter animation

export default function CyclingWord() {
  const [index, setIndex] = useState(0)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const id = setInterval(() => {
      // 1. blur/fade the whole word out
      setLeaving(true)
      // 2. after fade-out, swap word and animate letters in
      setTimeout(() => {
        setIndex((i) => (i + 1) % WORDS.length)
        setLeaving(false)
      }, 320)
    }, INTERVAL)
    return () => clearInterval(id)
  }, [])

  const word = WORDS[index]

  return (
    <span className="relative inline-grid">
      {/* Ghost words — keep container sized to the longest word */}
      {WORDS.map((w) => (
        <span
          key={w}
          aria-hidden
          className="col-start-1 row-start-1 invisible select-none"
        >
          {w}
        </span>
      ))}

      {/* Active word — sits on top, same grid cell */}
      <span
        className="col-start-1 row-start-1 text-primary italic"
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {/* key=index forces remount → restarts letter animations on each word swap */}
        <span key={index} style={{ display: 'inline-flex' }}>
          {word.split('').map((char, ci) =>
            leaving ? (
              // leaving: whole word blurs + slides down together
              <span
                key={ci}
                style={{
                  display: 'inline-block',
                  transition: `opacity 0.28s ease, transform 0.28s ease, filter 0.28s ease`,
                  opacity: 0,
                  transform: 'translateY(8px)',
                  filter: 'blur(5px)',
                }}
              >
                {char}
              </span>
            ) : (
              // entering: each letter pops in staggered, piano-style
              <span
                key={ci}
                style={{
                  display: 'inline-block',
                  animation: `char-in ${CHAR_DURATION}s cubic-bezier(0.22, 1, 0.36, 1) both`,
                  animationDelay: `${ci * CHAR_DELAY}s`,
                }}
              >
                {char}
              </span>
            )
          )}
        </span>
      </span>

      {/* Underline — always visible, no animation */}
      <span className="absolute left-0 -bottom-1 h-[2px] w-full bg-primary rounded-full" />
    </span>
  )
}
