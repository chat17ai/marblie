import { curveTrackGeometry, straightTrackGeometry, trackShape } from "./geometries.js";
import * as THREE from "three";
import * as RAPIER from "@dimforge/rapier3d-compat";
import { BufferGeometryUtils, GLTFLoader } from "three/examples/jsm/Addons.js";
import { randFloat, randInt } from "three/src/math/MathUtils.js";
import gsap from "gsap";
import { getSignedAngle3D } from "./utils.ts";
import { Marble } from "./Marble.ts";
import { defaults } from "./config.ts";
import { PhysicsObject } from "./PhysicsObject.ts";

const unitY = new THREE.Vector3(0, 1, 0);

const modelDatas = [
  { name: "FunnelTrack", url: "./models/funnel.glb", geometries: [] },
  { name: "LogoTrackBack", url: "./models/logo-back.glb", geometries: [] },
  { name: "LogoTrackText", url: "./models/logo-text.glb", geometries: [] },
  { name: "RingTrack", url: "./models/ring.glb", geometries: [] },
  { name: "ConeTrack", url: "./models/cone.glb", geometries: [] },
  { name: "RingLongTrack", url: "./models/ring-long.glb", geometries: [] },
  { name: "StarterTrack", url: "./models/starter.glb", geometries: [] },
  { name: "TrayTrack", url: "./models/tray.glb", geometries: [] },
  { name: "TubeTrack", url: "./models/tube.glb", geometries: [] },
  { name: "LightCube", url: "./models/light-cube.glb", geometries: [] },
  { name: "LightCubeBase", url: "./models/light-cube-base.glb", geometries: [] },
];

const baseColors: { [key: string]: string } = {
  c1: "#2a5e92",
  c2: "#ffeead",
  c3: "#ff9943",
  c4: "#8ac6d6",
};

// Helper to convert sRGB to linear with optional HSL offset
function makeColor(hslOffset = { h: 0, s: 0, l: 0 }) {
  const keys = Object.keys(baseColors);
  const randomKey = keys[Math.floor(Math.random() * keys.length)];
  const color = new THREE.Color(baseColors[randomKey]).offsetHSL(
    0,
    randFloat(-0.025, 0.025),
    randFloat(-0.025, 0.025)
  );
  const h = randFloat(0, hslOffset.h);
  const s = randFloat(0, hslOffset.s);
  const l = randFloat(0, hslOffset.l);
  return color.offsetHSL(h, s, l);
}

// Define base colors once

// Use shared logic
const setColors = {
  straight: () => makeColor(),
  curve: () => makeColor(),
  windmill: () => makeColor(),
  tray: () => makeColor(),
  funnel: () => makeColor(),
  ring: () => makeColor(),
  ringLong: () => makeColor(),
  cone: () => makeColor(),
  starter: () => makeColor(),
  logo: () => makeColor(),
};

function makeMaterial() {
  return new THREE.MeshStandardMaterial({ color: setColors.straight() });
}

const setMaterials = {
  straight: () => makeMaterial(),
  curve: () => makeMaterial(),
  windmill: () => makeMaterial(),
  tray: () => makeMaterial(),
  funnel: () => makeMaterial(),
  ring: () => makeMaterial(),
  ringLong: () => makeMaterial(),
  cone: () => makeMaterial(),
  starter: () => makeMaterial(),
  tube: () => {
    return new THREE.MeshPhysicalMaterial({
      color: "#e2e7f1",
      opacity: 0.4,
      roughness: 0,
      ior: 2.333,
      reflectivity: 1,
      iridescence: 0.336,
      iridescenceIOR: 1.48,
      sheen: 1,
      sheenRoughness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0,
      specularIntensity: 1,
      transparent: true,
    });
  },
  logo: () => makeMaterial(),
};

export async function preloadTracks() {
  const loader = new GLTFLoader();
  for (const modelData of modelDatas) {
    const url = modelData.url;
    const glb = await loader.loadAsync(url);

    for (const child of glb.scene.children) {
      if (child instanceof THREE.Mesh && child.geometry) {
        // Ensure child is a Mesh and has geometry
        (modelData.geometries as THREE.BufferGeometry[]).push(child.geometry);
      }
    }
  }
}

function getGeometries(name: string): THREE.BufferGeometry[] | undefined {
  const data = modelDatas.find((data) => data.name === name);
  return data?.geometries as THREE.BufferGeometry[] | undefined;
}

