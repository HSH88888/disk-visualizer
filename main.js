const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    backgroundColor: '#1a1a2e',
    show: false
  });

  mainWindow.loadFile('index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 폴더 선택 다이얼로그
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });

  if (result.canceled) {
    return null;
  }

  return result.filePaths[0];
});

// 디스크 스캔 기능
ipcMain.handle('scan-folder', async (event, folderPath) => {
  try {
    const data = await scanDirectory(folderPath, 0, 10);
    return data;
  } catch (error) {
    console.error('Scan error:', error);
    throw error;
  }
});

// 파일 탐색기에서 폴더 열기
ipcMain.handle('open-in-explorer', async (event, folderPath) => {
  const { shell } = require('electron');
  shell.openPath(folderPath);
});

// 재귀적 디렉토리 스캔
async function scanDirectory(dirPath, currentDepth, maxDepth) {
  const stats = fs.statSync(dirPath);
  const name = path.basename(dirPath);

  if (stats.isFile()) {
    return {
      name: name,
      value: stats.size,
      path: dirPath,
      isFile: true,
      extension: path.extname(name).toLowerCase()
    };
  }

  // 디렉토리인 경우
  const children = [];
  let totalSize = 0;

  if (currentDepth < maxDepth) {
    try {
      const items = fs.readdirSync(dirPath);

      for (const item of items) {
        const itemPath = path.join(dirPath, item);

        try {
          const childData = await scanDirectory(itemPath, currentDepth + 1, maxDepth);
          if (childData) {
            children.push(childData);
            totalSize += childData.value || 0;
          }
        } catch (err) {
          // 권한 오류 등은 무시
          console.log(`Skipping ${itemPath}: ${err.message}`);
        }
      }
    } catch (err) {
      console.log(`Cannot read directory ${dirPath}: ${err.message}`);
    }
  } else {
    // 최대 깊이에 도달하면 폴더 크기만 계산
    totalSize = getDirectorySize(dirPath);
  }

  return {
    name: name,
    value: totalSize,
    path: dirPath,
    isFile: false,
    children: children.length > 0 ? children : undefined
  };
}

// 폴더 크기 계산 (깊이 제한 도달 시)
function getDirectorySize(dirPath) {
  let totalSize = 0;

  try {
    const items = fs.readdirSync(dirPath);

    for (const item of items) {
      const itemPath = path.join(dirPath, item);

      try {
        const stats = fs.statSync(itemPath);
        if (stats.isFile()) {
          totalSize += stats.size;
        } else {
          totalSize += getDirectorySize(itemPath);
        }
      } catch (err) {
        // 권한 오류 무시
      }
    }
  } catch (err) {
    // 디렉토리 읽기 오류 무시
  }

  return totalSize;
}

// 폴더 내 파일 목록 가져오기
ipcMain.handle('get-files', async (event, folderPath) => {
  try {
    const items = fs.readdirSync(folderPath);
    const files = [];

    for (const item of items) {
      const itemPath = path.join(folderPath, item);
      try {
        const stats = fs.statSync(itemPath);
        if (stats.isFile()) {
          files.push({
            name: item,
            path: itemPath,
            size: stats.size,
            modified: stats.mtime
          });
        }
      } catch (err) {
        // 권한 오류 무시
      }
    }

    // 크기순 정렬
    files.sort((a, b) => b.size - a.size);
    return files;
  } catch (err) {
    return [];
  }
});

// 파일 삭제 (휴지통으로)
ipcMain.handle('delete-file', async (event, filePath) => {
  try {
    const { shell } = require('electron');
    await shell.trashItem(filePath);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 파일 이동
ipcMain.handle('move-file', async (event, sourcePath, destFolder) => {
  try {
    const fileName = path.basename(sourcePath);
    const destPath = path.join(destFolder, fileName);
    fs.renameSync(sourcePath, destPath);
    return { success: true, newPath: destPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 이동할 폴더 선택
ipcMain.handle('select-dest-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: '이동할 폴더 선택'
  });

  if (result.canceled) {
    return null;
  }

  return result.filePaths[0];
});
