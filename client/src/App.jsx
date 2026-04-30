import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { TokensPage } from './Pages/TokensPage/TokensPage'
import { HistoryPage } from './Pages/HistoryPage/HistoryPage'
import { Layout } from './components/Layout/Layout'
import { AuthPage } from './Pages/AuthPage/AuthPage'
import ExportPage from './Pages/ExportPage/ExportPage.jsx'
import './App.css'

function App() {
	return (
		<Router>
			<Routes>
				<Route path='/auth' element={<AuthPage />} />
				<Route
					path='*'
					element={
						<Layout>
							<Routes>
								<Route path='/' element={<TokensPage />} />
								<Route path='/tokens' element={<TokensPage />} />
								<Route path='/history' element={<HistoryPage />} />
								<Route path='/export' element={<ExportPage />} />
							</Routes>
						</Layout>
					}
				/>
			</Routes>
		</Router>
	)
}

export default App