function buildTrack(
  name: string,
  group: THREE.Group,
  material: THREE.Material, // Changed back to THREE.Material
  _scene: THREE.Scene, // Marked as unused
  body: RAPIER.RigidBody,
  world: RAPIER.World,
  isTrimesh = true
) {
  const geometries = getGeometries(name);
  if (!geometries) return;

  for (const geometry of geometries) {
    if (!geometry) continue; // Skip if geometry is undefined
    geometry.computeVertexNormals();
    // material is now a THREE.Material instance
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    group.add(mesh);

    const newGeometry = BufferGeometryUtils.mergeVertices(geometry);

    const positionAttribute = newGeometry.getAttribute("position");
    if (!positionAttribute || !positionAttribute.array) {
      console.warn(`Skipping collider creation for geometry in model ${name} as it is missing position data.`);
      continue;
    }

    if (!newGeometry.index || !newGeometry.index.array) {
      console.warn(`Skipping collider creation for geometry in model ${name} as it is missing index data.`);
      continue;
    }

    const collider = isTrimesh
      ? RAPIER.ColliderDesc.trimesh(
          positionAttribute.array as Float32Array,
          newGeometry.index.array as Uint32Array
        )
      : RAPIER.ColliderDesc.convexHull(
          positionAttribute.array as Float32Array
          // newGeometry.index.array should not be passed to convexHull (TS2554 fix from documentation)
        );
    if (collider) { // Check if collider is not null
      world.createCollider(collider, body);
    }
  }
}

interface StraightTrackOptions {
  width?: number;
  height?: number;
  depth?: number;
  trackWidth?: number;
  trackDepth?: number;
}

export class Straight extends PhysicsObject {
  dimensions: StraightTrackOptions;
  originalDimensions: StraightTrackOptions;
  colliders: RAPIER.Collider[] = [];
  // world is inherited from PhysicsObject
  // type is inherited from PhysicsObject
  // scene is inherited from PhysicsObject
  // group is inherited from PhysicsObject
  // body is inherited from PhysicsObject
  // timeline is inherited from PhysicsObject

  constructor(scene: THREE.Scene, world: RAPIER.World, options: StraightTrackOptions = {}) {
    const {
      width = defaults.width,
      height = defaults.height,
      depth = defaults.depth,
      trackWidth = defaults.trackWidth,
      trackDepth = defaults.trackDepth,
    } = options;

    const geometry = straightTrackGeometry({
      width,
      height,
      depth,
      trackWidth,
      trackDepth,
    });

    const material = setMaterials.straight(); // No longer cast to MaterialParameters
    const mesh = new THREE.Mesh(geometry, material);

    const group = new THREE.Group();
    group.userData.type = "StraightTrack";
    group.add(mesh);

    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());

    super(scene, group, world, body);

    this.dimensions = { ...defaults, ...options };
    this.originalDimensions = { ...defaults, ...options };
    // this.colliders is initialized above
    this.world = world; // world is already on PhysicsObject but often re-assigned in subclasses

    this.type = "StraightTrack";

    this.generateColliders();
  }

  scale(x: number, y: number, z: number) { // Add types
    this.timeline.to(this.group.scale, {
      x: x,
      y: y,
      z: z,
      duration: 0.4,
      ease: "back.out(1.7)",
    });

    if (this.dimensions.depth !== undefined && this.originalDimensions.depth !== undefined) {
      this.dimensions.depth = this.originalDimensions.depth * z;
    }
    this.removeColliders();
    this.generateColliders();
    return this;
  }

  generateColliders() {
    const { width, height, depth, trackWidth, trackDepth } = this.dimensions as Required<StraightTrackOptions>; // Cast to Required as they should be set by now
    const wallWidth = (width - trackWidth) / 2;

    const colliderDescs = [
      RAPIER.ColliderDesc.cuboid(
        width / 2 - wallWidth,
        (height - trackDepth * 2) / 2,
        depth / 2
      ).setTranslation(width / 2, 0, 0),

      RAPIER.ColliderDesc.cuboid(
        (width - trackWidth) / 4,
        height / 2,
        depth / 2
      ).setTranslation(wallWidth / 2, 0, 0),

      RAPIER.ColliderDesc.cuboid(
        (width - trackWidth) / 4,
        height / 2,
        depth / 2
      ).setTranslation(width - wallWidth / 2, 0, 0),
    ];

    for (const desc of colliderDescs) {
      desc.setFriction(defaults.trackFriction);
      const collider = this.world.createCollider(desc, this.body);
      if (collider) this.colliders.push(collider); // Check collider
    }
  }

  removeColliders() {
    for (const c of this.colliders) {
      this.world.removeCollider(c, true); // Assumed true for wakeUp, adjust if necessary
    }
  }
}

