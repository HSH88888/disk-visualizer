// Disk Space Visualizer - Mind Map Renderer
// Interactive features: click, double-click, search, expand

// 상태 관리
let currentData = null;
let originalData = null;
let rootTotal = 0;
let zoom = 1;
let panX = 0;
let panY = 0;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let navigationStack = [];
let isExpanded = false;
let isFullExpand = false;
let colorMode = 'depth'; // 'depth' or 'size'
let currentTheme = 'purple'; // 'purple', 'dark', 'light'
let searchMatches = [];
let allNodes = [];

// DOM 요소
const selectFolderBtn = document.getElementById('selectFolderBtn');
const welcomeSelectBtn = document.getElementById('welcomeSelectBtn');
const welcomeScreen = document.getElementById('welcomeScreen');
const loadingScreen = document.getElementById('loadingScreen');
const mindmapContainer = document.getElementById('mindmapContainer');
const toolbar = document.getElementById('toolbar');
const svg = document.getElementById('mindmapSvg');
const tooltip = document.getElementById('tooltip');
const breadcrumb = document.getElementById('breadcrumb');
const statusText = document.getElementById('statusText');
const totalSizeSpan = document.getElementById('totalSize');
const zoomLevelSpan = document.getElementById('zoomLevel');
const searchResults = document.getElementById('searchResults');
const searchResultsList = document.getElementById('searchResultsList');
const searchResultCount = document.getElementById('searchResultCount');

// 버튼들
const btnBack = document.getElementById('btnBack');
const btnZoomIn = document.getElementById('btnZoomIn');
const btnZoomOut = document.getElementById('btnZoomOut');
const btnZoomFit = document.getElementById('btnZoomFit');
const btnExpandLayout = document.getElementById('btnExpandLayout');
const btnCompactLayout = document.getElementById('btnCompactLayout');
const btnExpandAll = document.getElementById('btnExpandAll');
const searchInput = document.getElementById('searchInput');
const btnSearch = document.getElementById('btnSearch');
const btnClearSearch = document.getElementById('btnClearSearch');
const btnCloseSearch = document.getElementById('btnCloseSearch');
const legend = document.getElementById('legend');
const legendItems = document.getElementById('legendItems');
const legendTitle = document.getElementById('legendTitle');
const resizeHandle = document.getElementById('resizeHandle');
const btnColorMode = document.getElementById('btnColorMode');
const btnToggleLegend = document.getElementById('btnToggleLegend');
const btnTheme = document.getElementById('btnTheme');
const btnExplorer = document.getElementById('btnExplorer');
const explorerPanel = document.getElementById('explorerPanel');
const explorerTree = document.getElementById('explorerTree');
const btnCloseExplorer = document.getElementById('btnCloseExplorer');
const explorerFiles = document.getElementById('explorerFiles');
const fileCount = document.getElementById('fileCount');
const explorerResizeHandle = document.getElementById('explorerResizeHandle');

// 현재 선택된 폴더 경로
let currentFolderPath = null;

// 색상 팔레트
const colorPalette = [
    '#6c5ce7', '#e74c3c', '#f39c12', '#27ae60',
    '#3498db', '#9b59b6', '#1abc9c', '#e91e63'
];

// 용량별 색상 (빨강 = 큰 용량, 파랑 = 작은 용량)
const sizeColorPalette = [
    { threshold: 0.5, color: '#e74c3c', label: '50%+ (매우 큼)' },
    { threshold: 0.2, color: '#e67e22', label: '20-50% (큼)' },
    { threshold: 0.1, color: '#f39c12', label: '10-20% (중간)' },
    { threshold: 0.05, color: '#27ae60', label: '5-10% (작음)' },
    { threshold: 0.01, color: '#3498db', label: '1-5% (아주 작음)' },
    { threshold: 0, color: '#9b59b6', label: '1% 미만' }
];

// 이벤트 리스너
selectFolderBtn.addEventListener('click', handleSelectFolder);
welcomeSelectBtn.addEventListener('click', handleSelectFolder);
btnBack.addEventListener('click', navigateBack);
btnZoomIn.addEventListener('click', () => setZoom(zoom * 1.2));
btnZoomOut.addEventListener('click', () => setZoom(zoom / 1.2));
btnZoomFit.addEventListener('click', fitToScreen);
btnExpandLayout.addEventListener('click', () => setLayoutMode(true));
btnCompactLayout.addEventListener('click', () => setLayoutMode(false));
btnExpandAll.addEventListener('click', expandAllFolders);
btnSearch.addEventListener('click', performSearch);
btnClearSearch.addEventListener('click', clearSearch);
btnCloseSearch.addEventListener('click', closeSearchResults);
btnColorMode.addEventListener('click', toggleColorMode);
btnToggleLegend.addEventListener('click', toggleColorMode);
btnTheme.addEventListener('click', toggleTheme);
btnExplorer.addEventListener('click', toggleExplorerPanel);
btnCloseExplorer.addEventListener('click', toggleExplorerPanel);
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch();
});

