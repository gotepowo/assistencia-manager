const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  database: {
    load: () =>
      ipcRenderer.invoke("db:load"),

    list: (entityName, sortExpression, limit) =>
      ipcRenderer.invoke(
        "db:list",
        entityName,
        sortExpression,
        limit,
      ),

    get: (entityName, id) =>
      ipcRenderer.invoke(
        "db:get",
        entityName,
        id,
      ),

    create: (entityName, data) =>
      ipcRenderer.invoke(
        "db:create",
        entityName,
        data,
      ),

    update: (entityName, id, changes) =>
      ipcRenderer.invoke(
        "db:update",
        entityName,
        id,
        changes,
      ),

    delete: (entityName, id) =>
      ipcRenderer.invoke("db:delete", entityName, id),

    restore: (entityName, record) =>
      ipcRenderer.invoke("db:restore", entityName, record),

    bulkCreate: (entityName, records) =>
      ipcRenderer.invoke(
        "db:bulk-create",
        entityName,
        records,
      ),

    filter: (entityName, filters) =>
      ipcRenderer.invoke(
        "db:filter",
        entityName,
        filters,
      ),
  },

  serviceOrders: {
    nextNumber: (prefix) => ipcRenderer.invoke("os:next-number", prefix),
  },

  backups: {
    export: () => ipcRenderer.invoke("backup:export"),
    import: () => ipcRenderer.invoke("backup:import"),
  },

  sync: {
    status: () => ipcRenderer.invoke("sync:status"),
    chooseFolder: () => ipcRenderer.invoke("sync:choose-folder"),
    useFolder: (folderPath) => ipcRenderer.invoke("sync:use-folder", folderPath),
    disable: () => ipcRenderer.invoke("sync:disable"),
    now: (options) => ipcRenderer.invoke("sync:now", options),
  },

  files: {
    upload: (fileData) =>
      ipcRenderer.invoke(
        "file:upload",
        fileData,
      ),
  },
});