interface CurveTrackOptions {
  width?: number;
  height?: number;
  depth?: number;
  trackWidth?: number;
  trackDepth?: number;
  sections?: number;
  curvePoints?: { x: number; y: number; z: number }[];
}

export class Curve extends PhysicsObject {
  shape: THREE.Shape;
  mesh: THREE.Mesh<THREE.ExtrudeGeometry, THREE.MeshStandardMaterial>;
  cap1: THREE.Mesh<THREE.ShapeGeometry, THREE.MeshStandardMaterial>;
  cap2: THREE.Mesh<THREE.ShapeGeometry, THREE.MeshStandardMaterial>;
  curvePoints: THREE.Vector3[];
  curve: THREE.QuadraticBezierCurve3;
  geometry: THREE.ExtrudeGeometry;
  sections: number;
  collider: RAPIER.Collider | null = null; // Initialize collider

  constructor(scene: THREE.Scene, world: RAPIER.World, options: CurveTrackOptions = {}) {
    const {
      width = defaults.width,
      height = defaults.height,
      depth = defaults.depth,
      trackWidth = defaults.trackWidth,
      trackDepth = defaults.trackDepth,
      sections = defaults.sections,
      curvePoints = defaults.curvePoints,
    } = options;

    const curvePointsCopy = [];
    for (const point of curvePoints) {
      curvePointsCopy.push(new THREE.Vector3(point.x, point.y, point.z));
    }

    const curve = new THREE.QuadraticBezierCurve3(
      curvePointsCopy[0],
      curvePointsCopy[1],
      curvePointsCopy[2]
    );

    const shape = trackShape({ width, height, depth, trackWidth, trackDepth });
    const geometry = curveTrackGeometry(shape, curve);
    const material = setMaterials.curve(); // No longer cast

    const mesh = new THREE.Mesh(geometry, material); // mesh uses the direct material instance
    mesh.castShadow = true;

    const group = new THREE.Group();

    // RAPIER
    const trackBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());

    super(scene, group, world, trackBody);

    const capGeometry = new THREE.ShapeGeometry(shape);
    // Caps should also use the same material instance if that's the intent
    const capMesh1 = new THREE.Mesh(capGeometry, material);
    const capMesh2 = new THREE.Mesh(capGeometry, material);

    group.userData.type = "CurveTrack";
    group.add(mesh, capMesh1, capMesh2);

    this.shape = shape;
    this.mesh = mesh;
    this.cap1 = capMesh1;
    this.cap2 = capMesh2;
    this.curvePoints = curvePointsCopy;
    this.curve = curve;
    this.geometry = geometry;
    this.sections = sections;
    this.world = world;

    this.type = "CurveTrack";

    this.updateCaps();
    this.generateCollider();
  }

  updateCaps() {
    const endPos1 = this.curve.getPointAt(0);
    const endPos2 = this.curve.getPointAt(1);

    const endRot1 = getSignedAngle3D(this.curve.getTangentAt(0), unitY);
    const endRot2 = getSignedAngle3D(this.curve.getTangentAt(1), unitY);

    this.cap1.position.copy(endPos1);
    this.cap1.rotation.set(-endRot1 + Math.PI / 2, 0, 0);
    this.cap2.position.copy(endPos2);
    this.cap2.rotation.set(-endRot2 + (3 * Math.PI) / 2, 0, 0);
  }

  removeCollider() {
    if (this.collider) { // Check if collider exists
      this.world.removeCollider(this.collider, true); // Add wakeUp parameter
    }
  }

  generateCollider() {
    let newGeometry = BufferGeometryUtils.mergeVertices(this.mesh.geometry as THREE.BufferGeometry); // Cast to BufferGeometry
    const positionArray = newGeometry.getAttribute("position").array as Float32Array;
    const indexArray = newGeometry.index ? newGeometry.index.array as Uint32Array : undefined;

    if (positionArray && indexArray) {
      const trackColliderDesc = RAPIER.ColliderDesc.trimesh(
        positionArray,
        indexArray
      ).setFriction(defaults.trackFriction);
      this.collider = this.world.createCollider(trackColliderDesc, this.body);
    } else {
      console.warn("Skipping collider creation for Curve track due to missing position or index data.");
    }
  }

  buildCurve() {
    this.curve = new THREE.QuadraticBezierCurve3(
      this.curvePoints[0],
      this.curvePoints[1],
      this.curvePoints[2]
    );
  }

  buildGeometry() {
    this.mesh.geometry = curveTrackGeometry(this.shape, this.curve);
    this.updateCaps();
  }
}

