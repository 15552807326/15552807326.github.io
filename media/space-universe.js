/**
 * A small, self-contained planet fly-in. No textures, tracking or network work.
 * Time is owned by the caller; this renderer never schedules animation frames.
 */
export function createUniverse(canvas) {
  const gl = canvas.getContext('webgl2', {
    alpha: false, antialias: false, depth: false, stencil: false,
    premultipliedAlpha: false, preserveDrawingBuffer: false,
    powerPreference: 'low-power',
  });
  if (!gl) throw new Error('Space entrance requires WebGL 2.');

  const vertexSource = `#version 300 es
  precision highp float;
  void main() {
    vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
    gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
  }`;

  const fragmentSource = `#version 300 es
  precision highp float;
  uniform vec2 uResolution;
  uniform float uTime;
  out vec4 fragColor;

  float hash13(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }
  vec3 hash23(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yxz + 33.33);
    return fract((p3.xxy + p3.yzz) * p3.zyx);
  }
  float noise3(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash13(i), hash13(i + vec3(1,0,0)), f.x),
                   mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), f.x),
                   mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  const mat3 terrainRotation = mat3(0.00,0.80,0.60, -0.80,0.36,-0.48, -0.60,-0.48,0.64);
  float terrain(vec3 p) {
    float sum = 0.0, amp = 0.55;
    for (int i = 0; i < 5; i++) {
      sum += amp * noise3(p);
      p = terrainRotation * p * 2.08 + 12.37;
      amp *= 0.48;
    }
    return sum;
  }
  float ease(float a, float b, float t) { return smoothstep(a, b, t); }
  mat3 spin(float a) {
    float s = sin(a), c = cos(a);
    return mat3(c,0,-s, 0,1,0, s,0,c);
  }

  // Points live on three different world-space depth planes, not a flat star image.
  vec3 starPlane(vec3 ro, vec3 rd, float depth, float cellSize, float seed) {
    float distanceToPlane = (-depth - ro.z) / rd.z;
    vec2 p = (ro + rd * distanceToPlane).xy / cellSize;
    vec2 cell = floor(p), local = fract(p);
    // Derivatives inside the hit/miss branch are undefined at a planet's edge.
    // An analytic projected pixel size avoids white, broken star rings there.
    float footprint = max(2.3*distanceToPlane/(min(uResolution.x,uResolution.y)*1.9*cellSize),0.00001);
    vec3 light = vec3(0.0);
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 neighbour = vec2(float(x), float(y));
        vec3 random = hash23(cell + neighbour + seed);
        vec2 delta = neighbour + random.xy - local;
        float d = length(delta);
        float rare = pow(random.z, 15.0);
        float radius = max(0.0013 + rare * 0.004, footprint * 0.34);
        float core = exp(-d*d / (radius*radius));
        float halo = exp(-d / max(radius*3.2, footprint)) * 0.065;
        float brightness = 0.14 + pow(random.z, 5.0) * 1.7;
        vec3 tint = mix(vec3(0.47,0.67,1.0), vec3(1.0,0.86,0.67), random.x);
        light += tint * (core + halo) * brightness;
      }
    }
    return light;
  }

  vec3 sky(vec3 ro, vec3 rd, vec2 uv, float t) {
    vec3 color = vec3(0.0013,0.0022,0.0050);
    float dust = terrain(rd * 4.1 + vec3(2.0,0.0,0.0));
    float cloud = pow(max(dust - 0.25, 0.0), 3.0);
    color += vec3(0.010,0.023,0.049) * cloud;
    color += starPlane(ro, rd, 14.0, 3.1, 11.2);
    color += starPlane(ro, rd, 43.0, 5.3, 43.8) * 0.75;
    color += starPlane(ro, rd, 95.0, 7.8, 79.4) * 0.55;

    // A distant warm stellar glint contrasts with the cold atmosphere.
    vec3 sunDirection = normalize(vec3(-0.64,0.32,-1.0));
    float sunAngle = length(rd - sunDirection);
    float sun = 0.000020 / (sunAngle*sunAngle + 0.000045);
    color += vec3(1.0,0.62,0.26) * sun;
    float shimmer = exp(-sunAngle*sunAngle / 0.000027);
    color += vec3(1.8,1.30,0.68) * shimmer;
    return color;
  }

  // Crater relief and its analytic tangent-space gradient. This is a surface
  // material, not displaced geometry, so the planetary silhouette stays smooth.
  vec3 craters(vec2 p) {
    vec2 cell=floor(p), f=fract(p);
    vec3 field=vec3(0.0);
    for (int y=-1;y<=1;y++) for (int x=-1;x<=1;x++) {
      vec2 neighbour=vec2(float(x),float(y));
      vec3 random=hash23(cell+neighbour+41.8);
      vec2 delta=f-neighbour-random.xy;
      float radius=mix(0.17,0.43,random.z);
      float d=max(length(delta),0.0001), q=d/radius;
      if (q<1.7) {
        float s=clamp(q/0.88,0.0,1.0);
        float rim=0.018*exp(-pow((q-0.99)*8.0,2.0));
        float height=-0.060*(1.0-s*s*(3.0-2.0*s))+rim;
        float slope=(0.060*6.0*s*(1.0-s)/0.88-rim*128.0*(q-0.99))/radius;
        field+=vec3(height,delta/d*slope);
      }
    }
    return field;
  }

  vec3 planetSurface(vec3 p, vec3 ro, vec3 rd, float t) {
    vec3 normal = normalize(p);
    mat3 rotation = spin(t * 0.044 - 0.15);
    vec3 land = rotation * normal;
    float height = terrain(land * 8.0 + 2.3);
    float strata = terrain(land * 47.0 + height * 2.0);
    float grain = noise3(land*245.0);
    float mineral = smoothstep(0.27,0.74,height);
    vec3 albedo = mix(vec3(0.095,0.125,0.160),vec3(0.25,0.285,0.32),mineral);
    albedo *= 0.72+strata*0.46+grain*0.20;
    vec2 spherical=vec2(atan(land.x,land.z),asin(clamp(land.y,-1.0,1.0)));
    vec3 crater=craters(spherical*12.0);
    albedo*=1.0+crater.x*1.7;

    // Small-scale finite differences supply lighting relief without silhouette popping.
    vec3 terrainPoint = land * 56.0;
    float centre = noise3(terrainPoint);
    vec3 gradient = vec3(noise3(terrainPoint+vec3(0.13,0,0)),
                         noise3(terrainPoint+vec3(0,0.13,0)),
                         noise3(terrainPoint+vec3(0,0,0.13))) - centre;
    gradient = transpose(rotation) * gradient;
    gradient -= normal * dot(gradient,normal);
    vec3 tangentU=normalize(vec3(land.z,0.0,-land.x)+vec3(0.00001,0,0));
    vec3 tangentV=normalize(cross(land,tangentU));
    vec3 craterGradient=transpose(rotation)*(tangentU*crater.y+tangentV*crater.z);
    vec3 reliefNormal = normalize(normal - gradient * 0.45-craterGradient*0.29);
    // The warm key is exactly the direction of the visible distant star.
    vec3 key = normalize(vec3(-0.64,0.32,-1.0));
    float illumination = max(dot(reliefNormal,key),0.0);
    float day = smoothstep(-0.16,0.25,dot(normal,key));
    float fill=max(dot(reliefNormal,normalize(vec3(-0.30,0.48,0.87))),0.0);
    vec3 color = albedo * (vec3(0.010,0.018,0.030)+fill*vec3(0.17,0.25,0.34)+illumination*vec3(1.65,1.26,0.90));
    float rim = pow(1.0 - max(dot(normal,-rd),0.0),3.4);
    color += vec3(0.12,0.32,0.56) * rim * day * 0.34;
    color += vec3(0.007,0.019,0.040) * rim;
    vec3 halfVector = normalize(key-rd);
    float sheen = pow(max(dot(reliefNormal,halfVector),0.0),36.0);
    color += vec3(0.39,0.45,0.52) * sheen * mineral * 0.09;
    return color;
  }

  // An irregular, three-dimensional neighbourhood around the flight corridor.
  // Near moons pass the camera; larger, much more distant worlds remain in the sky.
  const int WORLD_COUNT = 11;
  const vec4 worlds[WORLD_COUNT] = vec4[WORLD_COUNT](
    vec4(-4.8,  3.7, 13.0, 1.05),
    vec4( 6.2, -3.4, 10.0, 1.35),
    vec4(-7.7, -4.5,  2.0, 1.75),
    vec4( 8.2,  5.9, -4.0, 2.20),
    vec4(-12.0, 8.9,-13.0, 2.75),
    vec4(14.8, -7.7,-18.0, 2.50),
    vec4(-14.0,-10.5,-28.0,1.95),
    vec4( 3.1,  9.8,  5.0,0.65),
    vec4( 1.0,-10.0, -5.0,1.15),
    vec4(19.0,  1.2,-32.0,1.40),
    vec4(-21.0, 1.0,-36.0,2.05)
  );
  vec3 satelliteSurface(vec3 p, vec3 rd, int index, float t) {
    vec4 world = worlds[index];
    vec3 n = normalize(p-world.xyz);
    vec3 local = spin(t * (0.018+float(index)*0.004)) * n;
    float rock = terrain(local*7.0+float(index)*5.71);
    float fine = noise3(local*42.0+float(index)*8.9);
    vec3 dark = vec3(0.045,0.058,0.075);
    vec3 pale = vec3(0.30,0.39,0.47);
    if (index == 1 || index == 5) {
      dark = vec3(0.080,0.049,0.038);
      pale = vec3(0.57,0.36,0.22);
    } else if (index == 3 || index == 8) {
      dark = vec3(0.070,0.053,0.085);
      pale = vec3(0.39,0.32,0.45);
    } else if (index == 4) {
      dark = vec3(0.032,0.066,0.073);
      pale = vec3(0.22,0.43,0.47);
    }
    float pattern = smoothstep(0.32,0.70,rock);
    if (index == 3 || index == 5) {
      // Quiet banding distinguishes distant gas worlds from the rocky landing world.
      float bands = sin(local.y*29.0 + rock*5.0)*0.5+0.5;
      pattern = mix(pattern,bands,0.57);
    }
    vec3 albedo = mix(dark,pale,pattern)*(0.78+fine*0.40);
    vec3 key = normalize(vec3(-0.64,0.32,-1.0));
    float diffuse = max(dot(n,key),0.0);
    float fill=max(dot(n,normalize(vec3(-0.30,0.48,0.87))),0.0);
    vec3 color = albedo * (vec3(0.012,0.018,0.032)+fill*vec3(0.18,0.25,0.34)+diffuse*vec3(1.50,1.14,0.86));
    float rim = pow(1.0-max(dot(n,-rd),0.0),4.4);
    color += vec3(0.045,0.12,0.22)*rim*smoothstep(-0.1,0.5,dot(n,key));
    return color;
  }

  vec2 sphereIntersection(vec3 ro,vec3 rd,vec3 centre,float radius,float lens) {
    vec3 relative=ro-centre;
    float projected=-dot(relative,rd);
    if (projected<=0.0) return vec2(1e6,0.0);
    float nearSquared=max(dot(relative,relative)-projected*projected,0.0);
    float signedEdge=sqrt(nearSquared)-radius;
    float halfPixel=max(projected/(min(uResolution.x,uResolution.y)*lens)*1.25,0.00001);
    float coverage=1.0-smoothstep(-halfPixel,halfPixel,signedEdge);
    float hit=projected-sqrt(max(radius*radius-nearSquared,0.0));
    return vec2(hit,coverage);
  }

  void main() {
    float t = clamp(uTime,0.0,5.2);
    vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution) / min(uResolution.x,uResolution.y);

    // An actual orbital dolly: the sphere keeps its size in world space.
    // End just above its surface. The caller unfolds the homepage over this landing.
    float distanceToCentre = 26.0;
    distanceToCentre = mix(distanceToCentre,7.8,ease(0.20,1.45,t));
    distanceToCentre = mix(distanceToCentre,2.85,ease(1.10,2.45,t));
    distanceToCentre = mix(distanceToCentre,1.035,ease(2.55,4.22,t));
    float orbit = mix(0.23,0.0,ease(0.0,4.15,t));
    vec3 ro = vec3(sin(orbit),0.05*(1.0-ease(1.5,3.9,t)),cos(orbit));
    ro = normalize(ro) * distanceToCentre;
    vec3 target = vec3(mix(-2.0,0.0,ease(0.2,2.2,t)),0.0,0.0);
    vec3 forward = normalize(target-ro);
    vec3 right = normalize(cross(forward,vec3(0,1,0)));
    vec3 up = cross(right,forward);
    float lens = mix(1.86,1.98,ease(2.4,4.1,t));
    vec3 rd = normalize(forward * lens + uv.x * right + uv.y * up);

    float b = dot(ro,rd);
    vec3 color = vec3(0.0);
    float nearestHit = 1e6;
    float edgeCoverage=0.0;
    int hitWorld = -1;
    vec2 primaryHit=sphereIntersection(ro,rd,vec3(0),1.0,lens);
    if (primaryHit.y>0.001) {
      nearestHit = primaryHit.x;
      edgeCoverage=primaryHit.y;
      hitWorld = WORLD_COUNT;
    }
    float othersVisible = 1.0-ease(2.15,3.15,t);
    if (othersVisible > 0.001) {
      for (int i=0;i<WORLD_COUNT;i++) {
        vec2 hit=sphereIntersection(ro,rd,worlds[i].xyz,worlds[i].w,lens);
        if (hit.y>0.001 && hit.x>0.001 && hit.x<nearestHit) {
          nearestHit=hit.x;
          edgeCoverage=hit.y;
          hitWorld=i;
        }
      }
    }
    if (hitWorld == WORLD_COUNT) {
      color = planetSurface(ro+rd*nearestHit,ro,rd,t);
    } else if (hitWorld >= 0) {
      color = satelliteSurface(ro+rd*nearestHit,rd,hitWorld,t);
      if (othersVisible < 0.999) color = mix(sky(ro,rd,uv,t),color,othersVisible);
    } else {
      color = sky(ro,rd,uv,t);
    }
    if (hitWorld>=0 && edgeCoverage<0.999) color=mix(sky(ro,rd,uv,t),color,edgeCoverage);
    // Continuous atmosphere on both sides of the analytically antialiased limb.
    if (hitWorld==WORLD_COUNT || hitWorld<0) {
      float nearest=length(ro-rd*dot(ro,rd));
      vec3 nearNormal=normalize(ro+rd*max(-b,0.0));
      float sunlit=pow(max(dot(nearNormal,normalize(vec3(-0.64,0.32,-1.0))),0.0),0.7);
      float outer=exp(-max(nearest-1.0,0.0)*90.0);
      float inner=smoothstep(0.968,1.0,nearest);
      color+=vec3(0.075,0.21,0.40)*outer*inner*(0.05+sunlit*0.40);
      color+=vec3(0.008,0.028,0.07)*exp(-abs(nearest-1.0)*25.0)*sunlit;
    }

    // One tilted ring system provides a recognisable silhouette amongst the moons.
    if (othersVisible > 0.001) {
      vec3 ringCentre = worlds[3].xyz;
      vec3 ringNormal = normalize(vec3(0.12,0.64,1.0));
      float planeDenominator = dot(rd,ringNormal);
      if (abs(planeDenominator)>0.0001) {
        float ringHit = dot(ringCentre-ro,ringNormal)/planeDenominator;
        if (ringHit>0.0 && ringHit<nearestHit) {
          vec3 ringPoint = ro+rd*ringHit-ringCentre;
          float ringRadius = length(ringPoint)/worlds[3].w;
          float ringMask = smoothstep(1.24,1.31,ringRadius)*(1.0-smoothstep(1.93,2.03,ringRadius));
          if (ringMask>0.0) {
            float grooves = 0.64+0.20*sin(ringRadius*79.0)+0.10*sin(ringRadius*157.0);
            vec3 ringColor = vec3(0.19,0.17,0.24)*grooves;
            color = mix(color,ringColor,ringMask*0.73*othersVisible);
          }
        }
      }
    }

    // Gentle optical response; avoid a white flash at arrival.
    color *= 1.18;
    color = color / (1.0 + color);
    color = pow(max(color,vec3(0.0)),vec3(0.4545));
    float vignette = 1.0 - 0.18*smoothstep(0.65,2.0,length(uv));
    color *= vignette;
    color *= mix(1.0,0.10,ease(4.15,5.05,t));
    color *= mix(0.40,1.0,ease(0.0,0.30,t));
    fragColor = vec4(color,1.0);
  }`;

  const shaders = [];
  let program;
  let disposed = false;
  function compile(type, source) {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('Could not create entrance shader.');
    shaders.push(shader);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(`Space entrance shader: ${gl.getShaderInfoLog(shader)}`);
    }
    return shader;
  }
  try {
    const vertex = compile(gl.VERTEX_SHADER, vertexSource);
    const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
    program = gl.createProgram();
    if (!program) throw new Error('Could not create entrance renderer.');
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Space entrance link: ${gl.getProgramInfoLog(program)}`);
    }
  } catch (error) {
    if (program) gl.deleteProgram(program);
    shaders.forEach(shader => gl.deleteShader(shader));
    throw error;
  }
  shaders.forEach(shader => gl.deleteShader(shader));
  const resolution = gl.getUniformLocation(program, 'uResolution');
  const time = gl.getUniformLocation(program, 'uTime');
  const vao = gl.createVertexArray();

  function resize() {
    if (disposed) return;
    const bounds = canvas.getBoundingClientRect();
    const width = Math.max(1, bounds.width || window.innerWidth);
    const height = Math.max(1, bounds.height || window.innerHeight);
    const mobile = width <= 720;
    let dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.35 : 1.5);
    dpr = Math.min(dpr, Math.sqrt(1900000 / (width * height)));
    const physicalWidth = Math.max(1, Math.round(width * dpr));
    const physicalHeight = Math.max(1, Math.round(height * dpr));
    if (canvas.width !== physicalWidth || canvas.height !== physicalHeight) {
      canvas.width = physicalWidth;
      canvas.height = physicalHeight;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  function render(seconds) {
    if (disposed || gl.isContextLost()) return;
    gl.useProgram(program);
    gl.bindVertexArray(vao);
    gl.uniform2f(resolution, canvas.width, canvas.height);
    gl.uniform1f(time, Number.isFinite(seconds) ? Math.max(0, seconds) : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    gl.deleteVertexArray(vao);
    gl.deleteProgram(program);
    // Release allocations without poisoning the canvas for a local replay.
  }
  resize();
  return { render, resize, dispose };
}
