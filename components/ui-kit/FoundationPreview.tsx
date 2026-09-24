import {
  brandTokens,
  chartTokens,
  functionalTokens,
  motionTokens,
  radiusTokens,
  semanticTokens,
  shadowTokens,
  spacingTokens,
  typographySamples,
} from "@/lib/design-system";

function cssVar(token:string){
  return `var(${token})`;
}

function TokenSwatch({token,label,description}:{token:string;label:string;description?:string}){
  return <article className="ds-token-swatch">
    <span className="ds-token-color" style={{background:cssVar(token)}} aria-hidden="true"/>
    <div>
      <strong>{label}</strong>
      <code>{token}</code>
      {description&&<small>{description}</small>}
    </div>
  </article>;
}

export function FoundationPreview(){
  return <div className="ds-foundations">
    <section className="ds-preview-section" id="colors">
      <div className="ds-preview-heading">
        <span>Foundations</span>
        <h2>Color</h2>
        <p>Los colores visibles provienen directamente de los tokens cargados por la aplicación.</p>
      </div>
      <div className="ds-token-grid">
        {brandTokens.map(token=><TokenSwatch key={token.token}{...token}/>)}
      </div>

      <h3>Estados semánticos</h3>
      <div className="ds-token-grid ds-token-grid-4">
        {semanticTokens.map(token=><TokenSwatch key={token.token}{...token}/>)}
      </div>

      <h3>Áreas funcionales</h3>
      <div className="ds-token-grid ds-token-grid-4">
        {functionalTokens.map(token=><TokenSwatch key={token.token}{...token}/>)}
      </div>

      <h3>Secuencia de gráficos</h3>
      <div className="ds-chart-palette" aria-label="Paleta oficial de gráficos">
        {chartTokens.map(token=><span key={token.token} title={token.label} style={{background:cssVar(token.token)}}/>)}
      </div>
    </section>

    <section className="ds-preview-section" id="typography">
      <div className="ds-preview-heading">
        <span>Foundations</span>
        <h2>Tipografía</h2>
        <p>Inter permanece como fuente base con fallback de sistema y una jerarquía predecible.</p>
      </div>
      <div className="ds-type-stack">
        {typographySamples.map(sample=><div className="ds-type-row" key={sample.label}>
          <span className={sample.className}>Aa · DESWEB CMMS</span>
          <div><strong>{sample.label}</strong><small>{sample.meta}</small></div>
        </div>)}
      </div>
    </section>

    <section className="ds-preview-section" id="spacing">
      <div className="ds-preview-heading">
        <span>Foundations</span>
        <h2>Spacing</h2>
        <p>La escala evita medidas arbitrarias y permite componer módulos con ritmo consistente.</p>
      </div>
      <div className="ds-measure-list">
        {spacingTokens.map(([token,value])=><div key={token}>
          <code>{token}</code>
          <span className="ds-space-bar" style={{width:cssVar(token)}} aria-hidden="true"/>
          <strong>{value}px</strong>
        </div>)}
      </div>
    </section>

    <section className="ds-preview-section" id="radius">
      <div className="ds-preview-heading">
        <span>Foundations</span>
        <h2>Radius y sombras</h2>
        <p>Controles compactos, cards moderadas y elevación ligera.</p>
      </div>
      <div className="ds-radius-grid">
        {radiusTokens.map(([token,value])=><div key={token} style={{borderRadius:cssVar(token)}}>
          <strong>{value}px</strong><code>{token}</code>
        </div>)}
      </div>
      <div className="ds-shadow-grid">
        {shadowTokens.map(token=><div key={token} style={{boxShadow:cssVar(token)}}>
          <strong>{token.replace("--shadow-","").toUpperCase()}</strong><code>{token}</code>
        </div>)}
      </div>
    </section>

    <section className="ds-preview-section" id="motion">
      <div className="ds-preview-heading">
        <span>Foundations</span>
        <h2>Motion</h2>
        <p>Las duraciones se reservan para feedback de interacción y respetan reduced motion.</p>
      </div>
      <div className="ds-motion-grid">
        {motionTokens.map(([token,value])=><div key={token}>
          <span className="ds-motion-dot" style={{transitionDuration:cssVar(token)}} aria-hidden="true"/>
          <strong>{value}ms</strong>
          <code>{token}</code>
        </div>)}
      </div>
    </section>
  </div>;
}
