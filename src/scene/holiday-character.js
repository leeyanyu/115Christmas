import * as THREE from 'three';

// View-facing diffuse fill belongs only to these materials. Global lights,
// foliage shadows, and the tree's warm glow never need to change.
export function characterMaterial(options) {
  const material = new THREE.MeshStandardMaterial(options);
  const fill = new THREE.Color(0xffe2c0).multiplyScalar(.65);
  material.onBeforeCompile = shader => {
    shader.uniforms.characterFill = { value: fill };
    shader.fragmentShader = `uniform vec3 characterFill;\n${shader.fragmentShader}`.replace(
      '#include <lights_fragment_end>',
      '#include <lights_fragment_end>\nreflectedLight.indirectDiffuse += diffuseColor.rgb * characterFill * (0.3 + 0.7 * max(normal.z, 0.0));',
    );
  };
  material.customProgramCacheKey = () => 'holiday-character-fill-v1';
  return material;
}

export function createHolidayCharacter(kind = 'gingerbread') {
  const candy = kind === 'candy-cane';
  const cookie = characterMaterial({ color: candy ? 0xffffff : 0xd1a16a, roughness: candy ? .4 : .8 });
  const icing = characterMaterial({ color: candy ? 0x654536 : 0xffedd0, roughness: .65 });
  const pink = characterMaterial({ color: 0xcc8990, roughness: .7 });
  const ribbon = characterMaterial({ color: candy ? 0x8bb8a3 : 0xcc8990, roughness: .7 });
  const sphere = new THREE.SphereGeometry(1, 24, 16);
  const root = new THREE.Group(); root.name = candy ? 'hidden-candy-cane' : 'hidden-gingerbread';
  root.userData.holidayCharacter = kind;
  function ball(material, x, y, z, sx, sy = sx, sz = sx) {
    const mesh = new THREE.Mesh(sphere, material); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); root.add(mesh); return mesh;
  }
  let body, stripes;
  if (candy) {
    const curve = new THREE.CatmullRomCurve3([
      [-.12, -.35], [-.12, .14], [-.12, .29], [-.04, .40], [.10, .40], [.20, .31], [.20, .18],
    ].map(([x, y]) => new THREE.Vector3(x, y, 0)));
    body = new THREE.TubeGeometry(curve, 80, .072, 12, false);
    // TubeGeometry has open ends; rounded candy caps close both tips.
    const data = new Uint8Array(128 * 32 * 4);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 128; x++) {
      const color = (x + y * .5) % 16 < 6 ? [179, 95, 104] : [246, 234, 210];
      data.set([...color, 255], (y * 128 + x) * 4);
    }
    stripes = new THREE.DataTexture(data, 128, 32);
    stripes.colorSpace = THREE.SRGBColorSpace;
    stripes.wrapS = stripes.wrapT = THREE.RepeatWrapping;
    stripes.magFilter = THREE.LinearFilter; stripes.needsUpdate = true; cookie.map = stripes;
    root.add(new THREE.Mesh(body, cookie));
    const tip = characterMaterial({ color: 0xf6ead2, roughness: .4 });
    ball(tip, -.12, -.35, 0, .072); ball(tip, .20, .18, 0, .072);
    for (const side of [-1, 1]) ball(icing, -.12 + side * .027, .11, .071, .012, .016, .009);
    const smile = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-.15, .058, .073), new THREE.Vector3(-.12, .025, .079), new THREE.Vector3(-.09, .058, .073));
    root.add(new THREE.Mesh(new THREE.TubeGeometry(smile, 12, .006, 6, false), icing));
    ball(ribbon, -.15, -.075, .07, .04, .023, .012); ball(ribbon, -.09, -.075, .07, .04, .023, .012);
    ball(ribbon, -.12, -.075, .08, .016);
  } else {
    const outline = new THREE.Shape();
    outline.moveTo(0, .47);
    outline.bezierCurveTo(.17, .47, .23, .29, .10, .19);
    outline.bezierCurveTo(.13, .16, .16, .16, .19, .20);
    outline.bezierCurveTo(.26, .29, .32, .31, .36, .25);
    outline.bezierCurveTo(.42, .17, .31, .12, .22, .06);
    outline.bezierCurveTo(.16, .02, .15, -.02, .16, -.10);
    outline.bezierCurveTo(.17, -.17, .23, -.28, .19, -.35);
    outline.bezierCurveTo(.16, -.42, .07, -.43, .035, -.35);
    outline.bezierCurveTo(.01, -.29, .02, -.23, 0, -.22);
    outline.bezierCurveTo(-.02, -.23, -.01, -.29, -.035, -.35);
    outline.bezierCurveTo(-.07, -.43, -.16, -.42, -.19, -.35);
    outline.bezierCurveTo(-.23, -.28, -.17, -.17, -.16, -.10);
    outline.bezierCurveTo(-.15, -.02, -.16, .02, -.22, .06);
    outline.bezierCurveTo(-.31, .12, -.42, .17, -.36, .25);
    outline.bezierCurveTo(-.32, .31, -.26, .29, -.19, .20);
    outline.bezierCurveTo(-.16, .16, -.13, .16, -.10, .19);
    outline.bezierCurveTo(-.23, .29, -.17, .47, 0, .47);
    outline.closePath();
    body = new THREE.ExtrudeGeometry(outline, { depth: .09, bevelEnabled: true, bevelSize: .025, bevelThickness: .025, bevelSegments: 5, curveSegments: 20, steps: 1 });
    body.translate(0, 0, -.045); root.add(new THREE.Mesh(body, cookie));
    for (const side of [-1, 1]) {
      ball(icing, side * .055, .33, .075, .017, .021, .012);
      ball(pink, side * .085, .275, .074, .022, .013, .009);
    }
    const smile = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-.055, .275, .076), new THREE.Vector3(0, .22, .083), new THREE.Vector3(.055, .275, .076));
    root.add(new THREE.Mesh(new THREE.TubeGeometry(smile, 20, .009, 8, false), icing));
    ball(ribbon, -.035, .14, .08, .044, .026, .012); ball(ribbon, .035, .14, .08, .044, .026, .012);
    ball(ribbon, 0, .14, .09, .018);
    ball(icing, 0, .04, .075, .019); ball(icing, 0, -.04, .075, .019);
  }
  // Lightly baked, golden crisp, and deep toasted; every palette stays brown.
  const colors = [[0xd1a16a, 0xcc8990], [0xb77b45, 0x8bb8a3], [0x825032, 0xd8ba76]];
  return {
    root, body,
    dress(index) { if (!candy) cookie.color.setHex(colors[index % colors.length][0]); ribbon.color.setHex(colors[index % colors.length][1]); },
    dispose() {
      const geometries = new Set(), materials = new Set([cookie, icing, pink, ribbon]);
      root.traverse(o => { if (o.geometry) geometries.add(o.geometry); if (o.material) materials.add(o.material); });
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); stripes?.dispose();
    },
  };
}
