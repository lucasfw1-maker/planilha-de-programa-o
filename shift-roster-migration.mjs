export async function migrateShiftRoster(client){
 const tx=await client.transaction('write');try{
 if((await tx.execute("SELECT value FROM settings WHERE key='shift_roster_v1'")).rows.length){await tx.commit();return;}
 const statements=[
 `CREATE TABLE IF NOT EXISTS shift_workers(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,name_key TEXT NOT NULL UNIQUE,role TEXT NOT NULL CHECK(role IN ('operador','ajudante','ambos')),active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),revision INTEGER NOT NULL DEFAULT 0,created_by INTEGER NOT NULL REFERENCES users(id))`,
 `CREATE TABLE IF NOT EXISTS shift_crews(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,name_key TEXT NOT NULL UNIQUE,operator_id INTEGER NOT NULL REFERENCES shift_workers(id),helper_id INTEGER NOT NULL REFERENCES shift_workers(id),extra_id INTEGER REFERENCES shift_workers(id),active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),revision INTEGER NOT NULL DEFAULT 0,created_by INTEGER NOT NULL REFERENCES users(id),CHECK(operator_id<>helper_id),CHECK(extra_id IS NULL OR (extra_id<>operator_id AND extra_id<>helper_id)))`,
 `CREATE TABLE IF NOT EXISTS shift_pump_defaults(pump_id INTEGER PRIMARY KEY REFERENCES pumps(id),crew_id INTEGER NOT NULL REFERENCES shift_crews(id),updated_by INTEGER NOT NULL REFERENCES users(id),updated_at TEXT NOT NULL,effective_date TEXT NOT NULL DEFAULT '')`,
 `CREATE TABLE IF NOT EXISTS shift_schedules(id INTEGER PRIMARY KEY AUTOINCREMENT,date TEXT NOT NULL,branch TEXT NOT NULL CHECK(branch IN ('pacaembu','aeroporto')),revision INTEGER NOT NULL DEFAULT 1,snapshot_json TEXT NOT NULL,created_by INTEGER NOT NULL REFERENCES users(id),updated_by INTEGER NOT NULL REFERENCES users(id),created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(date,branch))`,
 `CREATE TABLE IF NOT EXISTS shift_versions(id INTEGER PRIMARY KEY AUTOINCREMENT,schedule_id INTEGER NOT NULL REFERENCES shift_schedules(id),version INTEGER NOT NULL,snapshot_json TEXT NOT NULL,created_by INTEGER NOT NULL REFERENCES users(id),created_at TEXT NOT NULL,UNIQUE(schedule_id,version))`,
 `CREATE TABLE IF NOT EXISTS shift_driver_assignments(schedule_id INTEGER NOT NULL REFERENCES shift_schedules(id),driver_id INTEGER NOT NULL REFERENCES lab_drivers(id),cb_id INTEGER REFERENCES maintenance_cbs(id),PRIMARY KEY(schedule_id,driver_id))`,
 `CREATE INDEX IF NOT EXISTS shift_driver_usage ON shift_driver_assignments(driver_id,cb_id)`,
 `CREATE INDEX IF NOT EXISTS shift_schedule_date ON shift_schedules(date,branch)`];
 for(const sql of statements)await tx.execute(sql);await tx.execute("INSERT INTO settings(key,value) VALUES('shift_roster_v1','1')");await tx.commit();
 }catch(e){try{await tx.rollback();}catch{}throw e;}finally{tx.close();}
}
