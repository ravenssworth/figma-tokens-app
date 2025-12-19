import React, { useState, useEffect } from 'react'
import { rgbToHex, getColorStyle } from '../../utils/tokenUtils'
import './HistoryPanel.css'

export function HistoryPanel({ collection, variables: propsVariables }) {
	const [history, setHistory] = useState([])
	const [loading, setLoading] = useState(true)
	const [selectedVariable, setSelectedVariable] = useState(null)
	const [startDate, setStartDate] = useState('')
	const [endDate, setEndDate] = useState('')
	const [variables, setVariables] = useState([])

	// Функция сброса периода на последние 7 дней
	const resetPeriod = () => {
		const end = new Date()
		const start = new Date()
		start.setDate(start.getDate() - 7)

		setEndDate(end.toISOString().split('T')[0])
		setStartDate(start.toISOString().split('T')[0])
	}

	// Инициализация периода при монтировании
	useEffect(() => {
		resetPeriod()
	}, [])

	// Загрузка переменных коллекции
	useEffect(() => {
		if (!collection?.id) {
			setVariables([])
			return
		}

		const loadVariables = async () => {
			try {
				const response = await fetch(
					`/api/variables?collectionId=${collection.id}`
				)
				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status}`)
				}
				const data = await response.json()
				if (data.success) {
					setVariables(Array.isArray(data.data) ? data.data : [])
				} else {
					setVariables([])
				}
			} catch (error) {
				console.error('Ошибка загрузки переменных:', error)
				setVariables([])
			}
		}

		// Если переменные переданы через props, используем их, иначе загружаем
		if (propsVariables && Array.isArray(propsVariables)) {
			setVariables(propsVariables)
		} else {
			loadVariables()
		}
	}, [collection, collection?.id, propsVariables])

	// Загрузка истории изменений
	useEffect(() => {
		if (!collection || !variables || variables.length === 0) {
			setHistory([])
			setLoading(false)
			return
		}

		const loadHistory = async () => {
			setLoading(true)
			try {
				// Получаем историю для всей коллекции
				const responses = await Promise.all(
					variables.map(v =>
						fetch(`/api/variables/${v.id}/history`)
							.then(res => res.json())
							.then(data => ({
								variable: v,
								history:
									data.success && Array.isArray(data.data) ? data.data : [],
							}))
							.catch(error => {
								console.error(`Ошибка загрузки истории для ${v.id}:`, error)
								return {
									variable: v,
									history: [],
								}
							})
					)
				)

				// Объединяем и сортируем по дате
				const allHistory = responses
					.flatMap(response => {
						if (!response.history || !Array.isArray(response.history)) {
							return []
						}
						return response.history.map(record => ({
							...record,
							variable: response.variable,
							formattedDate: new Date(record.changed_at).toLocaleDateString(
								'ru-RU',
								{
									day: '2-digit',
									month: '2-digit',
									year: 'numeric',
									hour: '2-digit',
									minute: '2-digit',
								}
							),
						}))
					})
					.sort((a, b) => new Date(b.changed_at) - new Date(a.changed_at))

				setHistory(allHistory)
			} catch (error) {
				console.error('Ошибка загрузки истории:', error)
				setHistory([])
			} finally {
				setLoading(false)
			}
		}

		loadHistory()
	}, [collection, variables])

	// Ранний возврат после всех хуков
	if (!collection) {
		return (
			<div className='history-empty'>
				<i className='fas fa-history'></i>
				<p>Выберите коллекцию для просмотра истории изменений</p>
			</div>
		)
	}

	// Фильтрация по выбранному периоду
	const filteredHistory = history.filter(record => {
		if (!startDate && !endDate) return true

		const recordDate = new Date(record.changed_at)
		const start = startDate ? new Date(startDate) : null
		const end = endDate ? new Date(endDate) : null

		// Устанавливаем время для корректного сравнения
		if (start) start.setHours(0, 0, 0, 0)
		if (end) end.setHours(23, 59, 59, 999)

		let isWithinRange = true
		if (start) isWithinRange = isWithinRange && recordDate >= start
		if (end) isWithinRange = isWithinRange && recordDate <= end

		return isWithinRange
	})

	// Статистика изменений
	const uniqueVariableIds = new Set(filteredHistory.map(h => h.variable_id))
	const stats = {
		totalChanges: filteredHistory.length,
		uniqueVariables: uniqueVariableIds.size,
		lastChange: filteredHistory[0]?.formattedDate || 'Нет изменений',
	}

	return (
		<div className='history-panel'>
			<div className='history-panel__header'>
				<div className='history-panel__header-title'>
					<h3>История изменений коллекции "{collection.name}"</h3>
					<span className='stat-value'>{stats.totalChanges}</span>
				</div>

				<div className='history-panel__controls'>
					<div className='history-panel__date-range-selector'>
						<div className='history-panel__date-input-group'>
							<input
								type='date'
								value={startDate}
								onChange={e => setStartDate(e.target.value)}
								className='history-panel__date-input'
							/>
							<span className='history-panel__date-separator'>—</span>
							<input
								type='date'
								value={endDate}
								onChange={e => setEndDate(e.target.value)}
								className='history-panel__date-input'
							/>
						</div>
						<button
							className='history-panel__reset-button'
							onClick={resetPeriod}
						>
							<i className='fas fa-redo'></i>
							Сбросить
						</button>
					</div>
				</div>
			</div>

			{loading ? (
				<div className='history-panel__loading'>
					<p>Загрузка истории изменений...</p>
				</div>
			) : filteredHistory.length === 0 ? (
				<div className='history-panel__empty'>
					<i className='fas fa-calendar-check'></i>
					<p>Нет изменений за выбранный период</p>
				</div>
			) : (
				<div className='history-panel__list'>
					{filteredHistory.map((record, index) => {
						// Находим предыдущее значение для той же переменной
						const prevRecord = history
							.slice(index + 1)
							.find(r => r.variable_id === record.variable_id)

						const isCreated = !prevRecord
						const changeType = isCreated ? 'created' : 'updated'

						// Парсим значения для использования в getColorStyle
						const parseValues = values => {
							if (!values) return null
							if (typeof values === 'string') {
								try {
									return JSON.parse(values)
								} catch {
									return null
								}
							}
							return values
						}

						const currentValues = parseValues(record.values_by_mode)
						const prevValues = prevRecord
							? parseValues(prevRecord.values_by_mode)
							: null

						return (
							<div
								key={record.id}
								className={`history-record history-record--${changeType} ${
									selectedVariable?.id === record.variable_id ? 'selected' : ''
								}`}
								onClick={() => setSelectedVariable(record.variable)}
								onKeyDown={e => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault()
										setSelectedVariable(record.variable)
									}
								}}
								role='button'
								tabIndex={0}
							>
								<div className='history-record__header'>
									<div className='history-record__date'>
										<i className='fas fa-clock' />
										{record.formattedDate}
									</div>
									<div
										className={`history-record__badge history-record__badge--${changeType}`}
									>
										<i
											className={`fas ${
												isCreated ? 'fa-plus-circle' : 'fa-edit'
											}`}
										/>
										{isCreated ? 'Создана' : 'Изменена'}
									</div>
								</div>

								<div className='history-record__body'>
									<div className='history-record__variable-info'>
										<div className='history-record__variable-name'>
											{record.variable.name}
										</div>
										<div className='history-record__variable-type'>
											{record.variable.type}
										</div>
									</div>

									<div className='history-record__values'>
										{isCreated ? (
											<div className='history-record__value history-record__value--new'>
												<div className='history-record__value-content'>
													{record.variable.type === 'COLOR' && (
														<span
															className='history-record__color-preview'
															style={getColorStyle(
																record.variable.type,
																currentValues,
																variables
															)}
														></span>
													)}
													<span className='history-record__value-text'>
														{formatHistoryValue(
															record.values_by_mode,
															record.variable.type
														)}
													</span>
												</div>
											</div>
										) : (
											<>
												<div className='history-record__value history-record__value--old'>
													<div className='history-record__value-content'>
														{record.variable.type === 'COLOR' && prevValues && (
															<span
																className='history-record__color-preview'
																style={getColorStyle(
																	record.variable.type,
																	prevValues,
																	variables
																)}
															></span>
														)}
														<span className='history-record__value-text'>
															{formatHistoryValue(
																prevRecord.values_by_mode,
																record.variable.type
															)}
														</span>
													</div>
												</div>
												<div className='history-record__arrow'> &rarr;</div>
												<div className='history-record__value history-record__value--new'>
													<div className='history-record__value-content'>
														{record.variable.type === 'COLOR' && (
															<span
																className='history-record__color-preview'
																style={getColorStyle(
																	record.variable.type,
																	currentValues,
																	variables
																)}
															></span>
														)}
														<span className='history-record__value-text'>
															{formatHistoryValue(
																record.values_by_mode,
																record.variable.type
															)}
														</span>
													</div>
												</div>
											</>
										)}
									</div>
								</div>
							</div>
						)
					})}
				</div>
			)}
		</div>
	)
}

// Функция форматирования значения для истории
function formatHistoryValue(valuesByMode, type) {
	if (!valuesByMode) return 'N/A'

	try {
		// Парсим JSON, если это строка
		const values =
			typeof valuesByMode === 'string' ? JSON.parse(valuesByMode) : valuesByMode

		if (!values || typeof values !== 'object') return 'N/A'

		const firstMode = Object.values(values)[0]

		if (!firstMode) return 'N/A'

		if (type === 'COLOR') {
			if (firstMode.type === 'VARIABLE_ALIAS') {
				return `→ ${firstMode.id}`
			}
			if (firstMode.r !== undefined) {
				const hexColor = rgbToHex(firstMode.r, firstMode.g, firstMode.b)
				return hexColor
			}
		}

		return typeof firstMode === 'object'
			? JSON.stringify(firstMode)
			: String(firstMode)
	} catch (error) {
		console.error('Ошибка форматирования значения:', error)
		return 'N/A'
	}
}
