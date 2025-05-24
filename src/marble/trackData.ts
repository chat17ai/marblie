import * as THREE from 'three';
import { randFloat } from 'three/src/math/MathUtils.js';

export const modelDatas = [
  { name: "FunnelTrack", url: "./models/funnel.glb" },
  { name: "LogoTrackBack", url: "./models/logo-back.glb" },
  { name: "LogoTrackText", url: "./models/logo-text.glb" },
  { name: "RingTrack", url: "./models/ring.glb" },
  { name: "ConeTrack", url: "./models/cone.glb" },
  { name: "RingLongTrack", url: "./models/ring-long.glb" },
  { name: "StarterTrack", url: "./models/starter.glb" },
  { name: "TrayTrack", url: "./models/tray.glb" },
  { name: "TubeTrack", url: "./models/tube.glb" },
  { name: "LightCube", url: "./models/light-cube.glb" },
  { name: "LightCubeBase", url: "./models/light-cube-base.glb" },
];

export function getModelPath(name: string): string | undefined {
  const model = modelDatas.find(m => m.name === name);
  return model?.url;
}

// Material and Color functions
const baseColors: { [key: string]: string } = {
  c1: "#2a5e92",
  c2: "#ffeead",
  c3: "#ff9943",
  c4: "#8ac6d6",
};

function makeBasicColor() {
  const keys = Object.keys(baseColors);
  const randomKey = keys[Math.floor(Math.random() * keys.length)];
  return new THREE.Color(baseColors[randomKey]).offsetHSL(
    0,
    randFloat(-0.025, 0.025),
    randFloat(-0.025, 0.025)
  );
}

export const trackMaterials = {
  starter: () => new THREE.MeshStandardMaterial({ color: makeBasicColor() }),
  straight: () => new THREE.MeshStandardMaterial({ color: makeBasicColor() }),
  curve: () => new THREE.MeshStandardMaterial({ color: makeBasicColor() }),
  windmill: () => new THREE.MeshStandardMaterial({ color: makeBasicColor() }),
  funnel: () => new THREE.MeshStandardMaterial({ color: makeBasicColor() }),
  ring: () => new THREE.MeshStandardMaterial({ color: makeBasicColor() }),
  cone: () => new THREE.MeshStandardMaterial({ color: makeBasicColor() }),
  ringLong: () => new THREE.MeshStandardMaterial({ color: makeBasicColor() }),
  tray: () => new THREE.MeshStandardMaterial({ color: makeBasicColor() }),
  tube: () => new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#e2e7f1"),
    opacity: 0.4,
    transparent: true,
    roughness: 0, // Ensure MeshPhysicalMaterial is imported if not already
    ior: 2.333,
    reflectivity: 1,
    iridescence: 0.336,
    iridescenceIOR: 1.48,
    sheen: 1,
    sheenRoughness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0,
    specularIntensity: 1,
  }),
  logoBack: () => new THREE.MeshStandardMaterial({ color: new THREE.Color('#06335a') }),
  logoText: () => new THREE.MeshStandardMaterial({ color: new THREE.Color('#ffffff'), emissive: new THREE.Color("#d8d8ff"), emissiveIntensity: 0 }),
  lightCubeBase: () => new THREE.MeshStandardMaterial({ color: new THREE.Color('#06335a'), visible: false }),
  lightCubeMain: () => new THREE.MeshStandardMaterial({ color: new THREE.Color('#ffffff'), emissive: new THREE.Color("#d8d8ff"), emissiveIntensity: 0, visible: false }),
  // Add other materials as needed for other track types
};
