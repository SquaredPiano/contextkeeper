export const dashboardHtml = `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
	<title>Autonomous Copilot Dashboard</title>
	<style>
		:root {
			--container-padding: 16px;
			--card-gap: 12px;
			--border-radius: 6px;
		}

		body {
			padding: var(--container-padding);
			color: var(--vscode-foreground);
			background-color: var(--vscode-editor-background);
			font-family: var(--vscode-font-family);
			font-size: var(--vscode-font-size);
			line-height: 1.5;
		}

		h2 {
			font-size: 1.2em;
			margin: 0 0 12px 0;
			color: var(--vscode-foreground);
			font-weight: 600;
		}

		.dashboard {
			display: flex;
			flex-direction: column;
			gap: 24px;
		}

		.section {
			display: flex;
			flex-direction: column;
			gap: var(--card-gap);
		}

		.card {
			background-color: var(--vscode-editor-inactiveSelectionBackground);
			border: 1px solid var(--vscode-panel-border);
			border-radius: var(--border-radius);
			padding: 12px;
			display: flex;
			justify-content: space-between;
			align-items: center;
		}

		.card .label {
			color: var(--vscode-descriptionForeground);
			font-size: 0.9em;
		}

		.card .value {
			font-weight: 600;
			color: var(--vscode-foreground);
		}

		.badge {
			display: inline-block;
			padding: 2px 8px;
			border-radius: 12px;
			font-size: 0.85em;
			font-weight: 600;
		}

		.badge.error {
			background-color: var(--vscode-inputValidation-errorBackground);
			color: var(--vscode-inputValidation-errorForeground);
			border: 1px solid var(--vscode-inputValidation-errorBorder);
		}

		.badge.warning {
			background-color: var(--vscode-inputValidation-warningBackground);
			color: var(--vscode-inputValidation-warningForeground);
			border: 1px solid var(--vscode-inputValidation-warningBorder);
		}

		.badge.info {
			background-color: var(--vscode-inputValidation-infoBackground);
			color: var(--vscode-inputValidation-infoForeground);
			border: 1px solid var(--vscode-inputValidation-infoBorder);
		}

		.badge.low { background-color: #28a745; color: white; }
		.badge.medium { background-color: #ffc107; color: black; }
		.badge.high { background-color: #dc3545; color: white; }

		.issue-list {
			display: flex;
			flex-direction: column;
			gap: 8px;
		}

		.issue-item {
			background-color: var(--vscode-list-hoverBackground);
			border-left: 3px solid;
			padding: 10px 12px;
			border-radius: var(--border-radius);
			cursor: pointer;
			transition: background-color 0.2s;
		}

		.issue-item:hover {
			background-color: var(--vscode-list-activeSelectionBackground);
		}

		.issue-item.error { border-left-color: var(--vscode-editorError-foreground); }
		.issue-item.warning { border-left-color: var(--vscode-editorWarning-foreground); }
		.issue-item.info { border-left-color: var(--vscode-editorInfo-foreground); }

		.issue-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: 4px;
		}

		.issue-title {
			font-weight: 600;
			font-size: 0.95em;
		}

		.issue-location {
			color: var(--vscode-descriptionForeground);
			font-size: 0.85em;
		}

		.issue-message {
			color: var(--vscode-descriptionForeground);
			font-size: 0.9em;
			margin-top: 4px;
		}

		.actions {
			display: flex;
			flex-direction: column;
			gap: 12px;
		}

		button {
			padding: 10px 16px;
			border: 1px solid var(--vscode-button-border);
			border-radius: var(--border-radius);
			cursor: pointer;
			font-family: var(--vscode-font-family);
			font-size: var(--vscode-font-size);
			transition: all 0.2s;
		}

		button.primary {
			background-color: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
		}

		button.primary:hover {
			background-color: var(--vscode-button-hoverBackground);
		}

		button.secondary {
			background-color: var(--vscode-button-secondaryBackground);
			color: var(--vscode-button-secondaryForeground);
		}

		button.secondary:hover {
			background-color: var(--vscode-button-secondaryHoverBackground);
		}

		button:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}

		.toggle-button {
			display: flex;
			justify-content: space-between;
			align-items: center;
		}

		.empty-state {
			text-align: center;
			padding: 32px 16px;
			color: var(--vscode-descriptionForeground);
		}

		.empty-state-icon {
			font-size: 3em;
			margin-bottom: 12px;
		}

		.loading {
			text-align: center;
			padding: 20px;
			color: var(--vscode-descriptionForeground);
		}

		.spinner {
			display: inline-block;
			width: 20px;
			height: 20px;
			border: 3px solid var(--vscode-descriptionForeground);
			border-top-color: transparent;
			border-radius: 50%;
			animation: spin 1s linear infinite;
			margin-right: 8px;
		}

		@keyframes spin {
			to { transform: rotate(360deg); }
		}
	</style>
</head>
<body>
	<div class="dashboard">
		<!-- Context Summary Section -->
		<div class="section">
			<h2>Developer Context</h2>
			<div class="card">
				<span class="label">Active File:</span>
				<span class="value" id="activeFile">Loading...</span>
			</div>
			<div class="card">
				<span class="label">Files Edited:</span>
				<span class="value" id="filesEdited">0</span>
			</div>
			<div class="card">
				<span class="label">Total Edits:</span>
				<span class="value" id="totalEdits">0</span>
			</div>
			<div class="card">
				<span class="label">Current Branch:</span>
				<span class="value" id="currentBranch">-</span>
			</div>
			<div class="card">
				<span class="label">Uncommitted Changes:</span>
				<span class="value" id="uncommittedChanges">0 files</span>
			</div>
		</div>

		<!-- AI Analysis Section -->
		<div class="section">
			<h2>AI Analysis</h2>
			<div class="card">
				<span class="label">Issues Found:</span>
				<span class="value" id="issuesCount">0</span>
			</div>
			<div class="card">
				<span class="label">Risk Level:</span>
				<span class="value">
					<span class="badge" id="riskBadge">-</span>
				</span>
			</div>
			<div class="card">
				<span class="label">Confidence:</span>
				<span class="value" id="confidence">-</span>
			</div>

			<div id="issuesContainer">
				<div class="empty-state">
					<div class="empty-state-icon">$(search)</div>
					<div>Run analysis to see issues and suggestions</div>
				</div>
			</div>
		</div>

		<!-- Actions Section -->
		<div class="section">
			<h2>Actions</h2>
			<div class="actions">
				<button id="analyzeBtn" class="primary">
					Analyze Now
				</button>
				<button id="toggleAutoBtn" class="secondary toggle-button">
					<span>Autonomous Mode:</span>
					<span id="autoStatus" style="font-weight: 600;">OFF</span>
				</button>
				<button id="refreshContextBtn" class="secondary">
					Refresh Context
				</button>
			</div>
		</div>
	</div>

	<script>
		const vscode = acquireVsCodeApi();

		// UI Elements
		const elements = {
			activeFile: document.getElementById('activeFile'),
			filesEdited: document.getElementById('filesEdited'),
			totalEdits: document.getElementById('totalEdits'),
			currentBranch: document.getElementById('currentBranch'),
			uncommittedChanges: document.getElementById('uncommittedChanges'),
			issuesCount: document.getElementById('issuesCount'),
			riskBadge: document.getElementById('riskBadge'),
			confidence: document.getElementById('confidence'),
			issuesContainer: document.getElementById('issuesContainer'),
			analyzeBtn: document.getElementById('analyzeBtn'),
			toggleAutoBtn: document.getElementById('toggleAutoBtn'),
			autoStatus: document.getElementById('autoStatus'),
			refreshContextBtn: document.getElementById('refreshContextBtn'),
		};

		let isAutonomous = false;

		// Button handlers
		elements.analyzeBtn.addEventListener('click', () => {
			vscode.postMessage({ type: 'triggerAnalysis' });
			showLoading('Analyzing...');
		});

		elements.toggleAutoBtn.addEventListener('click', () => {
			isAutonomous = !isAutonomous;
			elements.autoStatus.textContent = isAutonomous ? 'ON' : 'OFF';
			elements.autoStatus.style.color = isAutonomous ? '#28a745' : '';
			vscode.postMessage({ type: 'toggleAutonomous', enabled: isAutonomous });
		});

		elements.refreshContextBtn.addEventListener('click', () => {
			vscode.postMessage({ type: 'requestContext' });
			showLoading('Loading context...');
		});

		// Message handler
		window.addEventListener('message', event => {
			const message = event.data;

			switch (message.type) {
				case 'contextUpdate':
					updateContext(message.payload);
					break;
				case 'analysisComplete':
					updateAnalysis(message.payload);
					break;
				case 'stateChanged':
					updateState(message.state);
					break;
				case 'error':
					showError(message.message);
					break;
			}
		});

		function updateContext(context) {
			elements.activeFile.textContent = getFileName(context.files.activeFile);
			elements.filesEdited.textContent = context.files.recentlyEdited.length;
			elements.totalEdits.textContent = context.session.totalEdits;
			elements.currentBranch.textContent = context.git.currentBranch;
			elements.uncommittedChanges.textContent = 
				\`\${context.git.uncommittedChanges.length} files\`;
		}

		function updateAnalysis(analysis) {
			elements.issuesCount.textContent = analysis.issues.length;
			
			// Update risk badge
			elements.riskBadge.textContent = analysis.riskLevel.toUpperCase();
			elements.riskBadge.className = 'badge ' + analysis.riskLevel;
			
			elements.confidence.textContent = \`\${Math.round(analysis.confidence * 100)}%\`;

			// Render issues
			if (analysis.issues.length === 0) {
				elements.issuesContainer.innerHTML = \`
					<div class="empty-state">
						<div class="empty-state-icon">$(check)</div>
						<div>No issues found! Your code looks great.</div>
					</div>
				\`;
			} else {
				const issuesHtml = analysis.issues.slice(0, 5).map(issue => \`
					<div class="issue-item \${issue.severity}" onclick="navigateToIssue('\${issue.file}', \${issue.line})">
						<div class="issue-header">
							<span class="badge \${issue.severity}">\${issue.severity.toUpperCase()}</span>
							<span class="issue-location">\${getFileName(issue.file)}:\${issue.line}</span>
						</div>
						<div class="issue-message">\${issue.message}</div>
					</div>
				\`).join('');

				const moreCount = analysis.issues.length - 5;
				const moreHtml = moreCount > 0 
					? \`<div style="text-align: center; margin-top: 12px; color: var(--vscode-descriptionForeground);">
						+ \${moreCount} more issues (see tree view)
					</div>\`
					: '';

				elements.issuesContainer.innerHTML = \`
					<div class="issue-list">
						\${issuesHtml}
						\${moreHtml}
					</div>
				\`;
			}
		}

		function navigateToIssue(file, line) {
			vscode.postMessage({ type: 'navigateToIssue', file, line });
		}

		function showLoading(message) {
			elements.analyzeBtn.disabled = true;
			elements.analyzeBtn.innerHTML = \`<span class="spinner"></span>\${message}\`;
		}

		function showError(message) {
			elements.issuesContainer.innerHTML = \`
				<div class="empty-state" style="color: var(--vscode-errorForeground);">
					<div class="empty-state-icon">$(warning)</div>
					<div>\${message}</div>
				</div>
			\`;
			elements.analyzeBtn.disabled = false;
			elements.analyzeBtn.innerHTML = 'Analyze Now';
		}

		function updateState(state) {
			if (state.status === 'analyzing') {
				showLoading(state.message || 'Analyzing');
			} else {
				elements.analyzeBtn.disabled = false;
				elements.analyzeBtn.innerHTML = 'Analyze Now';
			}
		}

		function getFileName(path) {
			return path.split('/').pop() || path;
		}

		// Request initial context on load
		vscode.postMessage({ type: 'requestContext' });
	</script>
</body>
</html>`;
