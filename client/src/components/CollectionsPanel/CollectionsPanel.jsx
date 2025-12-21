import { useMemo } from 'react'
import './CollectionsPanel.css'

export function CollectionsPanel({
	collections,
	selectedCollection,
	onSelect,
	variables = [],
}) {
	const tokenCounts = useMemo(() => {
		if (!collections || !variables) return {}

		const counts = {}
		collections.forEach(col => {
			counts[col.id] = variables.filter(v => v.collection_id === col.id).length
		})
		return counts
	}, [collections, variables])

	if (!collections || collections.length === 0) {
		return (
			<div className='error'>
				Коллекции не найдены. Экспортируйте токены из Figma.
			</div>
		)
	}

	return (
		<div className='collections-section'>
			<div className='collections-section__title'>Коллекции</div>
			<div className='collections'>
				{collections.map(collection => (
					<div
						key={collection.id}
						className={`collection ${
							selectedCollection?.id === collection.id ? 'active' : ''
						}`}
						onClick={() => onSelect(collection)}
					>
						<span className='collection__name'>
							{collection.name || 'Без названия'}
						</span>
						<span className='collection__count'>
							{tokenCounts[collection.id] || 0}
						</span>
					</div>
				))}
			</div>
		</div>
	)
}
