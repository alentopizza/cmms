import fs from "node:fs";

function read(path){return fs.readFileSync(path,"utf8");}
function expect(source,needle,label){if(!source.includes(needle))throw new Error(label+" missing: "+needle);}

const subnav=read("components/InventorySubnav.tsx");
for(const needle of [
  "/dashboard/inventory?view=summary",
  "/dashboard/inventory?view=products",
  "/dashboard/inventory/categories",
  "/dashboard/inventory/warehouses",
  "/dashboard/inventory/kardex?type=receipt",
  "/dashboard/inventory/kardex?type=issue",
  "/dashboard/inventory/kardex?type=adjustment",
  "/dashboard/inventory/kardex?type=transfer",
  "/dashboard/inventory/kardex",
  "/dashboard/inventory?view=reports",
  "/dashboard/inventory?view=settings",
])expect(subnav,needle,"inventory subnav");
if(/\/dashboard\/inventory#/.test(subnav))throw new Error("Inventory subnav still uses hash anchors");

const page=read("app/dashboard/inventory/page.tsx");
expect(page,"INVENTORY_MAIN_VIEWS","inventory view registry");
for(const view of ["summary","products","reports","settings"])expect(page,'view==="'+view+'"',"inventory central view "+view);
expect(page,"<InventorySubnav active={view}/>","inventory active subnav");
expect(page,'name="view" value="products"',"product sort preserves central view");
if(/\/dashboard\/inventory#/.test(page))throw new Error("Inventory main page still uses hash navigation");

const css=read("app/globals.css");
for(const needle of [".inventory-catalog-grid","repeat(4,minmax(0,1fr))","@media(max-width:460px)"])expect(css,needle,"inventory responsive cards");

console.log("Inventory independent views UX smoke: OK");
