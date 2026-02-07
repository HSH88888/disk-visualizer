const { contextBridge, ipcRenderer } = require('electron');

// 렌더러에서 사용할 안전한 API 노출
contextBridge.exposeInMainWorld('electronAPI', {
    // 폴더 선택 다이얼로그 열기
    selectFolder: () => ipcRenderer.invoke('select-folder'),

    // 폴더 스캔
    scanFolder: (folderPath) => ipcRenderer.invoke('scan-folder', folderPath),

    // 파일 탐색기에서 폴더 열기
    openInExplorer: (folderPath) => ipcRenderer.invoke('open-in-explorer', folderPath),

    // 폴더 내 파일 목록 가져오기
    getFiles: (folderPath) => ipcRenderer.invoke('get-files', folderPath),

    // 파일 삭제 (휴지통으로)
    deleteFile: (filePath) => ipcRenderer.invoke('delete-file', filePath),

    // 파일 이동
    moveFile: (sourcePath, destFolder) => ipcRenderer.invoke('move-file', sourcePath, destFolder),

    // 이동할 폴더 선택
    selectDestFolder: () => ipcRenderer.invoke('select-dest-folder')
});
