export async function migrateMaintenanceRole(client){
 const sql=(await client.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'")).rows[0]?.sql||'';
 if(!/CHECK/i.test(sql)||sql.includes("'manutencao'"))return;
 // One connection/sequence: foreign keys are disabled only during the atomic table rebuild.
 // Keeping the original parent name until DROP preserves all child FK definitions.
 await client.executeMultiple(`PRAGMA foreign_keys=OFF;
 BEGIN IMMEDIATE;
 CREATE TABLE users_maintenance_upgrade(id INTEGER PRIMARY KEY,name TEXT NOT NULL,username TEXT UNIQUE NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('programador','gerente','controlador','vendedor','manutencao')),active INTEGER NOT NULL DEFAULT 1,status TEXT NOT NULL DEFAULT 'aprovado',must_change INTEGER NOT NULL DEFAULT 0);
 INSERT INTO users_maintenance_upgrade SELECT id,name,username,password,role,active,status,must_change FROM users;
 DROP TABLE users;
 ALTER TABLE users_maintenance_upgrade RENAME TO users;
 CREATE TEMP TABLE maintenance_role_fk_check(n INTEGER CHECK(n=0));
 INSERT INTO maintenance_role_fk_check SELECT COUNT(*) FROM pragma_foreign_key_check;
 DROP TABLE maintenance_role_fk_check;
 COMMIT;
 PRAGMA foreign_keys=ON;`);
}
