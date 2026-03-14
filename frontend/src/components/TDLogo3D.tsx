import { useRef, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

const TD_GREEN = '#84cc16'
const EDGE_COLOR = '#bef264'
const ROTATE_STRENGTH = 0.3

// Global mouse position normalized to [-1, 1]
const mouse = { x: 0, y: 0 }
if (typeof window !== 'undefined') {
  window.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1
    mouse.y = (e.clientY / window.innerHeight) * 2 - 1
  })
}

function Scene() {
  const groupRef = useRef<THREE.Group>(null)
  const { scene } = useGLTF('/td-logo.glb')

  // Apply materials + edges
  useEffect(() => {
    scene.traverse((child) => {
      const mesh = child as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.material = new THREE.MeshStandardMaterial({
        color: TD_GREEN,
        metalness: 0.0,
        roughness: 1.0,
        transparent: true,
        opacity: 0.88,
      })
      mesh.castShadow = true
      const edges = new THREE.EdgesGeometry(mesh.geometry, 15)
      mesh.add(new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({ color: EDGE_COLOR, transparent: true, opacity: 0.5 })
      ))
    })
  }, [scene])

  useFrame((state) => {
    if (!groupRef.current) return
    const t = state.clock.elapsedTime

    // Smoothly lerp rotation toward cursor position
    const targetY = mouse.x * ROTATE_STRENGTH
    const targetX = mouse.y * ROTATE_STRENGTH
    groupRef.current.rotation.y += (targetY - groupRef.current.rotation.y) * 0.05
    groupRef.current.rotation.x += (targetX - groupRef.current.rotation.x) * 0.05

    // Gentle float
    groupRef.current.position.y = Math.sin(t * 0.9) * 0.12
  })

  return (
    <group ref={groupRef} scale={1.6}>
      <primitive object={scene} />
    </group>
  )
}

useGLTF.preload('/td-logo.glb')

export default function TDLogo3D() {
  return (
    <Canvas
      camera={{ position: [0, 0, 5], fov: 55 }}
      style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
      shadows
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 6, 5]} intensity={2.5} castShadow />
      <directionalLight position={[-4, 2, -3]} intensity={0.6} color="#aaffaa" />
      <pointLight position={[0, 0, 6]} intensity={0.8} />
      <Scene />
    </Canvas>
  )
}
