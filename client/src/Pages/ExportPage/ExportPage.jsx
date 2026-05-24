import React, { useState, useEffect } from 'react'
import {
	formatVersionTagForDisplay,
	isReleaseVersionTag,
	sortVersionsForExportList,
} from '../../utils/versionUtils'
import './ExportPage.css'

const ExportPage = () => {
	const [collections, setCollections] = useState([])
	const [selectedCollection, setSelectedCollection] = useState(null)
	const [versions, setVersions] = useState([])
	const [selectedVersion, setSelectedVersion] = useState(null)
	const [tokens, setTokens] = useState([])
	const [loadingTokens, setLoadingTokens] = useState(false)

	const [format, setFormat] = useState('css')
	const [isExporting, setIsExporting] = useState(false)
	const [npmPackageName, setNpmPackageName] = useState('@org/design-tokens')
	const [npmPackageVersion, setNpmPackageVersion] = useState('1.0.0')
	const [npmToken, setNpmToken] = useState('')
	const [isPackaging, setIsPackaging] = useState(false)
	const [isPublishing, setIsPublishing] = useState(false)
	const [npmStatus, setNpmStatus] = useState('')
	const [tokenTypes, setTokenTypes] = useState({
		color: true,
		number: true,
		string: true,
		boolean: true,
	})
	const [fileName, setFileName] = useState('')

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
		} else {
			setTokens([])
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
		}
	}

	async function loadVersions(collectionId) {
		try {
			const response = await fetch(`/api/collections/${collectionId}/versions`)
			const data = await response.json()

			if (data.success) {
				const sorted = sortVersionsForExportList(data.data || [])
				setVersions(sorted)
				if (sorted.length > 0) {
					setSelectedVersion(sorted[0])
				} else {
					setSelectedVersion(null)
					setTokens([])
				}
			}
		} catch (error) {
			console.error('Ошибка загрузки версий:', error)
			setVersions([])
		}
	}

	async function loadTokensFromVersion(versionId) {
		try {
			setLoadingTokens(true)
			const [versionResponse, allVariablesResponse] = await Promise.all([
				fetch(`/api/versions/${versionId}/variables`),
				fetch('/api/variables'),
			])
			const [data, allVariablesData] = await Promise.all([
				versionResponse.json(),
				allVariablesResponse.json(),
			])

			if (data.success) {
				const parseValuesByMode = valuesByMode => {
					if (!valuesByMode) return {}
					if (typeof valuesByMode === 'string') {
						return JSON.parse(valuesByMode || '{}')
					}
					if (typeof valuesByMode === 'object') {
						if (
							valuesByMode.values &&
							typeof valuesByMode.values === 'object'
						) {
							return valuesByMode.values
						}
						return valuesByMode
					}
					return {}
				}

				const snapshotVariables = data.data || []
				const allVariables = allVariablesData?.success
					? allVariablesData.data || []
					: []
				const variablesById = new Map()

				;[...allVariables, ...snapshotVariables].forEach(variable => {
					variablesById.set(String(variable.id), variable)
				})

				const getFirstModeValue = (valuesByMode, preferredModeId) => {
					const modeKeys = Object.keys(valuesByMode || {})
					if (modeKeys.length === 0) return null
					if (preferredModeId && valuesByMode[preferredModeId] !== undefined) {
						return valuesByMode[preferredModeId]
					}
					return valuesByMode[modeKeys[0]]
				}

				const getReferenceNameByAliasValue = aliasValue => {
					if (
						!aliasValue ||
						typeof aliasValue !== 'object' ||
						aliasValue.type !== 'VARIABLE_ALIAS' ||
						!aliasValue.id
					) {
						return null
					}

					const referencedToken = variablesById.get(String(aliasValue.id))
					return referencedToken?.name || null
				}

				const resolveTokenValue = (
					value,
					preferredModeId,
					visited = new Set(),
				) => {
					if (
						!value ||
						typeof value !== 'object' ||
						value.type !== 'VARIABLE_ALIAS' ||
						!value.id
					) {
						return value
					}

					const aliasId = String(value.id)
					if (visited.has(aliasId)) {
						return value
					}
					visited.add(aliasId)

					const referencedToken = variablesById.get(aliasId)
					if (!referencedToken) {
						return value
					}

					const referencedValuesByMode = parseValuesByMode(
						referencedToken.values_by_mode,
					)
					const referencedFirstModeValue = getFirstModeValue(
						referencedValuesByMode,
						preferredModeId,
					)

					return resolveTokenValue(
						referencedFirstModeValue,
						preferredModeId,
						visited,
					)
				}

				const parsedTokens = snapshotVariables.map(token => {
					const valuesByMode = parseValuesByMode(token.values_by_mode)
					const modeKeys = Object.keys(valuesByMode || {})
					const firstModeKey = modeKeys[0]
					const firstModeValue = firstModeKey
						? valuesByMode[firstModeKey]
						: null
					const resolvedValue = resolveTokenValue(firstModeValue, firstModeKey)
					const referenceName = getReferenceNameByAliasValue(firstModeValue)

					return {
						id: token.id,
						name: token.name,
						type: token.type,
						value: formatTokenValue(resolvedValue),
						referenceName,
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
				color: true,
				number: true,
				string: true,
				boolean: true,
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
			return String(value.id)
		}

		// Return as string
		if (typeof value === 'number') {
			return `${value}px`
		}
		return String(value)
	}

	// Filter tokens based on selected token types
	const getFilteredTokens = () => {
		return tokens.filter(token => {
			const typeMap = {
				COLOR: tokenTypes.color,
				FLOAT: tokenTypes.number,
				STRING: tokenTypes.string,
				BOOLEAN: tokenTypes.boolean,
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

		const getExportTokenName = tokenName => {
			if (!tokenName) return ''
			const parts = String(tokenName).split('/').filter(Boolean)
			const lastPart = parts[parts.length - 1] || tokenName
			return lastPart.toLowerCase()
		}

		switch (format) {
			case 'css': {
				const lines = filteredTokens.map(token => {
					const exportName = getExportTokenName(token.name)
					const referenceExportName = token.referenceName
						? getExportTokenName(token.referenceName)
						: null
					const hasSelfReference =
						referenceExportName && referenceExportName === exportName
					const exportValue =
						referenceExportName && !hasSelfReference
							? `var(--${referenceExportName})`
							: token.value
					return `  --${exportName}: ${exportValue};`
				})

				return `:root {\n${lines.join('\n')}\n}`
			}
			case 'json': {
				const jsonObj = {}
				filteredTokens.forEach(token => {
					const exportName = getExportTokenName(token.name)
					const referenceExportName = token.referenceName
						? getExportTokenName(token.referenceName)
						: null
					const hasSelfReference =
						referenceExportName && referenceExportName === exportName
					jsonObj[exportName] =
						referenceExportName && !hasSelfReference
							? `{${referenceExportName}}`
							: token.value
				})
				return JSON.stringify(jsonObj, null, 2)
			}
			case 'scss':
				return filteredTokens
					.map(token => {
						const exportName = getExportTokenName(token.name)
						const referenceExportName = token.referenceName
							? getExportTokenName(token.referenceName)
							: null
						const hasSelfReference =
							referenceExportName && referenceExportName === exportName
						const exportValue =
							referenceExportName && !hasSelfReference
								? `$${referenceExportName}`
								: token.value
						return `$${exportName}: ${exportValue};`
					})
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

	const handleExport = () => {
		if (tokens.length === 0) return
		setIsExporting(true)
		const raw = (fileName.trim() || 'tokens').replace(/\.[^/.]+$/, '')
		const exportBase = raw || 'tokens'
		const ext = getFileExtension()
		const mime =
			ext === 'json' ? 'application/json' : 'text/plain;charset=utf-8'

		window.setTimeout(() => {
			try {
				const content = getPreviewContent()
				const blob = new Blob([content], { type: mime })
				const url = URL.createObjectURL(blob)
				const a = document.createElement('a')
				a.href = url
				a.download = `${exportBase}.${ext}`
				document.body.appendChild(a)
				a.click()
				a.remove()
				URL.revokeObjectURL(url)
			} catch (e) {
				console.error('Ошибка экспорта файла:', e)
			} finally {
				setIsExporting(false)
			}
		}, 400)
	}

	const getPackageEntryFileName = () => {
		switch (format) {
			case 'css':
				return 'tokens.css'
			case 'scss':
				return 'tokens.scss'
			case 'json':
				return 'tokens.json'
			default:
				return 'tokens.txt'
		}
	}

	const handleBuildNpmPackage = async shouldPublish => {
		try {
			setNpmStatus('')
			if (!npmPackageName.trim()) {
				setNpmStatus('Укажите имя npm-пакета')
				return
			}
			if (!npmPackageVersion.trim()) {
				setNpmStatus('Укажите версию npm-пакета')
				return
			}
			if (shouldPublish && !npmToken.trim()) {
				setNpmStatus('Для публикации нужен npm token')
				return
			}

			if (shouldPublish) {
				setIsPublishing(true)
			} else {
				setIsPackaging(true)
			}

			const response = await fetch('/api/npm/package', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					packageName: npmPackageName.trim(),
					packageVersion: npmPackageVersion.trim(),
					entryFileName: getPackageEntryFileName(),
					entryFileContent: getPreviewContent(),
					shouldPublish,
					npmToken: npmToken.trim(),
				}),
			})
			const data = await response.json()

			if (!data.success) {
				setNpmStatus(data.error || 'Не удалось собрать npm-пакет')
				return
			}

			if (shouldPublish) {
				setNpmStatus(data.message || 'Пакет опубликован')
				return
			}

			const binary = atob(data.fileContentBase64)
			const bytes = new Uint8Array(binary.length)
			for (let i = 0; i < binary.length; i++) {
				bytes[i] = binary.charCodeAt(i)
			}
			const blob = new Blob([bytes], { type: 'application/gzip' })
			const url = URL.createObjectURL(blob)
			const link = document.createElement('a')
			link.href = url
			link.download = data.fileName || `${npmPackageName.trim()}.tgz`
			document.body.appendChild(link)
			link.click()
			link.remove()
			URL.revokeObjectURL(url)

			setNpmStatus('npm-пакет собран и скачан')
		} catch (error) {
			setNpmStatus('Ошибка при сборке npm-пакета')
			console.error('Ошибка npm package:', error)
		} finally {
			setIsPackaging(false)
			setIsPublishing(false)
		}
	}

	const versionSummary = selectedVersion
		? `${selectedVersion.version_name} (${formatVersionTagForDisplay(selectedVersion.version_tag)})`
		: 'не выбрана'

	return (
		<div className='export-page'>
			<div className='export-page__workspace'>
				<div className='export-page__workspace-spacer' aria-hidden='true' />
				<div className='export-page__main'>
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
									{`${version.version_name} (${formatVersionTagForDisplay(version.version_tag)})`}
								</option>
							))}
						</select>
					</div>
				</div>

				{selectedVersion &&
					!isReleaseVersionTag(selectedVersion.version_tag) && (
						<div className='export-page__version-notice' role='status'>
							<strong>Черновая версия.</strong> Для стабильной выдачи в прод
							или в команду обычно выбирают снимок с тегом «релиз». Черновик
							можно экспортировать для локальной проверки файлов.
						</div>
					)}

				<div className='export-page__panel'>
					<div className='export-page__top-options'>
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

						<div className='export-page__token-types-section'>
							<div className='export-page__section-title'>Тип токенов</div>
							<div className='export-page__token-types-options'>
								<label className='export-page__token-types-label'>
									<input
										type='checkbox'
										checked={tokenTypes.color}
										onChange={e =>
											setTokenTypes({
												...tokenTypes,
												color: e.target.checked,
											})
										}
									/>
									Color
								</label>
								<label className='export-page__token-types-label'>
									<input
										type='checkbox'
										checked={tokenTypes.number}
										onChange={e =>
											setTokenTypes({
												...tokenTypes,
												number: e.target.checked,
											})
										}
									/>
									Number
								</label>
								<label className='export-page__token-types-label'>
									<input
										type='checkbox'
										checked={tokenTypes.string}
										onChange={e =>
											setTokenTypes({
												...tokenTypes,
												string: e.target.checked,
											})
										}
									/>
									String
								</label>
								<label className='export-page__token-types-label'>
									<input
										type='checkbox'
										checked={tokenTypes.boolean}
										onChange={e =>
											setTokenTypes({
												...tokenTypes,
												boolean: e.target.checked,
											})
										}
									/>
									Boolean
								</label>
							</div>
						</div>
					</div>

					<div className='export-page__preview-section'>
						<div className='export-page__preview-title'>
							Предпросмотр ({tokens.length} токенов)
							{loadingTokens && (
								<span className='export-page__preview-loading'>Загрузка...</span>
							)}
						</div>
						<div className='export-page__preview-content'>
							<pre>{getPreviewContent()}</pre>
						</div>
					</div>
					</div>
				</div>

				<div className='export-page__workspace-tail'>
					<div className='export-page__right-slot'>
						<div className='export-page__side-stack'>
							<div className='export-page__side-card'>
								<div className='export-page__side-card-head'>
									<div className='export-page__side-card-title'>
										npm-пакет
									</div>
									<p className='export-page__side-card-lead'>
										Содержимое пакета совпадает с предпросмотром слева: те же
										токены, формат и фильтры типов.
									</p>
									<dl className='export-page__side-meta'>
										<div className='export-page__side-meta-row'>
											<dt>Коллекция</dt>
											<dd>{selectedCollection?.name ?? '—'}</dd>
										</div>
										<div className='export-page__side-meta-row'>
											<dt>Версия</dt>
											<dd>{versionSummary}</dd>
										</div>
									</dl>
								</div>
								<label className='export-page__field-label' htmlFor='npm-pkg-name'>
									Имя пакета
								</label>
								<input
									id='npm-pkg-name'
									type='text'
									value={npmPackageName}
									onChange={e => setNpmPackageName(e.target.value)}
									placeholder='@scope/design-tokens'
									className='export-page__filename-input'
								/>
								<label
									className='export-page__field-label'
									htmlFor='npm-pkg-version'
								>
									Версия пакета
								</label>
								<input
									id='npm-pkg-version'
									type='text'
									value={npmPackageVersion}
									onChange={e => setNpmPackageVersion(e.target.value)}
									placeholder='1.0.0'
									className='export-page__filename-input'
								/>
								<label className='export-page__field-label' htmlFor='npm-token'>
									npm token (только для публикации)
								</label>
								<input
									id='npm-token'
									type='password'
									value={npmToken}
									onChange={e => setNpmToken(e.target.value)}
									placeholder='npm token'
									className='export-page__filename-input'
									autoComplete='off'
								/>
								<div className='export-page__version-form-buttons'>
									<button
										type='button'
										className='export-page__export-button'
										disabled={isPackaging || tokens.length === 0}
										onClick={() => handleBuildNpmPackage(false)}
									>
										{isPackaging ? 'Сборка...' : 'Скачать .tgz'}
									</button>
									<button
										type='button'
										className='export-page__reset-button'
										disabled={isPublishing || tokens.length === 0}
										onClick={() => handleBuildNpmPackage(true)}
									>
										{isPublishing ? 'Публикация...' : 'Опубликовать'}
									</button>
								</div>
								{npmStatus && (
									<div className='export-page__npm-status'>{npmStatus}</div>
								)}
							</div>

							<div className='export-page__side-card export-page__side-card--actions'>
								<div className='export-page__side-card-title'>Файл</div>
								<p className='export-page__side-card-lead export-page__side-card-lead--tight'>
									Имя без расширения — одно нажатие, файл сразу сохранится в
									загрузки.
								</p>
								<label
									className='export-page__field-label'
									htmlFor='export-file-name'
								>
									Имя файла (без .{getFileExtension()})
								</label>
								<input
									id='export-file-name'
									type='text'
									value={fileName}
									onChange={e => setFileName(e.target.value)}
									placeholder='tokens'
									className='export-page__filename-input'
									disabled={tokens.length === 0}
								/>
								<button
									type='button'
									onClick={handleExport}
									disabled={isExporting || tokens.length === 0}
									className='export-page__export-open-button'
								>
									{isExporting
										? 'Сохранение...'
										: `Скачать .${getFileExtension()}`}
								</button>
								{isExporting && (
									<div className='export-page__progress-container'>
										<div className='export-page__progress-bar' />
									</div>
								)}
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}

export default ExportPage
