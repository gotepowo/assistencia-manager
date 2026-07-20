import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { app, dialog } from "electron";

const SYNC_FOLDER_NAME = "Gotelip Assistencia Sync";
const KEEP_REVISIONS = 10;

function getApplicationFolder() {
  if (!app.isPackaged) return process.cwd();
  return process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(process.execPath);
}

function getConfigPath() {
  return path.join(getApplicationFolder(), "data", "cloud-sync.json");
}

function defaultState() {
  return {
    enabled: false,
    oneDriveRoot: "",
    deviceId: randomUUID(),
    deviceName: os.hostname(),
    baseRevision: 0,
    dirty: false,
    lastSyncAt: null,
    lastError: null,
  };
}

function readState() {
  const configPath = getConfigPath();
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  if (!fs.existsSync(configPath)) {
    const state = defaultState();
    writeState(state);
    return state;
  }
  try {
    return { ...defaultState(), ...JSON.parse(fs.readFileSync(configPath, "utf8")) };
  } catch {
    const state = defaultState();
    writeState(state);
    return state;
  }
}

function writeState(state) {
  const configPath = getConfigPath();
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  const temp = `${configPath}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(state, null, 2), "utf8");
  fs.renameSync(temp, configPath);
}

function getSyncRoot(state = readState()) {
  if (!state.oneDriveRoot) return null;
  return path.join(state.oneDriveRoot, SYNC_FOLDER_NAME);
}

function getManifestPath(syncRoot) {
  return path.join(syncRoot, "manifest.json");
}

function readManifest(syncRoot) {
  const manifestPath = getManifestPath(syncRoot);
  if (!fs.existsSync(manifestPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch (error) {
    throw new Error(`O manifesto do OneDrive está inválido: ${error.message}`);
  }
}

function writeManifestAtomic(syncRoot, manifest) {
  fs.mkdirSync(syncRoot, { recursive: true });
  const manifestPath = getManifestPath(syncRoot);
  const temp = `${manifestPath}.${randomUUID()}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(manifest, null, 2), "utf8");
  fs.renameSync(temp, manifestPath);
}

function copyDirectory(source, destination) {
  if (!fs.existsSync(source)) return;
  fs.cpSync(source, destination, { recursive: true, force: true });
}

