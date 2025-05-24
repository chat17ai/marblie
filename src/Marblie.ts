import * as THREE from "three";
import * as RAPIER from "@dimforge/rapier3d-compat";
import * as TRACK from "./marble/Track";
import { OrbitControls } from "three/examples/jsm/Addons.js";
import { Marble } from "./marble/Marble.ts";
import { TrackTransformControls } from "./marble/TrackTransformControls";
import GUI from "lil-gui";
import gsap from "gsap";
import { isMouseInTrackButton } from "./marble/utils";
import { defaults } from "./marble/config";

import {
  DepthOfFieldEffect,
  EffectComposer,
  EffectPass,
  RenderPass,
  SMAAEffect,
} from "postprocessing";

let scene: THREE.Scene = new THREE.Scene();
let dofEffect: DepthOfFieldEffect;
let composer: EffectComposer;

const toggles = {
  autoMarbleOn: false,
  cameraFollowOn: false,
  isDay: true,
};

const settings = {
  dayLightPosition: { x: 100, y: 50, z: 50 },
  nightLightPosition: { x: 0, y: 0, z: 5 },
  focusDistance: 0.2,
  focusLength: 0.2,
};

// ----- THREE.js -----
let width = window.innerWidth;
let height = window.innerHeight;

let renderer: THREE.WebGLRenderer;
let camera: THREE.PerspectiveCamera = new THREE.PerspectiveCamera(
  25,
  width / height,
  0.1,
  1000
);

let controls: OrbitControls;
let raycaster: THREE.Raycaster;
let trackIntersects: THREE.Intersection[] = [];
let handleIntersects: THREE.Intersection[] = [];
let intersects: THREE.Intersection[] = [];

let dayLight: THREE.DirectionalLight;
let nightLight: THREE.DirectionalLight;
let ambientLight: THREE.AmbientLight;

const clock = new THREE.Clock();
let lastTriggerTime = 0;
let lastMarblePosition = new THREE.Vector3();

const pointer = new THREE.Vector2(-Infinity, -Infinity);
const cursor = new THREE.Vector2(-Infinity, -Infinity);

const focusRaycaster = new THREE.Raycaster();
const screenCenter = new THREE.Vector2(0, 0);
const focusPoint = new THREE.Vector3(0, 0, 0);

class RapierDebugRenderer {
  mesh: THREE.LineSegments;
  world: RAPIER.World;
  enabled = false;

  constructor(scene: THREE.Scene, world: RAPIER.World) {
    this.world = world;
    this.mesh = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0xffffff, vertexColors: true })
    );
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  update() {
    if (this.enabled) {
      const { vertices, colors } = this.world.debugRender();
      this.mesh.geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
      this.mesh.geometry.setAttribute("color", new THREE.BufferAttribute(colors, 4));
      this.mesh.visible = true;
    } else {
      this.mesh.visible = false;
    }
  }
}

await RAPIER.init();

const gravity = new RAPIER.Vector3(0, -9.81 * 10, 0);
const world = new RAPIER.World(gravity);

const FIXED_TIME_STEP = 1 / 240;
const MAX_SUBSTEPS = 4;

// const FIXED_TIME_STEP = 1 / 60;
// const MAX_SUBSTEPS = 1;

world.timestep = FIXED_TIME_STEP;

let accumulator = 0;

function rapierStep(deltaTime: number) {
  accumulator += deltaTime;

  let substeps = 0;
  while (accumulator >= FIXED_TIME_STEP && substeps < MAX_SUBSTEPS) {
    world.step(); // step Rapier world once
    accumulator -= FIXED_TIME_STEP;
    substeps++;
  }
}

sceneSetup();
setupLights();

// ----- Marble -----

const marbles: Marble[] = [];
const marbleLightPool: THREE.PointLight[] = [];

for (let i = 0; i < 3; i++) {
  const light = new THREE.PointLight(0xffc53d, 1, 15);
  light.castShadow = true;
  light.userData.inUse = false;
  light.intensity = 0;
  scene.add(light);
  marbleLightPool.push(light);
}

function getAvailableMarbleLight() {
  if (Math.random() < 0.3) {
    for (const light of marbleLightPool) {
      if (!light.userData.inUse) {
        light.userData.inUse = true;
        return light;
      }
    }
  }

  // All lights are in use — reuse the oldest?
  return null;
}

