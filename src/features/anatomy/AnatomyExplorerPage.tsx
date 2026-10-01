import { useEffect, useRef, useState, useMemo, useCallback } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js"

export interface AnatomyModelDef {
  id: string
  name: string
  format: "glb" | "obj"
  url: string
  badge: string
}

export const AVAILABLE_MODELS: AnatomyModelDef[] = [
  {
    id: "layered_anatomy",
    name: "Human Anatomy (Layered 3D)",
    format: "glb",
    url: "/models/human_anatomy_layered.glb",
    badge: "Full Body (Organs, Muscles, Skeleton)"
  },
  {
    id: "skeleton_hd",
    name: "Human Skeleton HD",
    format: "obj",
    url: "/models/human_skeleton_hd.obj",
    badge: "Skeletal System (OBJ)"
  }
]

/**
 * Filter to identify and sanitize genital / private anatomy parts
 * Hides and strips reproductive and genital organs while strictly preserving
 * pelvic bones, urinary organs (kidneys, bladder), abdomen, and normal anatomy.
 */
export function isGenitalOrPrivatePart(obj: THREE.Object3D): boolean {
  const name = (obj.name || "").toLowerCase()
  const userData = obj.userData || {}
  const anatName = String(userData.anatomical_name || "").toLowerCase()
  const system = String(userData.system || "").toLowerCase()
  const layer = String(userData.layer || "").toLowerCase()
  const combined = `${name} ${anatName} ${system} ${layer}`

  const privateKeywords = [
    "penis",
    "testis",
    "testes",
    "testicle",
    "testicular",
    "scrotum",
    "scrotal",
    "glans",
    "prepuce",
    "foreskin",
    "pubic_hair",
    "pubic hair",
    "corpus_cavernosum",
    "corpus_spongiosum",
    "epididymis",
    "seminal_vesicle",
    "deferent_duct",
    "reproductive_system",
    "male_reproductive",
    "female_reproductive",
    "vulva",
    "vagina",
    "clitoris",
    "labia",
    "erectile"
  ]

  return privateKeywords.some((kw) => combined.includes(kw))
}

/**
 * Traverses 3D scene and strips/hides any genital/private parts
 */
export function cleanPrivateParts(root: THREE.Object3D) {
  const toRemove: THREE.Object3D[] = []

  root.traverse((child) => {
    if (isGenitalOrPrivatePart(child)) {
      child.visible = false
      toRemove.push(child)
    }
  })

  for (const node of toRemove) {
    node.visible = false
    node.traverse((descendant) => {
      descendant.visible = false
      if ((descendant as THREE.Mesh).isMesh) {
        ;(descendant as THREE.Mesh).geometry?.dispose?.()
      }
    })
    if (node.parent) {
      node.parent.remove(node)
    }
  }
}

/**
 * Normalizes 3D model orientation (detecting Z-up vs Y-up),
 * scales height to ~1.7 units to fit viewport, and centers at origin (0, 0, 0).
 * Highly optimized for low-end devices by freezing static submesh matrices and computing bounding spheres.
 */
export function setupAndCenterModel(obj: THREE.Object3D) {
  obj.updateMatrixWorld(true)
  const initialBox = new THREE.Box3().setFromObject(obj)
  const size = new THREE.Vector3()
  initialBox.getSize(size)

  // Auto-detect orientation: if Z dimension is significantly larger than Y, rotate from Z-up to Y-up
  if (size.z > size.y * 1.3) {
    obj.rotation.x = -Math.PI / 2
    obj.updateMatrixWorld(true)
  }

  // Recompute box after orientation adjustment
  const orientedBox = new THREE.Box3().setFromObject(obj)
  const orientedSize = new THREE.Vector3()
  orientedBox.getSize(orientedSize)
  const maxDim = Math.max(orientedSize.x, orientedSize.y, orientedSize.z)

  // Target height ~ 1.7 units to fit standard camera viewport (camera z ~ 2.1)
  if (maxDim > 0) {
    const targetScale = 1.7 / maxDim
    obj.scale.setScalar(targetScale)
  }
  obj.updateMatrixWorld(true)

  // Center model at (0, 0, 0)
  const finalBox = new THREE.Box3().setFromObject(obj)
  const center = new THREE.Vector3()
  finalBox.getCenter(center)
  obj.position.sub(center)
  obj.updateMatrixWorld(true)

  // LOW-END OPTIMIZATION:
  // 1. Enable frustum culling on all submeshes
  // 2. Compute bounding spheres so off-screen meshes are instantly skipped
  // 3. Disable matrixAutoUpdate on internal static parts so CPU doesn't recalculate 2,234 matrices every frame!
  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh
      mesh.frustumCulled = true
      if (mesh.geometry && !mesh.geometry.boundingSphere) {
        mesh.geometry.computeBoundingSphere()
      }
      mesh.matrixAutoUpdate = false
    }
  })
}

export const CONSTANT_FOCUS_DISTANCE = 2.1

export type { AnatomicalCondition, BodyPart } from "./anatomyData"
import type { BodyPart } from "./anatomyData"

