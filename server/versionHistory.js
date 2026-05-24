const pool = require('./database.js')

async function logVersionEvent(
	connection,
	{
		versionId,
		projectId,
		collectionId,
		eventType,
		versionName,
		versionTag,
		description,
		createdAt,
	}
) {
	const db = connection || pool
	await db.query(
		`INSERT INTO version_history
     (version_id, project_id, collection_id, event_type, version_name, version_tag, description, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, NOW()))`,
		[
			versionId,
			projectId,
			collectionId,
			eventType,
			versionName,
			versionTag || 'черновик',
			description || '',
			createdAt || null,
		]
	)
}

module.exports = { logVersionEvent }
