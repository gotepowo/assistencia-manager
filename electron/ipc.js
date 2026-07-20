import { ipcMain, dialog, BrowserWindow } from "electron";
import fs from "node:fs";
import path from "node:path";

import {
  loadDatabase,
  listRecords,
  getRecord,
  createRecord,
  updateRecord,
  deleteRecord,
  bulkCreateRecords,
  filterRecords,
  saveUploadedFile,
  restoreRecord,
  getNextServiceOrderNumber,
  getDatabasePathForBackup,
  validateAndRestoreBackup,
} from "./database.js";

import {
  markLocalDirty,
  getSyncStatus,
  chooseOneDriveFolder,
  configureDetectedFolder,
  disableSync,
  syncNow,
} from "./cloudSync.js";

const ALLOWED_ENTITIES = new Set([
  "Client",
  "ServiceOrder",
  "Invoice",
  "Transaction",
  "Setting",
]);

function validateEntity(entityName) {
  if (!ALLOWED_ENTITIES.has(entityName)) {
    throw new Error(`Invalid entity: ${entityName}`);
  }
}

export function registerIPC() {
  ipcMain.handle("db:load", () => {
    return loadDatabase();
  });

  ipcMain.handle(
    "db:list",
    (_event, entityName, sortExpression, limit) => {
      validateEntity(entityName);
      return listRecords(entityName, sortExpression, limit);
    },
  );

  ipcMain.handle("db:get", (_event, entityName, id) => {
    validateEntity(entityName);
    return getRecord(entityName, id);
  });

  ipcMain.handle("db:create", (_event, entityName, data) => {
    validateEntity(entityName);
    const result = createRecord(entityName, data);
    markLocalDirty();
    return result;
  });

  ipcMain.handle(
    "db:update",
    (_event, entityName, id, changes) => {
      validateEntity(entityName);
      const result = updateRecord(entityName, id, changes);
      markLocalDirty();
      return result;
    },
  );

  ipcMain.handle("db:delete", (_event, entityName, id) => {
    validateEntity(entityName);
    const result = deleteRecord(entityName, id);
    if (result) markLocalDirty();
    return result;
  });

  ipcMain.handle("db:restore", (_event, entityName, record) => {
    validateEntity(entityName);
    const result = restoreRecord(entityName, record);
    markLocalDirty();
    return result;
  });

  ipcMain.handle("os:next-number", (_event, prefix) => getNextServiceOrderNumber(prefix));

  ipcMain.handle("backup:export", async () => {
    const sourcePath = getDatabasePathForBackup();
    const defaultName = `gotelip-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const result = await dialog.showSaveDialog({
      title: "Salvar backup completo",
      defaultPath: defaultName,
      filters: [{ name: "Backup JSON", extensions: ["json"] }],
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    fs.copyFileSync(sourcePath, result.filePath);
    return { canceled: false, path: result.filePath };
  });

  ipcMain.handle("backup:import", async () => {
    const result = await dialog.showOpenDialog({
      title: "Selecionar backup para restaurar",
      properties: ["openFile"],
      filters: [{ name: "Backup JSON", extensions: ["json"] }],
    });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    validateAndRestoreBackup(result.filePaths[0]);
    markLocalDirty();
    return { canceled: false, path: result.filePaths[0] };
  });

  ipcMain.handle(
    "db:bulk-create",
    (_event, entityName, records) => {
      validateEntity(entityName);
      const result = bulkCreateRecords(entityName, records);
      markLocalDirty();
      return result;
    },
  );

  ipcMain.handle("db:filter", (_event, entityName, filters) => {
    validateEntity(entityName);
    return filterRecords(entityName, filters);
  });


  ipcMain.handle("sync:status", () => getSyncStatus());
  ipcMain.handle("sync:choose-folder", (event) => chooseOneDriveFolder(BrowserWindow.fromWebContents(event.sender)));
  ipcMain.handle("sync:use-folder", (_event, folderPath) => configureDetectedFolder(folderPath));
  ipcMain.handle("sync:disable", () => disableSync());
  ipcMain.handle("sync:now", (_event, options = {}) => syncNow(options));

  ipcMain.handle("file:upload", (_event, fileData) => {
  const result = saveUploadedFile(fileData);
  markLocalDirty();
  return result;
  });
}