// 검색창 리사이즈
let isResizing = false;
let resizeStartY = 0;
let resizeStartHeight = 0;

resizeHandle.addEventListener('mousedown', (e) => {
    isResizing = true;
    resizeStartY = e.clientY;
    resizeStartHeight = searchResults.offsetHeight;
    e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
    if (isResizing) {
        const delta = e.clientY - resizeStartY;
        const newHeight = Math.max(150, Math.min(600, resizeStartHeight + delta));
        searchResults.style.maxHeight = newHeight + 'px';
        searchResultsList.style.maxHeight = (newHeight - 60) + 'px';
    }
});

document.addEventListener('mouseup', () => {
    isResizing = false;
});

// 팬(드래그) 이벤트
mindmapContainer.addEventListener('mousedown', (e) => {
    if (e.button === 0 && e.target === svg) {
        isDragging = true;
        dragStartX = e.clientX - panX;
        dragStartY = e.clientY - panY;
    }
});

document.addEventListener('mousemove', (e) => {
    if (isDragging) {
        panX = e.clientX - dragStartX;
        panY = e.clientY - dragStartY;
        updateTransform();
    }
});

document.addEventListener('mouseup', () => {
    isDragging = false;
});

// 마우스 휠 줌
mindmapContainer.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(zoom * delta);
});

// 폴더 선택 핸들러
async function handleSelectFolder() {
    try {
        const folderPath = await window.electronAPI.selectFolder();
        if (!folderPath) return;

        showLoading();
        const data = await window.electronAPI.scanFolder(folderPath);
        originalData = data;
        currentData = data;
        rootTotal = data.value;
        navigationStack = [{ data: data, path: folderPath }];

        hideLoading();
        showMindmap();
        renderMindmap(data);
        updateBreadcrumb();
        updateStatus(`스캔 완료: ${folderPath}`);
        totalSizeSpan.textContent = `총 용량: ${formatSize(data.value)}`;

    } catch (error) {
        hideLoading();
        console.error('Error:', error);
        updateStatus(`오류: ${error.message}`);
    }
}

// 화면 전환
function showLoading() {
    welcomeScreen.classList.add('hidden');
    mindmapContainer.classList.add('hidden');
    toolbar.classList.add('hidden');
    loadingScreen.classList.remove('hidden');
}

function hideLoading() {
    loadingScreen.classList.add('hidden');
}

function showMindmap() {
    mindmapContainer.classList.remove('hidden');
    toolbar.classList.remove('hidden');
    legend.classList.remove('hidden');
    updateBackButton();
    updateLegend();
}

// 마인드맵 렌더링
function renderMindmap(data) {
    svg.innerHTML = '';
    allNodes = [];

    const rect = mindmapContainer.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.id = 'mindmapGroup';
    svg.appendChild(g);

    const nodes = [];
    const links = [];

    // 루트 노드
    const rootRadius = calculateRadius(data.value, rootTotal, true);
    const rootNode = {
        id: data.path,
        name: data.name,
        value: data.value,
        path: data.path,
        x: centerX,
        y: centerY,
        radius: rootRadius,
        depth: 0,
        isFile: data.isFile,
        data: data
    };
    nodes.push(rootNode);

    // 자식 노드 배치
    if (data.children && data.children.length > 0) {
        layoutChildren(data, centerX, centerY, rootRadius, 0, Math.PI * 2, 1, nodes, links);
    }

    allNodes = nodes;

    // 링크 먼저 그리기
    links.forEach(link => {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('class', 'link-line');
        line.setAttribute('x1', link.source.x);
        line.setAttribute('y1', link.source.y);
        line.setAttribute('x2', link.target.x);
        line.setAttribute('y2', link.target.y);
        g.appendChild(line);
    });

    // 노드 그리기
    nodes.forEach(node => {
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('data-path', node.path);

        // 원
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('class', 'node-circle');
        circle.setAttribute('cx', node.x);
        circle.setAttribute('cy', node.y);
        circle.setAttribute('r', node.radius);
        circle.setAttribute('fill', getNodeColor(node.depth, node.value));
        circle.setAttribute('stroke', 'rgba(255,255,255,0.2)');
        circle.setAttribute('stroke-width', '2');
        circle.setAttribute('data-path', node.path);

        // 검색 하이라이트 적용
        if (searchMatches.includes(node.path)) {
            circle.classList.add('highlighted');
        }

        // 클릭 이벤트 (드릴다운)
        circle.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!node.isFile && node.data && node.data.children && node.data.children.length > 0) {
                navigateToFolder(node.data);
            }
        });

        // 더블클릭 이벤트 (파일 탐색기 열기)
        circle.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            window.electronAPI.openInExplorer(node.path);
        });

        // 호버 이벤트
        circle.addEventListener('mouseenter', (e) => showTooltip(e, node));
        circle.addEventListener('mousemove', (e) => moveTooltip(e));
        circle.addEventListener('mouseleave', hideTooltip);

        group.appendChild(circle);

        // 텍스트
        if (node.radius > 20) {
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('class', 'node-text');
            text.setAttribute('x', node.x);
            text.setAttribute('y', node.y);
            text.setAttribute('font-size', Math.min(node.radius / 3.5, 13));
            text.textContent = truncateText(node.name, node.radius);
            group.appendChild(text);

            // 크기 텍스트
            if (node.radius > 35) {
                const sizeText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                sizeText.setAttribute('class', 'node-text');
                sizeText.setAttribute('x', node.x);
                sizeText.setAttribute('y', node.y + node.radius / 4);
                sizeText.setAttribute('font-size', Math.min(node.radius / 4.5, 10));
                sizeText.setAttribute('fill', 'rgba(255,255,255,0.7)');
                sizeText.textContent = formatSize(node.value);
                group.appendChild(sizeText);
            }
        }

        g.appendChild(group);
    });

    fitToScreen();
}

