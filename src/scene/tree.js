import * as THREE from 'three';
import { palette } from './art-direction.js';

// Rounded, closed profile with a gently scalloped edge, shared by all tiers.
function createBoughGeometry() {
  const curve = new THREE.SplineCurve([
    new THREE.Vector2(0, -.16), new THREE.Vector2(.48, -.15),
    new THREE.Vector2(.91, -.09), new THREE.Vector2(1, .02),
    new THREE.Vector2(.9, .14), new THREE.Vector2(.66, .3),
    new THREE.Vector2(.39, .52), new THREE.Vector2(.15, .73),
    new THREE.Vector2(.04, .8), new THREE.Vector2(0, .82),
  ]);
  const profile = curve.getPoints(28);
  profile.forEach(point => { point.x = Math.max(0, point.x); });
  const geometry = new THREE.LatheGeometry(profile, 48);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), z = positions.getZ(i);
    const angle = Math.atan2(z, x);
    const ripple = 1 + .025 * Math.cos(angle * 7) + .012 * Math.sin(angle * 3);
    positions.setXYZ(i, x * ripple / 1.037, positions.getY(i), z * ripple / 1.037);
  }
  geometry.computeVertexNormals();
  return geometry;
}

// Local coordinates keep this content independent of the camera / future AR anchor.
export function createTree() {
  const root = new THREE.Group();
  const layers = [];
  const animated = [];
  const foliage = [palette.sage, palette.foliageShade].map(color => new THREE.MeshStandardMaterial({ color, roughness: .86, metalness: .02 }));
  const boughGeometry = createBoughGeometry();
  const gold = new THREE.MeshStandardMaterial({ color: palette.champagne, metalness: .65, roughness: .34 });
  const ornamentMaterials = [gold,
    new THREE.MeshStandardMaterial({ color: palette.rose, metalness: .18, roughness: .52 }),
    new THREE.MeshStandardMaterial({ color: palette.ivory, metalness: .08, roughness: .38 }),
  ];
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.13, .2, .7, 24), new THREE.MeshStandardMaterial({ color: palette.trunk, roughness: .95 }));
  trunk.position.y = .45;
  root.add(trunk);
  // Preserve tier origins and scale animation while softening the silhouette.
  for (let tier = 0; tier < 9; tier++) {
    const y = .65 + tier * .34;
    const radius = 1.48 * (1 - tier / 10);
    const layer = new THREE.Group();
    layer.position.y = y;
    const core = new THREE.Mesh(boughGeometry, foliage[tier % 3 === 1 ? 1 : 0]);
    core.scale.set(radius, 1, radius);
    core.rotation.y = tier * .52;
    layer.add(core);
    root.add(layer);
    layers.push(layer);
  }
  const sphere = new THREE.SphereGeometry(.085, 24, 16);
  for (let i = 0; i < 48; i++) {
    const y = .65 + (i / 48) * 2.9;
    const radius = 1.54 * (1 - (y - .5) / 3.75);
    const angle = i * 2.39996;
    const ornament = new THREE.Mesh(sphere, ornamentMaterials[i % 5 === 0 ? 1 : i % 5 === 1 ? 2 : 0]);
    ornament.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
    root.add(ornament);
    animated.push(ornament);
  }
  const bulbs = [];
  const bulbGeometry = new THREE.SphereGeometry(.035, 7, 5);
  const wirePoints = [];
  for (let i = 0; i < 100; i++) {
    const t = i / 99;
    const y = .7 + t * 3.05;
    const radius = 1.53 * (1 - t * .92);
    const angle = t * Math.PI * 2 * 5;
    const position = new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
    wirePoints.push(position);
    const material = new THREE.MeshBasicMaterial({ color: palette.unlit });
    const bulb = new THREE.Mesh(bulbGeometry, material);
    bulb.position.copy(position);
    root.add(bulb);
    bulbs.push(bulb);
  }
  const wire = new THREE.Line(new THREE.BufferGeometry().setFromPoints(wirePoints), new THREE.LineBasicMaterial({ color: palette.wire, transparent: true, opacity: .4 }));
  root.add(wire);
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const angle = Math.PI / 2 + i * Math.PI / 5;
    const radius = i % 2 === 0 ? .29 : .125;
    const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  shape.closePath();
  const starMaterial = new THREE.MeshStandardMaterial({ color: palette.champagne, metalness: .5, roughness: .36, emissive: palette.champagne, emissiveIntensity: 0 });
  const star = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: .09, bevelEnabled: true, bevelSize: .025, bevelThickness: .025, bevelSegments: 4, steps: 1 }), starMaterial);
  star.position.set(0, 4.02, 0);
  root.add(star);
  animated.push(star);
  const pedestal = new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(0, -.06), new THREE.Vector2(1.68, -.06), new THREE.Vector2(1.75, -.04), new THREE.Vector2(1.78, 0), new THREE.Vector2(1.75, .04), new THREE.Vector2(1.68, .06), new THREE.Vector2(0, .06)], 64), new THREE.MeshStandardMaterial({ color: palette.pedestal, metalness: .22, roughness: .65 }));
  pedestal.position.y = .02;
  root.add(pedestal);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.73, .012, 6, 64), gold);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = .08;
  root.add(rim);
  return { root, bulbs, starMaterial, layers, animated, trunk, wire };
}
