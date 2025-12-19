export function rgbToHex(r, g, b) {
	return (
		'#' +
		[r, g, b]
			.map(x => {
				const hex = Math.round(x * 255).toString(16)
				return hex.length === 1 ? '0' + hex : hex
			})
			.join('')
			.toUpperCase()
	)
}

export function formatValue(type, valuesByMode, allVariables = []) {
	if (!valuesByMode || Object.keys(valuesByMode).length === 0) {
		return 'N/A'
	}

	const firstModeValue = Object.values(valuesByMode)[0]

	// Если это ссылка на переменную, находим её и показываем имя
	if (firstModeValue.type === 'VARIABLE_ALIAS' && firstModeValue.id) {
		// Ищем переменную по ID (проверяем точное совпадение)
		const referencedVariable = allVariables.find(
			v =>
				v.id === firstModeValue.id || String(v.id) === String(firstModeValue.id)
		)

		if (referencedVariable?.name) {
			// Возвращаем полное имя переменной
			return referencedVariable.name
		}

		// Если переменная не найдена, возвращаем fallback с ID для отладки
		return `→ Ссылка (ID: ${firstModeValue.id})`
	}

	if (type === 'COLOR') {
		if (firstModeValue.r !== undefined) {
			const hex = rgbToHex(firstModeValue.r, firstModeValue.g, firstModeValue.b)
			const alpha =
				firstModeValue.a !== 1 && firstModeValue.a !== undefined
					? `, ${Math.round(firstModeValue.a * 100)}%`
					: ''
			return `${hex}${alpha}`
		}
	}

	if (type === 'FLOAT') return `${firstModeValue}px`
	if (type === 'STRING') return `"${firstModeValue}"`
	if (type === 'BOOLEAN') return firstModeValue ? 'true' : 'false'

	return String(firstModeValue)
}

export function getColorStyle(type, valuesByMode, allVariables = []) {
	if (type !== 'COLOR') return {}

	const firstModeValue = Object.values(valuesByMode)[0]
	if (!firstModeValue) {
		return {
			background:
				'linear-gradient(45deg, #f8f9fa 25%, #e9ecef 25%, #e9ecef 50%, #f8f9fa 50%, #f8f9fa 75%, #e9ecef 75%)',
			backgroundSize: '0.5vw 0.5vw',
		}
	}

	// Если это ссылка на переменную, находим её и получаем цвет
	if (firstModeValue.type === 'VARIABLE_ALIAS' && firstModeValue.id) {
		const referencedVariable = allVariables.find(
			v =>
				v.id === firstModeValue.id || String(v.id) === String(firstModeValue.id)
		)

		if (referencedVariable) {
			// Парсим значения референсной переменной
			const referencedValues =
				referencedVariable.parsedValues ||
				safeJsonParse(referencedVariable.values_by_mode)
			const referencedFirstValue = Object.values(referencedValues)[0]

			// Если у референсной переменной есть цвет, используем его
			if (referencedFirstValue && referencedFirstValue.r !== undefined) {
				const r = Math.round(referencedFirstValue.r * 255)
				const g = Math.round(referencedFirstValue.g * 255)
				const b = Math.round(referencedFirstValue.b * 255)
				const a =
					referencedFirstValue.a !== undefined ? referencedFirstValue.a : 1
				return {
					backgroundColor: `rgba(${r}, ${g}, ${b}, ${a})`,
					width: '1.2375vw',
					height: '1.2375vw',
					borderRadius: '0.208vw',
					display: 'inline-block',
					marginRight: '0.5vw',
					verticalAlign: 'middle',
					border: '1px solid #e5e5e7',
					boxShadow: '0 0.05vw 0.1vw rgba(0,0,0,0.05)',
				}
			}
		}

		// Если не нашли цвет, возвращаем паттерн
		return {
			background:
				'linear-gradient(45deg, #f8f9fa 25%, #e9ecef 25%, #e9ecef 50%, #f8f9fa 50%, #f8f9fa 75%, #e9ecef 75%)',
			backgroundSize: '0.5vw 0.5vw',
		}
	}

	if (firstModeValue.r !== undefined) {
		const r = Math.round(firstModeValue.r * 255)
		const g = Math.round(firstModeValue.g * 255)
		const b = Math.round(firstModeValue.b * 255)
		const a = firstModeValue.a !== undefined ? firstModeValue.a : 1
		return {
			backgroundColor: `rgba(${r}, ${g}, ${b}, ${a})`,
			width: '1.2375vw',
			height: '1.2375vw',
			borderRadius: '0.208vw',
			display: 'inline-block',
			marginRight: '0.5vw',
			verticalAlign: 'middle',
			border: '1px solid #e5e5e7',
			boxShadow: '0 0.05vw 0.1vw rgba(0,0,0,0.05)',
		}
	}

	return {}
}

export function safeJsonParse(data) {
	if (typeof data === 'string') {
		try {
			return JSON.parse(data)
		} catch {
			return {}
		}
	}
	return data || {}
}

export function getTypeLabel(type) {
	const labels = {
		COLOR: 'Цвет',
		FLOAT: 'Число',
		STRING: 'Текст',
		BOOLEAN: 'Логический',
	}
	return labels[type] || type
}
