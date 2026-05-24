async function resolveProjectId(db, { projectId, projectName }) {
	if (projectId != null && projectId !== '') {
		const id = Number(projectId)
		if (!Number.isInteger(id) || id < 1) {
			throw new Error('Некорректный projectId')
		}
		const [rows] = await db.query('SELECT id FROM projects WHERE id = ?', [id])
		if (!rows.length) {
			throw new Error('Проект не найден')
		}
		return id
	}

	const name = String(projectName || '').trim()
	if (!name) {
		throw new Error('Укажите projectId или название проекта (projectName)')
	}

	const [existing] = await db.query('SELECT id FROM projects WHERE name = ?', [name])
	if (existing.length > 0) {
		return existing[0].id
	}

	const [result] = await db.query('INSERT INTO projects (name) VALUES (?)', [name])
	return result.insertId
}

function parseProjectIdQuery(value) {
	if (value == null || value === '') {
		return null
	}
	const id = Number(value)
	if (!Number.isInteger(id) || id < 1) {
		return null
	}
	return id
}

module.exports = { resolveProjectId, parseProjectIdQuery }