// ----- Background Wall -----
const normalMap = new THREE.TextureLoader().load("./textures/pegboard-normals.jpg");
normalMap.wrapS = THREE.RepeatWrapping;
normalMap.wrapT = THREE.RepeatWrapping;
normalMap.repeat = new THREE.Vector2(5, 10);
const pegboardMaterial = new THREE.MeshStandardMaterial({
  color: "#fff8f1",
  dithering: true,
  normalMap: normalMap,
  // normalMapType: THREE.ObjectSpaceNormalMap,
  bumpMap: normalMap,
});

const wall = new THREE.Mesh(new THREE.PlaneGeometry(100, 200), pegboardMaterial);
wall.receiveShadow = true;
wall.rotateY(Math.PI / 2);
scene.add(wall);

const wallBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
const wallColliderDesc = RAPIER.ColliderDesc.cuboid(0.05, 500, 500).setTranslation(
  -0.05,
  0,
  0
);
world.createCollider(wallColliderDesc, wallBody);

// Load GLTF
await TRACK.preloadTracks();

const tracks = await loadTracks(scene, world);

const starterTrack = tracks.find((track) => track.type === "StarterTrack");
if (starterTrack) {
  const light = getAvailableMarbleLight();
  if (light) {
    new Marble(
      scene,
      world,
      defaults.marbleRadius,
      light,
      marbles
    ).setTranslation(0.9, starterTrack.group.position.y + 2.5, starterTrack.group.position.z);
  } else {
    // 如果没有可用的灯光，则不使用灯光创建弹珠
    new Marble(
      scene,
      world,
      defaults.marbleRadius,
      undefined as any, // 传递undefined作为light参数
      marbles
    ).setTranslation(0.9, starterTrack.group.position.y + 2.5, starterTrack.group.position.z);
  }
}

const trackTransformControls = new TrackTransformControls(camera, scene, tracks);

const rapierDebugRenderer = new RapierDebugRenderer(scene, world);

function animate() {
  requestAnimationFrame(animate);

  rapierStep(clock.getDelta());
  // world.step(eventQueue);
  for (const marble of marbles) marble.update();
  for (const track of tracks) {
    if (track.type === "WindmillTrack") track.updateRotation();
  }

  if (toggles.autoMarbleOn) autoPlaceMarble();
  if (toggles.cameraFollowOn) followMarble();

  // drainEvents();

  rapierDebugRenderer.update();
  controls.update();

  dofEffect.target.lerp(focusPoint, 0.1);

  // renderer.render(scene, camera);
  composer.render();
}

function followMarble() {
  if (marbles.length) {
    const marblePosition = marbles[marbles.length - 1].group.position;
    const marblePositionDiff = new THREE.Vector3().subVectors(
      marblePosition,
      lastMarblePosition
    );

    camera.position.add(marblePositionDiff);
    controls.target = lastMarblePosition;

    lastMarblePosition.copy(marblePosition);
  }
}

function autoPlaceMarble() {
  const elapsedTime = clock.getElapsedTime();
  if (elapsedTime - lastTriggerTime >= 3) {
    lastTriggerTime = elapsedTime;

    if (starterTrack) {
      const light = getAvailableMarbleLight();
      if (light) {
        new Marble(
          scene,
          world,
          defaults.marbleRadius,
          light,
          marbles
        ).setTranslation(0.9, starterTrack.group.position.y + 2.5, starterTrack.group.position.z);
      } else {
        // 如果没有可用的灯光，则不使用灯光创建弹珠
        new Marble(
          scene,
          world,
          defaults.marbleRadius,
          undefined as any, // 传递undefined作为light参数
          marbles
        ).setTranslation(0.9, starterTrack.group.position.y + 2.5, starterTrack.group.position.z);
      }
    }
  }
}

function sceneSetup() {
  const element = document.querySelector("#three") as HTMLElement;
  renderer = new THREE.WebGLRenderer({
    powerPreference: "high-performance",
    antialias: false,
    stencil: false,
    depth: false,
  });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setSize(width, height);
  renderer.setClearColor(0xe1dbd5);
  element.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.minDistance = 10;
  controls.maxDistance = 100;
  controls.maxAzimuthAngle = Math.PI - 0.1;
  controls.minAzimuthAngle = 0.1;
  controls.minPolarAngle = 0.1;
  controls.maxPolarAngle = Math.PI - 0.1;

  camera.position.set(100, 0, 0);
  camera.lookAt(0, 0, 0);

  controls.update();

  raycaster = new THREE.Raycaster();

  composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  const smaaEffect = new SMAAEffect();

  // Depth of Field effect
  dofEffect = new DepthOfFieldEffect(camera, {
    focusDistance: 0.02, // normalized [0,1] distance from camera
    focalLength: 0.04,
    bokehScale: 6.0,
  });

  dofEffect.target = new THREE.Vector3(0, 0, 0);

  const effectPass = new EffectPass(camera, dofEffect, smaaEffect);
  effectPass.renderToScreen = true;
  composer.addPass(effectPass);
}

