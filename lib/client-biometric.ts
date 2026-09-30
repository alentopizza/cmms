"use client";

/**
 * Shared browser-only biometric helpers.
 *
 * This module intentionally owns model loading and face-sample normalization so
 * supervised enrollment and attendance verification use the same thresholds
 * and embedding generation behavior.
 */

// ── Public data contracts ────────────────────────────────────────────────────

export type FaceCapture = {
  embedding:number[];
  live:number;
  real:number;
};

export type ActiveLivenessChallengeCode="blink"|"turn_left"|"turn_right"|"head_up"|"head_down";

export type ActiveLivenessEvidence={
  code:ActiveLivenessChallengeCode;
  label:string;
  completedAt:string;
};

declare global {
  interface Window {
    Human?: any;
  }
}

// ── Vector helpers ───────────────────────────────────────────────────────────

function averageNormalized(vectors:number[][]) {
  const length=vectors[0]?.length || 0;
  const result=new Array<number>(length).fill(0);
  for(const vector of vectors){
    for(let index=0;index<length;index+=1) result[index]+=vector[index]/vectors.length;
  }
  const norm=Math.sqrt(result.reduce((sum,value)=>sum+value*value,0)) || 1;
  return result.map(value=>value/norm);
}

// ── Human model loading ──────────────────────────────────────────────────────

export async function loadBiometricEngine() {
  if(!window.Human){
    await new Promise<void>((resolve,reject)=>{
      const existing=document.querySelector<HTMLScriptElement>('script[data-biometric-human="true"]');
      if(existing){
        if(window.Human){resolve();return;}
        existing.addEventListener("load",()=>resolve(),{once:true});
        existing.addEventListener("error",()=>reject(new Error("No fue posible cargar el motor biométrico.")),{once:true});
        return;
      }
      const script=document.createElement("script");
      script.src="/biometric-human.js";
      script.async=true;
      script.dataset.biometricHuman="true";
      script.onload=()=>resolve();
      script.onerror=()=>reject(new Error("No fue posible cargar el motor biométrico."));
      document.head.appendChild(script);
    });
  }

  const namespace=window.Human;
  const HumanCtor=namespace?.Human || namespace?.default || namespace;
  if(typeof HumanCtor!=="function") throw new Error("El motor biométrico no está disponible.");

  const human=new HumanCtor({
    backend:"webgl",
    modelBasePath:"/biometric-models/",
    face:{
      enabled:true,
      detector:{enabled:true,maxDetected:1,minConfidence:0.65},
      mesh:{enabled:true},
      description:{enabled:true},
      antispoof:{enabled:true},
      liveness:{enabled:true},
      emotion:{enabled:false},
      iris:{enabled:false},
    },
    body:{enabled:false},
    hand:{enabled:false},
    object:{enabled:false},
    segmentation:{enabled:false},
    gesture:{enabled:true},
    cacheSensitivity:0,
  });
  await human.load();
  return human;
}

// ── Active enrollment liveness challenge ───────────────────────────────────

const ACTIVE_LIVENESS_LABELS:Record<ActiveLivenessChallengeCode,string>={
  blink:"Parpadea una vez",
  turn_left:"Gira el rostro ligeramente a tu izquierda",
  turn_right:"Gira el rostro ligeramente a tu derecha",
  head_up:"Levanta ligeramente el rostro",
  head_down:"Baja ligeramente el rostro",
};

function gestureStrings(result:any){
  const raw=Array.isArray(result?.gesture)?result.gesture:[];
  return raw.map((item:any)=>String(item?.gesture||"").toLowerCase());
}

function challengeMatched(code:ActiveLivenessChallengeCode,gestures:string[]){
  if(code==="blink")return gestures.some(item=>item==="blink left eye"||item==="blink right eye");
  if(code==="turn_left")return gestures.includes("facing left");
  if(code==="turn_right")return gestures.includes("facing right");
  if(code==="head_up")return gestures.includes("head up");
  return gestures.includes("head down");
}

export function createActiveLivenessChallenge():ActiveLivenessChallengeCode[]{
  const turns:ActiveLivenessChallengeCode[]=["turn_left","turn_right","head_up","head_down"];
  const turn=turns[Math.floor(Math.random()*turns.length)]||"turn_left";
  return Math.random()>.5?["blink",turn]:[turn,"blink"];
}