export class Windmill extends PhysicsObject {
  bladeBody: RAPIER.RigidBody; // Declare bladeBody

  constructor(scene: THREE.Scene, world: RAPIER.World) {
    const { width, height, trackWidth, trackDepth } = defaults;

    const geometry = straightTrackGeometry({
      width,
      height,
      depth: defaults.windmillDepth, // depth is used here
      trackDepth,
      trackWidth,
    });

    // const color = new THREE.Color(0x06335a); // TS6133: 'color' is declared but its value is never read.
    const material = setMaterials.windmill();

    const mesh = new THREE.Mesh(geometry, material);

    const mesh2 = new THREE.Mesh(geometry, material);

    mesh2.rotateX(Math.PI / 2);

    const group = new THREE.Group();
    group.userData.type = "WindmillTrack";
    group.userData.isTrack = true;
    group.add(mesh, mesh2);

    const bladeBodyDesc = RAPIER.RigidBodyDesc.dynamic();
    const pinBodyDesc = RAPIER.RigidBodyDesc.fixed();
    const jointParams = RAPIER.JointData.revolute(
      { x: 0, y: 0, z: 0 }, // anchor on windmill
      { x: 0, y: 0, z: 0 }, // anchor on pin
      { x: 1, y: 0, z: 0 } // axis of rotation
    );

    const bladeBody = world.createRigidBody(bladeBodyDesc);
    bladeBody.setAngularDamping(1);
    bladeBody.setEnabledRotations(true, false, false, true); // Added wakeUp: true

    const pinBody = world.createRigidBody(pinBodyDesc);
    // const joint = world.createImpulseJoint(jointParams, bladeBody, pinBody, true); // TS6133: 'joint' is declared but its value is never read.
    world.createImpulseJoint(jointParams, bladeBody, pinBody, true);


    super(scene, group, world, pinBody);

    this.world = world;
    this.bladeBody = bladeBody;
    this.generateColliders();

    bladeBody.applyTorqueImpulse({ x: randInt(-10, 10), y: 0, z: 0 }, true);

    this.type = "WindmillTrack";
  }

  setTranslation(x: number | THREE.Vector3, y?: number, z?: number) {
    if (x instanceof THREE.Vector3) {
      this.bladeBody.setTranslation(x, true);
      super.setTranslation(x.x, x.y, x.z); // Pass x, y, z components
    } else if (y !== undefined && z !== undefined) {
      const vec = new THREE.Vector3(x as number, y, z);
      this.bladeBody.setTranslation(vec, true);
      super.setTranslation(x as number, y, z); // Pass x, y, z
    }
    return this;
  }

  dispose() {
    this.scene.remove(this.group);
    this.world.removeRigidBody(this.body);
    if (this.bladeBody) { // Check if bladeBody exists
      this.world.removeRigidBody(this.bladeBody);
    }
  }

  updateRotation() {
    this.group.quaternion.copy(this.bladeBody.rotation());
  }

  generateColliders() {
    const { width, height, windmillDepth, trackWidth, trackDepth } = defaults;
    const wallWidth = (width - trackWidth) / 2;

    let colliderDescs = [
      RAPIER.ColliderDesc.cuboid(
        width / 2 - wallWidth,
        (height - trackDepth * 2) / 2,
        windmillDepth / 2
      ).setTranslation(width / 2, 0, 0),

      RAPIER.ColliderDesc.cuboid(
        (width - trackWidth) / 4,
        height / 2,
        windmillDepth / 2
      ).setTranslation(wallWidth / 2, 0, 0),

      RAPIER.ColliderDesc.cuboid(
        (width - trackWidth) / 4,
        height / 2,
        windmillDepth / 2
      ).setTranslation(width - wallWidth / 2, 0, 0),

      RAPIER.ColliderDesc.cuboid(
        width / 2 - wallWidth,
        (height - trackDepth * 2) / 2,
        windmillDepth / 2
      )
        .setTranslation(width / 2, 0, 0)
        .setRotation(
          new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0))
        ),

