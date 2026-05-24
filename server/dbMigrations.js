const pool = require('./database.js')

async function columnExists(table, column) {
	const [rows] = await pool.query(
		`SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
		[table, column]
	)
	return rows[0].cnt > 0
}

async function tableExists(table) {
	const [rows] = await pool.query(
		`SELECT COUNT(*) AS cnt FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
		[table]
	)
	return rows[0].cnt > 0
}

async function runMigrations() {
	if (!(await columnExists('collection_versions', 'deleted_at'))) {
		await pool.query(
			'ALTER TABLE collection_versions ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL'
		)
		console.log('Миграция: добавлен deleted_at в collection_versions')
	}

	if (!(await tableExists('version_history'))) {
		await pool.query(`
      CREATE TABLE version_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        version_id INT NOT NULL,
        collection_id VARCHAR(255) NOT NULL,
        event_type VARCHAR(32) NOT NULL,
        version_name VARCHAR(255) NOT NULL,
        version_tag VARCHAR(64) NULL,
        description TEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_version_history_collection (collection_id),
        INDEX idx_version_history_version (version_id),
        INDEX idx_version_history_created (created_at)
      )
    `)
		console.log('Миграция: создана таблица version_history')
	}

	const [missing] = await pool.query(`
    SELECT cv.id, cv.collection_id, cv.version_name, cv.version_tag, cv.description, cv.created_at
    FROM collection_versions cv
    LEFT JOIN version_history vh ON vh.version_id = cv.id AND vh.event_type = 'created'
    WHERE vh.id IS NULL
  `)

	for (const row of missing) {
		await pool.query(
			`INSERT INTO version_history
       (version_id, collection_id, event_type, version_name, version_tag, description, created_at)
       VALUES (?, ?, 'created', ?, ?, ?, ?)`,
			[
				row.id,
				row.collection_id,
				row.version_name,
				row.version_tag || 'черновик',
				row.description || '',
				row.created_at,
			]
		)
	}

	if (missing.length > 0) {
		console.log(
			`Миграция: добавлено ${missing.length} записей created в version_history`
		)
	}
}

module.exports = { runMigrations }
