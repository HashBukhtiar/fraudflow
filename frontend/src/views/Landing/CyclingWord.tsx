import { useEffect, useState } from 'react'

const WORDS = ['detect.', 'protect.', 'explain.', 'block.']
const INTERVAL = 2200

export default function CyclingWord() {
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const id = setInterval(() => {
      // fade out
      setVisible(false)
      setTimeout(() => {
        setIndex((i) => (i + 1) % WORDS.length)
        setVisible(true)
      }, 350)
    }, INTERVAL)
    return () => clearInterval(id)
  }, [])

  return (
    <span className="relative inline-block">
      <span
        className="text-primary italic"
        style={{
          display: 'inline-block',
          transition: 'opacity 0.35s cubic-bezier(0.22,1,0.36,1), transform 0.35s cubic-bezier(0.22,1,0.36,1), filter 0.35s cubic-bezier(0.22,1,0.36,1)',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(10px)',
          filter: visible ? 'blur(0px)' : 'blur(6px)',
        }}
      >
        {WORDS[index]}
      </span>
      {/* animated underline */}
      <span
        className="absolute left-0 -bottom-1 h-[2px] bg-primary rounded-full"
        style={{
          width: visible ? '100%' : '0%',
          transition: 'width 0.4s cubic-bezier(0.22,1,0.36,1)',
          transitionDelay: visible ? '0.1s' : '0s',
        }}
      />
    </span>
  )
}
