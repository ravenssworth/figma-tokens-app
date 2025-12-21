function hasVariableChanged(oldValuesByMode, newValuesByMode) {
	if (!oldValuesByMode || !newValuesByMode) return true

	try {
		const oldValues =
			typeof oldValuesByMode === 'string'
				? JSON.parse(oldValuesByMode)
				: oldValuesByMode
		const newValues =
			typeof newValuesByMode === 'string'
				? JSON.parse(newValuesByMode)
				: newValuesByMode

		return !areFigmaValuesEqual(oldValues, newValues)
	} catch (error) {
		console.error('Ошибка сравнения значений:', error)
		return true
	}
}

function areFigmaValuesEqual(oldVals, newVals) {
	const oldModes = Object.keys(oldVals)
	const newModes = Object.keys(newVals)

	if (oldModes.length !== newModes.length) return false

	for (const modeId of oldModes) {
		if (!newVals[modeId]) return false

		const oldVal = oldVals[modeId]
		const newVal = newVals[modeId]

		if (oldVal.type === 'VARIABLE_ALIAS' && newVal.type === 'VARIABLE_ALIAS') {
			if (oldVal.id !== newVal.id) return false
			continue
		}

		if (oldVal.r !== undefined && newVal.r !== undefined) {
			if (Math.round(oldVal.r * 255) !== Math.round(newVal.r * 255))
				return false
			if (Math.round(oldVal.g * 255) !== Math.round(newVal.g * 255))
				return false
			if (Math.round(oldVal.b * 255) !== Math.round(newVal.b * 255))
				return false
			if ((oldVal.a || 1) !== (newVal.a || 1)) return false
			continue
		}

		if (typeof oldVal === 'number' && typeof newVal === 'number') {
			if (oldVal !== newVal) return false
			continue
		}

		if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) return false
	}

	return true
}

module.exports = {
	hasVariableChanged,
	areFigmaValuesEqual,
}