function setupLights() {
  // ----- Ambient Light -----
  ambientLight = new THREE.AmbientLight(0xffffff, 1);

  // ----- Day Light -----
  dayLight = new THREE.DirectionalLight(0xffffff, 2);
  dayLight.position.copy(settings.dayLightPosition);
  dayLight.castShadow = true;
  const shadowFrustrum = 50;
  dayLight.shadow.mapSize.width = 4096;
  dayLight.shadow.mapSize.height = 4096;
  dayLight.shadow.camera.left = -shadowFrustrum;
  dayLight.shadow.camera.right = shadowFrustrum;
  dayLight.shadow.camera.top = shadowFrustrum;
  dayLight.shadow.camera.bottom = -shadowFrustrum;
  dayLight.shadow.radius = 3;
  dayLight.shadow.intensity = 0.6;

  // const helper = new THREE.DirectionalLightHelper(dayLight);
  // const helper = new THREE.CameraHelper(dayLight.shadow.camera);
  // scene.add(helper);

  // ----- Night Light -----
  nightLight = new THREE.DirectionalLight("#3333ca", 0.5);
  nightLight.position.set(0.2, -1, 0.05);

  const lights = [ambientLight, dayLight, nightLight];

  lights.forEach((light) => {
    scene.add(light);
  });
}