export const BODY_PARTS_CATALOG: BodyPart[] = [
  {
    id: "skull",
    name: "Cranium & Skull",
    shortLabel: "SKULL / HEAD",
    latinName: "Cranium et Ossa Faciei",
    category: "Axial",
    subRegion: "Head & Neck",
    boneCount: 22,
    target: [0, 0.62, -0.05],
    cameraPos: [0, 0.62, 0.33],
    keyBones: ["Frontal", "Parietal (2)", "Temporal (2)", "Occipital", "Sphenoid", "Ethmoid", "Maxilla", "Mandible"],
    primaryFunctions: [
      "Protects the brain and cranial nerve structures",
      "Houses sensory organs for vision, hearing, smell, and taste",
      "Anchors muscles for facial expression and mastication"
    ],
    commonConditions: [
      { name: "Basilar Skull Fracture", severity: "Critical", note: "Battle's sign, raccoon eyes, CSF rhinorrhea/otorrhea" },
      { name: "Le Fort Facial Fractures", severity: "High", note: "Midfacial trauma requiring airway control and miniplate fixation" }
    ],
    clinicalNotes: "Always protect and immobilize cervical spine in cranial trauma until cleared by CT."
  },
  {
    id: "cervical_spine",
    name: "Cervical Spine (Neck)",
    shortLabel: "CERVICAL SPINE",
    latinName: "Vertebrae Cervicales C1-C7",
    category: "Axial",
    subRegion: "Spine",
    boneCount: 7,
    target: [0, 0.44, -0.04],
    cameraPos: [0, 0.44, 0.34],
    keyBones: ["Atlas (C1)", "Axis with Odontoid (C2)", "C3-C6 Vertebrae", "C7 Vertebra Prominens"],
    primaryFunctions: [
      "Supports head weight (~5 kg) and allows neck turning and nodding",
      "Shields cervical spinal cord and vertebral arteries in transverse foramina"
    ],
    commonConditions: [
      { name: "Hangman's Fracture (C2)", severity: "Critical", note: "Unstable hyperextension injury of C2 pars interarticularis" },
      { name: "Cervical Radiculopathy", severity: "Moderate", note: "Nerve root compression causing arm tingling and neck stiffness" }
    ],
    clinicalNotes: "Maintain rigid collar until full radiographic clearance is documented."
  },
  {
    id: "shoulder_girdle",
    name: "Shoulder & Clavicle",
    shortLabel: "SHOULDER & CLAVICLE",
    latinName: "Cingulum Pectorale & Clavicula",
    category: "Appendicular",
    subRegion: "Upper Limbs",
    boneCount: 4,
    target: [0.18, 0.38, 0],
    cameraPos: [0.18, 0.38, 0.38],
    keyBones: ["Clavicle (Collar bone)", "Scapula (Shoulder blade)", "Acromion", "Glenoid Fossa"],
    primaryFunctions: [
      "Connects arm to the axial skeleton with maximal multi-axis mobility",
      "Provides broad leverage for rotator cuff and deltoid musculature"
    ],
    commonConditions: [
      { name: "Midshaft Clavicle Fracture", severity: "Moderate", note: "Common cycling/sports fall; check subclavian vessels" },
      { name: "Shoulder Dislocation", severity: "High", note: "Humeral head pops out of socket; test axillary nerve sensation" }
    ],
    clinicalNotes: "Test lateral deltoid skin sensation before and after reducing shoulder dislocations."
  },
  {
    id: "thorax_ribs",
    name: "Ribs, Chest & Sternum",
    shortLabel: "RIBS & STERNUM",
    latinName: "Cavea Thoracis, Costae et Sternum",
    category: "Axial",
    subRegion: "Chest & Torso",
    boneCount: 37,
    target: [0, 0.24, 0.04],
    cameraPos: [0, 0.24, 0.42],
    keyBones: ["12 Pairs of Ribs (True, False, Floating)", "Sternum (Manubrium, Body, Xiphoid)", "T1-T12 Vertebrae"],
    primaryFunctions: [
      "Expands and contracts for breathing (lung ventilation)",
      "Rigid cage protecting heart, aorta, and mediastinal viscera"
    ],
    commonConditions: [
      { name: "Flail Chest", severity: "Critical", note: "Multiple segmental rib fractures causing paradoxical chest wall movement" },
      { name: "Rib Fracture & Hemothorax", severity: "High", note: "Sharp rib shard injuring pleura or intercostal vessels" }
    ],
    clinicalNotes: "Provide aggressive analgesia (nerve blocks) to enable deep breathing and avoid pneumonia."
  },
  {
    id: "arm_humerus",
    name: "Upper Arm (Humerus)",
    shortLabel: "ARM / HUMERUS",
    latinName: "Humerus",
    category: "Appendicular",
    subRegion: "Upper Limbs",
    boneCount: 2,
    target: [0.26, 0.16, 0],
    cameraPos: [0.26, 0.16, 0.38],
    keyBones: ["Humeral Head", "Greater & Lesser Tuberosities", "Humeral Shaft", "Distal Epicondyles"],
    primaryFunctions: [
      "Primary lever for lifting, pushing, and pulling loads",
      "Path for radial nerve running along posterior spiral groove"
    ],
    commonConditions: [
      { name: "Humeral Shaft Fracture (Wrist Drop)", severity: "High", note: "Radial nerve injury causing inability to extend wrist and fingers" },
      { name: "Supracondylar Fracture (Pediatric)", severity: "Critical", note: "Risk of brachial artery injury and Volkmann ischemic contracture" }
    ],
    clinicalNotes: "Immediately document radial nerve motor and sensory function in all humerus injuries."
  },
  {
    id: "lumbar_spine",
    name: "Lumbar Spine (Lower Back)",
    shortLabel: "LUMBAR SPINE",
    latinName: "Vertebrae Lumbales L1-L5",
    category: "Axial",
    subRegion: "Spine",
    boneCount: 5,
    target: [0, 0.05, -0.04],
    cameraPos: [0, 0.05, 0.34],
    keyBones: ["L1 to L5 Vertebrae", "Intervertebral Discs L1-S1", "Facet Joints"],
    primaryFunctions: [
      "Bears major body weight during standing, bending, and lifting",
      "Encloses cauda equina nerve root bundle"
    ],
    commonConditions: [
      { name: "Cauda Equina Syndrome", severity: "Critical", note: "Bowel/bladder loss with numbness; emergency decompression within 24h" },
      { name: "Herniated Disc (Sciatica)", severity: "Moderate", note: "L4-L5 / L5-S1 disc protrusion causing sharp shooting leg pain" }
    ],
    clinicalNotes: "Red flags for back pain: sphincter dysfunction, progressive motor loss, fever, or prior cancer."
  },
  {
    id: "pelvis_sacrum",
    name: "Pelvis & Hips",
    shortLabel: "PELVIS & HIPS",
    latinName: "Pelvis, Os Coxae et Sacrum",
    category: "Axial",
    subRegion: "Pelvis",
    boneCount: 4,
    target: [0, -0.08, 0],
    cameraPos: [0, -0.08, 0.38],
    keyBones: ["Ilium, Ischium & Pubis (Hip bones)", "Sacrum", "Coccyx (Tailbone)", "Acetabulum (Socket)"],
    primaryFunctions: [
      "Rigid ring transferring body weight from spine to lower limbs",
      "Shelters bladder, bowel, and internal reproductive organs"
    ],
    commonConditions: [
      { name: "Open Book Pelvic Fracture", severity: "Critical", note: "Disrupts pelvic ring; risk of massive retroperitoneal blood loss (up to 4L)" },
      { name: "Acetabular (Socket) Fracture", severity: "High", note: "High-energy injury disrupting the smooth hip joint surface" }
    ],
    clinicalNotes: "Immediately wrap a pelvic binder around the trochanters in unstable pelvic injury to stop bleeding."
  },
  {
    id: "forearm",
    name: "Forearm (Radius & Ulna)",
    shortLabel: "FOREARM",
    latinName: "Radius et Ulna",
    category: "Appendicular",
    subRegion: "Upper Limbs",
    boneCount: 4,
    target: [0.32, -0.04, 0],
    cameraPos: [0.32, -0.04, 0.38],
    keyBones: ["Radius (Lateral / Thumb side)", "Ulna (Medial / Pinky side)", "Olecranon (Elbow tip)", "Radial Head"],
    primaryFunctions: [
      "Enables pronation and supination (turning hand palm up / palm down)",
      "Transfers load from hand and wrist up into elbow joint"
    ],
    commonConditions: [
      { name: "Colles' Wrist Fracture", severity: "Moderate", note: "Distal radius fracture with dorsal tilt ('dinner fork' deformity) from FOOSH" },
      { name: "Monteggia Fracture", severity: "High", note: "Ulna shaft fracture with dislocated radial head at the elbow" }
    ],
    clinicalNotes: "Always inspect both elbow and wrist joints whenever one forearm bone is fractured."
  },
  {
    id: "hand_wrist",
    name: "Hand & Wrist",
    shortLabel: "HAND & WRIST",
    latinName: "Carpus, Metacarpus et Phalanges",
    category: "Appendicular",
    subRegion: "Upper Limbs",
    boneCount: 54,
    target: [0.38, -0.16, 0.02],
    cameraPos: [0.38, -0.16, 0.40],
    keyBones: ["8 Carpal Bones (Scaphoid, Lunate, etc.)", "5 Metacarpals", "14 Phalanges per hand"],
    primaryFunctions: [
      "Provides fine motor dexterity, pinching, and strong power grip",
      "Opposable thumb mechanism enables precision tool handling"
    ],
    commonConditions: [
      { name: "Scaphoid Fracture", severity: "High", note: "Anatomical snuffbox tenderness; risk of avascular necrosis due to retrograde blood supply" },
      { name: "Boxer's Fracture", severity: "Moderate", note: "5th metacarpal neck fracture after direct impact" }
    ],
    clinicalNotes: "Treat snuffbox tenderness as scaphoid fracture even if initial X-ray appears normal."
  },
  {
    id: "femur_hip",
    name: "Thigh & Femur",
    shortLabel: "THIGH / FEMUR",
    latinName: "Femur",
    category: "Appendicular",
    subRegion: "Lower Limbs",
    boneCount: 2,
    target: [0.11, -0.28, 0],
    cameraPos: [0.11, -0.28, 0.38],
    keyBones: ["Femoral Head & Neck", "Greater & Lesser Trochanters", "Femur Shaft", "Femoral Condyles"],
    primaryFunctions: [
      "Strongest and longest tubular bone in the human body",
      "Transfers high kinetic forces during walking, running, and jumping"
    ],
    commonConditions: [
      { name: "Femoral Neck Fracture", severity: "High", note: "Common elderly fall fracture; danger of blood supply loss to femoral head" },
      { name: "Femur Shaft Fracture", severity: "High", note: "Severe high-velocity trauma; internal blood loss up to 1.5L" }
    ],
    clinicalNotes: "Operate elderly hip fractures within 24-48 hours to minimize morbidity and mortality."
  },
  {
    id: "knee_patella",
    name: "Knee Joint & Patella",
    shortLabel: "KNEE & PATELLA",
    latinName: "Patella et Articulatio Genus",
    category: "Appendicular",
    subRegion: "Lower Limbs",
    boneCount: 4,
    target: [0.10, -0.48, 0.03],
    cameraPos: [0.10, -0.48, 0.38],
    keyBones: ["Patella (Kneecap)", "Distal Femoral Condyles", "Tibial Plateau", "Fibular Head"],
    primaryFunctions: [
      "Primary weight-bearing hinge joint for walking and squatting",
      "Patella increases knee straightening strength by up to 50%"
    ],
    commonConditions: [
      { name: "Patella Fracture", severity: "Moderate", note: "Disrupts extensor mechanism; unable to perform straight leg raise" },
      { name: "Knee Dislocation", severity: "Critical", note: "Emergency; high risk of tearing popliteal artery behind knee" }
    ],
    clinicalNotes: "Always palpate distal foot pulses after knee trauma to ensure popliteal artery is intact."
  },
  {
    id: "lower_leg",
    name: "Lower Leg (Tibia & Fibula)",
    shortLabel: "LOWER LEG (SHIN)",
    latinName: "Tibia et Fibula",
    category: "Appendicular",
    subRegion: "Lower Limbs",
    boneCount: 4,
    target: [0.10, -0.62, 0],
    cameraPos: [0.10, -0.62, 0.38],
    keyBones: ["Tibia (Shin bone)", "Fibula (Outer stabilizing strut)", "Medial Malleolus"],
    primaryFunctions: [
      "Tibia bears ~90% of total leg weight",
      "Anterior shin bone is subcutaneous with minimal protective soft tissue"
    ],
    commonConditions: [
      { name: "Compartment Syndrome", severity: "Critical", note: "Severe pain on passive toe stretch; mandates emergency fasciotomy" },
      { name: "Open Tibia Fracture", severity: "High", note: "Bone breaks through skin; high risk of bone infection (osteomyelitis)" }
    ],
    clinicalNotes: "Do not wait for loss of pulses to diagnose compartment syndrome; pulselessness is a late sign."
  },
  {
    id: "ankle_foot",
    name: "Ankle & Foot",
    shortLabel: "ANKLE & FOOT",
    latinName: "Pes, Tarsus et Metatarsus",
    category: "Appendicular",
    subRegion: "Lower Limbs",
    boneCount: 52,
    target: [0.11, -0.76, 0.04],
    cameraPos: [0.11, -0.76, 0.38],
    keyBones: ["Calcaneus (Heel bone)", "Talus (Ankle pivot)", "5 Metatarsals", "14 Toe Phalanges"],
    primaryFunctions: [
      "Flexible arches absorb shock upon every heel strike",
      "Talus smoothly distributes full body weight down into foot"
    ],
    commonConditions: [
      { name: "Ankle Fracture", severity: "Moderate", note: "Twisting trauma fracturing malleolus with syndesmosis strain" },
      { name: "Calcaneus Heel Fracture", severity: "High", note: "Fall from height; routinely check lumbar spine for co-existing fractures" }
    ],
    clinicalNotes: "In high-impact heel fractures, always perform examination and X-rays of the lower spine."
  }
]

