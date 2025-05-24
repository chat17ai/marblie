import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import { Physics, RigidBody } from '@react-three/rapier';
import { EffectComposer, SMAA, DepthOfField } from '@react-three/postprocessing';
import * as THREE from 'three';
import { Marble } from './marble/Marble'; // Adjust path if needed
import { modelDatas } from './marble/trackData'; // Adjust path if needed
import { StarterTrack, STARTER_TRACK_SPAWN_OFFSET } from './marble/tracks/StarterTrack'; // Adjust path
import { StraightTrack } from './marble/tracks/StraightTrack'; // Adjust path
import { CurveTrack } from './marble/tracks/CurveTrack'; // Adjust path
import { WindmillTrack } from './marble/tracks/WindmillTrack'; // Adjust path
import { FunnelTrack } from './marble/tracks/FunnelTrack'; // Adjust path
import { TubeTrack } from './marble/tracks/TubeTrack'; // Adjust path
import { LogoTrack } from './marble/tracks/LogoTrack'; // Adjust path
import { LightCube } from './marble/tracks/LightCube'; // Adjust path
import { RandomTrack } from './marble/tracks/RandomTrack'; // Adjust path

const App = () => {
  const [marbles, setMarbles] = useState<Array<{ id: string | number; position: [number, number, number]; hasLight: boolean }>>([]);
  const [logoLit, setLogoLit] = useState(false);
  const [lightCubeLit, setLightCubeLit] = useState(false);

  const [starterTrackInfo, setStarterTrackInfo] = useState({
    id: 'starter-track-1',
    position: [0, -2, 0] as [number, number, number], // Example initial position
    rotation: [0, 0, 0] as [number, number, number], // Example initial rotation
  });

  useEffect(() => {
    modelDatas.forEach(model => useGLTF.preload(model.url));
    console.log('Preloading GLB models initiated...');
    // Initial marble spawn
    spawnMarble();

    const timer = setTimeout(() => {
      setLogoLit(true);
      setLightCubeLit(true);
    }, 3000); // Light them up after 3 seconds
    return () => clearTimeout(timer);
  }, []); // Empty dependency array ensures this runs once on mount

  const handleDisposeMarble = (id: string | number) => {
    setMarbles((prevMarbles) => prevMarbles.filter(marble => marble.id !== id));
    console.log(`Disposed marble: ${id}`);
  };

  const spawnMarble = () => {
    const newId = `marble-${Date.now()}`;
    // Calculate spawn position based on StarterTrack's position and its defined offset
    const spawnPositionVec = new THREE.Vector3()
      .copy(STARTER_TRACK_SPAWN_OFFSET)
      .applyEuler(new THREE.Euler().setFromVector3(new THREE.Vector3(...starterTrackInfo.rotation))) // Apply rotation
      .add(new THREE.Vector3(...starterTrackInfo.position));

    const newPosition: [number, number, number] = [spawnPositionVec.x, spawnPositionVec.y, spawnPositionVec.z];

    setMarbles((prevMarbles) => [
      ...prevMarbles,
      { id: newId, position: newPosition, hasLight: Math.random() < 0.3 }
    ]);
    console.log(`Spawning marble at: ${newPosition.join(', ')}`);
  };

  // useEffect(() => {
  //   const timer = setTimeout(spawnMarble, 2000); // Remove automatic spawning for now, or make it button-based
  //   return () => clearTimeout(timer);
  // }, []); // This useEffect was causing double initial spawn

  return (
    <Canvas
      shadows
      camera={{ position: [100, 0, 0], fov: 25, near: 0.1, far: 1000 }}
    >
      <color attach="background" args={['#e1dbd5']} />
      <ambientLight intensity={1} />
      <directionalLight
        position={[100, 50, 50]}
        intensity={2}
        castShadow
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-camera-far={100}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
      />
      <Physics gravity={[0, -9.81 * 10, 0]}>
        <RigidBody type="fixed">
          <mesh receiveShadow castShadow>
            <boxGeometry args={[20, 1, 20]} />
            <meshStandardMaterial color="grey" />
          </mesh>
        </RigidBody>
        <StarterTrack
          id={starterTrackInfo.id}
          position={starterTrackInfo.position}
          rotation={starterTrackInfo.rotation}
        />
        <StraightTrack
          id="straight-1"
          position={[0, -2, -5]} // Example: Place it after the starter track
          rotation={[0, 0, 0]}
          scale={[1, 1, 3]} // Make it a bit longer
        />
        <CurveTrack 
          id="curve-1" 
          position={[0, -2, -10]} 
          rotation={[0, 0, 0]} 
        />
        <WindmillTrack 
          id="windmill-1" 
          position={[0, 0, -15]} 
        />
        <FunnelTrack id="funnel-1" position={[7, -2, -10]} rotation={[0,0,0]} />
        <TubeTrack id="tube-1" position={[-7, -2, -10]} rotation={[0,0,0]} />
        <LogoTrack id="logo-1" position={[0, 2, -20]} rotation={[0,0,0]} isLit={logoLit} />
        <LightCube id="lightcube-1" position={[5, 0, -20]} rotation={[0,0,0]} isLit={lightCubeLit} />
        <RandomTrack id="random-track-1" position={[10, -2, -5]} rotation={[0,0,0]} />
        <RandomTrack id="random-track-2" position={[10, -2, -10]} rotation={[0,0,0]} />
        <RandomTrack id="random-track-3" position={[10, -2, -15]} rotation={[0,0,0]} />
        {marbles.map(marble => (
          <Marble
            key={marble.id}
            id={marble.id}
            position={marble.position}
            hasLight={marble.hasLight}
            onDispose={handleDisposeMarble}
          />
        ))}
      </Physics>
      <OrbitControls
        minDistance={20} // From Marblie.ts: settings.minDistance
        maxDistance={150} // From Marblie.ts: settings.maxDistance
        minAzimuthAngle={-Math.PI / 2} // From Marblie.ts: -90 degrees
        maxAzimuthAngle={Math.PI / 2} // From Marblie.ts: 90 degrees
        minPolarAngle={Math.PI / 4} // From Marblie.ts: 45 degrees
        maxPolarAngle={(3 * Math.PI) / 4} // From Marblie.ts: 135 degrees
      />
      <EffectComposer>
        <SMAA />
        <DepthOfField
          focusDistance={0.02}
          focalLength={0.04}
          bokehScale={6.0}
        />
      </EffectComposer>
    </Canvas>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
