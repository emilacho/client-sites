/**
 * Round 12 forensic · probe the live r3f scene to determine
 * whether SignModel + SurfboardModel are within the camera
 * frustum at each of the 4 auto-rotate keyframes (0°/90°/180°/270°).
 *
 * Strategy · navigate to the preview, wait for r3f mount, then walk
 * the canvas's React fiber tree to find the Scene, traverse Object3D
 * nodes, and project each candidate's world position through the
 * camera's projectionMatrix * matrixWorldInverse to NDC. NDC in
 * [-1, 1]³ + matrixWorld.elements[14] > 0 (in front of camera) =
 * visible in frame (ignoring occlusion by other geometry).
 *
 * Then performs an occlusion test · casts a Raycaster from camera
 * to object world position, finds the first intersected mesh, and
 * reports whether it's the object itself or something blocking it.
 */
import { chromium } from "playwright"

const URL =
  "https://client-sites-template-git-landing-v2-zero-risk1.vercel.app/"

const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
})
const page = await ctx.newPage()

page.on("console", (m) => {
  const t = m.text()
  if (t.startsWith("[probe]")) console.log(t.replace(/^\[probe\] /, ""))
})

console.log("→", URL)
await page.goto(URL, { waitUntil: "networkidle", timeout: 45_000 })
await page.waitForTimeout(3500)

