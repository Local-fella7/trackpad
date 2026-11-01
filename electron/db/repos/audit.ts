import type Database from 'better-sqlite3'

export function writeAudit(db: Database.Database, userId: number | null, action: string, entity: string, entityId: number | null, details: unknown) {
  db.prepare('INSERT INTO audit_log (user_id, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?)')
    .run(userId, action, entity, entityId, JSON.stringify(details))
}