export function AnatomyExplorerPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const skeletonMeshRef = useRef<THREE.Object3D | null>(null)
  const animFrameIdRef = useRef<number | null>(null)
  const workerRef = useRef<Worker | null>(null)

  // Camera tween state
  const isTweeningRef = useRef(false)
  const tweenStartRef = useRef(0)
  const startCamPosRef = useRef(new THREE.Vector3())
  const startTargetRef = useRef(new THREE.Vector3())
  const endCamPosRef = useRef(new THREE.Vector3())
  const endTargetRef = useRef(new THREE.Vector3())

  // UI state
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [selectedPartId, setSelectedPartId] = useState<string>("hand_wrist")
  const selectedPartIdRef = useRef(selectedPartId)
  useEffect(() => {
    selectedPartIdRef.current = selectedPartId
  }, [selectedPartId])

  // Active 3D Model state (layered_anatomy by default, skeleton_hd, or custom upload)
  const [activeModelId, setActiveModelId] = useState<string>("layered_anatomy")
  const [customModelTitle, setCustomModelTitle] = useState<string | null>(null)
  const customFileInputRef = useRef<HTMLInputElement>(null)

  // Low-end / Performance mode state (auto-detected: mobile or <= 4 CPU cores)
  const [isPerformanceMode, setIsPerformanceMode] = useState<boolean>(() => {
    if (typeof navigator === "undefined") return true
    const cores = navigator.hardwareConcurrency || 4
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
    return cores <= 4 || isMobile
  })

  // Dynamic DPR and resolution adjustment on quality mode toggle
  useEffect(() => {
    if (!rendererRef.current || !containerRef.current) return
    const dpr = isPerformanceMode ? 1.0 : Math.min(window.devicePixelRatio, 1.5)
    rendererRef.current.setPixelRatio(dpr)
    rendererRef.current.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight)
  }, [isPerformanceMode])

  const [searchQuery, setSearchQuery] = useState("")
  const [autoRotate, setAutoRotate] = useState(false)
  const [isXRayMode, setIsXRayMode] = useState(false)
  const [showCard, setShowCard] = useState(true)

  // Real-time Loading State
  const [isLoading, setIsLoading] = useState(true)
  const [loadStage, setLoadStage] = useState<"downloading" | "decoding" | "parsing" | "ready">("downloading")
  const [loadPercent, setLoadPercent] = useState<number>(0)
  const [loadStatusMessage, setLoadStatusMessage] = useState<string>("Initiating 3D Model Stream...")
  const [loadBytesDetail, setLoadBytesDetail] = useState<string>("")
  const [loadError, setLoadError] = useState<string | null>(null)

  // 2D screen coordinate of active bone for leader line annotation
  const [boneScreenPos, setBoneScreenPos] = useState<{ x: number; y: number } | null>(null)

  const selectedPart = useMemo(() => {
    return BODY_PARTS_CATALOG.find((p) => p.id === selectedPartId) || BODY_PARTS_CATALOG[0]
  }, [selectedPartId])

  const filteredParts = useMemo(() => {
    return BODY_PARTS_CATALOG.filter((part) => {
      return (
        part.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        part.subRegion.toLowerCase().includes(searchQuery.toLowerCase()) ||
        part.keyBones.some((b) => b.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    })
  }, [searchQuery])

  // Camera transition smooth lerp to target
  const animateCameraTo = useCallback((targetPos: [number, number, number], camPos: [number, number, number]) => {
    if (!cameraRef.current || !controlsRef.current) return
    startCamPosRef.current.copy(cameraRef.current.position)
    startTargetRef.current.copy(controlsRef.current.target)
    endCamPosRef.current.set(camPos[0], camPos[1], camPos[2])
    endTargetRef.current.set(targetPos[0], targetPos[1], targetPos[2])
    tweenStartRef.current = performance.now()
    isTweeningRef.current = true
  }, [])

  const handleSelectPart = useCallback((part: BodyPart) => {
    setSelectedPartId(part.id)
    setShowCard(true)
    // Keep body framing constant without disorienting macro zoom cutting off the body
    if (cameraRef.current && controlsRef.current) {
      const curCam = cameraRef.current.position
      const curTarget = controlsRef.current.target
      const dir = curCam.clone().sub(curTarget).normalize()
      if (dir.lengthSq() < 0.05) dir.set(0, 0, 1)
      const dist = CONSTANT_FOCUS_DISTANCE
      const newCamPos: [number, number, number] = [dir.x * dist, dir.y * dist, dir.z * dist]
      animateCameraTo([0, 0, 0], newCamPos)
    }
  }, [animateCameraTo])

  // Reset to full body view
  const handleResetFullBody = useCallback(() => {
    animateCameraTo([0, 0, 0], [0, 0, CONSTANT_FOCUS_DISTANCE])
  }, [animateCameraTo])

  // View angle presets for 360 degree inspection with constant full-body distance
  const handleSetViewAngle = useCallback((angle: "front" | "side" | "back" | "top") => {
    if (!controlsRef.current || !cameraRef.current) return
    const dist = CONSTANT_FOCUS_DISTANCE
    let newCam: [number, number, number] = [0, 0, dist]

    if (angle === "front") {
      newCam = [0, 0, dist]
    } else if (angle === "side") {
      newCam = [dist, 0, 0]
    } else if (angle === "back") {
      newCam = [0, 0, -dist]
    } else if (angle === "top") {
      newCam = [0, dist * 0.95, 0.04]
    }

    animateCameraTo([0, 0, 0], newCam)
  }, [animateCameraTo])

  // Material update for Natural Bone/Anatomy vs X-Ray Mode (ONLY changes 3D model, not the UI colors!)
  const updateMaterials = useCallback((xray: boolean) => {
    if (!skeletonMeshRef.current) return

    if (xray) {
      const xrayMat = new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        emissive: 0x0369a1,
        emissiveIntensity: 0.42,
        roughness: 0.22,
        metalness: 0.65,
        transparent: true,
        opacity: 0.72,
        depthWrite: true,
        side: THREE.DoubleSide,
      })
      skeletonMeshRef.current.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          ;(child as THREE.Mesh).material = xrayMat
        }
      })
    } else {
      skeletonMeshRef.current.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh
          if (mesh.userData.__origMaterial) {
            mesh.material = mesh.userData.__origMaterial
          } else {
            mesh.material = new THREE.MeshStandardMaterial({
              color: 0xeeece4,
              roughness: 0.52,
              metalness: 0.04,
              side: THREE.DoubleSide,
            })
          }
        }
      })
    }
  }, [])

  useEffect(() => {
    updateMaterials(isXRayMode)
  }, [isXRayMode, updateMaterials])

  // Load 3D model: preset from public/models or custom file (.glb, .gltf, .obj)
  const loadModel = useCallback((modelId: string, customFile?: File) => {
    const scene = sceneRef.current
    if (!scene) return

    setIsLoading(true)
    setLoadError(null)
    setLoadPercent(0)
    setLoadBytesDetail("")

    // Terminate any active worker
    if (workerRef.current) {
      workerRef.current.terminate()
      workerRef.current = null
    }

    // Clean up previous 3D object from scene
    if (skeletonMeshRef.current) {
      scene.remove(skeletonMeshRef.current)
      skeletonMeshRef.current.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          ;(child as THREE.Mesh).geometry?.dispose?.()
        }
      })
      skeletonMeshRef.current = null
    }

    // CASE 1: Custom file loaded by user (.glb, .gltf, .obj)
    if (customFile) {
      const ext = customFile.name.split(".").pop()?.toLowerCase()
      setCustomModelTitle(customFile.name)
      setActiveModelId("custom")
      setLoadStage("parsing")
      setLoadPercent(10)
      setLoadStatusMessage(`Reading ${customFile.name} (${(customFile.size / (1024 * 1024)).toFixed(1)} MB)...`)

      if (ext === "glb" || ext === "gltf") {
        customFile.arrayBuffer().then((buf) => {
          setLoadPercent(45)
          setLoadStatusMessage(`Parsing 3D scene from ${customFile.name}...`)
          const loader = new GLTFLoader()
          loader.parse(
            buf,
            "",
            (gltf) => {
              // Sanitize any genital or private parts
              cleanPrivateParts(gltf.scene)

              gltf.scene.traverse((child) => {
                if (child.visible === false) return
                if (isGenitalOrPrivatePart(child)) {
                  child.visible = false
                  return
                }
                if ((child as THREE.Mesh).isMesh) {
                  const mesh = child as THREE.Mesh
                  mesh.castShadow = true
                  mesh.receiveShadow = true
                  mesh.userData.__origMaterial = mesh.material
                }
              })

              setupAndCenterModel(gltf.scene)
              skeletonMeshRef.current = gltf.scene
              scene.add(gltf.scene)

              updateMaterials(isXRayMode)
              setLoadPercent(100)
              setLoadStage("ready")
              setIsLoading(false)
              handleResetFullBody()
            },
            (err: any) => {
              setLoadError(`Failed to parse 3D file: ${err?.message || String(err)}`)
              setIsLoading(false)
            }
          )
        }).catch((err: any) => {
          setLoadError(`Failed to read file: ${err?.message || String(err)}`)
          setIsLoading(false)
        })
      } else if (ext === "obj") {
        customFile.text().then((text) => {
          setLoadPercent(45)
          setLoadStatusMessage(`Parsing OBJ geometry from ${customFile.name}...`)
          const loader = new OBJLoader()
          const obj = loader.parse(text)
          const boneMat = new THREE.MeshStandardMaterial({
            color: 0xeeece4,
            roughness: 0.52,
            metalness: 0.04,
            side: THREE.DoubleSide,
          })
          obj.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh
              mesh.material = boneMat
              mesh.castShadow = true
              mesh.receiveShadow = true
              mesh.userData.__origMaterial = boneMat
            }
          })
          setupAndCenterModel(obj)
          skeletonMeshRef.current = obj
          scene.add(obj)
          updateMaterials(isXRayMode)
          setLoadPercent(100)
          setLoadStage("ready")
          setIsLoading(false)
          handleResetFullBody()
        }).catch((err: any) => {
          setLoadError(`Failed to read file: ${err?.message || String(err)}`)
          setIsLoading(false)
        })
      }
      return
    }

    // CASE 2: Layered Human Anatomy GLB from public/models (Default)
    if (modelId === "layered_anatomy") {
      setLoadStage("downloading")
      setLoadStatusMessage("Streaming Human Anatomy Layered 3D (168 MB)...")
      const loader = new GLTFLoader()
      loader.load(
        "/models/human_anatomy_layered.glb",
        (gltf) => {
          setLoadStage("parsing")
          setLoadStatusMessage("Sanitizing anatomy & configuring layers...")

          // Filter out and sanitize any genital or private anatomy
          cleanPrivateParts(gltf.scene)

          gltf.scene.traverse((child) => {
            if (child.visible === false) return
            if (isGenitalOrPrivatePart(child)) {
              child.visible = false
              return
            }
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh
              mesh.castShadow = true
              mesh.receiveShadow = true
              mesh.userData.__origMaterial = mesh.material
            }
          })

          setupAndCenterModel(gltf.scene)
          skeletonMeshRef.current = gltf.scene
          scene.add(gltf.scene)

          updateMaterials(isXRayMode)
          setLoadPercent(100)
          setLoadStage("ready")
          setIsLoading(false)

          // Immediately zoom camera directly into the currently selected body part with constant zoom
          const curPart = BODY_PARTS_CATALOG.find((p) => p.id === selectedPartIdRef.current) || BODY_PARTS_CATALOG[0]
          if (cameraRef.current && controlsRef.current) {
            controlsRef.current.target.set(curPart.target[0], curPart.target[1], curPart.target[2])
            cameraRef.current.position.set(curPart.target[0], curPart.target[1], curPart.target[2] + CONSTANT_FOCUS_DISTANCE)
            controlsRef.current.update()
          }
        },
        (xhr) => {
          if (xhr.lengthComputable && xhr.total > 0) {
            const percent = Math.min(Math.round((xhr.loaded / xhr.total) * 100), 99)
            const mbLoaded = (xhr.loaded / (1024 * 1024)).toFixed(1)
            const mbTotal = (xhr.total / (1024 * 1024)).toFixed(1)
            setLoadPercent(percent)
            setLoadBytesDetail(`${mbLoaded} MB / ${mbTotal} MB (${percent}%)`)
            setLoadStatusMessage(`Downloading Human Anatomy (${percent}%)...`)
          } else {
            const mbLoaded = (xhr.loaded / (1024 * 1024)).toFixed(1)
            setLoadBytesDetail(`${mbLoaded} MB downloaded`)
          }
        },
        (err: any) => {
          console.error("GLTF load error:", err)
          setLoadError(`Failed to load 3D anatomy model: ${err?.message || "Unknown error"}`)
          setIsLoading(false)
        }
      )
    }

    // CASE 3: Human Skeleton HD OBJ from public/models
    else if (modelId === "skeleton_hd") {
      setLoadStage("downloading")
      setLoadStatusMessage("Initiating 3D Skeleton Stream (115 MB)...")
      const worker = new Worker(new URL("./anatomyWorker.ts", import.meta.url), { type: "module" })
      workerRef.current = worker

      worker.onmessage = (e: MessageEvent) => {
        const data = e.data
        if (data.type === "progress") {
          setLoadStage(data.stage)
          setLoadPercent(data.percent)
          if (data.loaded && data.total) {
            const mbLoaded = (data.loaded / (1024 * 1024)).toFixed(1)
            const mbTotal = (data.total / (1024 * 1024)).toFixed(1)
            setLoadBytesDetail(`${mbLoaded} MB / ${mbTotal} MB (${data.percent}%)`)
          }
          if (data.message) setLoadStatusMessage(data.message)
        } else if (data.type === "status") {
          setLoadStage(data.stage)
          if (data.percent !== undefined) setLoadPercent(data.percent)
          if (data.message) setLoadStatusMessage(data.message)
        } else if (data.type === "complete") {
          const { positions, normals } = data
          const geom = new THREE.BufferGeometry()
          geom.setAttribute("position", new THREE.BufferAttribute(positions, 3))
          if (normals) {
            geom.setAttribute("normal", new THREE.BufferAttribute(normals, 3))
          } else {
            geom.computeVertexNormals()
          }
          const boneMat = new THREE.MeshStandardMaterial({
            color: 0xeeece4,
            roughness: 0.52,
            metalness: 0.04,
            side: THREE.DoubleSide,
          })
          const mesh = new THREE.Mesh(geom, boneMat)
          mesh.userData.__origMaterial = boneMat
          setupAndCenterModel(mesh)
          skeletonMeshRef.current = mesh
          scene.add(mesh)
          updateMaterials(isXRayMode)
          setLoadPercent(100)
          setLoadStage("ready")
          setIsLoading(false)
        } else if (data.type === "error") {
          setLoadError(data.message || "Failed to load 3D skeleton")
          setIsLoading(false)
        }
      }

      worker.onerror = (err) => {
        console.error("Worker error:", err)
        setLoadError("Background parsing worker error. Please refresh.")
        setIsLoading(false)
      }

      worker.postMessage({ url: "/models/human_skeleton_hd.obj" })
    }
  }, [handleResetFullBody, isXRayMode, updateMaterials])

  const handleCustomFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    loadModel("custom", file)
    e.target.value = ""
  }

  // Initialize Three.js Scene, Camera, Lights, OrbitControls, and Background Web Worker
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const width = container.clientWidth
    const height = container.clientHeight

    // Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xf8fafc)
    sceneRef.current = scene

    // Camera initial setup focusing on full body in frame
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.05, 50)
    camera.position.set(0, 0, CONSTANT_FOCUS_DISTANCE)
    // WebGL Renderer configured with low-end GPU & mobile optimizations
    const renderer = new THREE.WebGLRenderer({
      antialias: !isPerformanceMode,
      powerPreference: "high-performance",
      precision: isPerformanceMode ? "mediump" : "highp",
      stencil: false,
      alpha: false,
    })
    renderer.setSize(width, height)
    renderer.setPixelRatio(isPerformanceMode ? 1.0 : Math.min(window.devicePixelRatio, 1.5))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    // Disable multi-pass shadow maps on 2,234 meshes to eliminate massive GPU bottleneck
    renderer.shadowMap.enabled = false
    container.innerHTML = ""
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // Full 360° unrestricted Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.target.set(0, 0, 0)
    controls.minDistance = 0.40
    controls.maxDistance = 5.0
    controls.minPolarAngle = 0
    controls.maxPolarAngle = Math.PI
    controlsRef.current = controls

    let isInteracting = false
    controls.addEventListener("start", () => {
      isInteracting = true
      isTweeningRef.current = false
    })
    controls.addEventListener("end", () => {
      isInteracting = false
    })

    // WebGL Context Loss Handling for low-end / budget mobile GPUs
    const canvas = renderer.domElement
    const handleContextLost = (e: Event) => {
      e.preventDefault()
      console.warn("WebGL context lost - throttling rendering")
    }
    const handleContextRestored = () => {
      console.info("WebGL context restored")
      loadModel(activeModelId)
    }
    canvas.addEventListener("webglcontextlost", handleContextLost, false)
    canvas.addEventListener("webglcontextrestored", handleContextRestored, false)

    // Studio Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.25)
    scene.add(ambientLight)

    const keyLight = new THREE.DirectionalLight(0xfffdfa, 1.35)
    keyLight.position.set(2, 4, 3)
    scene.add(keyLight)

    const fillLight = new THREE.DirectionalLight(0xe2e8f0, 0.95)
    fillLight.position.set(-3, 2, 2)
    scene.add(fillLight)

    const rimLight = new THREE.DirectionalLight(0xf1f5f9, 0.85)
    rimLight.position.set(0, 3, -3)
    scene.add(rimLight)

    // Load initial model (Human Anatomy Layered 3D by default)
    loadModel("layered_anatomy")

    // Resize observer
    const resizeObserver = new ResizeObserver(() => {
      if (!container || !renderer || !camera) return
      const w = container.clientWidth
      const h = container.clientHeight
      if (w === 0 || h === 0) return
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    })
    resizeObserver.observe(container)

    // Vector for screen projection
    const tempVec = new THREE.Vector3()
    let lastRenderTime = 0

    // Animation loop with smart idle throttling to prevent heating & battery drain
    const animate = (time: number) => {
      animFrameIdRef.current = requestAnimationFrame(animate)

      const isTweening = isTweeningRef.current
      const isRotating = autoRotate && !!skeletonMeshRef.current
      const isMoving = isTweening || isRotating || isInteracting

      // When completely idle (reading anatomical card), throttle renders to save CPU & GPU
      if (!isMoving) {
        if (time - lastRenderTime < 250) {
          return
        }
      }
      lastRenderTime = time

      if (isTweening) {
        const elapsed = performance.now() - tweenStartRef.current
        const progress = Math.min(elapsed / 900, 1)
        const ease = 1 - Math.pow(1 - progress, 3)

        camera.position.lerpVectors(startCamPosRef.current, endCamPosRef.current, ease)
        controls.target.lerpVectors(startTargetRef.current, endTargetRef.current, ease)
        controls.update()

        if (progress >= 1) {
          isTweeningRef.current = false
        }
      } else {
        controls.update()
      }

      if (autoRotate && !isTweeningRef.current && skeletonMeshRef.current) {
        skeletonMeshRef.current.rotation.y += 0.005
      }

      // Calculate 2D screen coordinate of active bone for leader line annotation
      if (container) {
        const activePart = BODY_PARTS_CATALOG.find((p) => p.id === selectedPartIdRef.current) || BODY_PARTS_CATALOG[0]
        tempVec.set(activePart.target[0], activePart.target[1], activePart.target[2])
        tempVec.project(camera)

        const sx = ((tempVec.x * 0.5) + 0.5) * container.clientWidth
        const sy = ((-(tempVec.y * 0.5)) + 0.5) * container.clientHeight

        if (tempVec.z < 1) {
          setBoneScreenPos({ x: Math.round(sx), y: Math.round(sy) })
        }
      }

      renderer.render(scene, camera)
    }
    animate(performance.now())

    // Cleanup
    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current)
      canvas.removeEventListener("webglcontextlost", handleContextLost)
      canvas.removeEventListener("webglcontextrestored", handleContextRestored)
      if (workerRef.current) {
        workerRef.current.terminate()
        workerRef.current = null
      }
      resizeObserver.disconnect()
      controls.dispose()
      renderer.dispose()
    }
  }, [])

  // Leader line connecting the elevated corner card (bottom-24) to the centered 3D bone
  const leaderPath = useMemo(() => {
    if (!boneScreenPos || !containerRef.current) return ""
    const boneX = boneScreenPos.x
    const boneY = boneScreenPos.y
    const cw = containerRef.current.clientWidth
    const ch = containerRef.current.clientHeight

    const cardLeftX = cw - 356
    const cardAnchorY = ch - 260

    return `M ${cardLeftX} ${cardAnchorY} L ${Math.round((cardLeftX + boneX) / 2)} ${cardAnchorY} L ${boneX} ${boneY}`
  }, [boneScreenPos])

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] w-full overflow-hidden font-sans bg-page text-ink">
      {/* Top Controls Toolbar */}
      <header className="h-10 border-b px-4 flex items-center justify-between shrink-0 shadow-xs bg-surface border-border">
        {/* Left Toolbar Controls: Toggle Sidebar & Model Selector */}
        <div className="flex items-center gap-2">
          {/* Toggle Sidebar Button */}
          <button
            onClick={() => setIsSidebarOpen((v) => !v)}
            className="px-2.5 py-1 rounded-control border text-xs font-medium transition-colors bg-surface border-border text-ink-2 hover:bg-slate-50 flex items-center gap-1.5"
            title={isSidebarOpen ? "Hide Body Parts List" : "Show Body Parts List"}
          >
            <span>{isSidebarOpen ? "◀" : "▶"}</span>
            <span>{isSidebarOpen ? "Hide List" : "Body Parts"}</span>
          </button>

          {/* Model Selection Dropdown (public/models + custom 3D file loader) */}
          <div className="flex items-center gap-1 bg-slate-100/90 p-0.5 rounded-control border border-border">
            <span className="text-[11px] font-semibold text-ink-3 pl-2 pr-0.5 flex items-center gap-1">
              <span>🧬</span>
              <span className="hidden sm:inline">Model:</span>
            </span>
            <select
              value={customModelTitle ? "custom" : activeModelId}
              onChange={(e) => {
                const val = e.target.value
                if (val === "custom") {
                  customFileInputRef.current?.click()
                } else {
                  setCustomModelTitle(null)
                  setActiveModelId(val)
                  loadModel(val)
                }
              }}
              className="bg-white text-xs font-semibold text-ink border border-border rounded px-2 py-0.5 outline-none cursor-pointer hover:border-brand transition-colors"
              title="Select 3D Anatomy Model from public/models or upload any custom file"
            >
              <option value="layered_anatomy">🫀 Human Anatomy (Layered 3D)</option>
              <option value="skeleton_hd">🦴 Human Skeleton HD (OBJ)</option>
              {customModelTitle && <option value="custom">📂 {customModelTitle}</option>}
              <option value="custom">📁 Open Any 3D File (.glb, .gltf, .obj)...</option>
            </select>
            <input
              ref={customFileInputRef}
              type="file"
              accept=".glb,.gltf,.obj"
              onChange={handleCustomFileUpload}
              className="hidden"
            />
          </div>
        </div>

        {/* Right View & Shading Controls */}
        <div className="flex items-center gap-2">
          {/* Performance / Low-End Device Optimization Toggle */}
          <button
            onClick={() => setIsPerformanceMode((v) => !v)}
            className={`px-2.5 py-1 rounded-control border text-xs font-medium transition-colors flex items-center gap-1 ${
              isPerformanceMode
                ? "bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold shadow-xs"
                : "bg-surface border-border text-ink-3 hover:bg-slate-50"
            }`}
            title={
              isPerformanceMode
                ? "Fast Mode Active (1.0x DPR, throttled idle renders, maximum FPS for low-end devices & phones)"
                : "Click to enable Fast Mode (Optimized for low-end devices)"
            }
          >
            <span>{isPerformanceMode ? "⚡ 60 FPS (Fast)" : "✨ HD Mode"}</span>
          </button>

          {/* X-Ray Model Switch (Changes ONLY 3D model, not the UI colors!) */}
          <div className="flex items-center p-0.5 rounded-control border text-xs bg-slate-100 border-slate-200">
            <button
              onClick={() => setIsXRayMode(false)}
              className={`px-2.5 py-1 rounded transition-all font-medium ${
                !isXRayMode ? "bg-white text-slate-900 shadow-xs font-semibold" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Natural
            </button>
            <button
              onClick={() => setIsXRayMode(true)}
              className={`px-2.5 py-1 rounded transition-all font-medium ${
                isXRayMode ? "bg-brand text-white shadow-xs font-semibold" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              ⚡ X-Ray Model
            </button>
          </div>

          {/* Quick Angle Viewers (View from any angle) */}
          <div className="hidden md:flex items-center p-0.5 rounded-control border text-xs bg-slate-100 border-slate-200">
            <button
              onClick={() => handleSetViewAngle("front")}
              className="px-2 py-1 text-xs hover:bg-white rounded transition-colors"
              title="Anterior (Front)"
            >
              Front
            </button>
            <button
              onClick={() => handleSetViewAngle("side")}
              className="px-2 py-1 text-xs hover:bg-white rounded transition-colors"
              title="Lateral (Side)"
            >
              Side
            </button>
            <button
              onClick={() => handleSetViewAngle("back")}
              className="px-2 py-1 text-xs hover:bg-white rounded transition-colors"
              title="Posterior (Back)"
            >
              Back
            </button>
            <button
              onClick={() => handleSetViewAngle("top")}
              className="px-2 py-1 text-xs hover:bg-white rounded transition-colors"
              title="Superior (Top)"
            >
              Top
            </button>
          </div>

          {/* Auto Rotate Toggle */}
          <button
            onClick={() => setAutoRotate((v) => !v)}
            className={`px-2.5 py-1 rounded-control border text-xs font-medium transition-colors ${
              autoRotate
                ? "bg-brand text-white border-brand shadow-xs"
                : "bg-surface border-border text-ink-2 hover:bg-slate-50"
            }`}
          >
            {autoRotate ? "Auto-Rotate: On" : "Auto-Rotate"}
          </button>

          {/* Reset Skeleton */}
          <button
            onClick={handleResetFullBody}
            className="px-3 py-1 bg-brand hover:bg-brand-hover text-white rounded-control text-xs font-semibold shadow-xs transition-colors"
          >
            Reset Whole Body
          </button>
        </div>
      </header>

      {/* Main Viewport */}
      <div className="flex-1 flex min-h-0 relative overflow-hidden">
        {/* LEFT COLUMN: Collapsible Clean List of Body Parts */}
        <aside
          className={`border-r flex flex-col shrink-0 z-10 shadow-xs bg-surface border-border transition-all duration-200 ${
            isSidebarOpen ? "w-72" : "w-0 overflow-hidden border-none"
          }`}
        >
          {/* Search Bar */}
          <div className="p-2.5 border-b border-border bg-slate-50/50">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search body part..."
                className="w-full border rounded-control py-1.5 pl-7 pr-3 text-xs bg-white border-border text-ink placeholder:text-ink-4 focus:outline-none focus:border-brand transition-all"
              />
              <svg
                className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2 pointer-events-none"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* List Count Header */}
          <div className="px-3 py-1.5 border-b text-[11px] font-medium flex items-center justify-between bg-slate-100/60 border-border text-ink-3">
            <span>Body Parts ({filteredParts.length})</span>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="w-4 h-4 rounded hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 text-[10px]"
              title="Hide body parts list"
            >
              ◀
            </button>
          </div>

          {/* Body Parts List */}
          <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
            {filteredParts.map((part) => {
              const isSelected = part.id === selectedPartId
              return (
                <div
                  key={part.id}
                  onClick={() => handleSelectPart(part)}
                  className={`px-3 py-2 rounded-control border text-left cursor-pointer transition-all ${
                    isSelected
                      ? "bg-brand-tint border-brand-border shadow-xs text-brand font-semibold"
                      : "bg-surface border-border-soft hover:bg-slate-50 hover:border-border text-ink-2"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs truncate">{part.name}</span>
                    <span className="text-[10px] font-mono text-ink-4">
                      {part.subRegion}
                    </span>
                  </div>
                </div>
              )
            })}

            {filteredParts.length === 0 && (
              <div className="text-center py-8 text-slate-400 text-xs">
                No body part found matching "{searchQuery}"
              </div>
            )}
          </div>
        </aside>

        {/* 3D CENTER VIEWPORT: Real Streaming Loading Bar + Background Worker */}
        <main
          className="flex-1 relative overflow-hidden flex flex-col cursor-grab active:cursor-grabbing select-none bg-slate-50"
          onDoubleClick={() => setShowCard((v) => !v)}
          title="Double-click to toggle anatomical info card"
        >
          {/* REAL AUTHENTIC STREAMING LOADING OVERLAY */}
          {isLoading && (
            <div className="absolute inset-0 z-30 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center text-ink select-none">
              {/* Active Spinner */}
              <div className="relative w-12 h-12 mb-4">
                <div className="w-12 h-12 rounded-full border-3 border-brand-tint border-t-brand animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-brand">
                  {loadPercent}%
                </div>
              </div>

              {/* Title & Live Status */}
              <div className="text-sm font-semibold text-slate-900 mb-1">
                Loading 3D Skeletal Anatomy
              </div>
              <div className="text-xs text-slate-500 mb-3 max-w-sm font-medium">
                {loadStatusMessage}
              </div>

              {/* Real-time Dynamic Progress Bar (No laggy CSS transitions) */}
              <div className="w-64 bg-slate-200 rounded-full h-2 overflow-hidden shadow-inner p-0.5 border border-slate-200">
                <div
                  className={`h-full rounded-full transition-all duration-75 ${
                    loadStage === "parsing" ? "bg-cyan-600 animate-pulse" : "bg-brand"
                  }`}
                  style={{ width: `${Math.max(loadPercent, 3)}%` }}
                />
              </div>

              {/* Live Bytes Loaded vs Total */}
              <div className="flex items-center gap-3 mt-2 text-[11px] font-mono text-slate-600">
                <span>{loadBytesDetail || `${loadPercent}% completed`}</span>
                {loadStage === "parsing" && (
                  <span className="text-cyan-700 font-sans font-semibold text-[10.5px]">
                    · Finalizing Mesh
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Load error message */}
          {loadError && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-danger-bg border border-danger-border text-danger-text px-4 py-2 rounded-control text-xs shadow-sm">
              {loadError}
            </div>
          )}

          {/* Three.js Canvas */}
          <div ref={containerRef} className="w-full h-full relative" />

          {/* Leader Line to Centered Bone */}
          {boneScreenPos && showCard && !isLoading && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-20">
              <path
                d={leaderPath}
                fill="none"
                stroke="#dc2626"
                strokeWidth="1.6"
              />
              <circle
                cx={boneScreenPos.x}
                cy={boneScreenPos.y}
                r="4.5"
                fill="#dc2626"
                stroke="#ffffff"
                strokeWidth="1.5"
              />
              <circle
                cx={boneScreenPos.x}
                cy={boneScreenPos.y}
                r="8"
                fill="none"
                stroke="#dc2626"
                strokeWidth="1"
                opacity="0.35"
              />
            </svg>
          )}

          {/* CORNER DETAIL CARD: Elevated at bottom-24 */}
          {showCard && !isLoading && (
            <div
              className="absolute bottom-24 right-4 z-20 w-84 rounded-card shadow-xl p-3.5 border transition-all duration-200 bg-white/95 backdrop-blur border-red-500/40 text-slate-900"
            >
              {/* Close Button & Header */}
              <div className="flex items-start justify-between border-b pb-1.5 mb-2 border-slate-200/80">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold tracking-wider uppercase text-red-600">
                      {selectedPart.shortLabel}
                    </span>
                    <span className="text-[10px] opacity-60 font-mono">
                      · {selectedPart.boneCount} bones
                    </span>
                  </div>
                  <h3 className="text-xs font-bold leading-tight mt-0.5">
                    {selectedPart.name}
                  </h3>
                  <div className="text-[10.5px] opacity-70 italic">
                    {selectedPart.latinName}
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowCard(false)
                  }}
                  className="w-5 h-5 rounded hover:bg-slate-200 flex items-center justify-center text-xs opacity-60 hover:opacity-100 transition-colors"
                  title="Close card (or double-click anywhere on 3D)"
                >
                  ✕
                </button>
              </div>

              {/* Bones List */}
              <div className="mb-2">
                <div className="text-[10px] font-semibold opacity-70 uppercase mb-1">
                  Bones
                </div>
                <div className="flex flex-wrap gap-1">
                  {selectedPart.keyBones.slice(0, 6).map((b, idx) => (
                    <span
                      key={idx}
                      className="px-1.5 py-0.2 rounded text-[10px] border bg-slate-100 border-slate-200 text-slate-700"
                    >
                      {b}
                    </span>
                  ))}
                  {selectedPart.keyBones.length > 6 && (
                    <span className="text-[10px] opacity-60 self-center">
                      +{selectedPart.keyBones.length - 6} more
                    </span>
                  )}
                </div>
              </div>

              {/* Function & Role */}
              <div className="mb-2">
                <div className="text-[10px] font-semibold opacity-70 uppercase mb-0.5">
                  Function
                </div>
                <p className="text-[11px] leading-snug opacity-90">
                  {selectedPart.primaryFunctions[0]}
                </p>
              </div>

              {/* Conditions / Clinical Notes */}
              <div>
                <div className="text-[10px] font-semibold opacity-70 uppercase mb-0.5">
                  Clinical Pathologies
                </div>
                <div className="space-y-1">
                  {selectedPart.commonConditions.map((cond, idx) => (
                    <div key={idx} className="text-[10.5px] leading-tight opacity-90">
                      <span className="font-semibold">• {cond.name}:</span>{" "}
                      <span className="opacity-80">{cond.note}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Subtle Double Click hint */}
              <div className="mt-2 pt-1.5 border-t border-slate-200/60 text-[9.5px] opacity-50 flex items-center justify-between">
                <span>💡 Tip: Double-click 3D viewport to hide/show</span>
                <span>360° Free Rotate</span>
              </div>
            </div>
          )}

          {/* Hidden Card Restoration Pill */}
          {!showCard && !isLoading && (
            <button
              onClick={() => setShowCard(true)}
              className="absolute bottom-24 right-4 z-20 px-3 py-1.5 rounded-control text-xs font-medium shadow-md transition-all flex items-center gap-1.5 bg-white/95 text-slate-800 border border-slate-300 hover:bg-slate-50"
            >
              <span>ℹ️</span> Show {selectedPart.shortLabel} Details (or Double-Click)
            </button>
          )}

          {/* View hint at bottom left */}
          <div className="absolute bottom-2.5 left-3 z-10 pointer-events-none rounded-control px-2 py-0.5 text-[10px] shadow-xs backdrop-blur-xs border bg-white/80 border-border text-ink-3">
            Rotate 360°: Drag · Zoom: Scroll · Pan: Right Click · Double-Click: Toggle Info Card
          </div>
        </main>
      </div>
    </div>
  )
}