function handleResize() {
  width = window.innerWidth;
  height = window.innerHeight;
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function handleMouseMove(event: MouseEvent) {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

  cursor.x = event.clientX;
  cursor.y = event.clientY;

  raycaster.setFromCamera(pointer, camera);
}

function handleMouseDown() {
  attach();
}

function attach() {
  intersects = raycaster.intersectObjects(scene.children);

  trackIntersects = intersects.filter(
    (intersect) =>
      intersect.object.userData.isTrack || intersect.object.parent?.userData.isTrack
  );
  handleIntersects = intersects.filter(
    (intersect) => intersect.object.userData.type === "Handle"
  );

  if (trackIntersects[0] || handleIntersects[0]) controls.enableRotate = false;

  if (
    trackIntersects[0] && // intersects a track
    !isMouseInTrackButton(cursor) && // not in track buttons
    handleIntersects.length === 0 // not editing handle
  ) {
    trackTransformControls.attach(trackIntersects[0].object.parent as THREE.Group);
  } else if (!trackTransformControls.isDragging) {
    trackTransformControls.detach();
  }
}

function handleTouchStart(event: TouchEvent) {
  const touch = event.touches[0];

  pointer.x = (touch.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(touch.clientY / window.innerHeight) * 2 + 1;

  cursor.x = touch.clientX;
  cursor.y = touch.clientY;

  raycaster.setFromCamera(pointer, camera);
  attach();
}

function handleTouchMove(event: TouchEvent) {
  const touch = event.touches[0];

  pointer.x = (touch.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(touch.clientY / window.innerHeight) * 2 + 1;

  cursor.x = touch.clientX;
  cursor.y = touch.clientY;

  raycaster.setFromCamera(pointer, camera);
}

function handleMouseUp() {
  controls.enableRotate = true;
}

function handleMouseLeave() {
  pointer.set(-Infinity, -Infinity);
}

function handleTouchEnd() {
  handleMouseUp();
}

function addEventListeners() {
  window.addEventListener("resize", handleResize);
  controls.addEventListener("change", () => {
    focusRaycaster.setFromCamera(screenCenter, camera);
    const hits = focusRaycaster.intersectObjects(scene.children, true);
    focusPoint.copy(hits[0].point);
  });

  const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;

  if (!isTouchDevice) {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("mouseleave", handleMouseLeave);
  } else {
    window.addEventListener("touchstart", handleTouchStart);
    window.addEventListener("touchmove", handleTouchMove);
    window.addEventListener("touchend", handleTouchEnd);
  }

  trackTransformControls.addEventListener("edited", () => {
    saveTracks(tracks);
  });
}

addEventListeners();
animate();

// ----- Add Track Button Interaction -----
function addTrackPost(track: any) {
  const raycastPos = trackTransformControls.raycastPlanePos;
  track.setTranslation(raycastPos.x, raycastPos.y, raycastPos.z);
  trackTransformControls.attach(track.group);
  trackTransformControls.isDragging = true;
  trackTransformControls.selectedMesh = track.group.children[0];

  tracks.push(track);

  console.log(tracks);
}

const addStraightTrack = () => {
  const track = new TRACK.Straight(scene, world);
  addTrackPost(track);
};

const addCurveTrack = () => {
  const track = new TRACK.Curve(scene, world);
  addTrackPost(track);
};

const addWindmillTrack = () => {
  const track = new TRACK.Windmill(scene, world);

  addTrackPost(track);
};

const addFunnelTrack = () => {
  const track = new TRACK.Funnel(scene, world);
  addTrackPost(track);
};

const addLightCube = () => {
  const track = new TRACK.LightCube(scene, world);
  addTrackPost(track);
};

const addTubeTrack = () => {
  const track = new TRACK.Tube(scene, world);
  addTrackPost(track);
};

const addRandomTrack = () => {
  const track = new TRACK.Random(scene, world);
  addTrackPost(track);
};

const placeMarble = () => {
  if (starterTrack) {
    const light = getAvailableMarbleLight();
    if (light) {
      new Marble(
        scene,
        world,
        defaults.marbleRadius,
        light,
        marbles
      ).setTranslation(0.9, starterTrack.group.position.y + 2.5, starterTrack.group.position.z);
    } else {
      // 如果没有可用的灯光，则不使用灯光创建弹珠
      new Marble(
        scene,
        world,
        defaults.marbleRadius,
        undefined as any, // 传递undefined作为light参数
        marbles
      ).setTranslation(0.9, starterTrack.group.position.y + 2.5, starterTrack.group.position.z);
    }
  }
  gsap.to(".marbleButton", {
    keyframes: [
      { scale: 1.2, duration: 0.05, ease: "power1.out" },
      { scale: 1, duration: 0.05, ease: "power1.in" },
    ],
  });
};

// ----- UI Functions -----

const toggleDay = () => {
  const element = document.querySelector("#dayButton");

  const nightElements = document.querySelectorAll(
    ".trackButton, .overlaySidebar, .toggleButton, .marbleButton, .aboutButton, .iconSvg"
  );

  if (toggles.isDay) {
    toggles.isDay = false;

    // Logo Material changes
    tracks
      .filter((track) => track.type === "LogoTrack")
      .forEach((logo) => logo.lightOn());

    if (element) element.classList.remove("toggleOn");
    for (const nightElement of nightElements) {
      nightElement.classList.add("night");
    }

    // Day Light Position
    gsap.to(dayLight.position, {
      x: settings.nightLightPosition.x,
      y: settings.nightLightPosition.y,
      z: settings.nightLightPosition.z,
      onUpdate: () => {
        dayLight.lookAt(0, 0, 0);
        // helper.update();
      },
    });

    // Day Light Intensity
    gsap.to(dayLight, {
      intensity: 0,
    });

    // Ambient
    gsap.to(ambientLight, {
      intensity: 0.03,
    });

    gsap.to("#three", { backgroundColor: "#161514" });
  } else {
    if (element) element.classList.add("toggleOn");
    for (const nightElement of nightElements) nightElement.classList.remove("night");

    // Logo Material changes
    tracks
      .filter((track) => track.type === "LogoTrack")
      .forEach((logo) => logo.lightOff());

    toggles.isDay = true;
    // Day Light Position
    gsap.to(dayLight.position, {
      x: settings.dayLightPosition.x,
      y: settings.dayLightPosition.y,
      z: settings.dayLightPosition.z,
      onUpdate: () => {
        dayLight.lookAt(0, 0, 0);
        // helper.update();
      },
    });

    // Day Light Intensity
    gsap.to(dayLight, {
      intensity: 2,
    });

    // Ambient
    gsap.to(ambientLight, {
      intensity: 1,
    });

    gsap.to("#three", { backgroundColor: "#d0cbc4" });
  }
};

const toggleFollowMarble = () => {
  const element = document.querySelector("#followMarbleButton");

  if (!toggles.cameraFollowOn) {
    if (element) element.classList.add("toggleOn");

    toggles.cameraFollowOn = true;

    if (marbles.length) {
      const marblePosition = marbles[marbles.length - 1].group.position;
      lastMarblePosition.copy(marblePosition);
      camera.lookAt(marblePosition);
    }

    controls.enablePan = false;
  } else {
    if (element) element.classList.remove("toggleOn");

    toggles.cameraFollowOn = false;

    controls.update();
    controls.enablePan = true;
  }
};

const toggleAutoMarble = () => {
  const element = document.querySelector("#autoMarbleButton");
  if (toggles.autoMarbleOn) {
    if (element) element.classList.remove("toggleOn");
  } else {
    if (element) element.classList.add("toggleOn");
  }
  toggles.autoMarbleOn = !toggles.autoMarbleOn;
};

// ----- Debug GUI -----
const guiParams = {
  log: () => saveTracks(tracks),
  logTracks: () => {
    console.log(tracks);
  },
};
const gui = new GUI().hide();
gui.add(rapierDebugRenderer, "enabled");
gui.add(guiParams, "log");
gui.add(guiParams, "logTracks");

window.addEventListener("keydown", (event) => {
  const key = event.code;

  switch (key) {
    case "KeyD":
      gui._hidden ? gui.show() : gui.hide();
      break;
    case "KeyH":
      const overlay = document.querySelector(".overlay");
      overlay?.classList.toggle("hide");
      break;
    case "KeyM":
      placeMarble();
      break;
  }
});

function saveTracks(tracks: any[]) {
  const trackData = tracks.map((track) => {
    const { type, group, curvePoints, id } = track;
    const { position, rotation, scale } = group;

    const trackInfo: any = {
      type,
      position: {
        x: position.x,
        y: position.y,
        z: position.z,
      },
      rotation: {
        x: rotation.x,
        y: rotation.y,
        z: rotation.z,
      },
      id,
    };

    if (type === "StraightTrack") {
      trackInfo.scale = {
        x: scale.x,
        y: scale.y,
        z: scale.z,
      };
    }

    if (type === "CurveTrack") {
      trackInfo.curvePoints = curvePoints;
    }

    return trackInfo;
  });

  const json = JSON.stringify(trackData, null, 2);
  console.log(json);
  localStorage.setItem("trackData", json);
}

async function loadTracks(scene: THREE.Scene, world: RAPIER.World): Promise<any[]> {
  let json = localStorage.getItem("trackData");

  // If there's no track data in localStorage, fetch the default JSON
  if (!json) {
    const response = await fetch("./trackSetups/trackSetupDefault.json");
    json = JSON.stringify(await response.json());
  }

  const trackData = JSON.parse(json);
  const tracks: any[] = [];

  for (const data of trackData) {
    let track: any = null;

    switch (data.type) {
      case "StarterTrack":
        track = new TRACK.Starter(scene, world).delay();
        break;
      case "StraightTrack":
        track = new TRACK.Straight(scene, world)
          .delay()
          .scale(data.scale.x, data.scale.y, data.scale.z);
        break;
      case "CurveTrack":
        track = new TRACK.Curve(scene, world, {
          curvePoints: data.curvePoints,
        }).delay();
        break;
      case "WindmillTrack":
        track = new TRACK.Windmill(scene, world).delay();
        break;
      case "FunnelTrack":
        track = new TRACK.Funnel(scene, world).delay();
        break;
      case "TrayTrack":
        track = new TRACK.Tray(scene, world).delay();
        break;
      case "LogoTrack":
        track = new TRACK.Logo(scene, world).delay();
        break;
      case "RingTrack":
        track = new TRACK.Ring(scene, world).delay();
        break;
      case "RingLongTrack":
        track = new TRACK.RingLong(scene, world).delay();
        break;
      case "ConeTrack":
        track = new TRACK.Cone(scene, world).delay();
        break;
      case "LightCube":
        track = new TRACK.LightCube(scene, world).delay();
        break;
      case "TubeTrack":
        track = new TRACK.Tube(scene, world).delay();
        break;
      default:
        console.warn(`Unknown track type: ${data.type}`);
        break;
    }

    if (track) {
      track.id = data.id;
      track.setTranslation(data.position.x, data.position.y, data.position.z);
      track.setRotation(data.rotation.x, data.rotation.y, data.rotation.z);
      tracks.push(track);
    }
  }

  console.log("Loaded tracks");
  return tracks;
}

export {
  addStraightTrack,
  addCurveTrack,
  addWindmillTrack,
  addFunnelTrack,
  addLightCube,
  addTubeTrack,
  placeMarble,
  addRandomTrack,
  toggleDay,
  toggleFollowMarble,
  toggleAutoMarble,
};
