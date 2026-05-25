import { useState, useEffect } from 'react'
import { CollectionsPanel } from '../../components/CollectionsPanel/CollectionsPanel'
import { TokenTree } from '../../components/TokensTree/TokensTree'
import { TokensTable } from '../../components/TokensTable/TokensTable'
import { useNavigate } from 'react-router-dom'
import { useProject } from '../../context/ProjectContext'
import { withProjectQuery } from '../../utils/projectStorage'
import { VERSION_TAG_OPTIONS } from '../../utils/versionUtils'
import './TokensPage.css'

export function TokensPage() {
	const { project } = useProject()
	const [collections, setCollections] = useState([])
	const [variables, setVariables] = useState([])
	const [versionVariables, setVersionVariables] = useState([])
	const [selectedCollection, setSelectedCollection] = useState(null)
	const [selectedGroup, setSelectedGroup] = useState('all')
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState(null)
	const [selectedVersion, setSelectedVersion] = useState(null)
	const [collectionVersions, setCollectionVersions] = useState([])
	const [isVersionPanelOpen, setIsVersionPanelOpen] = useState(false)
	const [newVersionName, setNewVersionName] = useState('')
	const [newVersionDescription, setNewVersionDescription] = useState('')
	const [newVersionTag, setNewVersionTag] = useState('релиз')
	const [notification, setNotification] = useState(null)
	const [isAuthenticated, setIsAuthenticated] = useState(false)
	const navigate = useNavigate()

	useEffect(() => {
		const checkAuth = async () => {
			const token = localStorage.getItem('token')
			if (!token) {
				setIsAuthenticated(false)
				return
			}

			try {
				const response = await fetch('/api/auth/verify', {
					headers: { Authorization: `Bearer ${token}` },
				})
				const data = await response.json()
				setIsAuthenticated(data.success === true)
			} catch (error) {
				console.error('Ошибка проверки авторизации:', error)
				setIsAuthenticated(false)
			}
		}

		checkAuth()
		const handleStorageChange = () => {
			checkAuth()
		}

		globalThis.addEventListener('storage', handleStorageChange)

		globalThis.addEventListener('focus', checkAuth)

		return () => {
			globalThis.removeEventListener('storage', handleStorageChange)
			globalThis.removeEventListener('focus', checkAuth)
		}
	}, [])

	useEffect(() => {
		if (!project?.id) return
		setSelectedCollection(null)
		setSelectedVersion(null)
		setCollectionVersions([])
		loadData()
	}, [project?.id])

	useEffect(() => {
		if (selectedCollection?.id) {
			loadCollectionVersions(selectedCollection.id)
			setSelectedVersion(null)
			setVersionVariables([])
		} else {
			setCollectionVersions([])
			setSelectedVersion(null)
			setVersionVariables([])
		}
	}, [selectedCollection])

	useEffect(() => {
		if (selectedVersion) {
			loadVersionVariables(selectedVersion.id)
		} else {
			setVersionVariables([])
		}
	}, [selectedVersion])

	useEffect(() => {
		setSelectedGroup('all')
	}, [selectedCollection, selectedVersion])

	useEffect(() => {
		if (selectedVersion !== null) {
			setIsVersionPanelOpen(false)
		}
	}, [selectedVersion])

	async function loadData() {
		try {
			setLoading(true)
			setError(null)

			const [collectionsRes, variablesRes] = await Promise.all([
				fetch(withProjectQuery('/api/collections', project.id)),
				fetch(withProjectQuery('/api/variables', project.id)),
			])

			if (!collectionsRes.ok || !variablesRes.ok) {
				throw new Error(`Ошибка сервера: ${collectionsRes.status}`)
			}

			const collectionsData = await collectionsRes.json()
			const variablesData = await variablesRes.json()

			if (!collectionsData.success || !variablesData.success) {
				throw new Error('Некорректный формат данных от сервера')
			}

			setCollections(collectionsData.data || [])
			setVariables(variablesData.data || [])

			if (collectionsData.data && collectionsData.data.length > 0) {
				setSelectedCollection(collectionsData.data[0])
			}
		} catch (err) {
			console.error('Ошибка загрузки:', err)
			setError(err.message)
		} finally {
			setLoading(false)
		}
	}

	async function loadCollectionVersions(collectionId) {
		try {
			const response = await fetch(
				withProjectQuery(`/api/collections/${collectionId}/versions`, project.id)
			)
			if (!response.ok) return

			const data = await response.json()
			if (data.success) {
				setCollectionVersions(data.data || [])
			}
		} catch (error) {
			console.error('Ошибка загрузки версий:', error)
			setCollectionVersions([])
		}
	}

	async function loadVersionVariables(versionId) {
		try {
			setLoading(true)
			const response = await fetch(`/api/versions/${versionId}/variables`)
			if (!response.ok) {
				throw new Error(`Ошибка загрузки версии: ${response.status}`)
			}

			const data = await response.json()
			if (data.success) {
				setVersionVariables(data.data || [])
			} else {
				throw new Error('Не удалось загрузить данные версии')
			}
		} catch (error) {
			console.error('Ошибка загрузки переменных версии:', error)
			setError(error.message)
			setVersionVariables([])
		} finally {
			setLoading(false)
		}
	}

	async function handleDeleteVersion() {
		if (!selectedVersion) return

		const token = localStorage.getItem('token')
		if (!token) {
			setNotification({
				type: 'error',
				message: 'Для удаления версии необходимо авторизоваться',
			})
			setTimeout(() => navigate('/auth'), 1500)
			return
		}

		const versionName = selectedVersion.version_name
		if (
			!globalThis.confirm(
				`Удалить версию «${versionName}»? Снимок будет скрыт из списка, событие попадёт в историю.`
			)
		) {
			return
		}

		try {
			const response = await fetch(`/api/versions/${selectedVersion.id}`, {
				method: 'DELETE',
				headers: { Authorization: `Bearer ${token}` },
			})
			const data = await response.json()

			if (data.success) {
				setSelectedVersion(null)
				await loadCollectionVersions(selectedCollection.id)
				setNotification({
					type: 'success',
					message: `Версия «${versionName}» удалена`,
				})
			} else if (response.status === 401 || response.status === 403) {
				setNotification({
					type: 'error',
					message: 'Сессия истекла. Необходимо авторизоваться',
				})
				setTimeout(() => navigate('/auth'), 1500)
			} else {
				setNotification({
					type: 'error',
					message: data.error || 'Не удалось удалить версию',
				})
			}
		} catch (error) {
			console.error('Ошибка удаления версии:', error)
			setNotification({
				type: 'error',
				message: 'Не удалось удалить версию',
			})
		}
	}

	async function handleCreateVersion() {
		const token = localStorage.getItem('token')
		if (!token) {
			setNotification({
				type: 'error',
				message: 'Для создания версии необходимо авторизоваться',
			})
			setTimeout(() => {
				navigate('/auth')
			}, 1500)
			return
		}

		if (!newVersionName.trim()) {
			setNotification({
				type: 'error',
				message: 'Введите название версии',
			})
			return
		}

		try {
			const response = await fetch(
				`/api/collections/${selectedCollection.id}/versions`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${token}`,
					},
					body: JSON.stringify({
						projectId: project.id,
						version_name: newVersionName.trim(),
						description: newVersionDescription.trim(),
						version_tag: newVersionTag,
					}),
				}
			)

			const data = await response.json()
			if (data.success) {
				await loadCollectionVersions(selectedCollection.id)

				setSelectedVersion(data.data)

				const versionName = newVersionName
				setNewVersionName('')
				setNewVersionDescription('')
				setNewVersionTag('релиз')
				setIsVersionPanelOpen(false)
				setNotification({
					type: 'success',
					message: `Версия "${versionName}" успешно создана!`,
				})
			} else {
				if (response.status === 401 || response.status === 403) {
					setIsAuthenticated(false)
					setNotification({
						type: 'error',
						message: 'Сессия истекла. Необходимо авторизоваться',
					})
					setTimeout(() => {
						navigate('/auth')
					}, 1500)
				} else {
					setNotification({
						type: 'error',
						message: data.error || 'Ошибка создания версии',
					})
				}
			}
		} catch (error) {
			console.error('Ошибка создания версии:', error)
			setNotification({
				type: 'error',
				message: 'Не удалось создать версию',
			})
		}
	}

	const getDisplayVariables = () => {
		if (!selectedCollection) return []

		if (selectedVersion) {
			return versionVariables
		} else {
			return variables.filter(v => v.collection_id === selectedCollection.id)
		}
	}

	const collectionVariables = getDisplayVariables()
	const filteredVariables =
		selectedGroup === 'all'
			? collectionVariables
			: collectionVariables.filter(v => {
					if (!v.name) return false
					return v.name.startsWith(selectedGroup + '/')
			  })

	useEffect(() => {
		if (notification) {
			const timer = setTimeout(() => {
				setNotification(null)
			}, 5000)
			return () => clearTimeout(timer)
		}
	}, [notification])

	if (loading) {
		return (
			<div className='tokens-page tokens-page--state'>
				<div className='page-state-card'>Загрузка данных…</div>
			</div>
		)
	}

	if (error) {
		return (
			<div className='tokens-page tokens-page--state'>
				<div className='page-state-card page-state-card--error'>
					<h3>Ошибка загрузки</h3>
					<p>{error}</p>
					<button type='button' onClick={loadData}>
						Повторить попытку
					</button>
				</div>
			</div>
		)
	}

	const showVersionActions =
		selectedVersion === null && selectedCollection !== null

	const versionSourceHint = (() => {
		if (!selectedCollection) return ''
		if (collectionVersions.length === 0) {
			return 'У этой коллекции ещё нет сохранённых версий — показаны только актуальные токены.'
		}
		if (selectedVersion) {
			return `Просмотр снимка версии «${selectedVersion.version_name}» (состояние на момент сохранения). Для актуальных значений выберите «Актуальное состояние».`
		}
		return 'Актуальное состояние — текущие значения токенов в коллекции. Пункты ниже — сохранённые снимки только для просмотра.'
	})()

	return (
		<div className='tokens-page'>
			{notification && (
				<div
					className={`tokens-page__notification tokens-page__notification--${notification.type}`}
				>
					{notification.message}
					<button
						className='tokens-page__notification-close'
						onClick={() => setNotification(null)}
					>
						×
					</button>
				</div>
			)}
			<div className='page-workspace'>
				<div className='page-workspace__main'>
					<div className='page-toolbar'>
						{collectionVersions.length > 0 && (
							<div className='page-toolbar__row'>
								<div className='page-toolbar__group'>
									<label
										className='page-toolbar__label'
										htmlFor='version-select'
									>
										Источник данных
									</label>
									<div className='page-field'>
										<select
											id='version-select'
											value={selectedVersion?.id || 'current'}
											onChange={e => {
												if (e.target.value === 'current') {
													setSelectedVersion(null)
												} else {
													const version = collectionVersions.find(
														v => v.id == e.target.value
													)
													setSelectedVersion(version)
												}
											}}
										>
											<option value='current'>Актуальное состояние</option>
											<optgroup label='Снимок версии (только просмотр)'>
												{collectionVersions.map(version => (
													<option key={version.id} value={version.id}>
														{version.version_name}
													</option>
												))}
											</optgroup>
										</select>
									</div>
									{selectedVersion && (
										<button
											type='button'
											className='page-btn page-btn--danger-outline'
											onClick={handleDeleteVersion}
											title='Удалить выбранную версию'
										>
											Удалить версию
										</button>
									)}
								</div>
							</div>
						)}
						<p className='page-toolbar__hint'>{versionSourceHint}</p>
					</div>

					<div className='page-card page-card--grow tokens-page__dashboard'>
						<div className='sidebar'>
							<CollectionsPanel
								collections={collections}
								selectedCollection={selectedCollection}
								onSelect={setSelectedCollection}
								variables={variables}
							/>

							<TokenTree
								variables={collectionVariables}
								onSelectGroup={setSelectedGroup}
								selectedGroup={selectedGroup}
							/>
						</div>

						<div className='variables-panel'>
							<TokensTable
								variables={filteredVariables}
								allVariables={variables}
								collection={selectedCollection}
								selectedGroup={selectedGroup}
								version={selectedVersion}
							/>
						</div>
					</div>
				</div>

				{showVersionActions && (
				<aside className='page-workspace__aside'>
					{isVersionPanelOpen && (
						<div className='page-side-card' aria-label='Создание версии'>
							<div className='page-side-card__title'>Новая версия</div>
							<div className='tokens-page__version-form'>
								<label className='tokens-page__version-form-label'>
									Название версии
									<input
												type='text'
												placeholder='Например, v.1.0'
												value={newVersionName}
												onChange={e => setNewVersionName(e.target.value)}
												onKeyDown={e =>
													e.key === 'Enter' && handleCreateVersion()
												}
									/>
								</label>
								<label className='tokens-page__version-form-label'>
									Описание (необязательно)
									<textarea
												className='tokens-page__version-form-textarea'
												placeholder='Кратко, что изменилось в этой версии'
												value={newVersionDescription}
												onChange={e =>
													setNewVersionDescription(e.target.value)
												}
												rows={2}
									/>
								</label>
								<label className='tokens-page__version-form-label'>
									Тег
									<select
												className='tokens-page__version-form-select'
												value={newVersionTag}
												onChange={e => setNewVersionTag(e.target.value)}
											>
												{VERSION_TAG_OPTIONS.map(opt => (
													<option key={opt.value} value={opt.value}>
														{opt.label}
													</option>
												))}
									</select>
								</label>
								<div className='tokens-page__version-form-buttons'>
									<button type='button' onClick={handleCreateVersion}>
										Создать
									</button>
									<button
										type='button'
										onClick={() => {
											setIsVersionPanelOpen(false)
											setNewVersionName('')
											setNewVersionDescription('')
											setNewVersionTag('релиз')
										}}
									>
										Отмена
									</button>
								</div>
							</div>
						</div>
					)}
					{!isVersionPanelOpen && (
						<div className='page-side-card'>
							<div className='page-side-card__title'>Версия коллекции</div>
							<p className='page-side-card__lead'>
								Сохранить снимок токенов: имя, описание и тег версии.
							</p>
							<button
								type='button'
								className='page-btn page-btn--primary'
								onClick={() => setIsVersionPanelOpen(true)}
							>
								Создать версию
							</button>
						</div>
					)}
				</aside>
				)}
			</div>
		</div>
	)
}
