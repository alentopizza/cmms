import type { CSSProperties, Metadata } from "react";
import { Icon } from "@/components/ui";
import type { UiIconName } from "@/components/ui";
import {
  brandTokenGroups,
  chartTokens,
  motionTokens,
  radiusTokens,
  semanticTokenGroups,
  shadowTokens,
  spacingTokens,
  type DesignTokenGroup,
  type DesignTokenReference,
} from "@/lib/design-system";
import styles from "./ui-kit.module.css";

export const metadata:Metadata={
  title:"DESWEB UI Kit · Foundations",
  description:"Catálogo vivo del Design System DESWEB CMMS",
  robots:{index:false,follow:false},
};

function TokenSwatches({groups}:{groups:DesignTokenGroup[]}){
  return <div className={styles.groupGrid}>
    {groups.map(group=><article className={styles.foundationCard} key={group.title}>
      <div className={styles.cardHeading}>
        <h3>{group.title}</h3>
        <p>{group.description}</p>
      </div>
      <div className={styles.swatchGrid}>
        {group.tokens.map(item=><div className={styles.swatchItem} key={item.token}>
          <span className={styles.swatch} style={{background:`var(${item.token})`}} aria-hidden="true"/>
          <strong>{item.label}</strong>
          <code>{item.token}</code>
        </div>)}
      </div>
    </article>)}
  </div>;
}

function ChartPalette({tokens}:{tokens:DesignTokenReference[]}){
  return <div className={styles.chartPalette}>
    {tokens.map(item=><div key={item.token}>
      <span style={{background:`var(${item.token})`}} aria-hidden="true"/>
      <small>{item.label}</small>
    </div>)}
  </div>;
}

const iconNames:UiIconName[]=[
  "home","company","location","sublocation","user","asset","work-order",
  "activity","file","download","upload","edit","plus","check","power","trash",
];

