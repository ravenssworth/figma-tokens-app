const VERSION_TAG_LABELS = {
	draft: 'черновик',
	release: 'релиз',
}

/** Значения тега, сохраняемые в БД; подписи — для селекторов. */
export const VERSION_TAG_OPTIONS = [
	{ value: 'релиз', label: 'Релиз' },
	{ value: 'черновик', label: 'Черновик' },
]

/** Подпись тега версии для интерфейса (в т.ч. для старых записей на английском). */
export function formatVersionTagForDisplay(tag) {
	if (tag == null || tag === '') return ''
	const key = String(tag).trim().toLowerCase()
	return VERSION_TAG_LABELS[key] || String(tag).trim()
}

/** Релизная версия (для экспорта / подсказок): учитываем русский и английский тег в БД. */
export function isReleaseVersionTag(tag) {
	if (tag == null || tag === '') return false
	const key = String(tag).trim().toLowerCase()
	return key === 'релиз' || key === 'release'
}

/**
 * Сортировка списка версий: сначала релизные (новее выше), затем остальные по дате.
 */
export function sortVersionsForExportList(versions) {
	return [...(versions || [])].sort((a, b) => {
		const ar = isReleaseVersionTag(a.version_tag) ? 1 : 0
		const br = isReleaseVersionTag(b.version_tag) ? 1 : 0
		if (br !== ar) return br - ar
		return new Date(b.created_at) - new Date(a.created_at)
	})
}
