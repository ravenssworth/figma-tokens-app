import React, { useState, useMemo } from 'react'
import './TokensTree.css'

export function TokenTree({ variables, onSelectGroup, selectedGroup = 'all' }) {
	const [expandedGroups, setExpandedGroups] = useState(new Set(['all']))

	// Строим дерево групп с помощью useMemo для оптимизации
	const { groups, rootGroups } = useMemo(() => {
		if (!variables || variables.length === 0) {
			return { groups: {}, rootGroups: [] }
		}

		const groups = {}
		const rootGroups = []

		// Сначала создаем все группы
		variables.forEach(variable => {
			if (!variable.name) return

			const parts = variable.name.split('/')

			// Создаем группы для всех частей пути, кроме последней (имя переменной)
			let currentPath = ''
			for (let i = 0; i < parts.length - 1; i++) {
				currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i]

				if (!groups[currentPath]) {
					groups[currentPath] = {
						path: currentPath,
						name: parts[i],
						level: i,
						parent: i > 0 ? parts.slice(0, i).join('/') : null,
						children: [],
						variableIds: new Set(),
						allVariableIds: new Set(),
					}

					// Если это корневая группа, добавляем в rootGroups
					if (!groups[currentPath].parent) {
						rootGroups.push(groups[currentPath])
					}
				}
			}
		})

		// Заполняем children и подсчитываем переменные
		variables.forEach(variable => {
			if (!variable.name) return

			const parts = variable.name.split('/')

			// Добавляем переменную во все родительские группы
			let currentPath = ''
			for (let i = 0; i < parts.length - 1; i++) {
				currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i]
				const group = groups[currentPath]

				if (group) {
					// Добавляем переменную в эту группу
					group.allVariableIds.add(variable.id)

					// Если это последний уровень перед переменной, добавляем в direct variables
					if (i === parts.length - 2) {
						group.variableIds.add(variable.id)
					}

					// Если есть следующий уровень, добавляем его в children
					if (i < parts.length - 2) {
						const nextPath = currentPath + '/' + parts[i + 1]
						if (!group.children.includes(nextPath)) {
							group.children.push(nextPath)
						}
					}
				}
			}
		})

		return { groups, rootGroups }
	}, [variables])

	// Переключение раскрытия группы
	const toggleGroup = (groupPath, e) => {
		e.stopPropagation()
		const newExpanded = new Set(expandedGroups)
		if (newExpanded.has(groupPath)) {
			newExpanded.delete(groupPath)
		} else {
			newExpanded.add(groupPath)
		}
		setExpandedGroups(newExpanded)
	}

	// Выбор группы
	const handleSelectGroup = groupPath => {
		if (onSelectGroup) {
			onSelectGroup(groupPath)
		}
	}

	// Проверка, является ли группа дочерней для выбранной
	const isChildOfSelected = (groupPath, selectedGroup) => {
		if (!selectedGroup || selectedGroup === 'all') return false
		return groupPath.startsWith(selectedGroup + '/')
	}

	// Рекурсивный рендер групп
	const renderGroup = (groupPath, groups) => {
		const group = groups[groupPath]
		if (!group) return null

		const isExpanded = expandedGroups.has(groupPath)
		const hasChildren = group.children.length > 0
		const isSelected = selectedGroup === groupPath
		const isChild = isChildOfSelected(groupPath, selectedGroup)

		return (
			<div
				key={groupPath}
				className='tokens-tree__tokens-tree-item tokens-tree-item'
			>
				<div
					className={`tokens-tree-item__row ${
						isSelected ? 'selected' : isChild ? 'child-selected' : ''
					}`}
					onClick={() => handleSelectGroup(groupPath)}
					style={{ paddingLeft: `${group.level * 0.8 + 0.8}vw` }}
				>
					{hasChildren ? (
						<button
							className='tokens-tree-item__toggle'
							onClick={e => toggleGroup(groupPath, e)}
						>
							<span
								className={`tokens-tree-item__arrow ${
									isExpanded ? 'expanded' : ''
								}`}
							>
								&gt;
							</span>
						</button>
					) : (
						<div className='tokens-tree-item__toggle-placeholder'></div>
					)}
					<i className='fas fa-folder group-icon'></i>
					<span className='tokens-tree-item__name'>{group.name}</span>
					<span className='tokens-tree-item__count'>
						{group.allVariableIds.size}
					</span>
				</div>

				{isExpanded && hasChildren && (
					<div className='tokens-tree-item__group-children'>
						{group.children.map(childPath => renderGroup(childPath, groups))}
					</div>
				)}
			</div>
		)
	}

	if (!variables || variables.length === 0) {
		return (
			<div className='loading'>
				<i className='fas fa-spinner fa-spin'></i> Выберите коллекцию
			</div>
		)
	}

	return (
		<div className='tokens-tree'>
			<div className='tokens-tree__title'>Группы</div>
			{rootGroups.length > 0 ? (
				<div className='tokens-tree__container'>
					<div className='tokens-tree__list'>
						<div className='tokens-tree__tokens-tree-item tokens-tree-item'>
							<div
								className={`tokens-tree-all-item__row ${
									selectedGroup === 'all' ? 'selected' : ''
								}`}
								onClick={() => handleSelectGroup('all')}
							>
								<span className='tokens-tree-all-item__name'>Все</span>
								<span className='tokens-tree-all-item__count'>
									{variables.length}
								</span>
							</div>
						</div>

						{rootGroups.map(group => renderGroup(group.path, groups))}
					</div>
				</div>
			) : (
				<div className='tokens-tree__loading'>
					<i className='fas fa-folder-open'></i> Нет групп для отображения
				</div>
			)}
		</div>
	)
}
