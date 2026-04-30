import React, { useState, useEffect } from 'react'
import './ExportPage.css'

const ExportPage = () => {
	const [collections, setCollections] = useState([])
	const [selectedCollection, setSelectedCollection] = useState(null)
	const [versions, setVersions] = useState([])
	const [selectedVersion, setSelectedVersion] = useState(null)
	const [tokens, setTokens] = useState([])
	const [loading, setLoading] = useState(true)
	const [loadingTokens, setLoadingTokens] = useState(false)

	const [format, setFormat] = useState('css')
	const [isExporting, setIsExporting] = useState(false)
	const [downloadUrl, setDownloadUrl] = useState(null)
	const [tokenTypes, setTokenTypes] = useState({
		colors: true,
		sizes: true,
		spacing: true,
		typography: true,
	})
	const [fileName, setFileName] = useState('tokens')

	useEffect(() => {
		loadCollections()
	}, [])

	// Load versions when collection is selected
	useEffect(() => {
		if (selectedCollection) {
			loadVersions(selectedCollection.id)
		} else {
			setVersions([])
			setSelectedVersion(null)
			setTokens([])
		}
	}, [selectedCollection])

	// Load tokens when version is selected
	useEffect(() => {
		if (selectedVersion) {
			loadTokensFromVersion(selectedVersion.id)
		}
	}, [selectedVersion])

	async function loadCollections() {
		try {
			const response = await fetch('/api/collections')
			const data = await response.json()

			if (data.success) {
				setCollections(data.data || [])
				if (data.data && data.data.length > 0) {
					setSelectedCollection(data.data[0])
				}
			}
		} catch (error) {
			console.error('Ошибка загрузки коллекций:', error)
		} finally {
			setLoading(false)
		}
	}

	async function loadVersions(collectionId) {
		try {
			const response = await fetch(`/api/collections/${collectionId}/versions`)
			const data = await response.json()

			if (data.success) {
				setVersions(data.data || [])
				// Reset selected version when collection changes
				setSelectedVersion(null)
			}
		} catch (error) {
			console.error('Ошибка загрузки версий:', error)
			setVersions([])
		}
	}

	async function loadTokensFromVersion(versionId) {
		try {
			setLoadingTokens(true)
			const response = await fetch(`/api/versions/${versionId}/variables`)
			const data = await response.json()

			if (data.success) {
				const parsedTokens = data.data.map(token => {
					const valuesByMode = JSON.parse(token.values_by_mode || '{}')
					const firstModeValue = valuesByMode[Object.keys(valuesByMode)[0]]

					return {
						id: token.id,
						name: token.name,
						type: token.type,
						value: formatTokenValue(firstModeValue),
						from_version: token.from_version,
						version_name: token.version_name,
					}
				})
				setTokens(parsedTokens)
			}
		} catch (error) {
			console.error('Ошибка загрузки токенов версии:', error)
			setTokens([])
		} finally {
			setLoadingTokens(false)
		}
	}

	async function handleVersionChange(e) {
		const selectedVersionId = e.target.value
		const version = versions.find(v => String(v.id) === selectedVersionId)
		setSelectedVersion(version || null)

		if (version) {
			// Сбрасываем фильтры, чтобы показать все токены новой версии
			setTokenTypes({
				colors: true,
				sizes: true,
				spacing: true,
				typography: true,
			})
		} else {
			setTokens([])
		}
	}

	// Helper function to format token values
	function formatTokenValue(value) {
		if (!value) return ''

		// Handle RGBA color values
		if (
			value.r !== undefined &&
			value.g !== undefined &&
			value.b !== undefined
		) {
			const r = Math.round(value.r * 255)
			const g = Math.round(value.g * 255)
			const b = Math.round(value.b * 255)
			const a = value.a !== undefined ? value.a : 1

			if (a < 1) {
				return `rgba(${r}, ${g}, ${b}, ${a})`
			}
			return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
		}

		// Handle variable aliases
		if (value.type === 'VARIABLE_ALIAS' && value.id) {
			return `alias:${value.id}`
		}

		// Return as string
		return String(value)
	}

	// Filter tokens based on selected token types
	const getFilteredTokens = () => {
		return tokens.filter(token => {
			const typeMap = {
				COLOR: tokenTypes.colors,
				FLOAT: tokenTypes.sizes || tokenTypes.spacing,
				STRING: tokenTypes.typography,
			}
			return typeMap[token.type] !== false
		})
	}

	// Generate preview content based on selected format and actual tokens
	const getPreviewContent = () => {
		const filteredTokens = getFilteredTokens()

		if (filteredTokens.length === 0) {
			return '// Нет токенов для отображения'
		}

		switch (format) {
			case 'css':
				return filteredTokens
					.map(token => `--${token.name}: ${token.value};`)
					.join('\n')
			case 'json': {
				const jsonObj = {}
				filteredTokens.forEach(token => {
					jsonObj[token.name] = token.value
				})
				return JSON.stringify(jsonObj, null, 2)
			}
			case 'scss':
				return filteredTokens
					.map(token => `$${token.name}: ${token.value};`)
					.join('\n')
			default:
				return ''
		}
	}

	// Get file extension based on format
	const getFileExtension = () => {
		switch (format) {
			case 'css':
				return 'css'
			case 'json':
				return 'json'
			case 'scss':
				return 'scss'
			default:
				return 'txt'
		}
	}

	// Simulate export process
	const handleExport = () => {
		setIsExporting(true)
		// Simulate processing time
		setTimeout(() => {
			// Create a blob with the preview content
			const content = getPreviewContent()
			const blob = new Blob([content], { type: 'text/plain' })
			const url = URL.createObjectURL(blob)
			setDownloadUrl(url)
			setIsExporting(false)
		}, 1500)
	}

	return (
		<div className='export-page'>
			<div className='export-page__left-column'>
				<div className='export-page__header'>
					<div className='export-page__header-title'>
						<h2>Экспорт дизайн токенов</h2>
					</div>
					<div className='export-page__collection-selector'>
						<label htmlFor='collection-select'>Коллекция:</label>
						<select
							id='collection-select'
							value={selectedCollection?.id || ''}
							onChange={e => {
								const collection = collections.find(
									c => c.id === e.target.value,
								)
								setSelectedCollection(collection)
							}}
						>
							{collections.map(collection => (
								<option key={collection.id} value={collection.id}>
									{collection.name}
								</option>
							))}
						</select>
						<label htmlFor='version-select'>Версия:</label>
						<select
							id='version-select'
							value={selectedVersion ? String(selectedVersion.id) : ''}
							onChange={handleVersionChange}
						>
							<option value=''>Выберите версию</option>
							{versions.map(version => (
								<option key={version.id} value={String(version.id)}>
									{version.version_name} ({version.version_tag})
								</option>
							))}
						</select>
					</div>
				</div>

				<div className='export-page__panel'>
					<div className='export-page__format-section'>
						<div className='export-page__format-title'>
							Формат экспорта (.{getFileExtension()})
						</div>
						<div className='export-page__format-options'>
							<label className='export-page__format-option'>
								<input
									type='radio'
									value='css'
									checked={format === 'css'}
									onChange={e => setFormat(e.target.value)}
								/>
								CSS Custom Properties
							</label>
							<label className='export-page__format-option'>
								<input
									type='radio'
									value='json'
									checked={format === 'json'}
									onChange={e => setFormat(e.target.value)}
								/>
								JSON
							</label>
							<label className='export-page__format-option'>
								<input
									type='radio'
									value='scss'
									checked={format === 'scss'}
									onChange={e => setFormat(e.target.value)}
								/>
								SCSS
							</label>
						</div>
					</div>

					<div className='export-page__preview-section'>
						<div className='export-page__preview-title'>
							Preview ({tokens.length} токенов)
							{loadingTokens && (
								<span style={{ marginLeft: '10px', fontSize: '12px' }}>
									Загрузка...
								</span>
							)}
						</div>
						<div className='export-page__preview-content'>
							<pre>{getPreviewContent()}</pre>
						</div>
					</div>

					<div className='export-page__additional-options'>
						<div className='export-page__collections-section'>
							<div className='export-page__section-title'>
								Collections / Versions
							</div>
							<div className='export-page__collections-selector'>
								<select
									multiple
									value={selectedCollection ? [selectedCollection.id] : []}
									onChange={e => {
										const collectionId = Array.from(
											e.target.selectedOptions,
										).map(opt => opt.value)[0]
										const collection = collections.find(
											c => c.id === collectionId,
										)
										setSelectedCollection(collection || null)
									}}
								>
									{collections.map(collection => (
										<option key={collection.id} value={collection.id}>
											{collection.name}
										</option>
									))}
								</select>
							</div>
						</div>

						<div className='export-page__token-types-section'>
							<div className='export-page__section-title'>Token Types</div>
							<label className='export-page__token-types-label'>
								<input
									type='checkbox'
									checked={tokenTypes.colors}
									onChange={e =>
										setTokenTypes({ ...tokenTypes, colors: e.target.checked })
									}
								/>
								Colors
							</label>
							<label className='export-page__token-types-label'>
								<input
									type='checkbox'
									checked={tokenTypes.sizes}
									onChange={e =>
										setTokenTypes({ ...tokenTypes, sizes: e.target.checked })
									}
								/>
								Sizes
							</label>
							<label className='export-page__token-types-label'>
								<input
									type='checkbox'
									checked={tokenTypes.spacing}
									onChange={e =>
										setTokenTypes({ ...tokenTypes, spacing: e.target.checked })
									}
								/>
								Spacing
							</label>
							<label className='export-page__token-types-label'>
								<input
									type='checkbox'
									checked={tokenTypes.typography}
									onChange={e =>
										setTokenTypes({
											...tokenTypes,
											typography: e.target.checked,
										})
									}
								/>
								Typography
							</label>
						</div>

						<div className='export-page__filename-section'>
							<div className='export-page__section-title'>File Name</div>
							<input
								type='text'
								value={fileName}
								onChange={e => setFileName(e.target.value)}
								placeholder='tokens'
								className='export-page__filename-input'
							/>
							<span className='export-page__file-extension'>
								.{getFileExtension()}
							</span>
						</div>
					</div>
				</div>
			</div>
			<div className='export-page__right-column'>
				<div className='export-page__export-controls'>
					<button
						onClick={handleExport}
						disabled={isExporting || tokens.length === 0}
						className={`export-page__export-button ${isExporting ? 'export-page__export-button--disabled' : ''}`}
					>
						{isExporting ? 'Экспорт...' : 'Экспортировать дизайн-токены'}
					</button>

					{isExporting && (
						<div className='export-page__progress-container'>
							<div className='export-page__progress-bar' />
						</div>
					)}

					{downloadUrl && (
						<a
							href={downloadUrl}
							download={`${fileName}.${getFileExtension()}`}
							className='export-page__download-link'
						>
							Скачать файл ({fileName}.{getFileExtension()})
						</a>
					)}
				</div>
			</div>
		</div>
	)
}

export default ExportPage
