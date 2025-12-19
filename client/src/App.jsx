import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { TokensPage } from './Pages/TokensPage/TokensPage'
import { HistoryPage } from './Pages/HistoryPage/HistoryPage'
import { Layout } from './components/Layout/Layout'
import './App.css'

function App() {
	return (
		<Router>
			<Layout>
				<Routes>
					<Route path='/' element={<TokensPage />} />
					<Route path='/tokens' element={<TokensPage />} />
					<Route path='/history' element={<HistoryPage />} />
				</Routes>
			</Layout>
		</Router>
	)
}

export default App
