import React, { useState, useEffect } from 'react'
import { HistoryPanel } from '../../components/HistoryPanel/HistoryPanel'
import './HistoryPage.css'

export function HistoryPage() {
	const [collections, setCollections] = useState([])
	const [selectedCollection, setSelectedCollection] = useState(null)
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		loadCollections()
	}, [])

	async function loadCollections() {
		try {
			const response = await fetch('/api/collections')
			const data = await response.json()

			if (data.success) {
				setCollections(data.data || [])
				if (data.data && data.data.length > 0) {
					setSelectedCollection(data.data[0])
				}
			}
		} catch (error) {
			console.error('Ошибка загрузки коллекций:', error)
		} finally {
			setLoading(false)
		}
	}

	return (
		<div className='history-page'>
			<div className='history-page__header'>
				<div className='history-page__header-title'>
					<h2>История изменений</h2>
				</div>
				<div className='history-page__collection-selector'>
					<label htmlFor='collection-select'>Коллекция:</label>
					<select
						id='collection-select'
						value={selectedCollection?.id || ''}
						onChange={e => {
							const collection = collections.find(c => c.id === e.target.value)
							setSelectedCollection(collection)
						}}
					>
						{collections.map(collection => (
							<option key={collection.id} value={collection.id}>
								{collection.name}
							</option>
						))}
					</select>
				</div>
			</div>

			{loading ? (
				<div className='history-page__loading-container'>
					<p>Загрузка истории...</p>
				</div>
			) : (
				<HistoryPanel collection={selectedCollection} />
			)}
		</div>
	)
}
