"use client"
/**
 * MenuSign3D · R96.151 · botón "Ver menú" estilo letrero de madera 3D ·
 * carga el GLB sign-naufrago-compact.glb (mismo asset que el sign del
 * isla 3D) · rota 180° Y para esconder el texto "NÁUFRAGO" baked · y
 * sobrepone un `<Text>` drei con "MENÚ" en la cara frontal visible.
 *
 * Canvas mini · sin OrbitControls · estático con ligera animación
 * idle de balanceo. Click del wrapper → onClick prop (abre MenuModal).
 */
import { Suspense, useRef } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { Text, useGLTF } from "@react-three/drei"
import type * as THREE from "three"
import { naufragoAssets } from "@/lib/v2/naufrago-content"

useGLTF.preload(naufragoAssets.sign, true)

function SignWithText() {
  const groupRef = useRef<THREE.Group>(null)
  const { scene } = useGLTF(naufragoAssets.sign, true)

  // Idle balance · gentle rotation around Y · subtle "sea breeze".
  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const t = clock.getElapsedTime()
    groupRef.current.rotation.z = Math.sin(t * 0.6) * 0.05
  })

  return (
    <group ref={groupRef}>
      {/* Sign GLB rotado 180° Y · cara con "NÁUFRAGO" mira hacia atrás ·
          frontal queda madera limpia para overlay del nuevo texto */}
      <primitive object={scene} rotation={[0, Math.PI, 0]} scale={2.2} />
      {/* Texto "MENÚ" 3D · Bebas Neue look · letras sand color · letter
          spacing wide · posicionado en la cara frontal visible.
          Z offset positivo para que esté delante del plank · evita z-fighting. */}
      <Text
        position={[0, 0.15, 0.32]}
        fontSize={0.65}
        color="#F5E9D2"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.18}
        outlineWidth={0.025}
        outlineColor="#3D2A15"
        outlineOpacity={0.9}
      >
        MENÚ
      </Text>
    </group>
  )
}

interface Props {
  onClick: () => void
  className?: string
}

export default function MenuSign3D({ onClick, className }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Ver menú"
      className={`pointer-events-auto group relative block w-[200px] h-[120px] cursor-pointer transition-transform hover:translate-y-[-2px] active:scale-[0.97] ${className ?? ""}`}
    >
      <Canvas
        camera={{ position: [0, 0.2, 3.5], fov: 30 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        dpr={[1, 1.5]}
      >
        <ambientLight intensity={0.7} />
        <directionalLight
          position={[2, 4, 5]}
          intensity={1.3}
          color="#FFE5C2"
        />
        <directionalLight
          position={[-2, 2, -3]}
          intensity={0.4}
          color="#7BB7FF"
        />
        <Suspense fallback={null}>
          <SignWithText />
        </Suspense>
      </Canvas>
    </button>
  )
}
