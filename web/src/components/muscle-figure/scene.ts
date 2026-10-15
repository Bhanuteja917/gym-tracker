import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import type { MuscleId } from '@/lib/muscles';

// A stylised figure built from ellipsoids: neutral "body" parts underneath and
// one mesh group per muscle on top, so muscles can be coloured and picked.
// Units are roughly metres; y is up and the figure faces +z.

type Part = {
  /** Centre; parts with x ≠ 0 are mirrored to the other side. */
  at: [number, number, number];
  /** Ellipsoid radii. */
  r: [number, number, number];
  /** Tilt around z (radians) on the +x side; mirrored for −x. */
  tilt?: number;
};

const ARM_TILT = 0.18;

const BODY: Part[] = [
  { at: [0, 1.62, 0], r: [0.095, 0.12, 0.11] }, // head
  { at: [0, 1.48, -0.005], r: [0.055, 0.07, 0.055] }, // neck
  { at: [0, 1.22, 0], r: [0.165, 0.23, 0.105] }, // rib cage
  { at: [0, 1.0, 0], r: [0.135, 0.14, 0.09] }, // waist
  { at: [0, 0.86, 0], r: [0.155, 0.1, 0.1] }, // pelvis
  { at: [0.235, 1.2, 0], r: [0.048, 0.15, 0.048], tilt: ARM_TILT }, // upper arm
  { at: [0.28, 0.93, 0.01], r: [0.038, 0.14, 0.04], tilt: ARM_TILT }, // forearm
  { at: [0.305, 0.74, 0.015], r: [0.028, 0.065, 0.02], tilt: ARM_TILT }, // hand
  { at: [0.09, 0.62, 0], r: [0.075, 0.22, 0.078] }, // thigh
  { at: [0.09, 0.4, 0.02], r: [0.05, 0.05, 0.05] }, // knee
  { at: [0.09, 0.22, 0], r: [0.047, 0.19, 0.047] }, // shin
  { at: [0.09, 0.03, 0.035], r: [0.042, 0.03, 0.09] }, // foot
];

const MUSCLE_PARTS: Record<MuscleId, Part[]> = {
  traps: [{ at: [0.065, 1.425, -0.03], r: [0.075, 0.035, 0.045], tilt: -0.45 }],
  'front-shoulders': [{ at: [0.195, 1.35, 0.035], r: [0.055, 0.06, 0.045] }],
  'rear-shoulders': [{ at: [0.195, 1.35, -0.035], r: [0.055, 0.06, 0.045] }],
  chest: [{ at: [0.075, 1.3, 0.075], r: [0.085, 0.065, 0.045], tilt: -0.1 }],
  biceps: [{ at: [0.24, 1.18, 0.03], r: [0.038, 0.095, 0.035], tilt: ARM_TILT }],
  triceps: [{ at: [0.235, 1.2, -0.03], r: [0.04, 0.11, 0.035], tilt: ARM_TILT }],
  forearms: [{ at: [0.28, 0.96, 0.012], r: [0.043, 0.1, 0.043], tilt: ARM_TILT }],
  abdominals: [{ at: [0, 1.03, 0.07], r: [0.07, 0.14, 0.04] }],
  obliques: [{ at: [0.11, 1.03, 0.045], r: [0.04, 0.1, 0.05], tilt: 0.1 }],
  lats: [{ at: [0.095, 1.16, -0.06], r: [0.08, 0.15, 0.05], tilt: 0.25 }],
  'traps-middle': [{ at: [0, 1.31, -0.08], r: [0.08, 0.085, 0.035] }],
  'lower-back': [{ at: [0.04, 0.99, -0.07], r: [0.035, 0.085, 0.035] }],
  glutes: [{ at: [0.072, 0.84, -0.06], r: [0.08, 0.085, 0.065] }],
  abductors: [{ at: [0.148, 0.79, 0], r: [0.035, 0.07, 0.055] }],
  adductors: [{ at: [0.045, 0.68, 0.005], r: [0.035, 0.11, 0.05] }],
  quads: [{ at: [0.095, 0.62, 0.035], r: [0.07, 0.18, 0.06] }],
  hamstrings: [{ at: [0.09, 0.6, -0.04], r: [0.066, 0.17, 0.052] }],
  calves: [
    { at: [0.09, 0.27, -0.03], r: [0.05, 0.11, 0.045] },
    { at: [0.1, 0.24, 0.025], r: [0.032, 0.12, 0.03] }, // shin (tibialis)
  ],
};

const PALETTE = {
  light: { body: 0xf4f4f3, muscle: 0x9a9894, outline: 0x2b2b2b, highlight: 0xe8657f, hover: 0xc4c2be },
  dark: { body: 0x161616, muscle: 0x6b6a68, outline: 0xf2f2f2, highlight: 0xe8657f, hover: 0x8f8d8a },
};

/** Thickness of the outline drawn around every part, like an inked body chart. */
const OUTLINE = 0.007;

export type SceneOptions = {
  highlighted: readonly MuscleId[];
  /** When set, muscles can be tapped. */
  onSelect?: (id: MuscleId) => void;
  dark: boolean;
};

export type MuscleScene = {
  update(options: SceneOptions): void;
  dispose(): void;
};

