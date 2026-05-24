export const PROJECT_ID_KEY = 'figma_tokens_project_id'
export const PROJECT_NAME_KEY = 'figma_tokens_project_name'

export function getStoredProjectId() {
	const raw = localStorage.getItem(PROJECT_ID_KEY)
	if (!raw) return null
	const id = Number(raw)
	return Number.isInteger(id) && id > 0 ? id : null
}

export function getStoredProjectName() {
	return localStorage.getItem(PROJECT_NAME_KEY) || ''
}

export function saveStoredProject(project) {
	if (!project?.id) return
	localStorage.setItem(PROJECT_ID_KEY, String(project.id))
	localStorage.setItem(PROJECT_NAME_KEY, project.name || '')
}

export function clearStoredProject() {
	localStorage.removeItem(PROJECT_ID_KEY)
	localStorage.removeItem(PROJECT_NAME_KEY)
}

/** Добавляет ?projectId= к пути API. */
export function withProjectQuery(path, projectId) {
	const id = projectId ?? getStoredProjectId()
	if (!id) return path
	const separator = path.includes('?') ? '&' : '?'
	return `${path}${separator}projectId=${id}`
}
