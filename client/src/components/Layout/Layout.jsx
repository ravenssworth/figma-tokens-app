import React from 'react'
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom'
import { useProject } from '../../context/ProjectContext'
import './Layout.css'

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
		navigate('/projects')
	}

	return (
		<div className='layout'>
			<header className='layout__header'>
				<div className='layout__header-left'>
					{project && (
						<div className='layout__project-info'>
							<span className='layout__project-label'>Проект:</span>
							<span className='layout__project-name'>{project.name}</span>
							<button
								type='button'
								className='layout__switch-project-btn'
								onClick={() => navigate('/projects')}
							>
								Сменить
							</button>
						</div>
					)}
				</div>
				{user ? (
					<div className='layout__user-info'>
						<span className='layout__username'>
							{user.username || user.email}
						</span>
						<button onClick={handleLogout} className='layout__logout-btn'>
							Выйти
						</button>
					</div>
				) : (
					<Link to='/auth' className='layout__auth-link'>
						Войти
					</Link>
				)}
			</header>
			<div className='layout__body'>
				<div className='content-area'></div>
				<nav className='layout__navigation'>
					<div className='layout__nav-menu'>
						<Link
							to='/tokens'
							className={`nav-link ${
								location.pathname === '/tokens' ? 'active' : ''
							}`}
						>
							<span>Токены</span>
						</Link>
						<Link
							to='/history'
							className={`nav-link ${
								location.pathname === '/history' ? 'active' : ''
							}`}
						>
							<span>История изменений</span>
						</Link>
						<Link
							to='/export'
							className={`nav-link ${
								location.pathname === '/export' ? 'active' : ''
							}`}
						>
							<span>Экспорт</span>
						</Link>
					</div>
					<div className='nav-footer'>
						<button
							type='button'
							className='layout__exit-project-btn'
							onClick={clearProject}
						>
							К списку проектов
						</button>
					</div>
				</nav>
				<main className='content'>
					<Outlet />
				</main>
			</div>
		</div>
	)
}
