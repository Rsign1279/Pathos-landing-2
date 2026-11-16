// One analytic sphere, one small texture, no model, postprocessing or framework.
// Public state is controlled by the page's single animation scheduler.
export async function createPlanet(canvas) {
  const gl = canvas.getContext('webgl', { alpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power', preserveDrawingBuffer: false });
  if (!gl) return null;
  const vertex = `attribute vec2 aPosition; varying vec2 vUv; void main(){vUv=aPosition*.5+.5;gl_Position=vec4(aPosition,0.,1.);}`;
  const fragment = `precision highp float;
    varying vec2 vUv; uniform sampler2D uStone; uniform float uRotation; uniform float uSignal;
    float hash(vec3 p){p=fract(p*.3183099+vec3(.17,.31,.53));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
    float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
    void main(){
      vec2 p=(vUv-.5)*2.015;float r=dot(p,p);if(r>1.){gl_FragColor=vec4(0.);return;}
      vec3 n=vec3(p,sqrt(max(0.,1.-r)));float a=uRotation;vec3 q=vec3(cos(a)*n.x+sin(a)*n.z,n.y,-sin(a)*n.x+cos(a)*n.z);
      vec2 uv=vec2(fract(atan(q.x,q.z)/6.2831853+.5),acos(clamp(q.y,-1.,1.))/3.1415926);
      vec3 stone=texture2D(uStone,uv).rgb;float lum=dot(stone,vec3(.299,.587,.114));
      float terrain=noise(q*33.)*.65+noise(q*102.)*.25+noise(q*260.)*.10;
      float veins=smoothstep(.22,.75,lum);vec3 material=mix(vec3(.24,.235,.21),vec3(.73,.70,.60),veins);
      material=mix(material,vec3(.47,.39,.43),smoothstep(.035,.20,stone.r-stone.g)*.25);
      material*=.65+terrain*.55;
      float dx=texture2D(uStone,uv+vec2(.0015,0)).r-stone.r;float dy=texture2D(uStone,uv+vec2(0,.002)).r-stone.r;
      vec3 normal=normalize(n+vec3(dx,dy,0.)*.9);vec3 light=normalize(vec3(.9,.55,.65));
      float diffuse=max(dot(normal,light),0.);float terminator=smoothstep(-.16,.8,dot(n,light));
      vec3 col=material*(.07+.96*diffuse)*terminator;
      col+=material*.028;float rim=pow(1.-max(n.z,0.),3.5)*max(dot(n,light),0.);
      col+=vec3(.76,.68,.49)*rim*.26;
      float grain=hash(vec3(gl_FragCoord.xy,11.))-.5;col+=grain*.016;
      // A restrained, data-inspired latitude travels across the surface.
      float band=1.-smoothstep(.002,.006,abs(q.y-(uSignal-.5)*.85));
      col+=vec3(.43,.29,.45)*band*.11*diffuse;
      gl_FragColor=vec4(col,1.-smoothstep(.993,1.,r));
    }`;
  const compile = (type, source) => {
    const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { gl.deleteShader(shader); throw new Error('Planet shader unavailable'); }
    return shader;
  };
  let program;
  try {
    program = gl.createProgram();
    const vs = compile(gl.VERTEX_SHADER, vertex), fs = compile(gl.FRAGMENT_SHADER, fragment);
    gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
    gl.deleteShader(vs); gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Planet unavailable');
  } catch { gl.deleteProgram(program); return null; }
  gl.useProgram(program);
  const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
  const pos = gl.getAttribLocation(program, 'aPosition'); gl.enableVertexAttribArray(pos); gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
  const texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  const photo = new Image(); photo.src = 'assets/marble-sm.webp';
  try { await photo.decode(); } catch { gl.deleteTexture(texture); return null; }
  if (gl.isContextLost()) return null;
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, photo);
  const rotation = gl.getUniformLocation(program, 'uRotation'), signal = gl.getUniformLocation(program, 'uSignal');
  let width=0, lost=false, quality=matchMedia('(max-width:720px)').matches?1.25:1.5;
  const render = (angle=0, activeSignal=.5) => {
    if (lost) return;
    const side=Math.max(1,Math.round(canvas.clientWidth*Math.min(devicePixelRatio||1,quality)));
    if(side!==width){width=side;canvas.width=canvas.height=side;gl.viewport(0,0,side,side);}
    gl.uniform1f(rotation,angle);gl.uniform1f(signal,activeSignal);gl.drawArrays(gl.TRIANGLES,0,6);
  };
  const onLost=event=>{event.preventDefault();lost=true;canvas.parentElement.classList.remove('has-webgl');};
  const onRestored=()=>{canvas.dispatchEvent(new CustomEvent('planetrestore'));};
  canvas.addEventListener('webglcontextlost',onLost);
  // Context restoration reinitializes only this optional illustration.
  canvas.addEventListener('webglcontextrestored',onRestored);
  render(-.45);canvas.parentElement.classList.add('has-webgl');
  return {render,lowerQuality(){quality=Math.max(.8,quality-.25);},destroy(){lost=true;canvas.removeEventListener('webglcontextlost',onLost);canvas.removeEventListener('webglcontextrestored',onRestored);gl.deleteTexture(texture);gl.deleteBuffer(buffer);gl.deleteProgram(program);}};
}
