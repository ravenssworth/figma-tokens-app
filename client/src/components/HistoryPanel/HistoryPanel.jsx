import React, { useState, useEffect, useMemo } from 'react'
import {
	getColorStyle,
	getTypeLabel,
	formatValue,
} from '../../utils/tokenUtils'
import './HistoryPanel.css'

function parseHistoryValues(values) {
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

export function HistoryPanel({ collection, variables: propsVariables }) {
	const [history, setHistory] = useState([])
	const [loading, setLoading] = useState(true)
	const [selectedVariable, setSelectedVariable] = useState(null)
	const [startDate, setStartDate] = useState('')
	const [endDate, setEndDate] = useState('')
	const [isDateFilterActive, setIsDateFilterActive] = useState(false)
	const [nameSearch, setNameSearch] = useState('')
	const [allVariables, setAllVariables] = useState([])
	const [currentCollectionVariables, setCurrentCollectionVariables] = useState(
		[]
	)

	const resetPeriod = () => {
		const end = new Date()
		const start = new Date()
		start.setDate(start.getDate() - 7)

		setEndDate(end.toISOString().split('T')[0])
		setStartDate(start.toISOString().split('T')[0])
	}

	useEffect(() => {
		const loadAllVariables = async () => {
			try {
				const collectionsResponse = await fetch('/api/collections')
				if (!collectionsResponse.ok) return
				const collectionsData = await collectionsResponse.json()

				if (collectionsData.success && Array.isArray(collectionsData.data)) {
					const allVars = []
					for (const col of collectionsData.data) {
						const varsResponse = await fetch(
							`/api/variables?collectionId=${col.id}`
						)
						if (varsResponse.ok) {
							const varsData = await varsResponse.json()
							if (varsData.success && Array.isArray(varsData.data)) {
								allVars.push(...varsData.data)
							}
						}
					}
					setAllVariables(allVars)
				}
			} catch (error) {
				console.error('Ошибка загрузки всех переменных:', error)
			}
		}

		loadAllVariables()
	}, [])

	useEffect(() => {
		if (!collection?.id) {
			setCurrentCollectionVariables([])
			return
		}

		const loadCurrentVariables = async () => {
			try {
				const response = await fetch(
					`/api/variables?collectionId=${collection.id}`
				)
				if (!response.ok) return
				const data = await response.json()
				if (data.success && Array.isArray(data.data)) {
					setCurrentCollectionVariables(data.data)
				}
			} catch (error) {
				console.error('Ошибка загрузки переменных текущей коллекции:', error)
				setCurrentCollectionVariables([])
			}
		}

		if (propsVariables && Array.isArray(propsVariables)) {
			setCurrentCollectionVariables(propsVariables)
		} else {
			loadCurrentVariables()
		}
	}, [collection, collection?.id, propsVariables])

	useEffect(() => {
		if (!collection || currentCollectionVariables.length === 0) {
			setHistory([])
			setLoading(false)
			return
		}

		const loadHistory = async () => {
			setLoading(true)
			try {
				const responses = await Promise.all(
					currentCollectionVariables.map(v =>
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
	}, [collection, currentCollectionVariables])

	const variableChains = useMemo(() => {
		const map = new Map()
		for (const rec of history) {
			const id = rec.variable_id
			if (!map.has(id)) map.set(id, [])
			map.get(id).push(rec)
		}
		for (const list of map.values()) {
			list.sort((a, b) => new Date(a.changed_at) - new Date(b.changed_at))
		}
		return map
	}, [history])

	if (!collection) {
		return (
			<div className='history-empty'>
				<p>Выберите коллекцию для просмотра истории изменений</p>
			</div>
		)
	}

	const filteredHistory = history.filter(record => {
		if (isDateFilterActive) {
			const recordDate = new Date(record.changed_at)
			const start = startDate ? new Date(startDate) : null
			const end = endDate ? new Date(endDate) : null

			if (start) start.setHours(0, 0, 0, 0)
			if (end) end.setHours(23, 59, 59, 999)

			let isWithinRange = true
			if (start) isWithinRange = isWithinRange && recordDate >= start
			if (end) isWithinRange = isWithinRange && recordDate <= end
			if (!isWithinRange) return false
		}

		const q = nameSearch.trim().toLowerCase()
		if (q) {
			const name = (record.variable?.name || '').toLowerCase()
			if (!name.includes(q)) return false
		}

		return true
	})

	const uniqueVariableIds = new Set(filteredHistory.map(h => h.variable_id))
	const stats = {
		totalChanges: filteredHistory.length,
		uniqueVariables: uniqueVariableIds.size,
		lastChange: filteredHistory[0]?.formattedDate || 'Нет изменений',
	}

	const changeTypeLabels = {
		created: 'Создана',
		updated: 'Изменена',
		deleted: 'Удалена',
		restored: 'Восстановлена',
	}

	const emptyMessage =
		history.length === 0
			? 'Нет изменений в этой коллекции'
			: 'Нет записей по заданным условиям (период или поиск)'

	return (
		<div className='history-panel'>
			<div className='history-panel__header'>
				<div className='history-panel__header-main'>
					<div className='history-panel__header-title'>
						<h3>История изменений коллекции "{collection.name}"</h3>
						<span className='stat-value'>{stats.totalChanges}</span>
					</div>
					<p className='history-panel__header-meta'>
						Последнее изменение: {stats.lastChange}
					</p>
				</div>

				<div className='history-panel__toolbar'>
					<div className='history-panel__toolbar-search'>
						<label className='history-panel__toolbar-label' htmlFor='history-token-search'>
							Поиск
						</label>
						<input
							id='history-token-search'
							type='search'
							className='history-panel__search-input'
							placeholder='Имя или часть пути токена'
							value={nameSearch}
							onChange={e => setNameSearch(e.target.value)}
							autoComplete='off'
						/>
					</div>

					<div className='history-panel__toolbar-period'>
						<label className='history-panel__date-filter-toggle'>
							<input
								type='checkbox'
								checked={isDateFilterActive}
								onChange={e => {
									const on = e.target.checked
									setIsDateFilterActive(on)
									if (on) resetPeriod()
								}}
							/>
							<span
								className='history-panel__checkbox-ui'
								aria-hidden='true'
							/>
							<span className='history-panel__date-filter-toggle-text'>
								Фильтр по периоду
							</span>
						</label>
						<div className='history-panel__date-input-group'>
							<input
								type='date'
								value={startDate}
								onChange={e => setStartDate(e.target.value)}
								disabled={!isDateFilterActive}
								className={`history-panel__date-input${!isDateFilterActive ? ' history-panel__date-input--inactive' : ''}`}
							/>
							<span className='history-panel__date-separator'>—</span>
							<input
								type='date'
								value={endDate}
								onChange={e => setEndDate(e.target.value)}
								disabled={!isDateFilterActive}
								className={`history-panel__date-input${!isDateFilterActive ? ' history-panel__date-input--inactive' : ''}`}
							/>
							<button
								type='button'
								className='history-panel__reset-button'
								disabled={!isDateFilterActive}
								onClick={resetPeriod}
							>
								Сбросить период
							</button>
						</div>
					</div>
				</div>
			</div>

			{loading ? (
				<div className='history-panel__loading'>
					<p>Загрузка истории изменений...</p>
				</div>
			) : filteredHistory.length === 0 ? (
				<div className='history-panel__empty'>
					<p>{emptyMessage}</p>
				</div>
			) : (
				<div className='history-panel__list'>
					{filteredHistory.map(record => {
						const fullIdx = history.findIndex(h => h.id === record.id)
						const prevRecord =
							fullIdx >= 0
								? history
										.slice(fullIdx + 1)
										.find(r => r.variable_id === record.variable_id)
								: null

						const isCreated = !prevRecord
						const changeType = record.change_type

						const currentValues = parseHistoryValues(record.values_by_mode)
						const prevValues = prevRecord
							? parseHistoryValues(prevRecord.values_by_mode)
							: null

						const chain = variableChains.get(record.variable_id) || []

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
										{record.formattedDate}
									</div>
									<div
										className={`history-record__badge history-record__badge--${changeType}`}
									>
										{changeTypeLabels[record.change_type]}
									</div>
								</div>

								<div className='history-record__body'>
									<div className='history-record__variable-info'>
										<div className='history-record__variable-name'>
											{record.variable.name}
										</div>
										<div className='history-record__variable-type'>
											{getTypeLabel(record.variable.type)}
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
																allVariables
															)}
														></span>
													)}
													<span className='history-record__value-text'>
														{formatValue(
															record.variable.type,
															currentValues,
															allVariables
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
																	allVariables
																)}
															></span>
														)}
														<span className='history-record__value-text'>
															{formatValue(
																record.variable.type,
																prevValues,
																allVariables
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
																	allVariables
																)}
															></span>
														)}
														<span className='history-record__value-text'>
															{formatValue(
																record.variable.type,
																currentValues,
																allVariables
															)}
														</span>
													</div>
												</div>
											</>
										)}
									</div>
								</div>

								{chain.length > 1 && (
									<>
										<div className='history-record__chain-hint'>
											Наведите на карточку — ниже появится хронология именно
											этого токена.
										</div>
										<div className='history-record__chain'>
											<div className='history-record__chain-head'>
												<span className='history-record__chain-label'>
													Хронология
												</span>
												<code className='history-record__chain-token-path'>
													{record.variable.name}
												</code>
											</div>
											<ol className='history-record__chain-steps'>
												{chain.map(step => {
													const stepVals = parseHistoryValues(
														step.values_by_mode
													)
													const stepDate = new Date(
														step.changed_at
													).toLocaleString('ru-RU', {
														day: '2-digit',
														month: '2-digit',
														year: 'numeric',
														hour: '2-digit',
														minute: '2-digit',
													})
													return (
														<li
															key={step.id}
															className='history-record__chain-step'
														>
															<div className='history-record__chain-step-line'>
																<span className='history-record__chain-step-date'>
																	{stepDate}
																</span>
																<span
																	className={`history-record__badge history-record__badge--${step.change_type}`}
																>
																	{changeTypeLabels[step.change_type]}
																</span>
															</div>
															<div className='history-record__chain-step-value'>
																{formatValue(
																	record.variable.type,
																	stepVals,
																	allVariables
																)}
															</div>
														</li>
													)
												})}
											</ol>
										</div>
									</>
								)}
							</div>
						)
					})}
				</div>
			)}
		</div>
	)
}
