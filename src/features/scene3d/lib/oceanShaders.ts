/** Small procedural shaders: no downloaded textures or post-processing passes. */
export const OCEAN_VERTEX = `
precision highp float;
attribute vec3 position;
uniform mat4 worldViewProjection;
uniform mat4 world;
varying vec3 vWorld;
varying vec3 vDirection;
void main(void) {
  vWorld = (world * vec4(position, 1.0)).xyz;
  vDirection = normalize(position);
  gl_Position = worldViewProjection * vec4(position, 1.0);
}`

/** Render the background at far depth, including during close-up camera clipping. */
export const SKY_VERTEX = `
precision highp float;
attribute vec3 position;
uniform mat4 worldViewProjection;
varying vec3 vDirection;
void main(void) {
  vDirection = normalize(position);
  vec4 clip = worldViewProjection * vec4(position, 1.0);
  gl_Position = vec4(clip.xy, clip.w * 0.999999, clip.w);
}`

export const SKY_FRAGMENT = `
precision highp float;
varying vec3 vDirection;
uniform vec3 zenithColor;
uniform vec3 horizonColor;
uniform vec3 sunColor;
uniform vec3 hazeColor;
uniform float underwater;
uniform float clock;
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5453);
  float b = fract(sin(dot(i + vec2(1.0, 0.0), vec2(127.1, 311.7))) * 43758.5453);
  float c = fract(sin(dot(i + vec2(0.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
  float d = fract(sin(dot(i + vec2(1.0), vec2(127.1, 311.7))) * 43758.5453);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
void main(void) {
  vec3 d = normalize(vDirection);
  float elevation = max(d.y, 0.0);
  vec3 color = mix(horizonColor, zenithColor, pow(elevation, 0.55));
  vec2 uv = d.xz / (0.2 + elevation) * 3.0 + vec2(clock * 0.003, 0.0);
  float cloud = noise(uv) * 0.56 + noise(uv * 2.1) * 0.28 + noise(uv * 4.3) * 0.16;
  float veil = smoothstep(0.51, 0.76, cloud) * smoothstep(0.02, 0.22, d.y);
  color = mix(color, sunColor, veil * 0.78);
  float sun = max(0.0, dot(d, normalize(vec3(-0.42, 0.76, 0.49))));
  color += sunColor * (pow(sun, 480.0) * 0.7 + pow(sun, 14.0) * 0.18);
  color = mix(color, hazeColor, (1.0 - smoothstep(-0.65, 0.02, d.y)));
  color = mix(color, mix(hazeColor, horizonColor, 0.3 + elevation * 0.3), underwater * 0.65);
  gl_FragColor = vec4(color, 1.0);
}`

export const WATER_FRAGMENT = `
precision highp float;
varying vec3 vWorld;
uniform vec3 cameraPosition;
uniform vec3 waterColor;
uniform vec3 glintColor;
uniform vec3 oceanCenter;
uniform vec3 oceanSize;
uniform float clock;
void main(void) {
  vec2 p = (vWorld.xz - oceanCenter.xz) / max(oceanSize.z, 1.0);
  float a = sin(p.x * 90.0 + p.y * 37.0 + clock * 0.32);
  float b = cos(p.y * 108.0 - p.x * 24.0 - clock * 0.27);
  float c = sin(p.x * 233.0 + p.y * 197.0 + clock * 0.43);
  vec3 view = normalize(cameraPosition - vWorld);
  float above = step(oceanCenter.y, cameraPosition.y);
  // Fade unresolved wave detail at grazing angles and in the distance.
  // Underwater gets a softer underside, without white foam striping.
  float detail = smoothstep(0.08, 0.45, abs(view.y))
    * (1.0 - smoothstep(8000.0, 40000.0, distance(cameraPosition, vWorld)))
    * mix(0.25, 1.0, above);
  vec3 normal = normalize(vec3((a * 0.10 + c * 0.025) * detail, 1.0, b * 0.10 * detail));
  float fresnel = pow(1.0 - abs(dot(view, normal)), 3.0);
  float shimmer = pow(max(0.0, a * b), 7.0) * detail;
  vec3 sunDirection = normalize(vec3(-0.42, 0.76, 0.49));
  float specular = pow(max(0.0, dot(reflect(-sunDirection, normal), view)), 80.0) * detail;
  float foam = smoothstep(0.94, 1.0, a * b) * (0.4 + 0.6 * c * c) * detail * above;
  vec2 edge = abs(vWorld.xz - oceanCenter.xz) / oceanSize.xy;
  float fade = 1.0 - smoothstep(0.72, 1.0, max(edge.x, edge.y));
  vec3 color = mix(waterColor, glintColor, clamp(fresnel * mix(0.22, 0.62, above) + shimmer * 0.3 + foam * 0.28, 0.0, 1.0));
  color += glintColor * specular * 0.6;
  float alpha = (0.20 + fresnel * 0.23 + shimmer * 0.07 + specular * 0.12) * fade;
  gl_FragColor = vec4(color, alpha);
}`
