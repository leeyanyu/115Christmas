import * as THREE from 'three';

// Transparent pools on one world-space ground plane provide contact and scale
// cues without covering the invitation's continuous midnight-blue background.
export function createDepthStage(scene, backdrop = scene) {
  const root = new THREE.Group(), rear = new THREE.Group(); root.name = 'diy-spatial-ground'; scene.add(root); backdrop.add(rear);
  const geometry = new THREE.PlaneGeometry(1, 1);
  function patch(color, opacity, sharpness) {
    const material = new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
      uniforms: { tint: { value: new THREE.Color(color) }, opacity: { value: opacity }, sharpness: { value: sharpness } },
      vertexShader: 'varying vec2 p; void main(){p=uv-.5;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'varying vec2 p; uniform vec3 tint; uniform float opacity; uniform float sharpness; void main(){float r=length(p)*2.;float a=exp(-r*r*sharpness)*(1.-smoothstep(.65,1.,r))*opacity;gl_FragColor=vec4(tint,a);#include <tonemapping_fragment>\n#include <colorspace_fragment>}',
    });
    // Shader chunks must begin on their own line.
    material.fragmentShader = material.fragmentShader.replace(';#include', ';\n#include');
    const mesh = new THREE.Mesh(geometry, material); mesh.rotation.x = -Math.PI / 2; mesh.position.y = -.043; root.add(mesh); return mesh;
  }
  const foregroundPool = patch(0x52727a, .10, 1.8); foregroundPool.scale.set(15, 22, 1); foregroundPool.position.y = -.046;
  const rearPool = patch(0x71868b, .12, 1.8); rearPool.scale.set(10, 14, 1); rearPool.position.y = -.046;
  const foregroundContact = patch(0x020912, .28, 3.2); foregroundContact.scale.set(4.3, 4.3, 1);
  const rearContact = patch(0x07101a, .30, 3.2); rearContact.scale.set(4.3, 4.3, 1);
  rear.add(rearPool, rearContact);
  return {
    update(ready, front, rear, rearVisible) {
      root.visible = ready; rear.visible = ready;
      foregroundContact.position.x = front.x; foregroundContact.position.z = front.z;
      rearContact.position.x = rear.x; rearContact.position.z = rear.z; rearContact.visible = rearVisible;
      rearPool.position.x = rear.x; rearPool.position.z = rear.z; rearPool.visible = rearVisible;
    },
    dispose() { scene.remove(root); backdrop.remove(rear); geometry.dispose(); [...root.children, ...rear.children].forEach(o => o.material.dispose()); },
  };
}
