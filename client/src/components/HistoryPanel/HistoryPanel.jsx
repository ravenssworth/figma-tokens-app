import React, { useState, useEffect, useMemo } from 'react'
import {
	getColorStyle,
	getTypeLabel,
	formatValue,
} from '../../utils/tokenUtils'
import {
	formatVersionTagForDisplay,
	formatVersionEventType,
	formatVersionHistoryMessage,
} from '../../utils/versionUtils'
import { useProject } from '../../context/ProjectContext'
import { withProjectQuery } from '../../utils/projectStorage'
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

function formatRecordDate(iso) {
	return new Date(iso).toLocaleDateString('ru-RU', {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	})
}

function filterByDateAndSearch(records, { isDateFilterActive, startDate, endDate, nameSearch, getSearchText }) {
	return records.filter(record => {
		if (isDateFilterActive) {
			const recordDate = new Date(record.changed_at || record.created_at)
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
			const text = getSearchText(record).toLowerCase()
			if (!text.includes(q)) return false
		}

		return true
	})
}

export function HistoryPanel() {
	const { project } = useProject()
	const [collections, setCollections] = useState([])
	const [selectedCollection, setSelectedCollection] = useState(null)
	const [viewMode, setViewMode] = useState('tokens')
	const [history, setHistory] = useState([])
	const [versionHistory, setVersionHistory] = useState([])
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
		if (!project?.id) return

		const loadCollections = async () => {
			try {
				const response = await fetch(
					withProjectQuery('/api/collections', project.id)
				)
				const data = await response.json()
				if (data.success) {
					setCollections(data.data || [])
					if (data.data?.length > 0) {
						setSelectedCollection(data.data[0])
					} else {
						setSelectedCollection(null)
					}
				}
			} catch (error) {
				console.error('Ошибка загрузки коллекций:', error)
			}
		}

		setSelectedCollection(null)
		loadCollections()
	}, [project?.id])

	useEffect(() => {
		if (!project?.id) return

		const loadAllVariables = async () => {
			try {
				const collectionsResponse = await fetch(
					withProjectQuery('/api/collections', project.id)
				)
				if (!collectionsResponse.ok) return
				const collectionsData = await collectionsResponse.json()

				if (collectionsData.success && Array.isArray(collectionsData.data)) {
					const allVars = []
					for (const col of collectionsData.data) {
						const varsResponse = await fetch(
							withProjectQuery(
								`/api/variables?collectionId=${encodeURIComponent(col.id)}`,
								project.id
							)
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
	}, [project?.id])

	useEffect(() => {
		if (!selectedCollection?.id || !project?.id) {
			setCurrentCollectionVariables([])
			return
		}

		const loadCurrentVariables = async () => {
			try {
				const response = await fetch(
					withProjectQuery(
						`/api/variables?collectionId=${encodeURIComponent(selectedCollection.id)}`,
						project.id
					)
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

		loadCurrentVariables()
	}, [selectedCollection, project?.id])

	useEffect(() => {
		if (viewMode !== 'tokens' || !selectedCollection || currentCollectionVariables.length === 0) {
			if (viewMode === 'tokens') {
				setHistory([])
				setLoading(false)
			}
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
							.catch(() => ({ variable: v, history: [] }))
					)
				)

				const allHistory = responses
					.flatMap(response => {
						if (!response.history?.length) return []
						return response.history.map(record => ({
							...record,
							variable: response.variable,
							formattedDate: formatRecordDate(record.changed_at),
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
	}, [selectedCollection, currentCollectionVariables, viewMode])

	useEffect(() => {
		if (viewMode !== 'versions' || !selectedCollection?.id) {
			if (viewMode === 'versions') {
				setVersionHistory([])
				setLoading(false)
			}
			return
		}

		const loadVersionHistory = async () => {
			setLoading(true)
			try {
				const response = await fetch(
					withProjectQuery(
						`/api/collections/${selectedCollection.id}/version-history`,
						project.id
					)
				)
				const data = await response.json()
				if (data.success && Array.isArray(data.data)) {
					setVersionHistory(
						data.data
							.map(record => ({
								...record,
								formattedDate: formatRecordDate(record.created_at),
							}))
							.sort(
								(a, b) => new Date(b.created_at) - new Date(a.created_at)
							)
					)
				} else {
					setVersionHistory([])
				}
			} catch (error) {
				console.error('Ошибка загрузки истории версий:', error)
				setVersionHistory([])
			} finally {
				setLoading(false)
			}
		}

		loadVersionHistory()
	}, [selectedCollection, viewMode])

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

	const filteredTokenHistory = useMemo(
		() =>
			filterByDateAndSearch(history, {
				isDateFilterActive,
				startDate,
				endDate,
				nameSearch,
				getSearchText: r => r.variable?.name || '',
			}),
		[history, isDateFilterActive, startDate, endDate, nameSearch]
	)

	const filteredVersionHistory = useMemo(
		() =>
			filterByDateAndSearch(versionHistory, {
				isDateFilterActive,
				startDate,
				endDate,
				nameSearch,
				getSearchText: r => r.version_name || '',
			}),
		[versionHistory, isDateFilterActive, startDate, endDate, nameSearch]
	)

	const changeTypeLabels = {
		created: 'Создана',
		updated: 'Изменена',
		deleted: 'Удалена',
		restored: 'Восстановлена',
	}

	const isTokensView = viewMode === 'tokens'
	const activeList = isTokensView ? filteredTokenHistory : filteredVersionHistory
	const sourceList = isTokensView ? history : versionHistory

	const stats = isTokensView
		? {
				count: filteredTokenHistory.length,
				lastLabel: 'Последнее изменение',
				lastValue:
					filteredTokenHistory[0]?.formattedDate || 'Нет изменений',
		  }
		: {
				count: filteredVersionHistory.length,
				lastLabel: 'Последнее событие',
				lastValue:
					filteredVersionHistory[0]?.formattedDate || 'Нет событий',
		  }

	const emptyMessage = !selectedCollection
		? 'Выберите коллекцию'
		: sourceList.length === 0
			? isTokensView
				? 'Нет изменений в этой коллекции'
				: 'Нет событий по версиям в этой коллекции'
			: 'Нет записей по заданным условиям (период или поиск)'

	const searchPlaceholder = isTokensView
		? 'Имя или часть пути токена'
		: 'Название версии'

	if (!collections.length && !loading) {
		return (
			<div className='page-state-card history-panel__empty-state'>
				<p>Нет коллекций. Экспортируйте токены из Figma через плагин.</p>
			</div>
		)
	}

	return (
		<div className='history-panel page-card page-card--grow'>
			<div className='history-panel__header'>
				<div className='history-panel__header-top'>
					<div className='history-panel__header-controls'>
						<div className='history-panel__collection-selector'>
							<label htmlFor='history-collection-select'>Коллекция</label>
							<select
								id='history-collection-select'
								value={selectedCollection?.id || ''}
								onChange={e => {
									const col = collections.find(c => c.id === e.target.value)
									setSelectedCollection(col || null)
									setSelectedVariable(null)
								}}
							>
								{collections.map(collection => (
									<option key={collection.id} value={collection.id}>
										{collection.name}
									</option>
								))}
							</select>
						</div>

						<div
							className='history-panel__view-toggle'
							role='group'
							aria-label='Тип истории'
						>
							<button
								type='button'
								className={`history-panel__view-toggle-btn${
									isTokensView ? ' history-panel__view-toggle-btn--active' : ''
								}`}
								onClick={() => {
									setViewMode('tokens')
									setNameSearch('')
								}}
							>
								Токены
							</button>
							<button
								type='button'
								className={`history-panel__view-toggle-btn${
									!isTokensView ? ' history-panel__view-toggle-btn--active' : ''
								}`}
								onClick={() => {
									setViewMode('versions')
									setNameSearch('')
									setSelectedVariable(null)
								}}
							>
								Версии
							</button>
						</div>

						<span className='page-stat-pill'>
							{stats.count}{' '}
							{isTokensView ? 'изменений' : 'событий'}
						</span>
					</div>
				</div>

				{selectedCollection && (
					<p className='history-panel__header-meta'>
						{selectedCollection.name} · {stats.lastLabel}: {stats.lastValue}
					</p>
				)}

				<div className='history-panel__toolbar'>
					<div className='history-panel__toolbar-search'>
						<label
							className='history-panel__toolbar-label'
							htmlFor='history-search'
						>
							Поиск
						</label>
						<input
							id='history-search'
							type='search'
							className='history-panel__search-input'
							placeholder={searchPlaceholder}
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
							<span className='history-panel__checkbox-ui' aria-hidden='true' />
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

			<div className='history-panel__body'>
			{loading ? (
				<div className='history-panel__loading page-state-card'>
					<p>Загрузка…</p>
				</div>
			) : activeList.length === 0 ? (
				<div className='history-panel__empty page-state-card'>
					<p>{emptyMessage}</p>
				</div>
			) : isTokensView ? (
				<div className='history-panel__list'>
					{filteredTokenHistory.map(record => {
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
														/>
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
															/>
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
															/>
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
													return (
														<li
															key={step.id}
															className='history-record__chain-step'
														>
															<div className='history-record__chain-step-line'>
																<span className='history-record__chain-step-date'>
																	{formatRecordDate(step.changed_at)}
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
			) : (
				<div className='history-panel__list'>
					{filteredVersionHistory.map(record => (
						<div
							key={record.id}
							className={`history-record history-record--version history-record--version-${record.event_type}`}
						>
							<div className='history-record__header'>
								<div className='history-record__date'>
									{record.formattedDate}
								</div>
								<div
									className={`history-record__badge history-record__badge--${record.event_type}`}
								>
									{formatVersionEventType(record.event_type)}
								</div>
							</div>
							<div className='history-record__version-body'>
								<p className='history-record__version-message'>
									{formatVersionHistoryMessage(record)}
								</p>
								{record.description?.trim() && (
									<p className='history-record__version-description'>
										{record.description.trim()}
									</p>
								)}
								{record.version_tag && record.event_type === 'created' && (
									<span className='history-record__version-tag'>
										{formatVersionTagForDisplay(record.version_tag)}
									</span>
								)}
							</div>
						</div>
					))}
				</div>
			)}
			</div>
		</div>
	)
}