// 자식 노드 레이아웃
function layoutChildren(parent, parentX, parentY, parentRadius, startAngle, endAngle, depth, nodes, links) {
    if (!parent.children || parent.children.length === 0 || depth > 5) return;

    const children = [...parent.children]
        .filter(c => c.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, isExpanded ? 20 : 10);

    if (children.length === 0) return;

    const totalAngle = endAngle - startAngle;
    const anglePerChild = totalAngle / children.length;

    // 거리 계산 (펼친 모드에서 더 멀리)
    const baseDistance = isExpanded ? 150 : 100;
    const distance = parentRadius + baseDistance + (depth * (isExpanded ? 50 : 30));

    children.forEach((child, i) => {
        const angle = startAngle + anglePerChild * (i + 0.5);
        const childRadius = calculateRadius(child.value, rootTotal, false);

        const x = parentX + Math.cos(angle) * distance;
        const y = parentY + Math.sin(angle) * distance;

        const node = {
            id: child.path,
            name: child.name,
            value: child.value,
            path: child.path,
            x: x,
            y: y,
            radius: childRadius,
            depth: depth,
            isFile: child.isFile,
            data: child
        };

        nodes.push(node);
        links.push({
            source: { x: parentX, y: parentY },
            target: { x: x, y: y }
        });

        // 재귀
        const maxDepth = isExpanded ? 4 : 3;
        if (child.children && child.children.length > 0 && depth < maxDepth) {
            const spread = isExpanded ? Math.PI * 0.5 : Math.PI * 0.4;
            layoutChildren(child, x, y, childRadius, angle - spread / 2, angle + spread / 2, depth + 1, nodes, links);
        }
    });
}

// 반지름 계산
function calculateRadius(value, total, isRoot) {
    if (isRoot) return 70;

    const ratio = value / total;
    const minRadius = 12;
    const maxRadius = isExpanded ? 55 : 50;

    const logRatio = Math.log10(ratio * 1000 + 1) / Math.log10(1001);
    return Math.max(minRadius, Math.min(maxRadius, minRadius + (maxRadius - minRadius) * logRatio));
}

// 네비게이션
function navigateToFolder(folderData) {
    navigationStack.push({ data: folderData, path: folderData.path });
    currentData = folderData;
    renderMindmap(folderData);
    updateBreadcrumb();
    updateBackButton();
    updateStatus(`현재 폴더: ${folderData.name}`);
    totalSizeSpan.textContent = `폴더 용량: ${formatSize(folderData.value)}`;
}

function navigateBack() {
    if (navigationStack.length > 1) {
        navigationStack.pop();
        const prev = navigationStack[navigationStack.length - 1];
        currentData = prev.data;
        renderMindmap(prev.data);
        updateBreadcrumb();
        updateBackButton();
        updateStatus(`현재 폴더: ${prev.data.name}`);
        totalSizeSpan.textContent = `폴더 용량: ${formatSize(prev.data.value)}`;
    }
}

