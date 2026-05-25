import React from 'react'
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom'
import { useProject } from '../../context/ProjectContext'
import './Layout.css'

const NAV_ITEMS = [
	{ path: '/tokens', label: 'Токены' },
	{ path: '/history', label: 'История' },
	{ path: '/export', label: 'Экспорт' },
]

function getPageTitle(pathname) {
	if (pathname === '/tokens') return 'Токены'
	if (pathname === '/history') return 'История изменений'
	if (pathname === '/export') return 'Экспорт'
	return 'Рабочая область'
}

function getUserInitial(user) {
	const name = user?.username || user?.email || '?'
	return String(name).charAt(0).toUpperCase()
}

export function Layout() {
	const location = useLocation()
	const navigate = useNavigate()
	const { project, clearProject } = useProject()
	const [user, setUser] = React.useState(null)

	React.useEffect(() => {
		const token = localStorage.getItem('token')
		if (!token) return

		fetch('/api/auth/verify', {
			headers: { Authorization: `Bearer ${token}` },
		})
			.then(res => res.json())
			.then(data => {
				if (data.success) {
					setUser(data.user)
				}
			})
	}, [])

	const handleLogout = () => {
		localStorage.removeItem('token')
		setUser(null)
		navigate('/auth')
	}

	const handleAllProjects = () => {
		clearProject()
	}

	const pageTitle = getPageTitle(location.pathname)

	return (
		<div className='layout'>
			<aside className='layout-sidebar' aria-label='Навигация'>
				<div className='layout-sidebar__top'>
					<div className='layout-sidebar__brand'>
						<span className='layout-sidebar__brand-mark' aria-hidden='true' />
						<div className='layout-sidebar__brand-text'>
							<span className='layout-sidebar__brand-title'>Design Tokens</span>
							<span className='layout-sidebar__brand-sub'>Figma → Web</span>
						</div>
					</div>

					{project && (
						<div className='layout-sidebar__project'>
							<span className='layout-sidebar__project-label'>
								Текущий проект
							</span>
							<p className='layout-sidebar__project-name' title={project.name}>
								{project.name}
							</p>
						</div>
					)}
				</div>

				<nav className='layout-sidebar__nav'>
					{NAV_ITEMS.map(item => (
						<Link
							key={item.path}
							to={item.path}
							className={`layout-nav-link${
								location.pathname === item.path
									? ' layout-nav-link--active'
									: ''
							}`}
						>
							{item.label}
						</Link>
					))}
				</nav>

				<div className='layout-sidebar__footer'>
					<button
						type='button'
						className='layout-sidebar__projects-btn'
						onClick={handleAllProjects}
					>
						Все проекты
					</button>
				</div>
			</aside>

			<div className='layout-main'>
				<header className='layout-header'>
					<div className='layout-header__context'>
						<span className='layout-header__eyebrow'>Рабочая область</span>
						<h1 className='layout-header__title'>{pageTitle}</h1>
					</div>

					<div className='layout-header__actions'>
						{user ? (
							<>
								<div className='layout-user-card'>
									<span
										className='layout-user-card__avatar'
										aria-hidden='true'
									>
										{getUserInitial(user)}
									</span>
									<div className='layout-user-card__text'>
										<span className='layout-user-card__name'>
											{user.username || 'Пользователь'}
										</span>
										<span className='layout-user-card__email'>
											{user.email}
										</span>
									</div>
								</div>
								<button
									type='button'
									className='layout-btn layout-btn--secondary'
									onClick={handleLogout}
								>
									Выйти
								</button>
							</>
						) : (
							<Link to='/auth' className='layout-btn layout-btn--primary'>
								Войти
							</Link>
						)}
					</div>
				</header>

				<main className='layout-content'>
					<div className='layout-content__stage'>
						<Outlet />
					</div>
				</main>
			</div>
		</div>
	)
}
