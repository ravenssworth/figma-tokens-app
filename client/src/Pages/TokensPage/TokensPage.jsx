import { useState, useEffect } from 'react'
import { CollectionsPanel } from '../../components/CollectionsPanel/CollectionsPanel'
import { TokenTree } from '../../components/TokensTree/TokensTree'
import { TokensTable } from '../../components/TokensTable/TokensTable'
import './TokensPage.css'

export function TokensPage() {
	const [collections, setCollections] = useState([])
	const [variables, setVariables] = useState([])
	const [versionVariables, setVersionVariables] = useState([])
	const [selectedCollection, setSelectedCollection] = useState(null)
	const [selectedGroup, setSelectedGroup] = useState('all')
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState(null)
	const [selectedVersion, setSelectedVersion] = useState(null)
	const [collectionVersions, setCollectionVersions] = useState([])
	const [isCreatingVersion, setIsCreatingVersion] = useState(false)
	const [newVersionName, setNewVersionName] = useState('')

	useEffect(() => {
		loadData()
	}, [])

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

	async function loadData() {
		try {
			setLoading(true)
			setError(null)

			const [collectionsRes, variablesRes] = await Promise.all([
				fetch('/api/collections'),
				fetch('/api/variables'),
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
			const response = await fetch(`/api/collections/${collectionId}/versions`)
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

	async function handleCreateVersion() {
		if (!newVersionName.trim()) {
			alert('Введите название версии')
			return
		}

		try {
			const response = await fetch(
				`/api/collections/${selectedCollection.id}/versions`,
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						version_name: newVersionName,
						description: `Версия ${newVersionName} коллекции ${selectedCollection.name}`,
						version_tag: 'release',
					}),
				}
			)

			const data = await response.json()
			if (data.success) {
				await loadCollectionVersions(selectedCollection.id)

				setSelectedVersion(data.data)

				setNewVersionName('')
				setIsCreatingVersion(false)
				alert(`Версия "${newVersionName}" успешно создана!`)
			} else {
				alert('Ошибка создания версии')
			}
		} catch (error) {
			console.error('Ошибка создания версии:', error)
			alert('Не удалось создать версию')
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

	if (loading) {
		return <div className='loading-container'>Загрузка данных...</div>
	}

	if (error) {
		return (
			<div className='error-container'>
				<h3>Ошибка загрузки</h3>
				<p>{error}</p>
				<button onClick={loadData}>Повторить попытку</button>
			</div>
		)
	}

	if (loading) {
		return <div className='loading-container'>Загрузка данных...</div>
	}

	if (error) {
		return (
			<div className='error-container'>
				<h3>Ошибка загрузки</h3>
				<p>{error}</p>
				<button onClick={loadData}>Повторить попытку</button>
			</div>
		)
	}

	return (
		<div className='tokens-page'>
			<div className='tokens-page__left-column'>
				<div className='tokens-page__collection-header'>
					{collectionVersions.length > 0 && (
						<div className='tokens-page__version-selector'>
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
								<option value='current'>Токены</option>
								{collectionVersions.map(version => (
									<option key={version.id} value={version.id}>
										{version.version_name}
									</option>
								))}
							</select>
						</div>
					)}
				</div>
				<div className='tokens-page__dashboard '>
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
			<div className='tokens-page__right-column'>
				{!selectedVersion && selectedCollection && (
					<div className='tokens-page__create-version-section'>
						{!isCreatingVersion ? (
							<button
								className='tokens-page__create-version-btn'
								onClick={() => setIsCreatingVersion(true)}
							>
								Создать версию
							</button>
						) : (
							<div className='tokens-page__version-form'>
								<input
									type='text'
									placeholder='Название версии'
									value={newVersionName}
									onChange={e => setNewVersionName(e.target.value)}
									onKeyDown={e => e.key === 'Enter' && handleCreateVersion()}
								/>
								<div className='tokens-page__version-form-buttons'>
									<button onClick={handleCreateVersion}>Создать</button>
									<button
										onClick={() => {
											setIsCreatingVersion(false)
											setNewVersionName('')
										}}
									>
										Отмена
									</button>
								</div>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	)
}
