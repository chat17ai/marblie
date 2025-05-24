// src/marble/tracks/LightCube.tsx
import React, { useMemo, useRef, useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import { RigidBody, TrimeshCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { trackMaterials, getModelPath } from '../trackData';
import { defaults } from '../config';
import gsap from 'gsap';

interface LightCubeProps {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number];
  isLit?: boolean;
}

export const LightCube: React.FC<LightCubeProps> = ({ id, position, rotation, isLit = false }) => {
  const modelPathBase = getModelPath('LightCubeBase');
  const modelPathCube = getModelPath('LightCube');

  const { scene: sceneBase } = useGLTF(modelPathBase!);
  const { scene: sceneCube } = useGLTF(modelPathCube!);

  const baseMaterial = useMemo(() => trackMaterials.lightCubeBase(), []);
  // Clone material for unique animation targets
  const cubeMaterialRef = useRef(trackMaterials.lightCubeMain().clone());
  const pointLightRef = useRef<THREE.PointLight>(null);

  useEffect(() => {
    const targetIntensity = isLit ? 10 : 0; // Original intensity was 10
    const targetEmissiveIntensity = isLit ? 0.8 : 0; // Original
    const targetVisibility = isLit;

    if (pointLightRef.current) {
      gsap.to(pointLightRef.current, { intensity: targetIntensity, duration: 0.5 });
    }
    gsap.to(cubeMaterialRef.current, { emissiveIntensity: targetEmissiveIntensity, duration: 0.5, onUpdate: () => {
        // GSAP might not directly animate 'visible', handle via onUpdate or separate state
        cubeMaterialRef.current.visible = targetVisibility;
    }});
    // Ensure material is updated if GSAP doesn't force rerender
    if (cubeMaterialRef.current.visible !== targetVisibility) {
         cubeMaterialRef.current.visible = targetVisibility;
         // This might require forcing an update if R3F doesn't pick up material property change
    }

  }, [isLit]);

  const processedBase = useMemo(() => { /* ... standard GLTF processing for base ... */ 
    const meshes: JSX.Element[] = []; const colliders: JSX.Element[] = []; let i=0;
    sceneBase.traverse(child => {
      if (child instanceof THREE.Mesh) {
        const geom = child.geometry.clone();
        if (!geom.attributes.position || !geom.index) return;
        meshes.push(<mesh key={`${id}-base-${i}`} geometry={geom} material={baseMaterial} castShadow receiveShadow />);
        colliders.push(<TrimeshCollider key={`${id}-base-col-${i}`} args={[geom.attributes.position.array as Float32Array, geom.index.array as Uint32Array]} />);
        i++;
      }
    });
    return { meshes, colliders };
  }, [sceneBase, id, baseMaterial]);

  const processedCube = useMemo(() => { /* ... standard GLTF processing for cube ... */ 
    const meshes: JSX.Element[] = []; const colliders: JSX.Element[] = []; let i=0;
    sceneCube.traverse(child => {
      if (child instanceof THREE.Mesh) {
        const geom = child.geometry.clone();
        if (!geom.attributes.position || !geom.index) return;
        // Apply the animated material
        meshes.push(<mesh key={`${id}-cube-${i}`} geometry={geom} material={cubeMaterialRef.current} castShadow receiveShadow />);
        colliders.push(<TrimeshCollider key={`${id}-cube-col-${i}`} args={[geom.attributes.position.array as Float32Array, geom.index.array as Uint32Array]} />);
        i++;
      }
    });
    return { meshes, colliders };
  }, [sceneCube, id]);
  
  return (
    <RigidBody type="fixed" position={position} rotation={rotation} userData={{ id, type: 'LightCube' }} friction={defaults.trackFriction}>
      {processedBase.meshes}
      {processedBase.colliders}
      {processedCube.meshes}
      {processedCube.colliders}
      <pointLight
        ref={pointLightRef}
        color={new THREE.Color("#d8d8ff")} // Original color
        intensity={0} // Initial, controlled by useEffect
        // distance, decay? Original just had intensity 10.
        position={[3, 0, 0]} // Original: areaLight.position.x = 3; areaLight.rotateX(Math.PI / 2); group.add(areaLight);
                            // This needs to be relative to the RigidBody.
                            // If light was rotated X by PI/2, it pointed "down" Y if it started along Z.
                            // Then positioned at x=3.
        // rotation-x={Math.PI / 2} // If pointlight has orientation (it doesn't, but for consistency if it were a spot)
      />
    </RigidBody>
  );
};
