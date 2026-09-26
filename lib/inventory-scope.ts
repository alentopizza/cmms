import { canAccessSite, type AuthSession } from "@/lib/auth";

export function hasLimitedInventorySiteScope(session:AuthSession){
  return session.platformRole==="user"&&!session.accessAllSites;
}

export function canAccessInventoryOrganization(session:AuthSession,organizationId:string){
  return session.platformRole!=="user"||session.organizationId===organizationId;
}

// Product master scope preserves the current model during I0. A legacy product
// without site_id remains organization-scoped; I0 does not redefine its domain.
export function canAccessInventoryItem(session:AuthSession,organizationId:string,siteId:string|null){
  if(!canAccessInventoryOrganization(session,organizationId))return false;
  if(!hasLimitedInventorySiteScope(session))return true;
  return siteId===null||canAccessSite(session,siteId);
}

// Physical inventory is stricter: a site-limited user can only use a warehouse
// whose site is explicitly inside session.siteIds.
export function canAccessInventoryWarehouse(session:AuthSession,organizationId:string,siteId:string|null){
  if(!canAccessInventoryOrganization(session,organizationId))return false;
  if(!hasLimitedInventorySiteScope(session))return true;
  return Boolean(siteId&&canAccessSite(session,siteId));
}
