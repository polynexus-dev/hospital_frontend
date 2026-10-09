export interface AnatomicalCondition {
  name: string
  severity: "Low" | "Moderate" | "High" | "Critical"
  note: string
}

export interface BodyPart {
  id: string
  name: string
  shortLabel: string
  latinName: string
  category: "Axial" | "Appendicular"
  subRegion: string
  boneCount: number
  target: [number, number, number]
  cameraPos: [number, number, number]
  keyBones: string[]
  primaryFunctions: string[]
  commonConditions: AnatomicalCondition[]
  clinicalNotes: string
}

export const BodyPart = {}

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
      { name: "Cauda Equina Syndrome", severity: "Critical", note: "Urinary retention, saddle anesthesia; mandates emergent decompression" },
      { name: "Lumbar Disc Herniation", severity: "Moderate", note: "L4-L5 or L5-S1 disc bulge compressing sciatic nerve (sciatica)" }
    ],
    clinicalNotes: "Always check post-void residual bladder volume and anal sphincter tone in acute severe low back pain."
  },
  {
    id: "pelvis_hip",
    name: "Pelvis & Hips",
    shortLabel: "PELVIS & HIPS",
    latinName: "Pelvis et Acetabulum",
    category: "Appendicular",
    subRegion: "Pelvis",
    boneCount: 4,
    target: [0, -0.10, 0],
    cameraPos: [0, -0.10, 0.42],
    keyBones: ["Ilium", "Ischium", "Pubis", "Sacrum", "Acetabulum (Hip Socket)"],
    primaryFunctions: [
      "Transfers upper body weight down to the bilateral lower extremities",
      "Protects pelvic bladder, internal iliac vessels, and reproductive organs"
    ],
    commonConditions: [
      { name: "Open-Book Pelvic Fracture", severity: "Critical", note: "High hemorrhage risk from ruptured venous plexus; apply pelvic binder" },
      { name: "Femoral Neck Fracture", severity: "High", note: "High risk of avascular necrosis of femoral head in elderly falls" }
    ],
    clinicalNotes: "Apply commercial pelvic binder centered directly over greater trochanters, not around the waist."
  },
  {
    id: "forearm_radius_ulna",
    name: "Forearm (Radius & Ulna)",
    shortLabel: "FOREARM",
    latinName: "Antebrachium (Radius et Ulna)",
    category: "Appendicular",
    subRegion: "Upper Limbs",
    boneCount: 4,
    target: [0.32, -0.04, 0],
    cameraPos: [0.32, -0.04, 0.38],
    keyBones: ["Radius (Rotates for pronation)", "Ulna (Hinge joint at elbow)", "Interosseous Membrane"],
    primaryFunctions: [
      "Allows forearm pronation (palm down) and supination (palm up)",
      "Transfers mechanical forces from hand to elbow"
    ],
    commonConditions: [
      { name: "Colles' Fracture", severity: "Moderate", note: "Dorsal displacement of distal radius from FOOSH fall" },
      { name: "Monteggia Fracture-Dislocation", severity: "High", note: "Ulna shaft fracture with radial head dislocation; easily missed" }
    ],
    clinicalNotes: "In single forearm bone fractures, always take X-rays of elbow and wrist to rule out joint dislocation."
  },
  {
    id: "hand_wrist",
    name: "Hand & Wrist",
    shortLabel: "HAND & WRIST",
    latinName: "Manus et Carpus",
    category: "Appendicular",
    subRegion: "Upper Limbs",
    boneCount: 54,
    target: [0.38, -0.06, 0.02],
    cameraPos: [0.38, -0.06, 0.38],
    keyBones: ["8 Carpal Bones (Scaphoid, Lunate, etc.)", "5 Metacarpals", "14 Phalanges"],
    primaryFunctions: [
      "Fine motor dexterity, opposable thumb grip, and tactile feedback",
      "Scaphoid bone acts as mechanical pivot bridge across carpal rows"
    ],
    commonConditions: [
      { name: "Scaphoid Fracture", severity: "Moderate", note: "High nonunion risk due to retrograde blood supply; treat if snuffbox tender" },
      { name: "Boxer's Fracture", severity: "Low", note: "Fracture of 5th metacarpal neck from punching hard object" }
    ],
    clinicalNotes: "Snuffbox tenderness with normal initial X-ray requires thumb spica immobilization and repeat scan in 10 days."
  },
  {
    id: "femur_thigh",
    name: "Thigh & Femur",
    shortLabel: "THIGH / FEMUR",
    latinName: "Femur",
    category: "Appendicular",
    subRegion: "Lower Limbs",
    boneCount: 2,
    target: [0.12, -0.30, 0],
    cameraPos: [0.12, -0.30, 0.44],
    keyBones: ["Femoral Head & Neck", "Greater & Lesser Trochanters", "Femoral Shaft", "Supracondylar Region"],
    primaryFunctions: [
      "Longest and strongest bone in the human body",
      "Supports total body weight and withstands forces up to 30x body weight in running"
    ],
    commonConditions: [
      { name: "Femoral Shaft Fracture", severity: "Critical", note: "Can lose 1000-1500 mL blood into thigh; apply Hare traction splint" },
      { name: "Fat Embolism Syndrome", severity: "Critical", note: "Hypoxemia, confusion, petechial rash 24-72h after long bone fracture" }
    ],
    clinicalNotes: "Apply traction splint early in closed femoral fractures to align bone fragments and tamponade internal hemorrhage."
  },
  {
    id: "knee_patella",
    name: "Knee Joint & Patella",
    shortLabel: "KNEE & PATELLA",
    latinName: "Articulatio Genus & Patella",
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