function updateBackButton() {
    if (navigationStack.length > 1) {
        btnBack.classList.remove('hidden');
    } else {
        btnBack.classList.add('hidden');
    }
}

function updateBreadcrumb() {
    breadcrumb.innerHTML = '';

    navigationStack.forEach((item, index) => {
        if (index > 0) {
            const sep = document.createElement('span');
            sep.className = 'breadcrumb-separator';
            sep.textContent = ' › ';
            breadcrumb.appendChild(sep);
        }

        const span = document.createElement('span');
        span.className = 'breadcrumb-item';
        span.textContent = item.data.name;
        span.addEventListener('click', () => {
            navigationStack = navigationStack.slice(0, index + 1);
            currentData = item.data;
            renderMindmap(item.data);
            updateBreadcrumb();
            updateBackButton();
        });
        breadcrumb.appendChild(span);
    });
}

// 검색 기능
function performSearch() {
    const query = searchInput.value.trim().toLowerCase();
    if (!query || !originalData) return;

    searchMatches = [];
    const results = [];

    searchInFolder(originalData, query, results);

    if (results.length > 0) {
        // 매칭된 폴더 경로 저장
        results.forEach(r => {
            collectParentPaths(r.path, originalData, searchMatches);
        });

        showSearchResults(results);
        btnClearSearch.classList.remove('hidden');

        // 마인드맵 다시 렌더링하여 하이라이트 적용
        renderMindmap(currentData);
    } else {
        searchResultCount.textContent = '검색 결과: 0개';
        searchResultsList.innerHTML = '<div style="padding:12px;color:var(--text-muted);">검색 결과가 없습니다.</div>';
        searchResults.classList.remove('hidden');
    }
}

function searchInFolder(folder, query, results) {
    if (folder.name.toLowerCase().includes(query)) {
        results.push({
            name: folder.name,
            path: folder.path,
            value: folder.value,
            isFile: folder.isFile
        });
    }

    if (folder.children) {
        folder.children.forEach(child => searchInFolder(child, query, results));
    }
}

function collectParentPaths(targetPath, folder, paths) {
    if (folder.path === targetPath || targetPath.startsWith(folder.path + '\\') || targetPath.startsWith(folder.path + '/')) {
        if (!paths.includes(folder.path)) {
            paths.push(folder.path);
        }
    }

    if (folder.children) {
        folder.children.forEach(child => collectParentPaths(targetPath, child, paths));
    }
}

function showSearchResults(results) {
    searchResultCount.textContent = `검색 결과: ${results.length}개`;
    searchResultsList.innerHTML = '';

    results.slice(0, 50).forEach(item => {
        const div = document.createElement('div');
        div.className = 'search-result-item';
        div.innerHTML = `
            <div class="search-result-name">${item.isFile ? '📄' : '📁'} ${item.name}</div>
            <div class="search-result-size">${formatSize(item.value)}</div>
        `;
        div.addEventListener('click', () => {
            window.electronAPI.openInExplorer(item.path);
        });
        searchResultsList.appendChild(div);
    });

    searchResults.classList.remove('hidden');
}

function clearSearch() {
    searchInput.value = '';
    searchMatches = [];
    btnClearSearch.classList.add('hidden');
    searchResults.classList.add('hidden');
    renderMindmap(currentData);
}

function closeSearchResults() {
    searchResults.classList.add('hidden');
}

// 레이아웃 모드
function setLayoutMode(expanded) {
    isExpanded = expanded;
    if (currentData) {
        renderMindmap(currentData);
    }
}

// 줌 기능
function setZoom(newZoom) {
    zoom = Math.max(0.1, Math.min(5, newZoom));
    zoomLevelSpan.textContent = `${Math.round(zoom * 100)}%`;
    updateTransform();
}

function updateTransform() {
    const g = document.getElementById('mindmapGroup');
    if (g) {
        const rect = mindmapContainer.getBoundingClientRect();
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        g.setAttribute('transform', `translate(${panX + cx * (1 - zoom)}, ${panY + cy * (1 - zoom)}) scale(${zoom})`);
    }
}

function fitToScreen() {
    zoom = 1;
    panX = 0;
    panY = 0;
    zoomLevelSpan.textContent = '100%';
    updateTransform();
}

// 유틸리티
function getColorByDepth(depth) {
    return colorPalette[depth % colorPalette.length];
}

// 용량 비율에 따른 색상
function getColorBySize(value) {
    const ratio = rootTotal > 0 ? value / rootTotal : 0;
    for (const item of sizeColorPalette) {
        if (ratio >= item.threshold) {
            return item.color;
        }
    }
    return sizeColorPalette[sizeColorPalette.length - 1].color;
}