function addParts(
  group: THREE.Group,
  parts: Part[],
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  outline: THREE.Material,
) {
  for (const p of parts) {
    for (const side of p.at[0] === 0 ? [1] : [1, -1]) {
      // The outline is a slightly larger copy showing only its inside faces.
      for (const [m, grow] of [
        [material, 0],
        [outline, OUTLINE],
      ] as const) {
        const mesh = new THREE.Mesh(geometry, m);
        mesh.position.set(p.at[0] * side, p.at[1], p.at[2]);
        mesh.scale.set(p.r[0] + grow, p.r[1] + grow, p.r[2] + grow);
        mesh.rotation.z = (p.tilt ?? 0) * side;
        group.add(mesh);
      }
    }
  }
}

/** True when the muscles sit mostly on the back of the body. */
function onBack(ids: readonly MuscleId[]): boolean {
  const z = ids.flatMap((id) => MUSCLE_PARTS[id].map((p) => p.at[2]));
  return z.length > 0 && z.reduce((a, b) => a + b, 0) < 0;
}

/** Mounts a rotatable figure in `container`, sized to it. */
export function createMuscleScene(container: HTMLElement, initial: SceneOptions): MuscleScene {
  let options = initial;
  let hovered: MuscleId | null = null;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.domElement.style.touchAction = 'none';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(1.5, 2.5, 2);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, 0.8);
  rim.position.set(-1.5, 1.5, -2);
  scene.add(rim);

  // Face the side the highlighted muscles are on.
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
  camera.position.set(0, 1.0, onBack(initial.highlighted) ? -3.6 : 3.6);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.84, 0);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.minDistance = 1.6;
  controls.maxDistance = 5;
  controls.minPolarAngle = Math.PI / 4;
  controls.maxPolarAngle = (Math.PI * 3) / 4;
  // Spin slowly while nothing is highlighted, as an invitation to drag.
  controls.autoRotate = initial.highlighted.length === 0;
  controls.autoRotateSpeed = 1.5;
  controls.addEventListener('start', () => (controls.autoRotate = false));

  const geometry = new THREE.SphereGeometry(1, 32, 24);
  const bodyMaterial = new THREE.MeshStandardMaterial({ roughness: 0.85 });
  const outlineMaterial = new THREE.MeshBasicMaterial({ side: THREE.BackSide });
  const figure = new THREE.Group();
  addParts(figure, BODY, geometry, bodyMaterial, outlineMaterial);
  scene.add(figure);

  const muscles = new Map<MuscleId, { group: THREE.Group; material: THREE.MeshStandardMaterial }>();
  for (const [id, parts] of Object.entries(MUSCLE_PARTS) as [MuscleId, Part[]][]) {
    const material = new THREE.MeshStandardMaterial({ roughness: 0.6 });
    const group = new THREE.Group();
    group.userData.muscle = id;
    addParts(group, parts, geometry, material, outlineMaterial);
    figure.add(group);
    muscles.set(id, { group, material });
  }

  function paint() {
    const colors = options.dark ? PALETTE.dark : PALETTE.light;
    bodyMaterial.color.setHex(colors.body);
    outlineMaterial.color.setHex(colors.outline);
    for (const [id, { material }] of muscles) {
      const on = options.highlighted.includes(id);
      material.color.setHex(on ? colors.highlight : id === hovered ? colors.hover : colors.muscle);
      material.emissive.setHex(on ? 0x3a0a14 : 0x000000);
    }
  }

  // Tap (not drag) to select a muscle.
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  function muscleAt(event: PointerEvent): MuscleId | null {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(figure.children, true)[0];
    return (hit?.object.parent?.userData.muscle as MuscleId | undefined) ?? null;
  }
  let down: { x: number; y: number } | null = null;
  const onDown = (e: PointerEvent) => (down = { x: e.clientX, y: e.clientY });
  const onUp = (e: PointerEvent) => {
    if (!down || !options.onSelect) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    down = null;
    if (moved > 6) return;
    const id = muscleAt(e);
    if (id) options.onSelect(id);
  };
  const onMove = (e: PointerEvent) => {
    if (!options.onSelect || e.pointerType !== 'mouse') return;
    const id = muscleAt(e);
    if (id === hovered) return;
    hovered = id;
    renderer.domElement.style.cursor = id ? 'pointer' : '';
    paint();
  };
  renderer.domElement.addEventListener('pointerdown', onDown);
  renderer.domElement.addEventListener('pointerup', onUp);
  renderer.domElement.addEventListener('pointermove', onMove);

  function resize() {
    const { clientWidth: w, clientHeight: h } = container;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  // Render only while visible.
  let visible = true;
  const visibility = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting));
  visibility.observe(container);
  renderer.setAnimationLoop(() => {
    if (!visible) return;
    controls.update();
    renderer.render(scene, camera);
  });

  paint();

  return {
    update(next) {
      options = next;
      if (!next.onSelect) renderer.domElement.style.cursor = '';
      paint();
    },
    dispose() {
      renderer.setAnimationLoop(null);
      observer.disconnect();
      visibility.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      renderer.domElement.removeEventListener('pointermove', onMove);
      controls.dispose();
      geometry.dispose();
      bodyMaterial.dispose();
      outlineMaterial.dispose();
      for (const { material } of muscles.values()) material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
