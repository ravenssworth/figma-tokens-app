require('dotenv').config()
const express = require('express')
const cors = require('cors')
const path = require('path')
const fs = require('fs/promises')
const os = require('os')
const { execFile } = require('child_process')
const { promisify } = require('util')
const app = express()
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const JWT_SECRET = process.env.JWT_SECRET
const PORT = process.env.APP_PORT || 3000
const execFileAsync = promisify(execFile)

app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, './client_dist')))

const pool = require('./database.js')
const { runMigrations } = require('./dbMigrations.js')
const { logVersionEvent } = require('./versionHistory.js')
const { resolveProjectId, parseProjectIdQuery } = require('./projects.js')

const { hasVariableChanged, deepEqual } = require('./utils/tokensUtils')

const authenticateToken = (req, res, next) => {
	const authHeader = req.headers['authorization']
	const token = authHeader && authHeader.split(' ')[1]

	if (!token) {
		return res
			.status(401)
			.json({ success: false, error: 'Требуется авторизация' })
	}

	jwt.verify(token, JWT_SECRET, (err, user) => {
		if (err) {
			return res.status(403).json({ success: false, error: 'Неверный токен' })
		}
		req.user = user
		next()
	})
}

try {
	const utils = require('./utils/tokensUtils.js')
	console.log('Функции импортированы:', Object.keys(utils))
} catch (error) {
	console.error('Ошибка импорта:', error.message)
}

pool
	.query('SELECT 1 + 1 AS solution')
	.then(async ([rows]) => {
		console.log('Подключение к БД успешно. Результат теста:', rows[0].solution)
		try {
			await runMigrations()
		} catch (err) {
			console.error('Ошибка миграций БД:', err.message)
		}
	})
	.catch(err => console.error('Ошибка подключения к БД:', err.message))

app.get('/', (req, res) => {
	res.send('Сервер для приёма дизайн-токенов работает!')
})

app.get('/api/projects', async (req, res) => {
	try {
		const [rows] = await pool.query(
			`SELECT p.id, p.name, p.created_at, p.updated_at,
              COUNT(DISTINCT c.id) AS collections_count
       FROM projects p
       LEFT JOIN collections c ON c.project_id = p.id
       GROUP BY p.id, p.name, p.created_at, p.updated_at
       ORDER BY p.updated_at DESC, p.id DESC`
		)
		res.json({ success: true, data: rows })
	} catch (error) {
		console.error('Ошибка получения проектов:', error)
		res.status(500).json({ success: false, error: 'Database error' })
	}
})

app.post('/api/projects', async (req, res) => {
	try {
		const name = String(req.body?.name || '').trim()
		if (!name) {
			return res.status(400).json({
				success: false,
				error: 'Укажите название проекта',
			})
		}

		const [existing] = await pool.query('SELECT * FROM projects WHERE name = ?', [
			name,
		])
		if (existing.length > 0) {
			return res.json({ success: true, data: existing[0], created: false })
		}

		const [result] = await pool.query('INSERT INTO projects (name) VALUES (?)', [
			name,
		])
		const [rows] = await pool.query('SELECT * FROM projects WHERE id = ?', [
			result.insertId,
		])
		res.status(201).json({ success: true, data: rows[0], created: true })
	} catch (error) {
		console.error('Ошибка создания проекта:', error)
		res.status(500).json({ success: false, error: 'Database error' })
	}
})