      RAPIER.ColliderDesc.cuboid((width - trackWidth) / 4, height / 2, windmillDepth / 2)
        .setTranslation(wallWidth / 2, 0, 0)
        .setRotation(
          new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0))
        ),

      RAPIER.ColliderDesc.cuboid((width - trackWidth) / 4, height / 2, windmillDepth / 2)
        .setTranslation(width - wallWidth / 2, 0, 0)
        .setRotation(
          new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0))
        ),
    ];

    for (const desc of colliderDescs) {
      desc.setFriction(defaults.trackFriction);
      this.world.createCollider(desc, this.bladeBody);
    }
  }
}

export class Tray extends PhysicsObject {
  constructor(scene: THREE.Scene, world: RAPIER.World) {
    const name = "TrayTrack";
    const group = new THREE.Group();
    const material = setMaterials.tray(); // No longer cast
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());

    group.userData.type = name;

    buildTrack(name, group, material, scene, body, world);
    super(scene, group, world, body);
    this.type = name;
  }
}

export class Funnel extends PhysicsObject {
  constructor(scene: THREE.Scene, world: RAPIER.World) {
    const name = "FunnelTrack";
    const group = new THREE.Group();
    group.userData.type = name;
    const material = setMaterials.funnel(); // No longer cast
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());

    buildTrack(name, group, material, scene, body, world);
    super(scene, group, world, body);
    this.type = name;
  }
}

export class Ring extends PhysicsObject {
  constructor(scene: THREE.Scene, world: RAPIER.World) {
    const name = "RingTrack";
    const group = new THREE.Group();
    group.userData.type = name;
    const material = setMaterials.ring(); // No longer cast
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());

    buildTrack(name, group, material, scene, body, world);
    super(scene, group, world, body);
    this.type = name;
  }
}

export class RingLong extends PhysicsObject {
  constructor(scene: THREE.Scene, world: RAPIER.World) {
    const name = "RingLongTrack";
    const group = new THREE.Group();
    group.userData.type = name;
    const material = setMaterials.ringLong(); // No longer cast
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());

    buildTrack(name, group, material, scene, body, world);
    super(scene, group, world, body);
    this.type = name;
  }
}

export class Tube extends PhysicsObject {
  constructor(scene: THREE.Scene, world: RAPIER.World) {
    const name = "TubeTrack";
    const group = new THREE.Group();
    group.userData.type = name;
    const material = setMaterials.tube(); // No longer cast
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());

    buildTrack(name, group, material, scene, body, world);
    super(scene, group, world, body);
    this.type = name;
  }
}

export class Cone extends PhysicsObject {
  constructor(scene: THREE.Scene, world: RAPIER.World) {
    const name = "ConeTrack";
    const group = new THREE.Group();
    group.userData.type = name;
    const material = setMaterials.cone(); // No longer cast
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());

    buildTrack(name, group, material, scene, body, world);
    super(scene, group, world, body);
    this.type = name;
  }
}

export class Random extends PhysicsObject {
  constructor(scene: THREE.Scene, world: RAPIER.World) {
    const names = ["RingTrack", "RingLongTrack", "ConeTrack", "TubeTrack"];
    const name = names[randInt(0, names.length - 1)];
    const group = new THREE.Group();
    group.userData.type = name;

    // Choose material based on the random track type selected
    let material: THREE.Material; // Specify type as THREE.Material
    switch (name) {
      case "RingTrack":
        material = setMaterials.ring();
        break;
      case "RingLongTrack":
        material = setMaterials.ringLong();
        break;
      case "ConeTrack":
        material = setMaterials.cone();
        break;
      default: // Assuming TubeTrack was meant or just a default
        material = setMaterials.tube(); // Defaulting to tube or another appropriate one
    }

    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());

    buildTrack(name, group, material, scene, body, world);
    super(scene, group, world, body);
    this.type = name;
  }
}

export class Starter extends PhysicsObject {
  // Outer width: 1.8
  // Inner width: 1.4

  constructor(scene: THREE.Scene, world: RAPIER.World) {
    const name = "StarterTrack";
    const group = new THREE.Group();
    group.userData.type = name;
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    const material = setMaterials.starter(); // No longer cast

    buildTrack(name, group, material, scene, body, world);

    super(scene, group, world, body);

    this.type = name;
    this.world = world;
  }