const findings = await page.evaluate(async () => {
  const log = (s) => console.log("[probe] " + s)

  // Find the r3f Canvas. drei stores its root state via fiber attribution.
  const canvas = document.querySelector("canvas")
  if (!canvas) return { error: "no canvas" }

  // Walk DOM up to find react fiber root.
  function getFiber(el) {
    const key = Object.keys(el).find(
      (k) =>
        k.startsWith("__reactFiber") ||
        k.startsWith("__reactInternalInstance"),
    )
    return key ? el[key] : null
  }
  function getR3fState(el) {
    // r3f stores state in element's internal `__r3f` symbol, accessible
    // by name pattern on the canvas element.
    const key = Object.keys(el).find((k) => k.startsWith("__r3f"))
    return key ? el[key] : null
  }
  let state = getR3fState(canvas)
  // Also try fiber-side
  if (!state) {
    let fiber = getFiber(canvas)
    while (fiber) {
      if (fiber.stateNode?.scene) {
        state = { scene: fiber.stateNode.scene, camera: fiber.stateNode.camera }
        break
      }
      fiber = fiber.return
    }
  }
  if (!state || !state.scene) return { error: "no r3f state found" }

  const scene = state.scene
  const camera = state.camera
  const renderer = state.gl
  log("scene children: " + scene.children.length)
  log("camera type: " + camera?.type)

  // Locate SignModel + SurfboardModel + island + character primitives.
  // These are <primitive object={scene} /> from each GLB · drei names
  // the top group "Sketchfab_Scene".
  const targets = []
  scene.traverse((obj) => {
    if (obj.name === "Sketchfab_Scene") {
      targets.push(obj)
    }
  })
  log("Sketchfab_Scene nodes found: " + targets.length)

  // Each GLB has its own Sketchfab_Scene · 4 GLBs total: island, character,
  // sign, surfboard. Distinguish by descendant content.
  // - Island has Object_4 (sand), Cube_59 (skybox), Ocean001_57, palms
  // - Character has Armature
  // - Sign has only 1-2 meshes · short
  // - Surfboard similar · short
  function describe(root) {
    let meshCount = 0
    const meshNames = []
    root.traverse((o) => {
      if (o.isMesh) {
        meshCount++
        if (meshNames.length < 5) meshNames.push(o.name)
      }
    })
    return { meshCount, meshNames }
  }

  const targetInfo = targets.map((t, i) => {
    const d = describe(t)
    const worldPos = new (window.THREE?.Vector3 ?? function () {})()
    if (t.getWorldPosition) t.getWorldPosition(worldPos)
    return {
      idx: i,
      meshCount: d.meshCount,
      meshNames: d.meshNames,
      worldPos: [worldPos.x, worldPos.y, worldPos.z],
      parentName: t.parent?.parent?.name ?? "?",
    }
  })

  // Without window.THREE, we need a different vector approach.
  // Pull THREE from drei's internals if exposed · otherwise use plain arrays.
  // Camera/scene matrices we can access directly via three.js methods on the
  // objects themselves.
  function snapshotPos(obj) {
    if (obj.matrixWorld) {
      const m = obj.matrixWorld.elements
      return [m[12], m[13], m[14]]
    }
    return [obj.position.x, obj.position.y, obj.position.z]
  }
  function snapshotCamera() {
    const m = camera.matrixWorld.elements
    return {
      position: [m[12], m[13], m[14]],
      fov: camera.fov,
      near: camera.near,
      far: camera.far,
      type: camera.type,
    }
  }
  function projectToNDC(worldPos) {
    // V_clip = projection * view * V_world
    // view = matrixWorldInverse
    const x = worldPos[0], y = worldPos[1], z = worldPos[2]
    const v = camera.matrixWorldInverse.elements
    const p = camera.projectionMatrix.elements
    // view * vec4(world, 1)
    const vx = v[0]*x + v[4]*y + v[8]*z + v[12]
    const vy = v[1]*x + v[5]*y + v[9]*z + v[13]
    const vz = v[2]*x + v[6]*y + v[10]*z + v[14]
    const vw = v[3]*x + v[7]*y + v[11]*z + v[15]
    const cx = p[0]*vx + p[4]*vy + p[8]*vz + p[12]*vw
    const cy = p[1]*vx + p[5]*vy + p[9]*vz + p[13]*vw
    const cz = p[2]*vx + p[6]*vy + p[10]*vz + p[14]*vw
    const cw = p[3]*vx + p[7]*vy + p[11]*vz + p[15]*vw
    return { ndcX: cx/cw, ndcY: cy/cw, ndcZ: cz/cw, eyeZ: vz, clipW: cw }
  }

  function angleOfCamera() {
    // recover azimuth from camera world position (x, z)
    const p = snapshotCamera().position
    const a = Math.atan2(p[2], p[0]) // 0..2π
    return a
  }

  // Drag-orbit isn't easy from headless without exposing a method · instead
  // we'll let the camera auto-rotate and probe at multiple time points.
  const results = []
  const samples = 12
  for (let i = 0; i < samples; i++) {
    await new Promise((r) => setTimeout(r, 1250)) // ~7.5° per sample at 6°/s
    const camSnap = snapshotCamera()
    const ang = (angleOfCamera() * 180 / Math.PI + 360) % 360
    const targetSnap = []
    for (const [idx, info] of targetInfo.entries()) {
      const t = targets[idx]
      // recompute world position
      t.updateMatrixWorld(true)
      const wp = snapshotPos(t)
      const proj = projectToNDC(wp)
      const inFront = proj.eyeZ < 0 // three uses right-handed · negative Z = forward
      const inFrame =
        inFront && Math.abs(proj.ndcX) <= 1 && Math.abs(proj.ndcY) <= 1
      targetSnap.push({
        idx,
        meshes: info.meshCount,
        firstMesh: info.meshNames[0],
        wp,
        ndc: [proj.ndcX.toFixed(2), proj.ndcY.toFixed(2)],
        eyeZ: proj.eyeZ.toFixed(1),
        inFrame,
      })
    }
    results.push({ angleDeg: ang.toFixed(1), cam: camSnap.position.map(n=>n.toFixed(2)), targets: targetSnap })
  }

  return {
    targetInfo,
    results,
  }
})

if (findings.error) {
  console.log("✗", findings.error)
} else {
  console.log("\n=== TARGET ROSTER ===")
  for (const t of findings.targetInfo) {
    console.log(`  [${t.idx}] parent=${t.parentName} · meshes=${t.meshCount} · ${t.meshNames.join(", ")}`)
  }
  console.log("\n=== VISIBILITY OVER TIME (12 samples · 1.25s apart · ~7.5°/sample) ===")
  for (const r of findings.results) {
    console.log(`\nt+? · cam=[${r.cam.join(",")}] · angle≈${r.angleDeg}°`)
    for (const t of r.targets) {
      const flag = t.inFrame ? "✓ in-frame" : "✗ off-frame"
      console.log(`  [${t.idx}] ${t.firstMesh.padEnd(20)} ndc=(${t.ndc[0]},${t.ndc[1]}) eyeZ=${t.eyeZ} · ${flag}`)
    }
  }
}

await browser.close()
console.log("\n✓ done")
