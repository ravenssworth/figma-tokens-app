// server.js
const express = require('express')
const cors = require('cors')
const path = require('path')
const app = express()
const PORT = process.env.PORT || 3000 // Сервер будет на http://localhost:3000

// Middleware
app.use(cors()) // Разрешаем запросы из браузера (от плагина)
app.use(express.json()) // Чтобы сервер мог читать JSON из тела запроса

// Подключение к БД (переместить ВВЕРХ, перед использованием pool)
const pool = require('./database.js')

// Тест подключения к БД
pool
	.query('SELECT 1 + 1 AS solution')
	.then(([rows]) =>
		console.log(
			'✅ Подключение к БД успешно. Результат теста:',
			rows[0].solution
		)
	)
	.catch(err => console.error('❌ Ошибка подключения к БД:', err.message))

// Простой маршрут для проверки, что сервер жив
app.get('/', (req, res) => {
	res.send('Сервер для приёма дизайн-токенов работает!')
})

// КЛЮЧЕВОЙ ЭНДПОИНТ: сюда плагин будет отправлять токены
app.post('/api/tokens', async (req, res) => {
	console.log('🔄 Начинаю обработку полученных токенов...')

	// Данные, присланные плагином, находятся в req.body
	const { variables, collections } = req.body

	// Проверяем, есть ли данные
	if (!variables || !collections) {
		return res.status(400).json({
			success: false,
			error: 'Отсутствуют необходимые данные (variables или collections)',
		})
	}

	console.log(
		`📊 Получено: ${collections.length} коллекций, ${variables.length} переменных`
	)

	// Получаем подключение из пула
	const connection = await pool.getConnection()

	try {
		// Начинаем транзакцию
		await connection.beginTransaction()

		console.log('💾 Сохраняю коллекции...')

		// 1. СОХРАНЕНИЕ КОЛЛЕКЦИЙ
		for (const collection of collections) {
			await connection.execute(
				`INSERT INTO collections (id, name, modes, created_at) 
                 VALUES (?, ?, ?, NOW()) 
                 ON DUPLICATE KEY UPDATE 
                 name = VALUES(name), 
                 modes = VALUES(modes)`,
				[
					collection.id,
					collection.name,
					JSON.stringify(collection.modes), // Преобразуем массив в JSON строку
				]
			)
			console.log(`   ✅ Коллекция: "${collection.name}"`)
		}

		console.log('💾 Сохраняю переменные и историю...')

		// 2. СОХРАНЕНИЕ ПЕРЕМЕННЫХ И ИХ ИСТОРИИ
		let savedVariables = 0
		for (const variable of variables) {
			// Сохраняем/обновляем переменную
			await connection.execute(
				`INSERT INTO variables (id, name, type, values_by_mode, collection_id, created_at) 
                 VALUES (?, ?, ?, ?, ?, NOW()) 
                 ON DUPLICATE KEY UPDATE 
                 name = VALUES(name), 
                 type = VALUES(type), 
                 values_by_mode = VALUES(values_by_mode), 
                 collection_id = VALUES(collection_id)`,
				[
					variable.id,
					variable.name,
					variable.type,
					JSON.stringify(variable.valuesByMode), // Преобразуем объект в JSON строку
					variable.collectionId || null, // Используем collectionId из данных плагина
				]
			)

			// Сохраняем запись в историю изменений
			await connection.execute(
				`INSERT INTO variable_history (variable_id, values_by_mode, changed_at) 
                 VALUES (?, ?, NOW())`,
				[variable.id, JSON.stringify(variable.valuesByMode)]
			)

			savedVariables++
		}

		// Фиксируем транзакцию
		await connection.commit()

		console.log(
			`🎉 Успешно сохранено: ${collections.length} коллекций, ${savedVariables} переменных`
		)

		// Отправляем успешный ответ
		res.status(200).json({
			success: true,
			message: `Сохранено: ${collections.length} коллекций, ${savedVariables} переменных`,
			stats: {
				collections: collections.length,
				variables: savedVariables,
			},
		})
	} catch (error) {
		// Откатываем транзакцию в случае ошибки
		await connection.rollback()
		console.error('❌ Ошибка при сохранении в БД:', error)

		// Отправляем ошибку клиенту
		res.status(500).json({
			success: false,
			error: 'Ошибка при сохранении данных',
			details: error.message,
		})
	} finally {
		// Всегда возвращаем подключение в пул
		connection.release()
	}
})

// API для получения коллекций
app.get('/api/collections', async (req, res) => {
	try {
		const [rows] = await pool.query(
			'SELECT * FROM collections ORDER BY created_at DESC'
		)
		res.json({ success: true, data: rows })
	} catch (error) {
		console.error('Ошибка получения коллекций:', error)
		res.status(500).json({ success: false, error: 'Database error' })
	}
})

// API для получения переменных с возможностью фильтрации по коллекции
app.get('/api/variables', async (req, res) => {
	try {
		const { collectionId } = req.query
		let query =
			'SELECT v.*, c.name as collection_name FROM variables v LEFT JOIN collections c ON v.collection_id = c.id'
		const params = []

		if (collectionId) {
			query += ' WHERE v.collection_id = ?'
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

// API для получения истории конкретной переменной
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
		// Получаем все переменные
		const [variables] = await pool.query(`
            SELECT v.*, c.name as collection_name 
            FROM variables v 
            LEFT JOIN collections c ON v.collection_id = c.id 
            ORDER BY v.name
        `)

		// Создаём карту для быстрого поиска по ID
		const variableMap = {}
		variables.forEach(v => {
			// Парсим JSON только один раз
			v.parsedValues = JSON.parse(v.values_by_mode)
			variableMap[v.id] = v
		})

		// Функция для рекурсивного разрешения ссылок
		const resolveValue = (value, visited = new Set()) => {
			// Если это не объект или уже посетили - возвращаем как есть
			if (!value || typeof value !== 'object' || visited.has(value.id)) {
				return value
			}

			// Если это ссылка на другую переменную
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

			// Если это цвет - преобразуем в HEX
			if (value.r !== undefined) {
				return rgbToHex(value.r, value.g, value.b, value.a)
			}

			return value
		}

		// Обрабатываем каждую переменную
		const enhancedVariables = variables.map(v => {
			const resolvedValues = {}

			// Обрабатываем все режимы
			Object.entries(v.parsedValues).forEach(([modeId, value]) => {
				resolvedValues[modeId] = resolveValue(value)
			})

			// Берем первый режим для отображения
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

// Запуск сервера
app.listen(PORT, () => {
	console.log(`🚀 Сервер запущен на http://localhost:${PORT}`)
	console.log(
		`📤 Endpoint для приёма токенов: POST http://localhost:${PORT}/api/tokens`
	)
})
