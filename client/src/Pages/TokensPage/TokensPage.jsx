import { useState, useEffect } from 'react'
import { CollectionsPanel } from '../../components/CollectionsPanel/CollectionsPanel'
import { TokenTree } from '../../components/TokensTree/TokensTree'
import { TokensTable } from '../../components/TokensTable/TokensTable'
import './TokensPage.css'

export function TokensPage() {
	const [collections, setCollections] = useState([])
	const [variables, setVariables] = useState([])
	const [selectedCollection, setSelectedCollection] = useState(null)
	const [selectedGroup, setSelectedGroup] = useState('all')
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState(null)

	// Загрузка данных при монтировании компонента
	useEffect(() => {
		loadData()
	}, [])

	useEffect(() => {
		setSelectedGroup('all')
	}, [selectedCollection])

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

			// Автоматически выбираем первую коллекцию
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

	// Фильтруем переменные для выбранной коллекции
	const collectionVariables = selectedCollection
		? variables.filter(v => v.collection_id === selectedCollection.id)
		: []

	// Фильтруем переменные по выбранной группе
	const filteredVariables =
		selectedGroup === 'all'
			? collectionVariables
			: collectionVariables.filter(v => {
					if (!v.name) return false
					// Проверяем, что переменная начинается с выбранной группы и имеет следующий уровень
					return v.name.startsWith(selectedGroup + '/')
			  })

	if (loading) {
		return (
			<div className='loading-container'>
				<i className='fas fa-spinner fa-spin'></i> Загрузка данных...
			</div>
		)
	}

	if (error) {
		return (
			<div className='error-container'>
				<i className='fas fa-exclamation-triangle'></i>
				<h3>Ошибка загрузки</h3>
				<p>{error}</p>
				<button onClick={loadData}>Повторить попытку</button>
			</div>
		)
	}

	if (loading) {
		return (
			<div className='loading-container'>
				<i className='fas fa-spinner fa-spin'></i> Загрузка данных...
			</div>
		)
	}

	if (error) {
		return (
			<div className='error-container'>
				<i className='fas fa-exclamation-triangle'></i>
				<h3>Ошибка загрузки</h3>
				<p>{error}</p>
				<button onClick={loadData}>Повторить попытку</button>
			</div>
		)
	}

	return (
		<div className='container'>
			{/* Левая панель */}
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

			{/* Правая панель */}
			<div className='variables-panel'>
				<TokensTable
					variables={filteredVariables}
					allVariables={variables}
					collection={selectedCollection}
					selectedGroup={selectedGroup}
				/>
			</div>
		</div>
	)
}
