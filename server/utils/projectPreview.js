const MAX_COLORS_PER_PROJECT = 8

function rgbToHex(r, g, b) {
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

function parseValuesByMode(raw) {
	if (!raw) return null
	if (typeof raw === 'string') {
		try {
			return JSON.parse(raw)
		} catch {
			return null
		}
	}
	if (typeof raw === 'object') {
		if (raw.values && typeof raw.values === 'object') {
			return raw.values
		}
		return raw
	}
	return null
}

function hexFromColorValue(value) {
	if (!value || typeof value !== 'object') return null
	if (value.type === 'VARIABLE_ALIAS') return null
	if (value.r !== undefined) {
		return rgbToHex(value.r, value.g, value.b)
	}
	return null
}

function collectColorsFromVariables(variables) {
	const seen = new Set()
	const colors = []

	for (const row of variables) {
		const parsed = parseValuesByMode(row.values_by_mode)
		if (!parsed) continue

		for (const modeValue of Object.values(parsed)) {
			const hex = hexFromColorValue(modeValue)
			if (!hex || seen.has(hex)) continue
			seen.add(hex)
			colors.push(hex)
			if (colors.length >= MAX_COLORS_PER_PROJECT) {
				return colors
			}
		}
	}

	return colors
}

module.exports = { collectColorsFromVariables, MAX_COLORS_PER_PROJECT }
