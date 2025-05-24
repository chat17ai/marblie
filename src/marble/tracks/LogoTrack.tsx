// src/marble/tracks/LogoTrack.tsx
import React, { useMemo, useRef, useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import { RigidBody, TrimeshCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { trackMaterials, getModelPath } from '../trackData';
import { defaults } from '../config';
import gsap from 'gsap';

interface LogoTrackProps {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number];
  isLit?: boolean;
}

export const LogoTrack: React.FC<LogoTrackProps> = ({ id, position, rotation, isLit = false }) => {
  const modelPathBack = getModelPath('LogoTrackBack');
  const modelPathText = getModelPath('LogoTrackText');

  if (!modelPathBack || !modelPathText) {
    console.error('LogoTrack model paths not found!');
    return null;
  }

  const { scene: sceneBack } = useGLTF(modelPathBack);
  const { scene: sceneText } = useGLTF(modelPathText);

  const backMaterial = useMemo(() => trackMaterials.logoBack(), []);
  // Make text material unique for this instance for animation
  const textMaterialRef = useRef(trackMaterials.logoText().clone()); 
  const rectAreaLightRef = useRef<THREE.RectAreaLight>(null);

  useEffect(() => {
    const targetIntensity = isLit ? 5 : 0;
    const targetEmissiveIntensity = isLit ? 0.8 : 0;
    if (rectAreaLightRef.current) {
      gsap.to(rectAreaLightRef.current, { intensity: targetIntensity, duration: 0.5 });
    }
    gsap.to(textMaterialRef.current, { emissiveIntensity: targetEmissiveIntensity, duration: 0.5 });
  }, [isLit]);
  
  const processedBack = useMemo(() => { 
    const meshes: JSX.Element[] = []; const colliders: JSX.Element[] = []; let i=0;
    sceneBack.traverse(child => {
      if (child instanceof THREE.Mesh) {
        const geom = child.geometry.clone();
        if (!geom.attributes.position || !geom.index) return;
        meshes.push(<mesh key={`${id}-back-${i}`} geometry={geom} material={backMaterial} castShadow receiveShadow />);
        colliders.push(<TrimeshCollider key={`${id}-back-col-${i}`} args={[geom.attributes.position.array as Float32Array, geom.index.array as Uint32Array]} />);
        i++;
      }
    });
    return { meshes, colliders };
  }, [sceneBack, id, backMaterial]);

  const processedText = useMemo(() => {
    const meshes: JSX.Element[] = []; const colliders: JSX.Element[] = []; let i=0;
    sceneText.traverse(child => {
      if (child instanceof THREE.Mesh) {
        const geom = child.geometry.clone();
        if (!geom.attributes.position || !geom.index) return;
        meshes.push(<mesh key={`${id}-text-${i}`} geometry={geom} material={textMaterialRef.current} castShadow receiveShadow />);
        colliders.push(<TrimeshCollider key={`${id}-text-col-${i}`} args={[geom.attributes.position.array as Float32Array, geom.index.array as Uint32Array]} />);
        i++;
      }
    });
    return { meshes, colliders };
  }, [sceneText, id]);

  return (
    <RigidBody type="fixed" position={position} rotation={rotation} userData={{ id, type: 'LogoTrack' }} friction={defaults.trackFriction} >
      {processedBack.meshes}
      {processedBack.colliders}
      {processedText.meshes}
      {processedText.colliders}
      <rectAreaLight
        ref={rectAreaLightRef}
        color={new THREE.Color("#d8d8ff")}
        intensity={0} // initial, controlled by useEffect
        width={7.88} height={2.03}
        position={[0.375, 0, 0]} // Relative to RigidBody. Original was on group.
        // Original: areaLight.rotateY(-Math.PI / 2); areaLight.position.x = 0.375; group.add(areaLight);
        // Assuming default RectAreaLight in R3F points along -Z (away from viewer in default view).
        // Rotating it -PI/2 around Y makes it point along +X.
        // So, its light would shine in the +X direction of the LogoTrack component.
        rotation-y={-Math.PI / 2}
      />
    </RigidBody>
  );
};
