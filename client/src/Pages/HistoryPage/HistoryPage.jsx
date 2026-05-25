import React from 'react'
import { HistoryPanel } from '../../components/HistoryPanel/HistoryPanel'
import './HistoryPage.css'

export function HistoryPage() {
	return (
		<div className='history-page'>
			<div className='page-workspace page-workspace--single'>
				<HistoryPanel />
			</div>
		</div>
	)
}
