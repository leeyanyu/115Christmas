import * as THREE from 'three';

// Accept horizontal surfaces only. The matrix stays in the XR reference space,
// so the tree remains in the room when the viewer moves the phone.
export function readFloorHit(frame, source, space, matrix) {
  for (const result of frame.getHitTestResults(source)) {
    const pose = result.getPose(space);
    if (!pose || pose.transform.matrix[5] < .75) continue;
    matrix.fromArray(pose.transform.matrix); return true;
  }
  return false;
}

export function placeSpatialTree(tree, matrix, cameraPosition) {
  tree.position.setFromMatrixPosition(matrix);
  tree.rotation.set(0, Math.atan2(cameraPosition.x - tree.position.x, cameraPosition.z - tree.position.z), 0);
  tree.visible = true;
}

export function spatialScale(value) { return THREE.MathUtils.clamp(value, .35, 1.8); }
