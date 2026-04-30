import React from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import './Layout.css'

export function Layout({ children }) {
	const location = useLocation()
	const navigate = useNavigate()
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
		navigate('/')
	}

	return (
		<div className='layout'>
			<header className='layout__header'>
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
								location.pathname === '/tokens' || location.pathname === '/'
									? 'active'
									: ''
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
					<div className='nav-footer'></div>
				</nav>
				<main className='content'>{children}</main>
			</div>
		</div>
	)
}
