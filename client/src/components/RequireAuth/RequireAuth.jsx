import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'

export function RequireAuth() {
	const location = useLocation()
	const [checked, setChecked] = useState(false)
	const [isAuthenticated, setIsAuthenticated] = useState(false)

	useEffect(() => {
		const token = localStorage.getItem('token')
		if (!token) {
			setIsAuthenticated(false)
			setChecked(true)
			return
		}

		fetch('/api/auth/verify', {
			headers: { Authorization: `Bearer ${token}` },
		})
			.then(res => res.json())
			.then(data => {
				setIsAuthenticated(data.success === true)
				setChecked(true)
			})
			.catch(() => {
				setIsAuthenticated(false)
				setChecked(true)
			})
	}, [location.pathname])

	if (!checked) {
		return (
			<div className='auth-guard-loading'>
				<p>Загрузка…</p>
			</div>
		)
	}

	if (!isAuthenticated) {
		return <Navigate to='/auth' replace state={{ from: location.pathname }} />
	}

	return <Outlet />
}
