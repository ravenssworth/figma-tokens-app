import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import './Layout.css'

export function Layout({ children }) {
	const location = useLocation()

	return (
		<div className='layout'>
			<header className='layout__header'></header>
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
							<i className='fas fa-tags'></i>
							<span>Токены</span>
						</Link>
						<Link
							to='/history'
							className={`nav-link ${
								location.pathname === '/history' ? 'active' : ''
							}`}
						>
							<i className='fas fa-history'></i>
							<span>История изменений</span>
						</Link>
						<Link
							to='/versions'
							className={`nav-link ${
								location.pathname === '/versions' ? 'active' : ''
							}`}
						>
							<i className='fas fa-code-branch'></i>
							<span>Версии</span>
						</Link>
						<Link
							to='/export'
							className={`nav-link ${
								location.pathname === '/export' ? 'active' : ''
							}`}
						>
							<i className='fas fa-file-export'></i>
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