// 현재 색상 모드에 따라 색상 반환
function getNodeColor(depth, value) {
    if (colorMode === 'size') {
        return getColorBySize(value);
    } else {
        return getColorByDepth(depth);
    }
}

// 색상 모드 전환
function toggleColorMode() {
    colorMode = colorMode === 'depth' ? 'size' : 'depth';

    // 버튼 텍스트 업데이트
    if (colorMode === 'depth') {
        btnColorMode.textContent = '🎨 깊이별';
        legendTitle.textContent = '🎨 깊이별 색상';
    } else {
        btnColorMode.textContent = '🎨 용량별';
        legendTitle.textContent = '📊 용량별 색상';
    }

    // 범례 업데이트
    updateLegend();

    // 마인드맵 다시 렌더링
    if (currentData) {
        if (isFullExpand) {
            renderFullExpandMindmap(currentData);
        } else {
            renderMindmap(currentData);
        }
    }
}

// 테마 전환
function toggleTheme() {
    const themes = ['purple', 'dark', 'light'];
    const themeNames = { purple: '🎭 퍼플', dark: '🌙 다크', light: '☀️ 화이트' };

    const currentIndex = themes.indexOf(currentTheme);
    const nextIndex = (currentIndex + 1) % themes.length;
    currentTheme = themes[nextIndex];

    // body에 테마 적용
    document.body.setAttribute('data-theme', currentTheme);

    // 버튼 텍스트 업데이트
    btnTheme.textContent = themeNames[currentTheme];
}

// 파일 탐색기 토글
function toggleExplorerPanel() {
    explorerPanel.classList.toggle('hidden');

    if (!explorerPanel.classList.contains('hidden') && originalData) {
        renderExplorerTree(originalData);
    }

    // 버튼 상태 업데이트
    if (explorerPanel.classList.contains('hidden')) {
        btnExplorer.textContent = '📂 탐색창';
    } else {
        btnExplorer.textContent = '📂 탐색창 ✓';
    }
}

// 파일 탐색기 트리 렌더링
function renderExplorerTree(data, container = explorerTree, depth = 0) {
    if (depth === 0) {
        container.innerHTML = '';
    }

    // 자식 폴더들을 크기 순으로 정렬
    const folders = data.children ? [...data.children]
        .filter(child => child.children)
        .sort((a, b) => b.value - a.value) : [];

    // 루트일 때는 루트 아이템도 표시
    if (depth === 0) {
        const rootItem = createTreeItem(data, 0);
        container.appendChild(rootItem);
    }

    folders.forEach(folder => {
        const item = createTreeItem(folder, depth + 1);
        container.appendChild(item);
    });
}

// 트리 아이템 생성
function createTreeItem(folder, depth) {
    const item = document.createElement('div');
    item.className = 'tree-item';
    item.setAttribute('data-path', folder.path);

    // 들여쓰기
    for (let i = 0; i < depth; i++) {
        const indent = document.createElement('span');
        indent.className = 'tree-item-indent';
        item.appendChild(indent);
    }

    // 토글 버튼 (자식이 있으면)
    const hasChildren = folder.children && folder.children.some(c => c.children);
    const toggle = document.createElement('span');
    toggle.className = 'tree-toggle';
    toggle.textContent = hasChildren ? '▶' : '';
    item.appendChild(toggle);

    // 아이콘
    const icon = document.createElement('span');
    icon.className = 'tree-item-icon';
    icon.textContent = '📁';
    item.appendChild(icon);

    // 이름
    const name = document.createElement('span');
    name.className = 'tree-item-name';
    name.textContent = folder.name;
    name.title = folder.path;
    item.appendChild(name);

    // 크기
    const size = document.createElement('span');
    size.className = 'tree-item-size';
    size.textContent = formatSize(folder.value);
    item.appendChild(size);

    // 클릭 이벤트 - 마인드맵에서 해당 폴더로 이동 + 파일 목록 표시
    item.addEventListener('click', (e) => {
        e.stopPropagation();

        // 현재 활성 아이템 해제
        explorerTree.querySelectorAll('.tree-item.active').forEach(el => el.classList.remove('active'));
        item.classList.add('active');

        // 마인드맵에서 해당 폴더로 드릴다운
        navigateTo(folder);

        // 파일 목록 표시
        showFilesForFolder(folder.path);
    });

    // 더블클릭 - 윈도우 탐색기로 열기
    item.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        window.electronAPI.openFolder(folder.path);
    });

    // 토글 클릭 - 하위 폴더 펼치기/접기
    if (hasChildren) {
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const isExpanded = toggle.textContent === '▼';
            toggle.textContent = isExpanded ? '▶' : '▼';

            // 하위 아이템 토글
            let nextSibling = item.nextElementSibling;
            const currentDepth = depth;

            if (isExpanded) {
                // 접기 - 하위 아이템 제거
                while (nextSibling) {
                    const siblingDepth = nextSibling.querySelectorAll('.tree-item-indent').length;
                    if (siblingDepth <= currentDepth) break;
                    const toRemove = nextSibling;
                    nextSibling = nextSibling.nextElementSibling;
                    toRemove.remove();
                }
            } else {
                // 펼치기 - 하위 아이템 추가
                const subfolders = folder.children
                    .filter(c => c.children)
                    .sort((a, b) => b.value - a.value);

                subfolders.forEach(subfolder => {
                    const subItem = createTreeItem(subfolder, depth + 1);
                    item.after(subItem);
                    item = subItem;
                });
            }
        });
    }

    return item;
}

