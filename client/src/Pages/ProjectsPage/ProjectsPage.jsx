import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProject } from '../../context/ProjectContext'
import './ProjectsPage.css'

function formatLastUpdate(iso) {
	if (!iso) return 'Нет импорта из Figma'
	try {
		return new Date(iso).toLocaleString('ru-RU', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		})
	} catch {
		return '—'
	}
}

function paletteGradient(colors) {
	if (!colors?.length) {
		return 'linear-gradient(135deg, #e5e5e7 0%, #f5f5f7 50%, #d2d2d7 100%)'
	}
	if (colors.length === 1) {
		return `linear-gradient(135deg, ${colors[0]} 0%, ${colors[0]} 100%)`
	}
	const stops = colors
		.map((hex, i) => {
			const pct = Math.round((i / (colors.length - 1)) * 100)
			return `${hex} ${pct}%`
		})
		.join(', ')
	return `linear-gradient(135deg, ${stops})`
}

function ProjectCard({ project, isActive, onOpen }) {
	const palette = project.palette || []
	const hasColors = palette.length > 0

	return (
		<article
			className={`project-card${isActive ? ' project-card--active' : ''}`}
			role='button'
			tabIndex={0}
			onClick={onOpen}
			onKeyDown={e => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault()
					onOpen()
				}
			}}
		>
			<div
				className='project-card__cover'
				style={{ background: paletteGradient(palette) }}
			>
				{hasColors ? (
					<div className='project-card__swatches'>
						{palette.slice(0, 6).map(hex => (
							<span
								key={hex}
								className='project-card__swatch'
								style={{ backgroundColor: hex }}
								title={hex}
							/>
						))}
					</div>
				) : (
					<span className='project-card__no-colors'>
						Палитра появится после импорта цветовых токенов
					</span>
				)}
			</div>

			<div className='project-card__body'>
				<div className='project-card__head'>
					<h2 className='project-card__name'>{project.name}</h2>
					{isActive && (
						<span className='project-card__badge'>Текущий</span>
					)}
				</div>

				<div className='project-card__stats'>
					<div className='project-card__stat'>
						<span className='project-card__stat-value'>
							{project.collections_count ?? 0}
						</span>
						<span className='project-card__stat-label'>коллекций</span>
					</div>
					<div className='project-card__stat'>
						<span className='project-card__stat-value'>
							{project.variables_count ?? 0}
						</span>
						<span className='project-card__stat-label'>токенов</span>
					</div>
					<div className='project-card__stat'>
						<span className='project-card__stat-value'>
							{project.versions_count ?? 0}
						</span>
						<span className='project-card__stat-label'>версий</span>
					</div>
				</div>

				<p className='project-card__meta'>
					Обновление: {formatLastUpdate(project.last_token_update)}
				</p>

				<button
					type='button'
					className='project-card__open-btn'
					onClick={e => {
						e.stopPropagation()
						onOpen()
					}}
				>
					Открыть проект
				</button>
			</div>
		</article>
	)
}

export function ProjectsPage() {
	const navigate = useNavigate()
	const { project, selectProject } = useProject()
	const [projects, setProjects] = useState([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState(null)
	const [userLabel, setUserLabel] = useState('')

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
		const token = localStorage.getItem('token')
		if (token) {
			fetch('/api/auth/verify', {
				headers: { Authorization: `Bearer ${token}` },
			})
				.then(res => res.json())
				.then(data => {
					if (data.success && data.user) {
						setUserLabel(data.user.username || data.user.email)
					}
				})
				.catch(() => {})
		}
		loadProjects()
	}, [])

	function handleLogout() {
		localStorage.removeItem('token')
		navigate('/auth')
	}

	return (
		<div className='projects-page'>
			<header className='projects-page__topbar'>
				<div className='projects-page__brand'>
					<h1>Дизайн-токены</h1>
					<p>Выберите проект, импортированный из Figma</p>
				</div>
				<div className='projects-page__topbar-actions'>
					{userLabel && (
						<span className='projects-page__user'>{userLabel}</span>
					)}
					<button
						type='button'
						className='projects-page__logout'
						onClick={handleLogout}
					>
						Выйти
					</button>
				</div>
			</header>

			<div className='projects-page__hint'>
				<strong>Новые проекты создаются в плагине Figma</strong> — укажите
				название при экспорте токенов. Здесь можно только открыть уже
				существующий проект.
			</div>

			{error && <p className='projects-page__error'>{error}</p>}

			{loading ? (
				<p className='projects-page__loading'>Загрузка проектов…</p>
			) : projects.length === 0 ? (
				<div className='projects-page__empty-card'>
					<h2>Проектов пока нет</h2>
					<p>
						Откройте плагин в Figma, задайте название проекта и нажмите
						«Экспортировать данные». После этого проект появится в этом списке
						с палитрой цветов и статистикой.
					</p>
				</div>
			) : (
				<div className='projects-page__grid'>
					{projects.map(p => (
						<ProjectCard
							key={p.id}
							project={p}
							isActive={project?.id === p.id}
							onOpen={() => selectProject(p)}
						/>
					))}
				</div>
			)}
		</div>
	)
}
