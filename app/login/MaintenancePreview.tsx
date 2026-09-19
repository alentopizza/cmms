export default function MaintenancePreview() {
  return <div className="login-preview" aria-label="Vista previa ilustrativa del CMMS">
    <div className="preview-grid" />

    <div className="preview-card preview-card-health">
      <div className="preview-card-head">
        <div>
          <span className="preview-label">Disponibilidad de activos</span>
          <strong>96.8%</strong>
        </div>
        <span className="preview-badge positive">+2.4%</span>
      </div>
      <div className="availability-row">
        <div className="availability-ring" aria-hidden="true">
          <span>97%</span>
        </div>
        <div className="availability-legend">
          <div><span className="dot dot-ok" /> Operativos <strong>142</strong></div>
          <div><span className="dot dot-maint" /> En mantenimiento <strong>4</strong></div>
          <div><span className="dot dot-down" /> Detenidos <strong>1</strong></div>
        </div>
      </div>
    </div>

    <div className="preview-card preview-card-orders">
      <div className="preview-card-head">
        <div>
          <span className="preview-label">Órdenes de trabajo</span>
          <strong>24 abiertas</strong>
        </div>
        <span className="preview-chip">Esta semana</span>
      </div>
      <div className="orders-chart" aria-hidden="true">
        <span style={{ height: "35%" }} />
        <span style={{ height: "58%" }} />
        <span style={{ height: "46%" }} />
        <span style={{ height: "76%" }} />
        <span style={{ height: "62%" }} />
        <span style={{ height: "88%" }} />
        <span style={{ height: "70%" }} />
      </div>
      <div className="orders-footer">
        <span><i className="status-dot urgent" /> 3 urgentes</span>
        <span><i className="status-dot progress" /> 8 en curso</span>
        <span><i className="status-dot open" /> 13 pendientes</span>
      </div>
    </div>

    <div className="preview-card preview-card-preventive">
      <div className="preview-card-head">
        <div>
          <span className="preview-label">Mantenimiento preventivo</span>
          <strong>91% cumplimiento</strong>
        </div>
      </div>
      <div className="preventive-progress"><span /></div>
      <div className="preventive-items">
        <div><span>Hoy</span><strong>4 tareas</strong></div>
        <div><span>Próximos 7 días</span><strong>12 tareas</strong></div>
        <div><span>Vencidas</span><strong className="warning-text">2 tareas</strong></div>
      </div>
    </div>

    <div className="preview-card preview-card-critical">
      <div className="preview-card-head compact">
        <div>
          <span className="preview-label">Activos por criticidad</span>
          <strong>147 equipos</strong>
        </div>
      </div>
      <div className="criticality-bars" aria-hidden="true">
        <div><span>Crítica</span><i><b style={{ width: "22%" }} /></i><strong>8</strong></div>
        <div><span>Alta</span><i><b style={{ width: "46%" }} /></i><strong>22</strong></div>
        <div><span>Media</span><i><b style={{ width: "78%" }} /></i><strong>64</strong></div>
        <div><span>Baja</span><i><b style={{ width: "64%" }} /></i><strong>53</strong></div>
      </div>
    </div>

    <div className="preview-brand-block">
      <div className="preview-brand-icon">D</div>
      <div>
        <strong>Control de mantenimiento en un solo lugar</strong>
        <p>Activos, órdenes de trabajo, preventivos, repuestos y trazabilidad para cada empresa y sede.</p>
      </div>
    </div>

    <div className="preview-disclaimer">Vista ilustrativa · Los indicadores reales se calculan con los datos de cada empresa.</div>
  </div>;
}
