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
    gesture:{enabled:false},
    cacheSensitivity:0,
  });
  await human.load();
  return human;
}

// ── Live face capture ────────────────────────────────────────────────────────

export async function captureLiveFace({
  human,
  video,
  livenessThreshold,
  samples=2,
}:{
  human:any;
  video:HTMLVideoElement;
  livenessThreshold:number;
  samples?:number;
}):Promise<FaceCapture> {
  const embeddings:number[][]=[];
  let minLive=1;
  let minReal=1;

  for(let attempt=0;attempt<samples;attempt+=1){
    if(attempt) await new Promise(resolve=>setTimeout(resolve,550));
    const result=await human.detect(video);
    if(result.face.length!==1){
      throw new Error(result.face.length>1
        ? "Debe aparecer una sola persona frente a la cámara."
        : "No se detectó un rostro. Mira de frente a la cámara.");
    }

    const face=result.face[0];
    if(!face.embedding?.length) throw new Error("No fue posible generar la plantilla facial.");

    const live=Number(face.live);
    const real=Number(face.real);
    if(!Number.isFinite(live)||!Number.isFinite(real)){
      throw new Error("No fue posible comprobar presencia real.");
    }
    if(live<livenessThreshold || real<livenessThreshold){
      throw new Error("La prueba de presencia no fue suficiente. Evita fotos o pantallas y mejora la iluminación.");
    }

    embeddings.push(face.embedding.map(Number));
    minLive=Math.min(minLive,live);
    minReal=Math.min(minReal,real);
  }

  return {
    embedding:averageNormalized(embeddings),
    live:minLive,
    real:minReal,
  };
}
