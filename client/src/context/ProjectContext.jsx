import { createContext, useContext, useState, useCallback } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import {
	getStoredProjectId,
	getStoredProjectName,
	saveStoredProject,
	clearStoredProject,
} from '../utils/projectStorage'

const ProjectContext = createContext(null)

export function ProjectProvider({ children }) {
	const navigate = useNavigate()
	const [project, setProject] = useState(() => {
		const id = getStoredProjectId()
		if (!id) return null
		return { id, name: getStoredProjectName() }
	})

	const selectProject = useCallback(
		p => {
			if (!p?.id) return
			saveStoredProject(p)
			setProject({ id: p.id, name: p.name || '' })
			navigate('/tokens')
		},
		[navigate]
	)

	const clearProject = useCallback(() => {
		clearStoredProject()
		setProject(null)
		navigate('/projects')
	}, [navigate])

	const updateProjectName = useCallback(name => {
		setProject(prev => {
			if (!prev) return prev
			const next = { ...prev, name: name || '' }
			saveStoredProject(next)
			return next
		})
	}, [])

	return (
		<ProjectContext.Provider
			value={{ project, selectProject, clearProject, updateProjectName }}
		>
			{children}
		</ProjectContext.Provider>
	)
}

export function useProject() {
	const ctx = useContext(ProjectContext)
	if (!ctx) {
		throw new Error('useProject must be used within ProjectProvider')
	}
	return ctx
}

export function RequireProject({ children }) {
	const { project } = useProject()
	if (!project?.id) {
		return <Navigate to='/projects' replace />
	}
	return children
}
