function requireElectronDatabase() {
  const database = window.electron?.database;

  if (!database) {
    throw new Error(
      "The local database is unavailable. Open this application through Electron using npm run dev:electron.",
    );
  }

  return database;
}

function createEntityApi(entityName) {
  return {
    list(sortExpression = "-created_date", limit = 500) {
      return requireElectronDatabase().list(
        entityName,
        sortExpression,
        limit,
      );
    },

    get(id) {
      return requireElectronDatabase().get(entityName, id);
    },

    create(data) {
      return requireElectronDatabase().create(entityName, data);
    },

    update(id, changes) {
      return requireElectronDatabase().update(
        entityName,
        id,
        changes,
      );
    },

    delete(id) {
      return requireElectronDatabase().delete(entityName, id);
    },

    restore(record) {
      return requireElectronDatabase().restore(entityName, record);
    },

    bulkCreate(records) {
      return requireElectronDatabase().bulkCreate(
        entityName,
        records,
      );
    },

    filter(filters = {}) {
      return requireElectronDatabase().filter(
        entityName,
        filters,
      );
    },
  };
}

const entities = new Proxy(
  {},
  {
    get(_target, entityName) {
      if (typeof entityName !== "string") {
        return undefined;
      }

      return createEntityApi(entityName);
    },
  },
);

export const db = {
  auth: {
    async isAuthenticated() {
      return true;
    },

    async me() {
      return {
        id: "local-user",
        email: "",
        full_name: "Usuário local",
      };
    },

    async logout() {
      return true;
    },
  },

  entities,

  serviceOrders: {
    nextNumber(prefix) {
      return window.electron.serviceOrders.nextNumber(prefix);
    },
  },

  backups: {
    export() { return window.electron.backups.export(); },
    import() { return window.electron.backups.import(); },
  },

  sync: {
    status() { return window.electron.sync.status(); },
    chooseFolder() { return window.electron.sync.chooseFolder(); },
    useFolder(folderPath) { return window.electron.sync.useFolder(folderPath); },
    disable() { return window.electron.sync.disable(); },
    now(options = {}) { return window.electron.sync.now(options); },
  },

  integrations: {
  Core: {
    async UploadFile({ file, category = "general" }) {
      if (!file) {
        throw new Error("No file was selected");
      }

      const arrayBuffer = await file.arrayBuffer();
      const bytes = Array.from(
        new Uint8Array(arrayBuffer),
      );

      return window.electron.files.upload({
        name: file.name,
        type: file.type,
        size: file.size,
        category,
        bytes,
      });
    },
  },
},
};

export default db;