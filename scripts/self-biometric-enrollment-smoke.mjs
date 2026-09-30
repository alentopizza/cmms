import fs from "node:fs";

function read(path){return fs.readFileSync(path,"utf8");}
function expect(source,needle,label){if(!source.includes(needle))throw new Error(label+" missing: "+needle);}

const biometric=read("lib/client-biometric.ts");
expect(biometric,"timeoutMs=13000","extended active challenge timeout");
expect(biometric,"centerDeadline=Date.now()+8000","extended frontal return window");
expect(biometric,"maxAttempts=samples","capture retry contract");
expect(biometric,"onCentering?.()","centering phase callback");

const self=read("components/SelfBiometricEnrollment.tsx");
for(const needle of [
  'open={cameraOpen}',
  'className="self-biometric-camera-modal"',
  'onCentering:()=>',
  'maxAttempts:8',
  'attemptDelayMs:650',
  'Retos completados. Mira de frente',
  'Reintentar prueba',
]){
  expect(self,needle,"self biometric modal flow");
}
if(self.includes('className={"attendance-camera-card self-biometric-camera "+(cameraReady?"visible":"")}')){
  throw new Error("Self enrollment camera still renders inline in page flow");
}

const css=read("app/globals.css");
expect(css,".self-biometric-camera-modal","biometric modal responsive styles");
expect(css,"@media(max-width:600px)","biometric mobile modal");

console.log("Self biometric enrollment modal + challenge timing smoke: OK");