app.post('/api/tokens', async (req, res) => {
	console.log('Обработка полученных токенов...')
	const {
		variables: newVariables,
		collections,
		projectId,
		projectName,
	} = req.body

	if (!newVariables || !collections) {
		return res.status(400).json({
			success: false,
			error: 'Отсутствуют необходимые данные',
		})
	}

	const connection = await pool.getConnection()

	try {
		let resolvedProjectId
		try {
			resolvedProjectId = await resolveProjectId(connection, {
				projectId,
				projectName,
			})
		} catch (err) {
			return res.status(400).json({ success: false, error: err.message })
		}

		await connection.beginTransaction()

		const stats = { created: 0, updated: 0, deleted: 0, unchanged: 0 }

		for (const collection of collections) {
			await connection.execute(
				`INSERT INTO collections (project_id, id, name, modes, created_at) 
                 VALUES (?, ?, ?, ?, NOW()) 
                 ON DUPLICATE KEY UPDATE 
                 name = VALUES(name), 
                 modes = VALUES(modes)`,
				[
					resolvedProjectId,
					collection.id,
					collection.name,
					JSON.stringify(collection.modes),
				]
			)
		}

		for (const collection of collections) {
			const [existingVariables] = await connection.query(
				`SELECT * FROM variables 
         WHERE project_id = ? AND collection_id = ? AND is_deleted = FALSE`,
				[resolvedProjectId, collection.id]
			)

			const existingVarMap = new Map()
			existingVariables.forEach(v => existingVarMap.set(v.id, v))

			const newVarsInCollection = newVariables.filter(
				v => v.collectionId === collection.id
			)
			const newVarMap = new Map()
			newVarsInCollection.forEach(v => newVarMap.set(v.id, v))

			for (const newVar of newVarsInCollection) {
				const existingVar = existingVarMap.get(newVar.id)

				if (!existingVar) {
					await connection.execute(
						`INSERT INTO variables (id, name, type, values_by_mode, project_id, collection_id, created_at) 
                         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
						[
							newVar.id,
							newVar.name,
							newVar.type,
							JSON.stringify(newVar.valuesByMode),
							resolvedProjectId,
							collection.id,
						]
					)

					await connection.execute(
						`INSERT INTO variable_history (variable_id, values_by_mode, changed_at, change_type) 
                         VALUES (?, ?, NOW(), 'created')`,
						[newVar.id, JSON.stringify(newVar.valuesByMode)]
					)

					stats.created++
					console.log(`Создана: "${newVar.name}"`)
				} else {
					const hasChanged =
						hasVariableChanged(
							existingVar.values_by_mode,
							newVar.valuesByMode
						) || existingVar.name !== newVar.name

					if (hasChanged) {
						await connection.execute(
							`UPDATE variables 
                             SET name = ?, type = ?, values_by_mode = ?, updated_at = NOW()
                             WHERE id = ?`,
							[
								newVar.name,
								newVar.type,
								JSON.stringify(newVar.valuesByMode),
								newVar.id,
							]
						)

						await connection.execute(
							`INSERT INTO variable_history (variable_id, values_by_mode, changed_at, change_type) 
                             VALUES (?, ?, NOW(), 'updated')`,
							[newVar.id, JSON.stringify(newVar.valuesByMode)]
						)

						stats.updated++
						console.log(`Обновлена: "${newVar.name}"`)
					} else {
						stats.unchanged++
					}
				}

				existingVarMap.delete(newVar.id)
			}

			for (const deletedVar of existingVarMap.values()) {
				await connection.execute(
					`UPDATE variables 
                     SET is_deleted = TRUE, deleted_at = NOW(), updated_at = NOW()
                     WHERE id = ?`,
					[deletedVar.id]
				)

				await connection.execute(
					`INSERT INTO variable_history (variable_id, values_by_mode, changed_at, change_type) 
                     VALUES (?, ?, NOW(), 'deleted')`,
					[deletedVar.id, deletedVar.values_by_mode]
				)

				stats.deleted++
				console.log(`Помечена как удалённая: "${deletedVar.name}"`)
			}
		}

		await connection.commit()

		console.log('\nИТОГИ ОБРАБОТКИ:')
		console.log(`   Создано: ${stats.created}`)
		console.log(`   Обновлено: ${stats.updated}`)
		console.log(`   Удалено: ${stats.deleted}`)
		console.log(`   Без изменений: ${stats.unchanged}`)

		res.status(200).json({
			success: true,
			message: 'Обработка завершена',
			projectId: resolvedProjectId,
			stats: stats,
		})
	} catch (error) {
		await connection.rollback()
		console.error('❌ Ошибка при сохранении в БД:', error)
		res.status(500).json({
			success: false,
			error: 'Ошибка при обработке данных',
			details: error.message,
		})
	} finally {
		connection.release()
	}
})

app.get('/api/collections', async (req, res) => {
	try {
		const projectId = parseProjectIdQuery(req.query.projectId)
		if (!projectId) {
			return res.status(400).json({
				success: false,
				error: 'Укажите projectId в query-параметре',
			})
		}

		const [rows] = await pool.query(
			'SELECT * FROM collections WHERE project_id = ? ORDER BY created_at DESC',
			[projectId]
		)
		res.json({ success: true, data: rows })
	} catch (error) {
		console.error('Ошибка получения коллекций:', error)
		res.status(500).json({ success: false, error: 'Database error' })
	}
})

app.get('/api/variables', async (req, res) => {
	try {
		const projectId = parseProjectIdQuery(req.query.projectId)
		const { collectionId } = req.query

		if (!projectId) {
			return res.status(400).json({
				success: false,
				error: 'Укажите projectId в query-параметре',
			})
		}

		let query = `
      SELECT v.*, c.name AS collection_name
      FROM variables v
      LEFT JOIN collections c
        ON v.project_id = c.project_id AND v.collection_id = c.id
      WHERE v.project_id = ?`
		const params = [projectId]

		if (collectionId) {
			query += ' AND v.collection_id = ?'
			params.push(collectionId)
		}

		query += ' ORDER BY v.created_at DESC'
		const [rows] = await pool.query(query, params)
		res.json({ success: true, data: rows })
	} catch (error) {
		console.error('Ошибка получения переменных:', error)
		res.status(500).json({ success: false, error: 'Database error' })
	}
})

app.get('/api/variables/:id/history', async (req, res) => {
	try {
		const [rows] = await pool.query(
			'SELECT * FROM variable_history WHERE variable_id = ? ORDER BY changed_at DESC',
			[req.params.id]
		)
		res.json({ success: true, data: rows })
	} catch (error) {
		console.error('Ошибка получения истории:', error)
		res.status(500).json({ success: false, error: 'Database error' })
	}
})

app.get('/api/variables/parsed', async (req, res) => {
	try {
		const projectId = parseProjectIdQuery(req.query.projectId)
		if (!projectId) {
			return res.status(400).json({
				success: false,
				error: 'Укажите projectId в query-параметре',
			})
		}

		const [variables] = await pool.query(
			`
            SELECT v.*, c.name AS collection_name 
            FROM variables v 
            LEFT JOIN collections c
              ON v.project_id = c.project_id AND v.collection_id = c.id
            WHERE v.project_id = ?
            ORDER BY v.name
        `,
			[projectId]
		)

		const variableMap = {}
		variables.forEach(v => {
			v.parsedValues = JSON.parse(v.values_by_mode)
			variableMap[v.id] = v
		})

		const resolveValue = (value, visited = new Set()) => {
			if (!value || typeof value !== 'object' || visited.has(value.id)) {
				return value
			}

			if (value.type === 'VARIABLE_ALIAS' && value.id) {
				const targetVar = variableMap[value.id]
				if (targetVar) {
					visited.add(value.id)
					const firstMode =
						targetVar.parsedValues[Object.keys(targetVar.parsedValues)[0]]
					return resolveValue(firstMode, visited)
				}
				return { error: `Unknown alias: ${value.id}` }
			}

			if (value.r !== undefined) {
				return rgbToHex(value.r, value.g, value.b, value.a)
			}

			return value
		}

		const enhancedVariables = variables.map(v => {
			const resolvedValues = {}

			Object.entries(v.parsedValues).forEach(([modeId, value]) => {
				resolvedValues[modeId] = resolveValue(value)
			})

			const firstModeValue = resolvedValues[Object.keys(resolvedValues)[0]]

			return {
				...v,
				resolvedValue: firstModeValue,
				isAlias:
					v.parsedValues[Object.keys(v.parsedValues)[0]]?.type ===
					'VARIABLE_ALIAS',
				originalValues: v.parsedValues,
			}
		})

		res.json({ success: true, data: enhancedVariables })
	} catch (error) {
		console.error('Ошибка получения переменных:', error)
		res.status(500).json({ success: false, error: 'Database error' })
	}
})

app.get('/api/collections/:collectionId/versions', async (req, res) => {
	try {
		const projectId = parseProjectIdQuery(req.query.projectId)
		if (!projectId) {
			return res.status(400).json({
				success: false,
				error: 'Укажите projectId в query-параметре',
			})
		}

		const [rows] = await pool.query(
			`SELECT id, project_id, collection_id, version_name, version_tag, description, created_at, deleted_at
       FROM collection_versions
       WHERE project_id = ? AND collection_id = ? AND deleted_at IS NULL
       ORDER BY created_at DESC`,
			[projectId, req.params.collectionId]
		)
		res.json({ success: true, data: rows })
	} catch (error) {
		console.error('Ошибка получения версий коллекции:', error)
		res.status(500).json({ success: false, error: 'Database error' })
	}
})

app.get('/api/collections/:collectionId/version-history', async (req, res) => {
	try {
		const projectId = parseProjectIdQuery(req.query.projectId)
		if (!projectId) {
			return res.status(400).json({
				success: false,
				error: 'Укажите projectId в query-параметре',
			})
		}

		const [rows] = await pool.query(
			`SELECT id, version_id, project_id, collection_id, event_type, version_name, version_tag,
              description, created_at
       FROM version_history
       WHERE project_id = ? AND collection_id = ?
       ORDER BY created_at DESC`,
			[projectId, req.params.collectionId]
		)
		res.json({ success: true, data: rows })
	} catch (error) {
		console.error('Ошибка получения истории версий:', error)
		res.status(500).json({ success: false, error: 'Database error' })
	}
})

app.post(
	'/api/collections/:collectionId/versions',
	authenticateToken,
	async (req, res) => {
		const { collectionId } = req.params
		const { version_name, description, version_tag, projectId } = req.body

		const connection = await pool.getConnection()
		try {
			let resolvedProjectId
			try {
				resolvedProjectId = await resolveProjectId(connection, { projectId })
			} catch (err) {
				return res.status(400).json({ success: false, error: err.message })
			}

			await connection.beginTransaction()

			const [variables] = await connection.query(
				`SELECT * FROM variables
         WHERE project_id = ? AND collection_id = ? AND is_deleted = FALSE`,
				[resolvedProjectId, collectionId]
			)

			const snapshotData = JSON.stringify(variables)

			const [result] = await connection.query(
				`INSERT INTO collection_versions 
       (project_id, collection_id, version_name, version_tag, description, snapshot_data) 
       VALUES (?, ?, ?, ?, ?, ?)`,
				[
					resolvedProjectId,
					collectionId,
					version_name,
					version_tag || 'черновик',
					description || '',
					snapshotData,
				]
			)

			await connection.commit()

			const [newVersion] = await connection.query(
				'SELECT * FROM collection_versions WHERE id = ?',
				[result.insertId]
			)

			await logVersionEvent(connection, {
				versionId: result.insertId,
				projectId: resolvedProjectId,
				collectionId,
				eventType: 'created',
				versionName: version_name,
				versionTag: version_tag || 'черновик',
				description: description || '',
			})

			res.json({
				success: true,
				data: newVersion[0],
				message: `Версия "${version_name}" создана`,
			})
		} catch (error) {
			await connection.rollback()
			console.error('Ошибка создания версии:', error)
			res.status(500).json({ success: false, error: 'Database error' })
		} finally {
			connection.release()
		}
	}
)

app.delete('/api/versions/:versionId', authenticateToken, async (req, res) => {
	const connection = await pool.getConnection()
	try {
		await connection.beginTransaction()

		const [versions] = await connection.query(
			'SELECT * FROM collection_versions WHERE id = ? AND deleted_at IS NULL',
			[req.params.versionId]
		)

		if (versions.length === 0) {
			await connection.rollback()
			return res
				.status(404)
				.json({ success: false, error: 'Версия не найдена или уже удалена' })
		}

		const version = versions[0]

		await connection.query(
			'UPDATE collection_versions SET deleted_at = NOW() WHERE id = ?',
			[version.id]
		)

		await logVersionEvent(connection, {
			versionId: version.id,
			projectId: version.project_id,
			collectionId: version.collection_id,
			eventType: 'deleted',
			versionName: version.version_name,
			versionTag: version.version_tag,
			description: version.description,
		})

		await connection.commit()

		res.json({
			success: true,
			message: `Версия "${version.version_name}" удалена`,
		})
	} catch (error) {
		await connection.rollback()
		console.error('Ошибка удаления версии:', error)
		res.status(500).json({ success: false, error: 'Database error' })
	} finally {
		connection.release()
	}
})

app.get('/api/versions/:versionId/variables', async (req, res) => {
	try {
		const [versions] = await pool.query(
			'SELECT * FROM collection_versions WHERE id = ? AND deleted_at IS NULL',
			[req.params.versionId]
		)

		if (versions.length === 0) {
			return res
				.status(404)
				.json({ success: false, error: 'Версия не найдена' })
		}

		const version = versions[0]

		let variables = []
		if (typeof version.snapshot_data === 'string') {
			try {
				variables = JSON.parse(version.snapshot_data)
			} catch (parseError) {
				console.error('Ошибка парсинга snapshot_data:', parseError)
				variables = []
			}
		} else {
			variables = version.snapshot_data
		}

		variables.forEach(v => {
			v.from_version = version.id
			v.version_name = version.version_name
		})

		res.json({ success: true, data: variables })
	} catch (error) {
		console.error('Ошибка получения переменных версии:', error)
		res.status(500).json({ success: false, error: 'Database error' })
	}
})

app.post('/api/npm/package', async (req, res) => {
	const {
		packageName,
		packageVersion,
		entryFileName,
		entryFileContent,
		shouldPublish,
		npmToken,
	} = req.body || {}

	if (!packageName || !packageVersion || !entryFileName || !entryFileContent) {
		return res.status(400).json({
			success: false,
			error: 'Не хватает данных для сборки npm-пакета',
		})
	}

	const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'tokens-npm-'))
	const packageDir = path.join(tempRoot, 'package')
	const packageJsonPath = path.join(packageDir, 'package.json')
	const readmePath = path.join(packageDir, 'README.md')
	const entryPath = path.join(packageDir, entryFileName)
	const indexJsPath = path.join(packageDir, 'index.js')
	const npmRcPath = path.join(packageDir, '.npmrc')

	try {
		await fs.mkdir(packageDir, { recursive: true })

		const packageJson = {
			name: packageName,
			version: packageVersion,
			description: 'Design tokens package generated from Figma Tokens App',
			main: 'index.js',
			files: ['index.js', entryFileName, 'README.md'],
			license: 'MIT',
			sideEffects: [entryFileName.endsWith('.css') ? entryFileName : '*.css'],
		}

		const jsExportLine = entryFileName.endsWith('.json')
			? `module.exports = require('./${entryFileName}')`
			: `module.exports = '${entryFileName}'`
		const jsCssImportLine = entryFileName.endsWith('.css')
			? `require('./${entryFileName}')\n`
			: ''

		await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf-8')
		await fs.writeFile(
			readmePath,
			`# ${packageName}\n\nАвтогенерируемый пакет дизайн-токенов.\n`,
			'utf-8',
		)
		await fs.writeFile(entryPath, entryFileContent, 'utf-8')
		await fs.writeFile(indexJsPath, `${jsCssImportLine}${jsExportLine}\n`, 'utf-8')

		const { stdout: packStdout } = await execFileAsync('npm', ['pack'], {
			cwd: packageDir,
		})
		const tgzFileName = packStdout
			.split('\n')
			.map(line => line.trim())
			.filter(Boolean)
			.pop()
		const tgzPath = path.join(packageDir, tgzFileName)
		const tgzBuffer = await fs.readFile(tgzPath)

		if (shouldPublish) {
			if (!npmToken) {
				return res.status(400).json({
					success: false,
					error: 'Для публикации нужен npm token',
				})
			}

			await fs.writeFile(
				npmRcPath,
				`//registry.npmjs.org/:_authToken=${npmToken}\n`,
				'utf-8',
			)

			await execFileAsync('npm', ['publish', '--access', 'public'], {
				cwd: packageDir,
				env: {
					...process.env,
					NPM_CONFIG_USERCONFIG: npmRcPath,
				},
			})

			return res.json({
				success: true,
				message: `Пакет ${packageName}@${packageVersion} опубликован`,
				published: true,
			})
		}

		return res.json({
			success: true,
			message: 'Пакет собран',
			fileName: tgzFileName,
			fileContentBase64: tgzBuffer.toString('base64'),
		})
	} catch (error) {
		console.error('Ошибка сборки/publish npm-пакета:', error)
		return res.status(500).json({
			success: false,
			error: 'Ошибка сборки/publish npm-пакета',
			details: error.message,
		})
	} finally {
		try {
			await fs.rm(tempRoot, { recursive: true, force: true })
		} catch (cleanupError) {
			console.error('Ошибка очистки temp папки:', cleanupError.message)
		}
	}
})

app.post('/api/auth/register', async (req, res) => {
	try {
		const { email, password, username } = req.body

		if (!email || !password) {
			return res
				.status(400)
				.json({ success: false, error: 'Email и пароль обязательны' })
		}

		const [existingUser] = await pool.query(
			'SELECT id FROM users WHERE email = ?',
			[email]
		)

		if (existingUser.length > 0) {
			return res
				.status(400)
				.json({ success: false, error: 'Пользователь уже существует' })
		}

		const saltRounds = 10
		const passwordHash = await bcrypt.hash(password, saltRounds)

		const [result] = await pool.query(
			'INSERT INTO users (email, password_hash, username) VALUES (?, ?, ?)',
			[email, passwordHash, username || null]
		)

		const token = jwt.sign({ userId: result.insertId, email }, JWT_SECRET, {
			expiresIn: '24h',
		})

		res.status(201).json({
			success: true,
			message: 'Пользователь успешно зарегистрирован',
			token,
			user: {
				id: result.insertId,
				email,
				username,
			},
		})
	} catch (error) {
		console.error('Ошибка регистрации:', error)
		res.status(500).json({ success: false, error: 'Ошибка сервера' })
	}
})

app.post('/api/auth/login', async (req, res) => {
	try {
		const { email, password } = req.body

		if (!email || !password) {
			return res
				.status(400)
				.json({ success: false, error: 'Email и пароль обязательны' })
		}

		const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [
			email,
		])

		if (users.length === 0) {
			return res
				.status(401)
				.json({ success: false, error: 'Неверный email или пароль' })
		}

		const user = users[0]

		const isPasswordValid = await bcrypt.compare(password, user.password_hash)

		if (!isPasswordValid) {
			return res
				.status(401)
				.json({ success: false, error: 'Неверный email или пароль' })
		}

		const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
			expiresIn: '24h',
		})

		res.json({
			success: true,
			message: 'Успешный вход',
			token,
			user: {
				id: user.id,
				email: user.email,
				username: user.username,
			},
		})
	} catch (error) {
		console.error('Ошибка входа:', error)
		res.status(500).json({ success: false, error: 'Ошибка сервера' })
	}
})

app.get('/api/auth/verify', authenticateToken, async (req, res) => {
	try {
		const [users] = await pool.query(
			'SELECT id, email, username FROM users WHERE id = ?',
			[req.user.userId]
		)

		if (users.length === 0) {
			return res.status(404).json({
				success: false,
				error: 'Пользователь не найден',
			})
		}

		const user = users[0]
		res.json({
			success: true,
			user: {
				id: user.id,
				email: user.email,
				username: user.username,
			},
		})
	} catch (error) {
		console.error('Ошибка проверки токена:', error)
		res.status(500).json({ success: false, error: 'Ошибка сервера' })
	}
})

app.listen(PORT, () => {
	console.log(`Сервер запущен на http://localhost:${PORT}`)
	console.log(
		`Endpoint для приёма токенов: POST http://localhost:${PORT}/api/tokens`
	)
})
