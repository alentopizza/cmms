import { Pool, type QueryResultRow } from "pg";

const globalForDb = globalThis as unknown as { pool?: Pool };

function positiveInteger(value:string|undefined,fallback:number){
  const parsed=Number.parseInt(value||"",10);
  return Number.isFinite(parsed)&&parsed>0?parsed:fallback;
}

const poolMax=positiveInteger(process.env.DB_POOL_MAX,10);
const slowQueryMs=positiveInteger(process.env.DB_SLOW_QUERY_MS,0);

export const pool =
  globalForDb.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: poolMax,
  });

if (process.env.NODE_ENV !== "production") globalForDb.pool = pool;

function queryLabel(text:string){
  return text.replace(/\s+/g," ").trim().slice(0,220);
}

export async function query<T extends QueryResultRow>(text: string, params: unknown[] = []) {
  if(!slowQueryMs)return pool.query<T>(text, params);
  const started=performance.now();
  try{
    return await pool.query<T>(text, params);
  }finally{
    const duration=Math.round(performance.now()-started);
    if(duration>=slowQueryMs)console.warn("[db:slow]",duration+"ms",queryLabel(text));
  }
}