// 파일 목록 표시
async function showFilesForFolder(folderPath) {
    currentFolderPath = folderPath;
    explorerFiles.innerHTML = '<div style="padding: 16px; color: var(--text-muted);">로딩 중...</div>';

    const files = await window.electronAPI.getFiles(folderPath);
    explorerFiles.innerHTML = '';
    fileCount.textContent = `${files.length}개`;

    if (files.length === 0) {
        explorerFiles.innerHTML = '<div style="padding: 16px; color: var(--text-muted);">파일 없음</div>';
        return;
    }

    files.forEach(file => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.setAttribute('data-path', file.path);

        // 파일 확장자에 따른 아이콘
        const ext = file.name.split('.').pop().toLowerCase();
        const iconMap = {
            'jpg': '🖼️', 'jpeg': '🖼️', 'png': '🖼️', 'gif': '🖼️', 'webp': '🖼️',
            'mp4': '🎬', 'avi': '🎬', 'mkv': '🎬', 'mov': '🎬',
            'mp3': '🎵', 'wav': '🎵', 'flac': '🎵',
            'pdf': '📑', 'doc': '📝', 'docx': '📝', 'txt': '📝',
            'zip': '📦', 'rar': '📦', '7z': '📦',
            'exe': '⚙️', 'msi': '⚙️'
        };

        const icon = document.createElement('span');
        icon.className = 'file-item-icon';
        icon.textContent = iconMap[ext] || '📄';
        fileItem.appendChild(icon);

        const nameSpan = document.createElement('span');
        nameSpan.className = 'file-item-name';
        nameSpan.textContent = file.name;
        nameSpan.title = file.path;
        fileItem.appendChild(nameSpan);

        const sizeSpan = document.createElement('span');
        sizeSpan.className = 'file-item-size';
        sizeSpan.textContent = formatSize(file.size);
        fileItem.appendChild(sizeSpan);

        // 우클릭 컨텍스트 메뉴
        fileItem.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            showContextMenu(e, file);
        });

        // 클릭 선택
        fileItem.addEventListener('click', () => {
            explorerFiles.querySelectorAll('.file-item.selected').forEach(el => el.classList.remove('selected'));
            fileItem.classList.add('selected');
        });

        explorerFiles.appendChild(fileItem);
    });
}

// 컨텍스트 메뉴 표시
function showContextMenu(e, file) {
    // 기존 메뉴 제거
    document.querySelectorAll('.context-menu').forEach(el => el.remove());

    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;

    // 탐색기에서 열기
    const openItem = document.createElement('div');
    openItem.className = 'context-menu-item';
    openItem.innerHTML = '📂 탐색기에서 열기';
    openItem.addEventListener('click', () => {
        window.electronAPI.openInExplorer(file.path);
        menu.remove();
    });
    menu.appendChild(openItem);

    // 이동
    const moveItem = document.createElement('div');
    moveItem.className = 'context-menu-item';
    moveItem.innerHTML = '📁 다른 폴더로 이동';
    moveItem.addEventListener('click', async () => {
        const destFolder = await window.electronAPI.selectDestFolder();
        if (destFolder) {
            const result = await window.electronAPI.moveFile(file.path, destFolder);
            if (result.success) {
                showFilesForFolder(currentFolderPath);
                updateStatus(`${file.name} 이동 완료`);
            } else {
                alert('이동 실패: ' + result.error);
            }
        }
        menu.remove();
    });
    menu.appendChild(moveItem);

    // 구분선
    const divider = document.createElement('div');
    divider.className = 'context-menu-divider';
    menu.appendChild(divider);

    // 삭제
    const deleteItem = document.createElement('div');
    deleteItem.className = 'context-menu-item danger';
    deleteItem.innerHTML = '🗑️ 휴지통으로 삭제';
    deleteItem.addEventListener('click', async () => {
        if (confirm(`"${file.name}"을(를) 휴지통으로 이동하시겠습니까?`)) {
            const result = await window.electronAPI.deleteFile(file.path);
            if (result.success) {
                showFilesForFolder(currentFolderPath);
                updateStatus(`${file.name} 삭제 완료`);
            } else {
                alert('삭제 실패: ' + result.error);
            }
        }
        menu.remove();
    });
    menu.appendChild(deleteItem);

    document.body.appendChild(menu);

    // 클릭 시 메뉴 닫기
    const closeMenu = () => {
        menu.remove();
        document.removeEventListener('click', closeMenu);
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 10);
}

