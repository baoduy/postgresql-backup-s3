const config = require("./config");
const PostgresService = require("./services/postgres");
const StorageService = require("./services/storage");
const EncryptionService = require("./services/encryption");
const { unlinkSync } = require("fs");

function validateConfig() {
  for (const envVar of config.required.envVars) {
    if (!process.env[envVar] || process.env[envVar].trim() === "") {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }
}

async function main() {
  try {
    validateConfig();

    const postgres = new PostgresService(
      config.postgres,
      config.backup.tempFolder
    );
    const storage = new StorageService(config.s3);
    const encryption = new EncryptionService(config.backup);

    let backupFile = await postgres.createBackup(config.backup.tempFile);
    backupFile = await encryption.encryptFile(backupFile);

    await storage.uploadFile(backupFile, config.postgres.database);
    await storage.cleanupOldBackups(config.backup.deleteOlderThan);

    console.log("SQL backup completed successfully");
  } catch (error) {
    console.error("Backup failed:", error);
    process.exit(1);
  } finally {
    try {
      unlinkSync(config.backup.tempFile);
    } catch (e) {
      // Ignore file deletion errors
    }
  }
}

main();
