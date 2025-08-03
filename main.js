const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  console.log('Creating window...');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('__dirname:', __dirname);
  
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false, // Don't show until ready
    center: true,
    webPreferences: {
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true, // Secure for local-only operation
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  
  // Load the standalone HTML file
  const indexPath = path.join(__dirname, 'public/index.html');
  console.log('Loading from:', indexPath);
  win.loadFile(indexPath).catch(err => {
    console.error('Failed to load file:', err);
  });
  
  // Open dev tools in development
  if (process.env.NODE_ENV === 'development') {
    win.webContents.openDevTools();
  }

  // Add error handling
  win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
  });

  win.webContents.on('dom-ready', () => {
    console.log('DOM ready - page loaded successfully');
    win.show(); // Show window after DOM is ready
    // win.webContents.openDevTools(); // Open dev tools to see any errors
    console.log('Window shown');
  });

  win.webContents.on('crashed', (event) => {
    console.error('Renderer process crashed:', event);
  });

  // Handle window closed
  win.on('closed', () => {
    console.log('Window closed');
    win.destroy();
  });

  console.log('Window setup complete');
}

app.whenReady().then(() => {
  console.log('App ready, creating window...');
  createWindow();
}).catch(err => {
  console.error('App failed to start:', err);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});