import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useProject } from '../../context/ProjectContext'
import './ProjectsPage.css'

export function ProjectsPage() {
	const { project, selectProject } = useProject()
	const [projects, setProjects] = useState([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState(null)
	const [newName, setNewName] = useState('')
	const [creating, setCreating] = useState(false)

	async function loadProjects() {
		setLoading(true)
		setError(null)
		try {
			const response = await fetch('/api/projects')
			const data = await response.json()
			if (data.success) {
				setProjects(data.data || [])
			} else {
				setError(data.error || 'Не удалось загрузить проекты')
			}
		} catch (err) {
			console.error(err)
			setError('Ошибка сети при загрузке проектов')
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => {
		loadProjects()
	}, [])

	async function handleCreate(e) {
		e.preventDefault()
		const name = newName.trim()
		if (!name) return

		setCreating(true)
		setError(null)
		try {
			const response = await fetch('/api/projects', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name }),
			})
			const data = await response.json()
			if (data.success && data.data) {
				setNewName('')
				selectProject(data.data)
			} else {
				setError(data.error || 'Не удалось создать проект')
			}
		} catch (err) {
			console.error(err)
			setError('Ошибка сети при создании проекта')
		} finally {
			setCreating(false)
		}
	}

	return (
		<div className='projects-page'>
			<div className='projects-page__card'>
				<Link to='/auth' className='projects-page__auth-link'>
					Войти
				</Link>

				<div className='projects-page__header'>
					<h1>Проекты</h1>
					<p className='projects-page__subtitle'>
						Выберите проект, чтобы работать с токенами, историей и экспортом.
						Данные из Figma привязываются к проекту при импорте в плагине.
					</p>
				</div>

				<form className='projects-page__create' onSubmit={handleCreate}>
					<label htmlFor='new-project-name'>Новый проект</label>
					<div className='projects-page__create-row'>
						<input
							id='new-project-name'
							type='text'
							placeholder='Название проекта'
							value={newName}
							onChange={e => setNewName(e.target.value)}
							autoComplete='off'
						/>
						<button
							type='submit'
							className='projects-page__btn projects-page__btn--primary'
							disabled={creating || !newName.trim()}
						>
							Создать
						</button>
					</div>
				</form>

				<h2 className='projects-page__list-title'>Существующие проекты</h2>

				{error && <p className='projects-page__error'>{error}</p>}

				{loading ? (
					<p className='projects-page__loading'>Загрузка…</p>
				) : (
					<div className='projects-page__list'>
						{projects.length === 0 ? (
							<p className='projects-page__empty'>
								Проектов пока нет. Создайте первый или импортируйте токены из
								Figma, указав название проекта в плагине.
							</p>
						) : (
							projects.map(p => (
								<div
									key={p.id}
									className='projects-page__item'
									role='button'
									tabIndex={0}
									onClick={() => selectProject(p)}
									onKeyDown={e => {
										if (e.key === 'Enter' || e.key === ' ') {
											e.preventDefault()
											selectProject(p)
										}
									}}
								>
									<div className='projects-page__item-info'>
										<span className='projects-page__item-name'>{p.name}</span>
										<span className='projects-page__item-meta'>
											Коллекций: {p.collections_count ?? 0}
											{project?.id === p.id ? ' · открыт сейчас' : ''}
										</span>
									</div>
									<span className='projects-page__btn projects-page__btn--primary'>
										Открыть
									</span>
								</div>
							))
						)}
					</div>
				)}
			</div>
		</div>
	)
}