export default function UiKitPage(){
  return <main className={styles.page}>
    <header className={styles.hero}>
      <div className={styles.brandMark} aria-hidden="true"><span/><span/><span/></div>
      <div className={styles.heroCopy}>
        <span className={styles.eyebrow}>DESWEB CMMS · Design System V2</span>
        <h1>UI Kit · Foundations</h1>
        <p>
          Catálogo vivo de los tokens y fundamentos que deben usar los componentes del ERP.
          Fase 1 instala la base técnica sin migrar todavía los módulos productivos.
        </p>
      </div>
      <div className={styles.heroStatus}>
        <strong>Fase 1</strong>
        <span>Foundations activas</span>
      </div>
    </header>

    <nav className={styles.sectionNav} aria-label="Secciones del UI Kit">
      <a href="#brand">Brand</a>
      <a href="#semantic">Semánticos</a>
      <a href="#type">Tipografía</a>
      <a href="#spacing">Spacing</a>
      <a href="#radius">Radius</a>
      <a href="#elevation">Sombras</a>
      <a href="#motion">Motion</a>
      <a href="#icons">Iconos</a>
    </nav>

    <section className={styles.section} id="brand">
      <div className={styles.sectionHeading}>
        <span>01</span>
        <div><h2>Brand & escalas</h2><p>Primary, Secondary y Dark son el ADN visual; las escalas resuelven sus variantes.</p></div>
      </div>
      <TokenSwatches groups={brandTokenGroups}/>
    </section>

    <section className={styles.section} id="semantic">
      <div className={styles.sectionHeading}>
        <span>02</span>
        <div><h2>Colores semánticos</h2><p>El color comunica estado. En componentes reales siempre se combina con texto o icono.</p></div>
      </div>
      <TokenSwatches groups={semanticTokenGroups}/>
      <article className={styles.foundationCard}>
        <div className={styles.cardHeading}>
          <h3>Secuencia de gráficos</h3>
          <p>Orden estable para visualizaciones de datos. No se eligen colores aleatoriamente.</p>
        </div>
        <ChartPalette tokens={chartTokens}/>
      </article>
    </section>

    <section className={styles.section} id="type">
      <div className={styles.sectionHeading}>
        <span>03</span>
        <div><h2>Tipografía</h2><p>Inter es la familia base. La jerarquía debe favorecer lectura rápida y densidad controlada.</p></div>
      </div>
      <article className={styles.typeCard}>
        <div className={styles.typeRow}><span>H1 · 32 / Bold</span><h1>Gestión empresarial clara</h1></div>
        <div className={styles.typeRow}><span>H2 · 24 / Semibold</span><h2>Activos e inventario conectados</h2></div>
        <div className={styles.typeRow}><span>H3 · 20 / Semibold</span><h3>Información operativa</h3></div>
        <div className={styles.typeRow}><span>Body Large · 16 / Medium</span><p className={styles.bodyLarge}>Texto importante para explicar una decisión o estado.</p></div>
        <div className={styles.typeRow}><span>Body · 14 / Regular</span><p>Texto general para tablas, formularios y contenido del ERP.</p></div>
        <div className={styles.typeRow}><span>Body Small · 12 / Regular</span><small>Texto secundario, ayuda y metadatos.</small></div>
      </article>
    </section>

    <section className={styles.section} id="spacing">
      <div className={styles.sectionHeading}>
        <span>04</span>
        <div><h2>Spacing</h2><p>Escala discreta para evitar márgenes y gaps arbitrarios por módulo.</p></div>
      </div>
      <div className={styles.measureGrid}>
        {spacingTokens.map(item=><article className={styles.measureCard} key={item.token}>
          <div className={styles.spaceBar} style={{width:`var(${item.token})`}} aria-hidden="true"/>
          <strong>{item.label}</strong><code>{item.token}</code>
        </article>)}
      </div>
    </section>

    <section className={styles.section} id="radius">
      <div className={styles.sectionHeading}>
        <span>05</span>
        <div><h2>Border radius</h2><p>Controles compactos, cards contenidas y superficies destacadas sin exceso de redondez.</p></div>
      </div>
      <div className={styles.radiusGrid}>
        {radiusTokens.map(item=><article className={styles.radiusCard} key={item.token}>
          <span style={{borderRadius:`var(${item.token})`}} aria-hidden="true"/>
          <strong>{item.label}</strong><code>{item.token}</code>
        </article>)}
      </div>
    </section>

    <section className={styles.section} id="elevation">
      <div className={styles.sectionHeading}>
        <span>06</span>
        <div><h2>Sombras</h2><p>Elevación ligera para dropdowns, modales, popovers y cards elevadas.</p></div>
      </div>
      <div className={styles.shadowGrid}>
        {shadowTokens.map(item=><article className={styles.shadowCard} key={item.token} style={{boxShadow:`var(${item.token})`}}>
          <strong>{item.label}</strong><code>{item.token}</code>
        </article>)}
      </div>
    </section>

    <section className={styles.section} id="motion">
      <div className={styles.sectionHeading}>
        <span>07</span>
        <div><h2>Motion</h2><p>Animación discreta y compatible con preferencias de movimiento reducido.</p></div>
      </div>
      <div className={styles.motionGrid}>
        {motionTokens.map(item=><article className={styles.motionCard} key={item.token}>
          <span
            className={styles.motionDot}
            style={{transitionDuration:`var(${item.token})`}}
            aria-hidden="true"
          />
          <strong>{item.label}</strong><code>{item.token}</code>
        </article>)}
      </div>
    </section>

    <section className={styles.section} id="icons">
      <div className={styles.sectionHeading}>
        <span>08</span>
        <div><h2>Iconografía</h2><p><code>UiIcon</code> se mantiene como sistema outline canónico provisional y se expone desde el namespace del UI Kit.</p></div>
      </div>
      <div className={styles.iconGrid}>
        {iconNames.map(name=><article className={styles.iconCard} key={name}>
          <span><Icon name={name} size={22}/></span>
          <code>{name}</code>
        </article>)}
      </div>
    </section>

    <footer className={styles.footer}>
      <strong>DESWEB UI Kit</strong>
      <p>Fase 2 incorporará primitives funcionales y documentados sobre estas foundations.</p>
    </footer>
  </main>;
}
