-- Once used operationally, a company/location can be deactivated, not erased.
ALTER TABLE organizations ADD COLUMN deletion_locked boolean NOT NULL DEFAULT false;
ALTER TABLE sites ADD COLUMN deletion_locked boolean NOT NULL DEFAULT false;
ALTER TABLE locations ADD COLUMN deletion_locked boolean NOT NULL DEFAULT false;

CREATE FUNCTION cmms_mark_history(org uuid, site uuid, location uuid) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  -- Always update (including already-locked rows). These row locks serialize
  -- operational writes with a concurrent parent DELETE, before FK cascades run.
  UPDATE organizations SET deletion_locked=true WHERE id=org;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization no longer exists' USING ERRCODE='23503';
  END IF;
  IF site IS NOT NULL THEN
    UPDATE sites SET deletion_locked=true WHERE id=site AND organization_id=org;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Site does not belong to organization' USING ERRCODE='23503';
    END IF;
  END IF;
  IF location IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM locations WHERE id=location AND organization_id=org AND site_id=site) THEN
      RAISE EXCEPTION 'Location does not belong to site' USING ERRCODE='23503';
    END IF;
    WITH RECURSIVE ancestors AS (
      SELECT id,parent_id FROM locations WHERE id=location AND organization_id=org
      UNION
      SELECT l.id,l.parent_id FROM locations l JOIN ancestors a ON l.id=a.parent_id WHERE l.organization_id=org
    )
    UPDATE locations SET deletion_locked=true WHERE id IN (SELECT id FROM ancestors);
  END IF;
END;
$$;

CREATE FUNCTION cmms_mark_record_history(payload jsonb) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  org uuid := (payload->>'organization_id')::uuid;
  related record;
  reference_id uuid;
BEGIN
  IF org IS NULL THEN RETURN; END IF;
  PERFORM cmms_mark_history(org,(payload->>'site_id')::uuid,(payload->>'location_id')::uuid);
  reference_id := (payload->>'asset_id')::uuid;
  IF reference_id IS NOT NULL THEN
    SELECT organization_id,site_id,location_id INTO related FROM assets WHERE id=reference_id;
    IF FOUND THEN PERFORM cmms_mark_history(related.organization_id,related.site_id,related.location_id); END IF;
  END IF;
  reference_id := (payload->>'item_id')::uuid;
  IF reference_id IS NOT NULL THEN
    SELECT organization_id,site_id,location_id INTO related FROM inventory_items WHERE id=reference_id;
    IF FOUND THEN PERFORM cmms_mark_history(related.organization_id,related.site_id,related.location_id); END IF;
  END IF;
  reference_id := (payload->>'work_order_id')::uuid;
  IF reference_id IS NOT NULL THEN
    SELECT organization_id,site_id,location_id INTO related FROM work_orders WHERE id=reference_id;
    IF FOUND THEN PERFORM cmms_mark_history(related.organization_id,related.site_id,related.location_id); END IF;
  END IF;
  reference_id := (payload->>'meter_id')::uuid;
  IF reference_id IS NOT NULL THEN
    SELECT a.organization_id,a.site_id,a.location_id INTO related FROM meters m JOIN assets a ON a.id=m.asset_id WHERE m.id=reference_id;
    IF FOUND THEN PERFORM cmms_mark_history(related.organization_id,related.site_id,related.location_id); END IF;
  END IF;
  -- Audit entries may outlive their source record. Resolve physical scopes
  -- while they still exist; the organization marker remains even if not.
  IF payload->>'entity_type' IN ('site','sites') THEN
    SELECT organization_id,id AS site_id,NULL::uuid AS location_id INTO related FROM sites WHERE id::text=payload->>'entity_id';
    IF FOUND THEN PERFORM cmms_mark_history(related.organization_id,related.site_id,related.location_id); END IF;
  ELSIF payload->>'entity_type' IN ('location','locations') THEN
    SELECT organization_id,site_id,id AS location_id INTO related FROM locations WHERE id::text=payload->>'entity_id';
    IF FOUND THEN PERFORM cmms_mark_history(related.organization_id,related.site_id,related.location_id); END IF;
  END IF;
END;
$$;

CREATE FUNCTION cmms_record_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='UPDATE' THEN PERFORM cmms_mark_record_history(to_jsonb(OLD)); END IF;
  PERFORM cmms_mark_record_history(to_jsonb(NEW));
  RETURN NEW;
END;
$$;

-- Backfill before enabling guards. Capture both creation of operational records
-- and their later movements; status (including cancelled/retired) is irrelevant.
DO $$
DECLARE
  table_name text;
  existing record;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['assets','inventory_items','work_orders','maintenance_plans',
    'meters','meter_readings','inventory_transactions','work_order_tasks','work_order_comments','attachments','audit_log']
  LOOP
    FOR existing IN EXECUTE format('SELECT to_jsonb(t) AS data FROM %I t',table_name)
    LOOP
      PERFORM cmms_mark_record_history(existing.data);
    END LOOP;
    EXECUTE format('CREATE TRIGGER protect_history BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION cmms_record_history()',table_name);
  END LOOP;
END;
$$;

CREATE FUNCTION cmms_guard_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='UPDATE' THEN
    -- A moved or removed record never erases the former scope's history.
    IF OLD.deletion_locked THEN NEW.deletion_locked := true; END IF;
    RETURN NEW;
  END IF;
  IF OLD.deletion_locked THEN
    RAISE EXCEPTION 'History protected: deactivate instead of deleting' USING ERRCODE='P2001';
  END IF;
  IF TG_TABLE_NAME='organizations' THEN
    IF EXISTS (SELECT 1 FROM sites WHERE organization_id=OLD.id AND deletion_locked)
      OR EXISTS (SELECT 1 FROM locations WHERE organization_id=OLD.id)
      OR EXISTS (SELECT 1 FROM suppliers WHERE organization_id=OLD.id)
      OR EXISTS (SELECT 1 FROM organization_members WHERE organization_id=OLD.id)
      OR EXISTS (SELECT 1 FROM asset_categories WHERE organization_id=OLD.id) THEN
      RAISE EXCEPTION 'Linked records protected' USING ERRCODE='P2001';
    END IF;
  ELSIF TG_TABLE_NAME='sites' THEN
    IF EXISTS (SELECT 1 FROM locations WHERE site_id=OLD.id)
      OR EXISTS (SELECT 1 FROM organization_members WHERE site_id=OLD.id) THEN
      RAISE EXCEPTION 'Linked records protected' USING ERRCODE='P2001';
    END IF;
  ELSIF TG_TABLE_NAME='locations' THEN
    IF EXISTS (SELECT 1 FROM locations WHERE parent_id=OLD.id) THEN
      RAISE EXCEPTION 'Remove empty children first' USING ERRCODE='P2001';
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER guard_history BEFORE DELETE OR UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION cmms_guard_history();
CREATE TRIGGER guard_history BEFORE DELETE OR UPDATE ON sites FOR EACH ROW EXECUTE FUNCTION cmms_guard_history();
CREATE TRIGGER guard_history BEFORE DELETE OR UPDATE ON locations FOR EACH ROW EXECUTE FUNCTION cmms_guard_history();
