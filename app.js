import * as THREE from './assets/vendor/three.module.min.js';

const canvas = document.querySelector('canvas');
const viewport = document.querySelector('#viewport');
const status = document.querySelector('#status');
const motion = document.querySelector('#motion');
const reset = document.querySelector('#reset');
const opacity = document.querySelector('#opacity');
const opacityValue = document.querySelector('#opacity-value');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const INITIAL_ANGLE = -0.75;
let playing = !reducedMotion.matches;
let visible = true;
let dragging = false;
let frame = null;
let lastTime = 0;
let angle = INITIAL_ANGLE;
let cameraHeight = 200;

async function initialize() {
  const renderer = new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1,2));
  renderer.setClearColor(0xffffff,0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-100,100,100,-100,1,1200);
  camera.position.set(0,0,450);
  scene.add(new THREE.HemisphereLight(0xffffff,0x9babb7,2.0));
  const key = new THREE.DirectionalLight(0xffffff,2.7);
  key.position.set(-120,180,250); scene.add(key);
  const fill = new THREE.DirectionalLight(0xdce7ed,1.1);
  fill.position.set(150,30,-80); scene.add(fill);
  const complex = new THREE.Group();
  scene.add(complex);

  const fetchAsset = async (path,kind) => {
    const response = await fetch(new URL(path,import.meta.url));
    if (!response.ok) throw new Error(`Cannot load ${path}: ${response.status}`);
    return kind === 'json' ? response.json() : response.arrayBuffer();
  };
  const [data,binary] = await Promise.all([
    fetchAsset('./assets/spufz1.json','json'),
    fetchAsset('./assets/protein-surface.bin','binary')
  ]);
  const header = new DataView(binary);
  const vertexCount = header.getUint32(0,true), faceCount = header.getUint32(4,true);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(binary,8,vertexCount*3),3));
  geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(binary,8+vertexCount*12,faceCount*3),1));
  geometry.computeVertexNormals();
  const surfaceMaterial = new THREE.MeshPhongMaterial({
    color:0xf4f5f6, specular:0xffffff, shininess:65,
    transparent:true, opacity:opacity ? Number(opacity.value) : .42, depthWrite:false,
    side:THREE.FrontSide
  });
  const surface = new THREE.Mesh(geometry,surfaceMaterial);
  surface.renderOrder = 5;
  complex.add(surface);

  const materials = new Map();
  function material(color) {
    if (!materials.has(color)) materials.set(color,new THREE.MeshPhongMaterial({color,specular:0xffffff,shininess:60}));
    return materials.get(color);
  }
  const colors = {target:0xde7e6a,nonTarget:0xfabb95,rna:0x91adc1};
  const point = p => new THREE.Vector3(...p);
  function tube(points,radius,color) {
    if (points.length<2) return;
    const curve = new THREE.CatmullRomCurve3(points.map(point),false,'centripetal');
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(16,points.length*6),radius,8,false),material(color));
    complex.add(mesh);
  }
  const rodGeometry = new THREE.CylinderGeometry(1,1,1,8);
  function rods(pairs,radius,color) {
    if (!pairs.length) return;
    const mesh = new THREE.InstancedMesh(rodGeometry,material(color),pairs.length);
    const dummy = new THREE.Object3D(),up = new THREE.Vector3(0,1,0);
    pairs.forEach(([a,b],i) => {
      const start=point(a),end=point(b),delta=end.clone().sub(start);
      dummy.position.copy(start).add(end).multiplyScalar(.5);
      dummy.quaternion.setFromUnitVectors(up,delta.clone().normalize());
      dummy.scale.set(radius,delta.length(),radius);
      dummy.updateMatrix(); mesh.setMatrixAt(i,dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate=true;
    complex.add(mesh);
  }
  // These sugar and base anchors come directly from PDB 8GKH, not an ideal helix.
  for (const [name,residues] of Object.entries(data.chains)) {
    // The target strand is rendered below as a single backbone spanning the
    // observed complex, exposed connector and modeled distal duplex.
    if(name==='target') {
      rods(residues.flatMap(r=>[[r.backbone,r.sugar],[r.sugar,r.base]]),.43,colors[name]);
      continue;
    }
    let segment=[];
    for (let i=0;i<residues.length;i++) {
      const residue=residues[i];
      if (i && (residue.residue-residues[i-1].residue>1 || point(residue.backbone).distanceTo(point(residues[i-1].backbone))>10)) {
        tube(segment,name==='rna'?.92:.86,colors[name]);segment=[];
      }
      segment.push(residue.backbone);
    }
    tube(segment,name==='rna'?.92:.86,colors[name]);
    rods(residues.flatMap(r=>[[r.backbone,r.sugar],[r.sugar,r.base]]),.43,colors[name]);
  }
  // Rungs join actual paired base centers. The scaffold retains its own folds.
  const ts = new Map(data.chains.target.map(r=>[r.residue,r]));
  const nts = new Map(data.chains.nonTarget.map(r=>[r.residue,r]));
  const rna = new Map(data.chains.rna.map(r=>[r.residue,r]));
  const dnaPairs=[],hybridPairs=[];
  for(let k=1;k<=15;k++) {
    if(ts.has(k)&&nts.has(-k)) dnaPairs.push([ts.get(k).base,nts.get(-k).base]);
  }
  for(let k=-14;k<=0;k++) {
    const r=rna.get(76-k),t=ts.get(k);
    if(r&&t) hybridPairs.push([r.base,t.base]);
  }
  rods(dnaPairs,.26,0xe2ac97);rods(hybridPairs,.28,0xc4b9af);

  const model=data.modeled;
  for(const [key,name,n] of [['upperTarget','target',15],['upperNonTarget','nonTarget',-15]]) {
    const source=data.chains[name].find(r=>r.residue===n);
    if(name!=='target') tube([source.backbone,...model[key].map(r=>r.backbone)],.86,colors[name]);
    rods(model[key].map(r=>[r.backbone,r.base]),.43,colors[name]);
  }
  for(const [key,name] of [['lowerTarget','target'],['lowerNonTarget','nonTarget']]) {
    const residues = name==='nonTarget' ? model[key].slice(data.reannealIndex) : model[key];
    rods(residues.flatMap(r=>[[r.backbone,r.sugar],[r.sugar,r.base]]),.43,colors[name]);
  }
  rods(model.upperTarget.map((r,i)=>[r.base,model.upperNonTarget[i].base]),.26,0xe2ac97);
  rods(model.lowerTarget.slice(data.reannealIndex).map((r,i)=>[r.base,model.lowerNonTarget[i+data.reannealIndex].base]),.26,0xe2ac97);
  // Each single strand and the dense helical trace share one interpolated
  // backbone, so the junction has no separate end cap or tangent mismatch.
  tube([...model.displacedNonTarget.slice(0,-1),...model.lowerCurves.nonTarget],.80,colors.nonTarget);
  // Share one spline through the protein exit as well as the duplex entry.
  // Every observed sugar anchor stays fixed; no independent end cap remains
  // where the experimental backbone meets the illustrative extension.
  tube([
    ...model.upperTarget.slice().reverse().map(r=>r.backbone),
    ...data.chains.target.slice().reverse().map(r=>r.backbone),
    ...model.targetConnector.slice(1,-1),
    ...model.lowerCurves.target
  ],.86,colors.target);
  // Unpaired bases follow each modeled linker with variable orientations.
  // No cross-strand rungs are drawn across these single-stranded segments.
  for(const [name,residues] of Object.entries(model.linkerNucleotides)) {
    rods(residues.flatMap(r=>[[r.backbone,r.sugar],[r.sugar,r.base]]),.43,colors[name]);
  }
  // The unresolved T(-15) display bridge is included in the continuous trace.

  const box = new THREE.Box3().setFromObject(complex);
  const bounds = box.getSize(new THREE.Vector3());
  const midpoint = box.getCenter(new THREE.Vector3());
  // Put the DNA axis through the center of the viewport, without bending it.
  const axisCenter = point(ts.get(8).backbone).add(point(nts.get(-8).backbone)).multiplyScalar(.5);
  for(const child of complex.children) child.position.sub(new THREE.Vector3(axisCenter.x,midpoint.y,axisCenter.z));
  const radialExtent=Math.max(...['x','z'].map(k=>Math.max(Math.abs(box.min[k]-axisCenter[k]),Math.abs(box.max[k]-axisCenter[k]))));

  function render() { complex.rotation.y=angle;renderer.render(scene,camera); }
  function fit() {
    const {width,height}=viewport.getBoundingClientRect();
    if(!width||!height)return;
    const aspect=width/height;
    cameraHeight=Math.max(bounds.y*1.14,radialExtent*2.3/aspect);
    camera.left=-cameraHeight*aspect/2;camera.right=cameraHeight*aspect/2;
    camera.top=cameraHeight/2;camera.bottom=-cameraHeight/2;
    camera.updateProjectionMatrix();renderer.setSize(width,height,false);render();
  }
  function tick(time) {
    frame=null;
    if(playing&&visible&&!document.hidden&&!dragging) {
      if(lastTime) angle+=Math.min((time-lastTime)/1000,.06)*.105;
      lastTime=time;render();frame=requestAnimationFrame(tick);
    } else lastTime=0;
  }
  function schedule() {
    if(frame!==null)cancelAnimationFrame(frame);
    frame=null;lastTime=0;
    if(playing&&visible&&!document.hidden&&!dragging)frame=requestAnimationFrame(tick);
    if(motion){motion.textContent=playing?'Pause rotation':'Play rotation';
    motion.setAttribute('aria-pressed',String(!playing));}
  }
  if(motion)motion.disabled=false;if(reset)reset.disabled=false;
  if(motion)motion.addEventListener('click',()=>{playing=!playing;schedule();});
  if(reset)reset.addEventListener('click',()=>{angle=INITIAL_ANGLE;render();});
  if(opacity)opacity.addEventListener('input',()=>{
    surfaceMaterial.opacity=Number(opacity.value);
    if(opacityValue)opacityValue.textContent=`${Math.round(Number(opacity.value)*100)}%`;render();
  });
  let previousX=0;
  canvas.addEventListener('pointerdown',event=>{
    if(event.pointerType==='mouse'&&event.button!==0)return;
    dragging=true;previousX=event.clientX;canvas.setPointerCapture(event.pointerId);schedule();
  });
  canvas.addEventListener('pointermove',event=>{
    if(!dragging)return;
    angle+=(event.clientX-previousX)*.008;previousX=event.clientX;render();
  });
  function endDrag(){dragging=false;schedule();}
  canvas.addEventListener('pointerup',endDrag);canvas.addEventListener('pointercancel',endDrag);
  canvas.addEventListener('lostpointercapture',()=>{if(dragging)endDrag();});
  document.addEventListener('visibilitychange',schedule);
  reducedMotion.addEventListener('change',e=>{playing=!e.matches;schedule();});
  new ResizeObserver(fit).observe(viewport);
  new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;schedule();}).observe(viewport);
  canvas.addEventListener('webglcontextlost',event=>{
    event.preventDefault();playing=false;schedule();status.hidden=false;
    status.textContent='The 3D view was interrupted. Reload to restore it.';
  });
  fit();status.hidden=true;schedule();
}

initialize().catch(error=>{
  console.error(error);
  status.hidden=false;status.textContent='Unable to load the 3D preview. Please reload in a browser with WebGL enabled.';
  if(motion)motion.disabled=true;if(reset)reset.disabled=true;
});
