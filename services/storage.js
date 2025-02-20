const {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const { createReadStream, statSync } = require("fs");
const path = require("path");

class StorageService {
  constructor(config) {
    this.config = config;
    this.client = this.createClient();
  }

  createClient() {
    const config = {
      region: this.config.region,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      },
    };

    if (this.config.endpoint && this.config.endpoint.trim() !== "") {
      config.endpoint = this.config.endpoint;
      config.forcePathStyle = true;
    }

    return new S3Client(config);
  }

  async uploadFile(filePath, database) {
    const fileName = path.basename(filePath);
    const timestamp = new Date().toISOString();
    const destFile = `${this.config.prefix}/${database}_${timestamp}_${fileName}`;

    console.log(`Uploading dump to ${this.config.bucket}/${destFile}`);

    // Get file stats for Content-Length
    const fileStats = statSync(filePath);
    const fileStream = createReadStream(filePath);

    const command = new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: destFile,
      Body: fileStream,
      ContentLength: fileStats.size,
    });

    try {
      await this.client.send(command);
      console.log("Upload completed successfully");
    } catch (error) {
      console.error("Upload failed:", error.message);
      throw error;
    }
  }

  async cleanupOldBackups(days) {
    if (!days) return;

    console.log(`Checking for files older than ${days} days`);
    const deleteOlderThan = new Date();
    deleteOlderThan.setDate(deleteOlderThan.getDate() - parseInt(days));

    const command = new ListObjectsV2Command({
      Bucket: this.config.bucket,
      Prefix: this.config.prefix,
    });

    const response = await this.client.send(command);
    if (!response.Contents) return;

    for (const object of response.Contents) {
      if (object.LastModified < deleteOlderThan) {
        console.log(`Deleting ${object.Key}`);
        await this.client.send(
          new DeleteObjectCommand({
            Bucket: this.config.bucket,
            Key: object.Key,
          })
        );
      }
    }
  }
}

module.exports = StorageService;
