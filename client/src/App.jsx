import {
	BrowserRouter as Router,
	Routes,
	Route,
	Navigate,
} from 'react-router-dom'
import { TokensPage } from './Pages/TokensPage/TokensPage'
import { HistoryPage } from './Pages/HistoryPage/HistoryPage'
import { ProjectsPage } from './Pages/ProjectsPage/ProjectsPage'
import { Layout } from './components/Layout/Layout'
import { AuthPage } from './Pages/AuthPage/AuthPage'
import ExportPage from './Pages/ExportPage/ExportPage.jsx'
import { ProjectProvider, RequireProject } from './context/ProjectContext'
import './App.css'

function App() {
	return (
		<Router>
			<ProjectProvider>
				<Routes>
					<Route path='/auth' element={<AuthPage />} />
					<Route path='/projects' element={<ProjectsPage />} />
					<Route
						element={
							<RequireProject>
								<Layout />
							</RequireProject>
						}
					>
						<Route path='/tokens' element={<TokensPage />} />
						<Route path='/history' element={<HistoryPage />} />
						<Route path='/export' element={<ExportPage />} />
					</Route>
					<Route path='/' element={<Navigate to='/projects' replace />} />
					<Route path='*' element={<Navigate to='/projects' replace />} />
				</Routes>
			</ProjectProvider>
		</Router>
	)
}

export default App
