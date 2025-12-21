import React from 'react'
import {
	formatValue,
	getColorStyle,
	safeJsonParse,
	getTypeLabel,
} from '../../utils/tokenUtils'

import './TokensTable.css'

export function TokensTable({
	variables,
	allVariables = [],
	collection,
	selectedGroup,
	version,
}) {
	if (!variables || variables.length === 0) {
		return (
			<div className='loading'>
				<strong className='fas fa-inbox'></strong> Нет данных для отображения
			</div>
		)
	}

	const getDisplayName = fullName => {
		const parts = fullName.split('/')
		return parts[parts.length - 1]
	}

	const groupVariablesByPath = (variables, selectedGroup) => {
		const groups = {}

		variables.forEach(variable => {
			const parts = variable.name.split('/')

			if (parts.length > 1) {
				const folderPath = parts.slice(0, -1).join('/')

				if (selectedGroup && folderPath.startsWith(selectedGroup + '/')) {
					const subPath = folderPath.substring(selectedGroup.length + 1)
					if (subPath.includes('/')) {
						const firstSubGroup = subPath.split('/')[0]
						if (!groups[firstSubGroup]) {
							groups[firstSubGroup] = {
								path: firstSubGroup,
								name: firstSubGroup,
								variables: [],
							}
						}
						groups[firstSubGroup].variables.push({
							...variable,
							displayName: getDisplayName(variable.name),
						})
						return
					}
				}

				if (!groups[folderPath]) {
					groups[folderPath] = {
						path: folderPath,
						name: folderPath,
						variables: [],
					}
				}

				groups[folderPath].variables.push({
					...variable,
					displayName: getDisplayName(variable.name),
				})
			} else {
				if (!groups['root']) {
					groups['root'] = {
						path: 'root',
						name: 'Основные токены',
						variables: [],
					}
				}

				groups['root'].variables.push({
					...variable,
					displayName: getDisplayName(variable.name),
				})
			}
		})

		return groups
	}

	if (selectedGroup && selectedGroup !== 'all') {
		const hasNestedGroups = variables.some(variable => {
			if (!variable.name) return false
			const groupPrefix = selectedGroup + '/'
			if (!variable.name.startsWith(groupPrefix)) return false
			const remainingPath = variable.name.substring(groupPrefix.length)
			const parts = remainingPath.split('/')
			return parts.length > 1
		})

		if (hasNestedGroups) {
			const groupedVariables = groupVariablesByPath(variables, selectedGroup)
			const groupsArray = Object.values(groupedVariables)
			groupsArray.sort((a, b) => a.path.localeCompare(b.path))

			return (
				<div className='tokens-table-container'>
					<div className='variables-panel__header'>
						<div className='variables-panel__title'>
							{collection?.name || 'Коллекция'}
						</div>
					</div>

					<table>
						<thead>
							<tr>
								<th>Наименование</th>
								<th>Значение</th>
								<th>Тип</th>
							</tr>
						</thead>
						<tbody className='variables-panel__table table'>
							{groupsArray.map(group => (
								<React.Fragment key={group.path}>
									<tr className='group-header'>
										<td colSpan='3'>
											<div className='table__group-header'>
												<strong className='fas fa-folder group-icon'></strong>
												<span className='table__group-name'>{group.name}</span>
											</div>
										</td>
									</tr>
									{group.variables.map(variable => {
										const values =
											variable.parsedValues ||
											safeJsonParse(variable.values_by_mode)
										const valueStr = formatValue(
											variable.type,
											values,
											allVariables
										)
										const colorStyle = getColorStyle(
											variable.type,
											values,
											allVariables
										)
										const isColor = variable.type === 'COLOR'

										return (
											<tr key={variable.id} className='token-row'>
												<td className='token-name'>{variable.displayName}</td>
												<td className='token-value'>
													{isColor && (
														<span
															className='color-preview'
															style={colorStyle}
														></span>
													)}
													{valueStr}
												</td>
												<td>
													<span className='token-type'>
														{getTypeLabel(variable.type)}
													</span>
												</td>
											</tr>
										)
									})}
								</React.Fragment>
							))}
						</tbody>
					</table>
				</div>
			)
		}

		return (
			<div className='tokens-table-container'>
				<div className='variables-panel__header'>
					<div className='variables-panel__title'>
						{collection?.name || 'Коллекция'}
					</div>
				</div>

				<table>
					<thead>
						<tr>
							<th>Наименование</th>
							<th>Значение</th>
							<th>Тип</th>
						</tr>
					</thead>
					<tbody>
						{variables.map(variable => {
							const values =
								variable.parsedValues || safeJsonParse(variable.values_by_mode)
							const valueStr = formatValue(variable.type, values, allVariables)
							const colorStyle = getColorStyle(
								variable.type,
								values,
								allVariables
							)
							const isColor = variable.type === 'COLOR'

							return (
								<tr key={variable.id} className='token-row'>
									<td className='token-name'>
										<span>{getDisplayName(variable.name)}</span>
									</td>
									<td className='token-value'>
										{isColor && (
											<span className='color-preview' style={colorStyle}></span>
										)}
										{valueStr}
									</td>
									<td>
										<span className='token-type'>
											{getTypeLabel(variable.type)}
										</span>
									</td>
								</tr>
							)
						})}
					</tbody>
				</table>
			</div>
		)
	}

	const groupedVariables = groupVariablesByPath(variables, selectedGroup)
	const groupsArray = Object.values(groupedVariables)

	return (
		<>
			<div className='variables-panel__header'>
				<div className='variables-panel__title'>
					{collection?.name || 'Коллекция'}

					{version && (
						<div className='variables-panel__version-info-tooltip'>
							<span className='variables-panel__version-info-icon'>🛈</span>
							<div className='variables-panel__version-info-popup'>
								<div className='variables-panel__version-info-content'>
									<h4>Информация о версии</h4>
									<p className='variables-panel__version-info-row'>
										<strong>Версия:</strong> {version.version_name}
									</p>
									<p className='variables-panel__version-info-row'>
										<strong>Создана:</strong>{' '}
										{new Date(version.created_at).toLocaleString('ru-RU')}
									</p>
									{version.description && (
										<p className='variables-panel__version-info-row'>
											<strong>Описание:</strong> {version.description}
										</p>
									)}
									{version.version_tag && (
										<p className='variables-panel__version-info-row'>
											<strong>Тег:</strong> {version.version_tag}
										</p>
									)}
								</div>
							</div>
						</div>
					)}
				</div>
			</div>

			<table>
				<thead>
					<tr>
						<th>Наименование</th>
						<th>Значение</th>
						<th>Тип</th>
					</tr>
				</thead>
				<tbody className='variables-panel__table table'>
					{groupsArray.map(group => (
						<React.Fragment key={group.path}>
							<tr className='group-header'>
								<td colSpan='3'>
									<div className='table__group-header'>
										<span className='table__group-name'>{group.name}</span>
									</div>
								</td>
							</tr>
							{group.variables.map(variable => {
								const values =
									variable.parsedValues ||
									safeJsonParse(variable.values_by_mode)
								const valueStr = formatValue(
									variable.type,
									values,
									allVariables
								)
								const colorStyle = getColorStyle(
									variable.type,
									values,
									allVariables
								)
								const isColor = variable.type === 'COLOR'

								return (
									<tr key={variable.id} className='token-row'>
										<td className='token-name'>{variable.displayName}</td>
										<td className='token-value'>
											{isColor && (
												<span
													className='color-preview'
													style={colorStyle}
												></span>
											)}
											{valueStr}
										</td>
										<td>
											<span className='token-type'>
												{getTypeLabel(variable.type)}
											</span>
										</td>
									</tr>
								)
							})}
						</React.Fragment>
					))}
				</tbody>
			</table>
		</>
	)
}