  placeMarble(marblesArray: Marble[], light: THREE.Light) { // Add types
    const marble = new Marble(
      this.scene as THREE.Scene, // Cast scene
      this.world as RAPIER.World, // Cast world
      defaults.marbleRadius,
      light,
      marblesArray
    );
    marble.setTranslation(0.9, this.group.position.y + 2.5, this.group.position.z);
  }
}

export class Logo extends PhysicsObject {
  areaLight: THREE.RectAreaLight;
  textMaterials: THREE.Material[];

  constructor(scene: THREE.Scene, world: RAPIER.World) {
    const group = new THREE.Group();
    group.userData.type = "LogoTrack";

    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());

    // These should be actual Material instances
    const backMaterial = new THREE.MeshStandardMaterial({ color: "#06335a" });
    const textMaterial = new THREE.MeshStandardMaterial({
      color: "#ffffff",
      emissive: new THREE.Color("#d8d8ff"),
      emissiveIntensity: 0,
    });

    buildTrack("LogoTrackBack", group, backMaterial, scene, body, world, false);
    buildTrack("LogoTrackText", group, textMaterial, scene, body, world, false);

    const areaLight = new THREE.RectAreaLight("#d8d8ff", 0, 7.88, 2.03);

    areaLight.rotateY(-Math.PI / 2);
    areaLight.position.x = 0.375;
    group.add(areaLight);

    super(scene, group, world, body);

    this.areaLight = areaLight;

    this.textMaterials = this.group.children
      .filter((child): child is THREE.Mesh => child instanceof THREE.Mesh) // Type guard
      .map(child => child.material) as THREE.Material[]; // Cast material

    this.type = "LogoTrack";
    this.world = world;
  }
  lightOn() {
    gsap.to(this.areaLight, { intensity: 5 });
    for (const textMaterial of this.textMaterials) {
      if (textMaterial instanceof THREE.MeshStandardMaterial) { // Check type
        gsap.to(textMaterial, { emissiveIntensity: 0.8 });
      }
    }
  }
  lightOff() {
    gsap.to(this.areaLight, { intensity: 0 });
    for (const textMaterial of this.textMaterials) {
      if (textMaterial instanceof THREE.MeshStandardMaterial) { // Check type
        gsap.to(textMaterial, { emissiveIntensity: 0 });
      }
    }
  }
}

export class LightCube extends PhysicsObject {
  areaLight: THREE.PointLight;
  textMaterials: THREE.Material[];

  constructor(scene: THREE.Scene, world: RAPIER.World) {
    const name = "LightCube";
    const group = new THREE.Group();
    group.userData.type = name;

    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());

    // These should be actual Material instances
    const backMaterial = new THREE.MeshStandardMaterial({ color: "#06335a", visible: false });
    const textMaterial = new THREE.MeshStandardMaterial({
      color: "#ffffff",
      emissive: new THREE.Color("#d8d8ff"),
      emissiveIntensity: 0,
      visible: false,
    });

    buildTrack("LightCubeBase", group, backMaterial, scene, body, world, false);
    buildTrack("LightCube", group, textMaterial, scene, body, world, false);

    const areaLight = new THREE.PointLight("#d8d8ff", 10);

    areaLight.position.x = 3;
    // areaLight.position.y = 3;
    areaLight.rotateX(Math.PI / 2);
    group.add(areaLight);

    super(scene, group, world, body);

    this.areaLight = areaLight;

    this.textMaterials = this.group.children
        .filter((child): child is THREE.Mesh => child instanceof THREE.Mesh) // Type guard
        .map(child => child.material) as THREE.Material[]; // Cast material

    this.type = name;
    this.world = world;
  }
  lightOn() {
    gsap.to(this.areaLight, { intensity: 5 });
    for (const textMaterial of this.textMaterials) {
      if (textMaterial instanceof THREE.MeshStandardMaterial) { // Check type
        gsap.to(textMaterial, { emissiveIntensity: 0.8 });
      }
    }
  }
  lightOff() {
    gsap.to(this.areaLight, { intensity: 0 });
    for (const textMaterial of this.textMaterials) {
      if (textMaterial instanceof THREE.MeshStandardMaterial) { // Check type
        gsap.to(textMaterial, { emissiveIntensity: 0 });
      }
    }
  }
}
