export async function migrateLabTrials(client){
 const tx=await client.transaction('write');try{
 if((await tx.execute("SELECT value FROM settings WHERE key='lab_trials_v1'")).rows.length){await tx.commit();return;}
 const statements=[
 `CREATE TABLE IF NOT EXISTS lab_trial_materials(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('cimento','polifuncional','midrange','super')),price_kg REAL NOT NULL CHECK(price_kg>=0),density_kg_l REAL CHECK(density_kg_l>0),is_reference INTEGER NOT NULL DEFAULT 0 CHECK(is_reference IN (0,1)),active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),revision INTEGER NOT NULL DEFAULT 0,created_by INTEGER NOT NULL REFERENCES users(id),created_at TEXT NOT NULL)`,
 `CREATE UNIQUE INDEX IF NOT EXISTS lab_material_reference ON lab_trial_materials(kind) WHERE is_reference=1 AND active=1`,
 `CREATE TABLE IF NOT EXISTS lab_trials(id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('concreto','aditivo','cimento')),started_on TEXT NOT NULL,target_fck REAL NOT NULL CHECK(target_fck>0),objective TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'andamento' CHECK(status IN ('andamento','concluido')),revision INTEGER NOT NULL DEFAULT 0,created_by INTEGER NOT NULL REFERENCES users(id),created_at TEXT NOT NULL,updated_at TEXT NOT NULL)`,
 `CREATE TABLE IF NOT EXISTS lab_trial_variants(id INTEGER PRIMARY KEY AUTOINCREMENT,trial_id INTEGER NOT NULL REFERENCES lab_trials(id),name TEXT NOT NULL,is_reference INTEGER NOT NULL DEFAULT 0 CHECK(is_reference IN (0,1)),mix_json TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0,created_by INTEGER NOT NULL REFERENCES users(id),created_at TEXT NOT NULL)`,
 `CREATE UNIQUE INDEX IF NOT EXISTS lab_variant_reference ON lab_trial_variants(trial_id) WHERE is_reference=1`,
 `CREATE TABLE IF NOT EXISTS lab_trial_sets(id INTEGER PRIMARY KEY AUTOINCREMENT,variant_id INTEGER NOT NULL REFERENCES lab_trial_variants(id),label TEXT NOT NULL UNIQUE,set_type TEXT NOT NULL CHECK(set_type IN ('A','B','C')),molded_on TEXT NOT NULL,molded_time TEXT NOT NULL DEFAULT '',notes TEXT NOT NULL DEFAULT '',created_by INTEGER NOT NULL REFERENCES users(id),created_at TEXT NOT NULL)`,
 `CREATE TABLE IF NOT EXISTS lab_trial_cps(id INTEGER PRIMARY KEY AUTOINCREMENT,set_id INTEGER NOT NULL REFERENCES lab_trial_sets(id),number TEXT NOT NULL UNIQUE,target_age REAL NOT NULL CHECK(target_age>0),planned_on TEXT NOT NULL,planned_at TEXT,broken_on TEXT,broken_time TEXT NOT NULL DEFAULT '',strength_mpa REAL CHECK(strength_mpa>=0),result_notes TEXT NOT NULL DEFAULT '',invalidated_at TEXT,invalid_reason TEXT NOT NULL DEFAULT '',revision INTEGER NOT NULL DEFAULT 0,tested_by INTEGER REFERENCES users(id))`,
 `CREATE INDEX IF NOT EXISTS lab_trial_variants_trial ON lab_trial_variants(trial_id)`,
 `CREATE INDEX IF NOT EXISTS lab_trial_sets_variant ON lab_trial_sets(variant_id)`,
 `CREATE INDEX IF NOT EXISTS lab_trial_cps_set ON lab_trial_cps(set_id)`];
 for(const sql of statements)await tx.execute(sql);await tx.execute("INSERT INTO settings(key,value) VALUES('lab_trials_v1','1')");await tx.commit();
 }catch(e){try{await tx.rollback();}catch{}throw e;}finally{tx.close();}
}
