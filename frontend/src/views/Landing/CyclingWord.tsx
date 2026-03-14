import { useEffect, useRef, useState } from 'react'

const WORDS = ['detect.', 'protect.', 'explain.', 'block.']
const INTERVAL = 2400
const CHAR_DELAY = 0.045
const CHAR_DURATION = 0.3

export default function CyclingWord() {
  const [index, setIndex] = useState(0)
  const [leaving, setLeaving] = useState(false)
  const [underlineWidth, setUnderlineWidth] = useState(0)
  const lettersRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const id = setInterval(() => {
      setLeaving(true)
      setTimeout(() => {
        setIndex((i) => (i + 1) % WORDS.length)
        setLeaving(false)
      }, 320)
    }, INTERVAL)
    return () => clearInterval(id)
  }, [])

  // measure the letters width after each word swap and update underline
  useEffect(() => {
    if (lettersRef.current) {
      setUnderlineWidth(lettersRef.current.offsetWidth)
    }
  }, [index])

  const word = WORDS[index]

  return (
    <span className="relative inline-grid">
      {/* Ghost words — size the container to the longest word */}
      {WORDS.map((w) => (
        <span key={w} aria-hidden className="col-start-1 row-start-1 invisible select-none">
          {w}
        </span>
      ))}

      {/* Active word */}
      <span
        className="col-start-1 row-start-1 text-primary italic"
        style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
      >
        {/* key=index remounts letters for piano animation */}
        <span key={index} ref={lettersRef} style={{ display: 'inline-flex' }}>
          {word.split('').map((char, ci) =>
            leaving ? (
              <span
                key={ci}
                style={{
                  display: 'inline-block',
                  transition: 'opacity 0.28s ease, transform 0.28s ease, filter 0.28s ease',
                  opacity: 0,
                  transform: 'translateY(8px)',
                  filter: 'blur(5px)',
                }}
              >
                {char}
              </span>
            ) : (
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

        {/* Underline — lives outside the keyed span so it can transition width */}
        <span
          style={{
            display: 'block',
            height: '2px',
            borderRadius: '9999px',
            backgroundColor: 'var(--color-primary)',
            marginTop: '2px',
            width: underlineWidth,
            transition: 'width 0.45s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        />
      </span>
    </span>
  )
}
