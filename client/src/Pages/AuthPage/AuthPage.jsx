import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './AuthPage.css'

export function AuthPage() {
	const [isLoginMode, setIsLoginMode] = useState(true)
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [username, setUsername] = useState('')
	const [confirmPassword, setConfirmPassword] = useState('')
	const [error, setError] = useState('')
	const [loading, setLoading] = useState(false)
	const navigate = useNavigate()

	const resetForm = () => {
		setEmail('')
		setPassword('')
		setUsername('')
		setConfirmPassword('')
		setError('')
	}

	const handleSwitchMode = () => {
		setIsLoginMode(!isLoginMode)
		resetForm()
	}

	const validateForm = () => {
		if (!email || !password) {
			setError('Email и пароль обязательны')
			return false
		}

		if (!isLoginMode) {
			if (password !== confirmPassword) {
				setError('Пароли не совпадают')
				return false
			}
			if (password.length < 6) {
				setError('Пароль должен содержать минимум 6 символов')
				return false
			}
		}

		return true
	}

	const handleSubmit = async e => {
		e.preventDefault()

		if (!validateForm()) {
			return
		}

		setError('')
		setLoading(true)

		try {
			const endpoint = isLoginMode ? '/api/auth/login' : '/api/auth/register'
			const body = isLoginMode
				? { email, password }
				: { email, password, username }

			const response = await fetch(endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			})

			const data = await response.json()

			if (data.success) {
				localStorage.setItem('token', data.token)
				navigate('/')
			} else {
				setError(
					data.error || `Ошибка ${isLoginMode ? 'входа' : 'регистрации'}`
				)
			}
		} catch (err) {
			setError('Ошибка сети')
		} finally {
			setLoading(false)
		}
	}

	return (
		<div className='auth-page'>
			<div className='auth-container'>
				<div className='auth-header'>
					<h2>{isLoginMode ? 'Вход в систему' : 'Регистрация'}</h2>
					<button
						type='button'
						className='auth-switch-mode'
						onClick={handleSwitchMode}
					>
						{isLoginMode
							? 'Нет аккаунта? Зарегистрироваться'
							: 'Уже есть аккаунт? Войти'}
					</button>
				</div>

				{error && <div className='auth-error'>{error}</div>}

				<form onSubmit={handleSubmit}>
					{!isLoginMode && (
						<div className='form-group'>
							<label>Имя пользователя</label>
							<input
								type='text'
								value={username}
								onChange={e => setUsername(e.target.value)}
								placeholder='Введите имя'
							/>
						</div>
					)}

					<div className='form-group'>
						<label>Email</label>
						<input
							type='email'
							value={email}
							onChange={e => setEmail(e.target.value)}
							placeholder='Введите email'
							required
						/>
					</div>

					<div className='form-group'>
						<label>Пароль</label>
						<input
							type='password'
							value={password}
							onChange={e => setPassword(e.target.value)}
							placeholder='Введите пароль'
							required
						/>
					</div>

					{!isLoginMode && (
						<div className='form-group'>
							<label>Подтвердите пароль</label>
							<input
								type='password'
								value={confirmPassword}
								onChange={e => setConfirmPassword(e.target.value)}
								placeholder='Повторите пароль'
								required
							/>
						</div>
					)}

					<button type='submit' className='auth-submit-btn' disabled={loading}>
						{loading
							? isLoginMode
								? 'Вход...'
								: 'Регистрация...'
							: isLoginMode
							? 'Войти'
							: 'Зарегистрироваться'}
					</button>
				</form>
			</div>
		</div>
	)
}