// 탐색기 너비 리사이즈
let isExplorerResizing = false;

explorerResizeHandle.addEventListener('mousedown', (e) => {
    isExplorerResizing = true;
    explorerResizeHandle.classList.add('active');
    e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
    if (!isExplorerResizing) return;

    const newWidth = e.clientX;
    if (newWidth >= 200 && newWidth <= 500) {
        explorerPanel.style.width = `${newWidth}px`;
    }
});

document.addEventListener('mouseup', () => {
    if (isExplorerResizing) {
        isExplorerResizing = false;
        explorerResizeHandle.classList.remove('active');
    }
});

function truncateText(text, radius) {
    const maxChars = Math.floor(radius / 5);
    if (text.length <= maxChars) return text;
    return text.substring(0, maxChars - 1) + '..';
}

function formatSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function showTooltip(e, node) {
    const tooltipName = tooltip.querySelector('.tooltip-name');
    const tooltipSize = tooltip.querySelector('.tooltip-size');
    const tooltipPercent = tooltip.querySelector('.tooltip-percent');

    tooltipName.textContent = `${node.isFile ? '📄' : '📁'} ${node.name}`;
    tooltipSize.textContent = formatSize(node.value);

    const percent = rootTotal > 0 ? ((node.value / rootTotal) * 100).toFixed(1) : 0;
    tooltipPercent.textContent = `전체의 ${percent}%`;

    tooltip.classList.remove('hidden');
    moveTooltip(e);
}

function moveTooltip(e) {
    tooltip.style.left = `${e.clientX + 12}px`;
    tooltip.style.top = `${e.clientY + 12}px`;
}

function hideTooltip() {
    tooltip.classList.add('hidden');
}

function updateStatus(text) {
    statusText.textContent = text;
}

// 윈도우 리사이즈
window.addEventListener('resize', () => {
    if (currentData && !mindmapContainer.classList.contains('hidden')) {
        if (isFullExpand) {
            renderFullExpandMindmap(currentData);
        } else {
            renderMindmap(currentData);
        }
    }
});

// 모두 펼치기 (겹치지 않게)
function expandAllFolders() {
    if (!currentData) return;
    isFullExpand = !isFullExpand;

    if (isFullExpand) {
        btnExpandAll.textContent = '🌳 접기';
        renderFullExpandMindmap(currentData);
    } else {
        btnExpandAll.textContent = '🌳 모두 펼치기';
        renderMindmap(currentData);
    }
}