export async function runActiveLivenessChallenge({
  human,
  video,
  challenge,
  onStep,
  onCentering,
  timeoutMs=13000,
}:{
  human:any;
  video:HTMLVideoElement;
  challenge:ActiveLivenessChallengeCode[];
  onStep?:(input:{index:number;code:ActiveLivenessChallengeCode;label:string;status:"waiting"|"done"})=>void;
  onCentering?:()=>void;
  timeoutMs?:number;
}):Promise<ActiveLivenessEvidence[]>{
  const evidence:ActiveLivenessEvidence[]=[];

  for(let index=0;index<challenge.length;index+=1){
    const code=challenge[index];
    const label=ACTIVE_LIVENESS_LABELS[code];
    onStep?.({index,code,label,status:"waiting"});
    const deadline=Date.now()+timeoutMs;
    let matched=false;

    while(Date.now()<deadline){
      const result=await human.detect(video);
      if(result.face?.length!==1){
        await new Promise(resolve=>setTimeout(resolve,180));
        continue;
      }
      if(challengeMatched(code,gestureStrings(result))){
        matched=true;
        break;
      }
      await new Promise(resolve=>setTimeout(resolve,180));
    }

    if(!matched)throw new Error("No se pudo completar la prueba de vida: "+label.toLowerCase()+". Intenta de nuevo.");
    evidence.push({code,label,completedAt:new Date().toISOString()});
    onStep?.({index,code,label,status:"done"});
    await new Promise(resolve=>setTimeout(resolve,450));
  }

  // Return to a frontal pose before generating the enrollment descriptor.
  onCentering?.();
  const centerDeadline=Date.now()+8000;
  while(Date.now()<centerDeadline){
    const result=await human.detect(video);
    if(result.face?.length===1&&gestureStrings(result).includes("facing center"))return evidence;
    await new Promise(resolve=>setTimeout(resolve,180));
  }

  throw new Error("Mira nuevamente de frente a la cámara para finalizar el enrolamiento.");
}

export function captureEnrollmentPreview(video:HTMLVideoElement){
  const canvas=document.createElement("canvas");
  const sourceWidth=video.videoWidth||720;
  const sourceHeight=video.videoHeight||720;
  const side=Math.min(sourceWidth,sourceHeight);
  canvas.width=360;
  canvas.height=360;
  const sx=Math.max(0,(sourceWidth-side)/2);
  const sy=Math.max(0,(sourceHeight-side)/2);
  const context=canvas.getContext("2d");
  if(!context)throw new Error("No fue posible preparar la vista previa del enrolamiento.");
  context.drawImage(video,sx,sy,side,side,0,0,360,360);
  return canvas.toDataURL("image/jpeg",0.72);
}

// ── Live face capture ────────────────────────────────────────────────────────

export async function captureLiveFace({
  human,
  video,
  livenessThreshold,
  samples=2,
  maxAttempts=samples,
  attemptDelayMs=550,
}:{
  human:any;
  video:HTMLVideoElement;
  livenessThreshold:number;
  samples?:number;
  maxAttempts?:number;
  attemptDelayMs?:number;
}):Promise<FaceCapture> {
  const embeddings:number[][]=[];
  let minLive=1;
  let minReal=1;
  let lastFailure="No se detectó un rostro válido.";

  for(let attempt=0;attempt<maxAttempts&&embeddings.length<samples;attempt+=1){
    if(attempt) await new Promise(resolve=>setTimeout(resolve,attemptDelayMs));
    const result=await human.detect(video);
    if(result.face.length!==1){
      lastFailure=result.face.length>1
        ? "Debe aparecer una sola persona frente a la cámara."
        : "No se detectó un rostro. Mira de frente a la cámara.";
      continue;
    }

    const face=result.face[0];
    if(!face.embedding?.length){
      lastFailure="No fue posible generar la plantilla facial.";
      continue;
    }

    const live=Number(face.live);
    const real=Number(face.real);
    if(!Number.isFinite(live)||!Number.isFinite(real)){
      lastFailure="No fue posible comprobar presencia real.";
      continue;
    }
    if(live<livenessThreshold || real<livenessThreshold){
      lastFailure="La prueba de presencia no fue suficiente. Evita fotos o pantallas y mejora la iluminación.";
      continue;
    }

    embeddings.push(face.embedding.map(Number));
    minLive=Math.min(minLive,live);
    minReal=Math.min(minReal,real);
  }

  if(embeddings.length<samples)throw new Error(lastFailure+" Mantén el rostro centrado unos segundos e intenta nuevamente.");

  return {
    embedding:averageNormalized(embeddings),
    live:minLive,
    real:minReal,
  };
}
