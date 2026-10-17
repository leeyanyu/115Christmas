import * as THREE from 'three';

// Tiny, rounded figures. Geometry is shared; each figure owns its colors so its
// transformation can fade independently without changing the tree's lighting.
export function createLittleAngels(colors) {
  const sphere = new THREE.SphereGeometry(1, 12, 8);
  const capsule = new THREE.CapsuleGeometry(.15, .24, 3, 8);
  const halo = new THREE.TorusGeometry(.18, .014, 5, 24);
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(.05, .25, .32, .5, .58, .45);
  shape.bezierCurveTo(.7, .28, .54, .01, .32, -.1);
  shape.bezierCurveTo(.16, -.16, .03, -.08, 0, 0);
  const wing = new THREE.ExtrudeGeometry(shape, { depth: .035, bevelEnabled: true,
    bevelSize: .018, bevelThickness: .012, bevelSegments: 2, curveSegments: 10, steps: 1 });
  const materials = [];
  function material(color, glow = .08) {
    const value = new THREE.MeshStandardMaterial({ color, roughness: .8, metalness: 0,
      emissive: color, emissiveIntensity: glow, transparent: true });
    materials.push(value); return value;
  }
  const characters = colors.map(color => {
    const root = new THREE.Group();
    const clothes = material(color), skin = material(0xe7ba98, .2);
    const hair = material(0x574037), ivory = material(0xf4e9d9, .15);
    const gold = material(0xeacb94, .35), eyes = material(0x372c29);
    const ownMaterials = [clothes, skin, hair, ivory, gold, eyes];
    function ball(x, y, z, sx, sy, sz, surface) {
      const mesh = new THREE.Mesh(sphere, surface);
      mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); root.add(mesh); return mesh;
    }
    const body = new THREE.Mesh(capsule, clothes);
    body.position.y = .43; root.add(body);
    ball(0, .82, 0, .18, .19, .16, skin);
    ball(0, .91, -.025, .185, .105, .15, hair);
    ball(-.057, .83, .151, .018, .02, .012, eyes);
    ball(.057, .83, .151, .018, .02, .012, eyes);
    ball(0, .755, .151, .035, .011, .012, ivory);
    for (const side of [-1, 1]) {
      ball(side * .09, .12, 0, .063, .12, .06, ivory);
      ball(side * .1, .035, .035, .078, .035, .095, clothes);
      ball(side * .2, .43, 0, .065, .17, .063, clothes);
      ball(side * .22, .29, .015, .058, .06, .055, skin);
    }
    const wings = new THREE.Group(); wings.name = 'angel-wings';
    const pivots = [-1, 1].map(side => {
      const pivot = new THREE.Group(), mesh = new THREE.Mesh(wing, ivory);
      pivot.position.set(side * .12, .56, -.08); mesh.scale.x = side;
      pivot.add(mesh); wings.add(pivot); return pivot;
    });
    root.add(wings);
    const ring = new THREE.Mesh(halo, gold); ring.name = 'angel-halo';
    ring.position.y = 1.12; ring.rotation.x = 1.05; root.add(ring);
    const original = new THREE.Color(color), white = new THREE.Color(0xf4e9d9);
    function pose(progress, opacity = 1, reducedMotion = false) {
      wings.visible = ring.visible = progress > 0;
      wings.scale.setScalar(Math.max(.001, THREE.MathUtils.smoothstep(progress, 0, .22)));
      clothes.color.copy(original).lerp(white, Math.min(.5, progress * 2));
      pivots.forEach((pivot, index) => {
        pivot.rotation.y = (index ? 1 : -1) * (reducedMotion ? .15 : Math.sin(progress * Math.PI * 12) * .45);
      });
      ownMaterials.forEach(surface => { surface.opacity = opacity; });
    }
    pose(0);
    return { root, pose };
  });
  return {
    characters,
    dispose() {
      characters.forEach(character => character.root.removeFromParent());
      [sphere, capsule, halo, wing].forEach(geometry => geometry.dispose());
      materials.forEach(surface => surface.dispose());
    },
  };
}
