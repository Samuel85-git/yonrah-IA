import {
  BackSide,
  DataTexture,
  MeshBasicMaterial,
  MeshStandardMaterial,
  MeshToonMaterial,
  NearestFilter,
  RedFormat,
} from "three";

/** Four cel-shading bands retain the source texture's embroidery and skin colours. */
export function animeRamp() {
  const ramp = new DataTexture(
    new Uint8Array([90, 155, 215, 255]),
    4,
    1,
    RedFormat,
  );
  ramp.minFilter = ramp.magFilter = NearestFilter;
  ramp.generateMipmaps = false;
  ramp.needsUpdate = true;
  return ramp;
}
export function animeMaterial(
  source: MeshStandardMaterial,
  ramp: DataTexture,
  meshName = "",
) {
  const material = new MeshToonMaterial({
    color: source.color,
    map: source.map,
    gradientMap: ramp,
    alphaMap: source.alphaMap,
    alphaTest: source.alphaTest,
    transparent: source.transparent,
    opacity: source.opacity,
    side: source.side,
    // Painted textures already carry detail; avoid noisy PBR normal/specular highlights.
  });
  const hair = /Hair_Top|Hair_center/.test(meshName);
  if (hair) {
    material.map = null;
    material.color.set("#eee9df");
  }
  if (source.name === "Clorh") {
    material.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <map_fragment>",
        "#include <map_fragment>\ndiffuseColor.rgb = max(diffuseColor.rgb, vec3(0.025, 0.029, 0.038));",
      );
    };
    material.customProgramCacheKey = () => "yorha-anime-cloth-v1";
  }
  material.name = source.name;
  if (material.map) material.map.anisotropy = 4;
  return material;
}
export function animeOutline() {
  const material = new MeshBasicMaterial({ color: "#25212f", side: BackSide });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\ntransformed += normalize(objectNormal) * 0.12;",
    );
  };
  material.customProgramCacheKey = () => "yorha-anime-outline-v1";
  material.toneMapped = false;
  return material;
}