function createLocalSafetyBackup(label = "pre-sync") {
  const appFolder = getApplicationFolder();
  const databasePath = path.join(appFolder, "data", "database.json");
  if (!fs.existsSync(databasePath)) return null;
  const backupFolder = path.join(appFolder, "backups");
  fs.mkdirSync(backupFolder, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  const target = path.join(backupFolder, `${label}-${stamp}.json`);
  fs.copyFileSync(databasePath, target);
  return target;
}

function cleanupOldRevisions(syncRoot) {
  if (!fs.existsSync(syncRoot)) return;
  const revisions = fs.readdirSync(syncRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^revision-\d{8}$/.test(entry.name))
    .map((entry) => entry.name)
    .sort()
    .reverse();
  for (const oldName of revisions.slice(KEEP_REVISIONS)) {
    fs.rmSync(path.join(syncRoot, oldName), { recursive: true, force: true });
  }
}

function revisionFolderName(revision) {
  return `revision-${String(revision).padStart(8, "0")}`;
}

function validateSnapshot(snapshotFolder) {
  const databasePath = path.join(snapshotFolder, "data", "database.json");
  if (!fs.existsSync(databasePath)) throw new Error("O snapshot não contém database.json.");
  const parsed = JSON.parse(fs.readFileSync(databasePath, "utf8"));
  for (const entity of ["Client", "ServiceOrder", "Invoice", "Transaction", "Setting"]) {
    if (!Array.isArray(parsed[entity])) throw new Error(`Banco inválido: entidade ${entity} ausente.`);
  }
}

function pushSnapshot(state, syncRoot, cloudManifest) {
  const cloudRevision = Number(cloudManifest?.revision || 0);
  if (cloudRevision !== Number(state.baseRevision || 0)) {
    throw new Error("CONFLICT: existe uma revisão mais nova no OneDrive. Baixe-a antes de enviar seus dados locais.");
  }

  const nextRevision = cloudRevision + 1;
  const finalFolder = path.join(syncRoot, revisionFolderName(nextRevision));
  const stagingFolder = path.join(syncRoot, `.staging-${randomUUID()}`);
  const appFolder = getApplicationFolder();

  fs.mkdirSync(path.join(stagingFolder, "data"), { recursive: true });
  fs.copyFileSync(path.join(appFolder, "data", "database.json"), path.join(stagingFolder, "data", "database.json"));
  copyDirectory(path.join(appFolder, "uploads"), path.join(stagingFolder, "uploads"));
  fs.writeFileSync(path.join(stagingFolder, "snapshot.json"), JSON.stringify({
    revision: nextRevision,
    createdAt: new Date().toISOString(),
    deviceId: state.deviceId,
    deviceName: state.deviceName,
  }, null, 2));

  validateSnapshot(stagingFolder);
  fs.renameSync(stagingFolder, finalFolder);

  const manifest = {
    schemaVersion: 1,
    revision: nextRevision,
    folder: path.basename(finalFolder),
    updatedAt: new Date().toISOString(),
    deviceId: state.deviceId,
    deviceName: state.deviceName,
  };
  writeManifestAtomic(syncRoot, manifest);
  cleanupOldRevisions(syncRoot);

  return manifest;
}

function pullSnapshot(state, syncRoot, manifest) {
  const snapshotFolder = path.join(syncRoot, manifest.folder || revisionFolderName(manifest.revision));
  validateSnapshot(snapshotFolder);
  createLocalSafetyBackup("antes-da-nuvem");

  const appFolder = getApplicationFolder();
  const localData = path.join(appFolder, "data");
  const localUploads = path.join(appFolder, "uploads");
  fs.mkdirSync(localData, { recursive: true });

  const sourceDb = path.join(snapshotFolder, "data", "database.json");
  const tempDb = path.join(localData, `database.${randomUUID()}.tmp`);
  fs.copyFileSync(sourceDb, tempDb);
  fs.renameSync(tempDb, path.join(localData, "database.json"));

  fs.rmSync(localUploads, { recursive: true, force: true });
  copyDirectory(path.join(snapshotFolder, "uploads"), localUploads);

  return manifest;
}

export function markLocalDirty() {
  const state = readState();
  state.dirty = true;
  state.lastError = null;
  writeState(state);
}

export function getSyncStatus() {
  const state = readState();
  const detected = detectOneDriveFolders();
  let cloudRevision = null;
  try {
    const root = getSyncRoot(state);
    cloudRevision = root ? readManifest(root)?.revision ?? 0 : null;
  } catch {
    cloudRevision = null;
  }
  return {
    ...state,
    syncFolder: getSyncRoot(state),
    detectedFolders: detected,
    cloudRevision,
  };
}

export function detectOneDriveFolders() {
  const candidates = [
    process.env.OneDrive,
    process.env.OneDriveConsumer,
    process.env.OneDriveCommercial,
    path.join(os.homedir(), "OneDrive"),
  ].filter(Boolean);
  return [...new Set(candidates.map((candidate) => path.resolve(candidate)))]
    .filter((candidate) => fs.existsSync(candidate));
}

export async function chooseOneDriveFolder(browserWindow) {
  const state = readState();
  const defaults = detectOneDriveFolders();
  const result = await dialog.showOpenDialog(browserWindow, {
    title: "Selecione a pasta principal do OneDrive",
    defaultPath: state.oneDriveRoot || defaults[0] || os.homedir(),
    properties: ["openDirectory", "createDirectory"],
  });
  if (result.canceled || !result.filePaths[0]) return { canceled: true };

  state.oneDriveRoot = result.filePaths[0];
  state.enabled = true;
  state.lastError = null;
  writeState(state);
  fs.mkdirSync(getSyncRoot(state), { recursive: true });
  return { canceled: false, status: getSyncStatus() };
}

export function disableSync() {
  const state = readState();
  state.enabled = false;
  state.lastError = null;
  writeState(state);
  return getSyncStatus();
}

export function configureDetectedFolder(folderPath) {
  const resolved = path.resolve(folderPath);
  if (!fs.existsSync(resolved)) throw new Error("A pasta selecionada não existe.");
  const state = readState();
  state.oneDriveRoot = resolved;
  state.enabled = true;
  state.lastError = null;
  writeState(state);
  fs.mkdirSync(getSyncRoot(state), { recursive: true });
  return getSyncStatus();
}

export function syncNow({ preferCloud = false, initializeCloud = false } = {}) {
  const state = readState();
  if (!state.enabled || !state.oneDriveRoot) {
    return { action: "disabled", status: getSyncStatus() };
  }

  const syncRoot = getSyncRoot(state);
  fs.mkdirSync(syncRoot, { recursive: true });

  try {
    const cloudManifest = readManifest(syncRoot);
    const cloudRevision = Number(cloudManifest?.revision || 0);
    const baseRevision = Number(state.baseRevision || 0);

    let action = "none";
    let manifest = cloudManifest;

    if (!cloudManifest) {
      if (!initializeCloud) {
        return { action: "cloud-empty", status: getSyncStatus(), reloadRequired: false };
      }
      manifest = pushSnapshot(state, syncRoot, null);
      action = "uploaded";
    } else if (cloudRevision > baseRevision) {
      if (state.dirty && !preferCloud) {
        throw new Error("CONFLICT: há alterações locais e uma versão mais nova no OneDrive. Escolha manter a nuvem ou faça um backup local antes.");
      }
      manifest = pullSnapshot(state, syncRoot, cloudManifest);
      action = "downloaded";
    } else if (state.dirty) {
      manifest = pushSnapshot(state, syncRoot, cloudManifest);
      action = "uploaded";
    }

    state.baseRevision = Number(manifest?.revision || baseRevision);
    state.dirty = false;
    state.lastSyncAt = new Date().toISOString();
    state.lastError = null;
    writeState(state);

    return { action, manifest, status: getSyncStatus(), reloadRequired: action === "downloaded" };
  } catch (error) {
    state.lastError = error.message;
    writeState(state);
    throw error;
  }
}