// 전체 펼침 마인드맵 (방사형 구조 유지, 간격 확대)
function renderFullExpandMindmap(data) {
    svg.innerHTML = '';

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.id = 'mindmapGroup';
    svg.appendChild(g);

    const rect = mindmapContainer.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const nodes = [];
    const links = [];

    // 루트 노드
    const rootRadius = 80;
    nodes.push({
        id: data.path,
        name: data.name,
        value: data.value,
        path: data.path,
        x: centerX,
        y: centerY,
        radius: rootRadius,
        depth: 0,
        isFile: data.isFile,
        data: data
    });

    // 방사형으로 자식 배치 (간격 크게)
    function layoutExpandedChildren(parent, parentX, parentY, parentRadius, startAngle, endAngle, depth) {
        if (!parent.children || parent.children.length === 0 || depth > 6) return;

        const children = [...parent.children]
            .filter(c => c.value > 0)
            .sort((a, b) => b.value - a.value)
            .slice(0, 20);

        if (children.length === 0) return;

        const totalAngle = endAngle - startAngle;
        const anglePerChild = totalAngle / children.length;

        // 간격을 훨씬 크게 (3배 이상)
        const baseDistance = 250 + (depth * 150);

        children.forEach((child, i) => {
            const angle = startAngle + anglePerChild * (i + 0.5);
            const childRadius = Math.max(15, Math.min(45, calculateRadius(child.value, rootTotal, false)));

            const x = parentX + Math.cos(angle) * baseDistance;
            const y = parentY + Math.sin(angle) * baseDistance;

            nodes.push({
                id: child.path,
                name: child.name,
                value: child.value,
                path: child.path,
                x: x,
                y: y,
                radius: childRadius,
                depth: depth,
                isFile: child.isFile,
                data: child
            });

            links.push({
                source: { x: parentX, y: parentY },
                target: { x: x, y: y }
            });

            // 재귀 (더 작은 각도 범위로)
            if (child.children && child.children.length > 0 && depth < 5) {
                const spread = Math.PI * 0.4 / depth;
                layoutExpandedChildren(child, x, y, childRadius, angle - spread / 2, angle + spread / 2, depth + 1);
            }
        });
    }

    if (data.children && data.children.length > 0) {
        layoutExpandedChildren(data, centerX, centerY, rootRadius, 0, Math.PI * 2, 1);
    }

    // 링크 그리기
    links.forEach(link => {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('class', 'link-line');
        line.setAttribute('x1', link.source.x);
        line.setAttribute('y1', link.source.y);
        line.setAttribute('x2', link.target.x);
        line.setAttribute('y2', link.target.y);
        g.appendChild(line);
    });

    // 노드 그리기
    nodes.forEach(node => {
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');

        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', node.x);
        circle.setAttribute('cy', node.y);
        circle.setAttribute('r', node.radius);
        circle.setAttribute('fill', getNodeColor(node.depth, node.value));
        circle.setAttribute('class', 'node-circle');
        circle.setAttribute('stroke', searchMatches.includes(node.path) ? '#f39c12' : 'rgba(255,255,255,0.2)');
        circle.setAttribute('stroke-width', searchMatches.includes(node.path) ? '4' : '2');

        circle.addEventListener('click', () => {
            if (!node.isFile && node.data && node.data.children && node.data.children.length > 0) {
                isFullExpand = false;
                btnExpandAll.textContent = '🌳 모두 펼치기';
                navigateToFolder(node.data);
            }
        });
        circle.addEventListener('dblclick', () => window.electronAPI.openInExplorer(node.path));
        circle.addEventListener('mouseenter', (e) => showTooltip(e, node));
        circle.addEventListener('mousemove', moveTooltip);
        circle.addEventListener('mouseleave', hideTooltip);
        group.appendChild(circle);

        // 텍스트 (큰 노드만)
        if (node.radius > 18) {
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('class', 'node-text');
            text.setAttribute('x', node.x);
            text.setAttribute('y', node.y - 5);
            text.setAttribute('font-size', Math.min(node.radius / 3.5, 12));
            text.textContent = truncateText(node.name, node.radius);
            group.appendChild(text);

            const sizeText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            sizeText.setAttribute('class', 'node-text');
            sizeText.setAttribute('x', node.x);
            sizeText.setAttribute('y', node.y + 10);
            sizeText.setAttribute('font-size', Math.min(node.radius / 4.5, 10));
            sizeText.setAttribute('fill', 'rgba(255,255,255,0.7)');
            sizeText.textContent = formatSize(node.value);
            group.appendChild(sizeText);
        }

        g.appendChild(group);
    });

    // 줌 아웃해서 전체가 보이게
    zoom = 0.3;
    panX = 0;
    panY = 0;
    zoomLevelSpan.textContent = '30%';
    updateTransform();
}

// 범례 업데이트
function updateLegend() {
    legendItems.innerHTML = '';

    if (colorMode === 'depth') {
        // 깊이별 범례
        const depthLabels = [
            '루트 폴더',
            '깊이 1',
            '깊이 2',
            '깊이 3',
            '깊이 4',
            '깊이 5'
        ];

        depthLabels.forEach((label, i) => {
            const div = document.createElement('div');
            div.className = 'legend-item';

            const circle = document.createElement('div');
            circle.className = 'legend-circle';
            circle.style.width = '14px';
            circle.style.height = '14px';
            circle.style.background = colorPalette[i];

            const span = document.createElement('span');
            span.textContent = label;

            div.appendChild(circle);
            div.appendChild(span);
            legendItems.appendChild(div);
        });
    } else {
        // 용량별 범례
        sizeColorPalette.forEach(item => {
            const div = document.createElement('div');
            div.className = 'legend-item';

            const circle = document.createElement('div');
            circle.className = 'legend-circle';
            circle.style.width = '14px';
            circle.style.height = '14px';
            circle.style.background = item.color;

            const span = document.createElement('span');
            span.textContent = item.label;

            div.appendChild(circle);
            div.appendChild(span);
            legendItems.appendChild(div);
        });
    }
}
