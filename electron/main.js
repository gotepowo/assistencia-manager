import {
  app,
  BrowserWindow,
  protocol,
} from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerIPC } from "./ipc.js";

protocol.registerSchemesAsPrivileged([
  {
    scheme: "local-file",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
]);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;

function getApplicationFolder() {
  if (!app.isPackaged) {
    return process.cwd();
  }

  return (
    process.env.PORTABLE_EXECUTABLE_DIR ||
    path.dirname(process.execPath)
  );
}

function getMimeType(filePath) {
  const extension = path.extname(filePath).toLowerCase();

  const mimeTypes = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".pdf": "application/pdf",
    ".txt": "text/plain; charset=utf-8",
    ".csv": "text/csv; charset=utf-8",
  };

  return mimeTypes[extension] || "application/octet-stream";
}

function getRelativePathFromLocalFileUrl(requestUrl) {
  // Example received from the renderer:
  // local-file:///uploads/settings/file.png
  let relativePath = decodeURIComponent(requestUrl);

  // Remove only the custom protocol prefix. Do not remove "uploads/".
  relativePath = relativePath.replace(
    /^local-file:(?:\/\/\/|\/\/|\/|\\\\|\\)?/i,
    "",
  );

  // Stored paths are always relative to the application folder.
  relativePath = relativePath.replace(/^[/\\]+/, "");

  // Accept old database entries that may contain the protocol twice.
  relativePath = relativePath.replace(
    /^local-file:(?:\/\/\/|\/\/|\/|\\\\|\\)?/i,
    "",
  );
  relativePath = relativePath.replace(/^[/\\]+/, "");

  return relativePath.replace(/[\\/]+/g, path.sep);
}

function registerLocalFileProtocol() {
  protocol.handle("local-file", async (request) => {
    try {
      const applicationFolder = path.resolve(getApplicationFolder());
      const relativePath = getRelativePathFromLocalFileUrl(request.url);
      const absolutePath = path.resolve(applicationFolder, relativePath);

      // Prevent the custom URL from reading files outside the app folder.
      const insideApplicationFolder =
        absolutePath === applicationFolder ||
        absolutePath.startsWith(`${applicationFolder}${path.sep}`);

      if (!insideApplicationFolder) {
        console.error("[local-file] Caminho bloqueado:", absolutePath);
        return new Response("Caminho inválido", { status: 403 });
      }

      console.log("[local-file]", absolutePath);

      const bytes = await fs.readFile(absolutePath);

      return new Response(bytes, {
        status: 200,
        headers: {
          "Content-Type": getMimeType(absolutePath),
          "Cache-Control": "no-cache",
        },
      });
    } catch (error) {
      console.error("[local-file] Arquivo não encontrado:", error);
      return new Response("Arquivo não encontrado", { status: 404 });
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    autoHideMenuBar: true,

    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (app.isPackaged) {
    mainWindow.loadFile(
      path.join(__dirname, "..", "dist", "index.html"),
    );
  } else {
    mainWindow.loadURL("http://localhost:5173");
  }

  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  registerLocalFileProtocol();
  registerIPC();
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
