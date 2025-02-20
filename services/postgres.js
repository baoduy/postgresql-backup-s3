const { spawn } = require("child_process");
const { createGzip } = require("zlib");
const { pipeline } = require("stream/promises");
const { createWriteStream } = require("fs");

class PostgresService {
  constructor(config, tempFolder) {
    this.config = config;
    this.tempFolder = tempFolder;
  }

  async createBackup(outputFile) {
    const pgDumpArgs = [
      "-h",
      this.config.host,
      "-p",
      this.config.port,
      "-U",
      this.config.user,
    ];

    if (this.config.extraOpts) {
      pgDumpArgs.push(...this.config.extraOpts.split(" "));
    }

    const command = this.config.database === "all" ? "pg_dumpall" : "pg_dump";
    if (this.config.database !== "all") {
      pgDumpArgs.push(this.config.database);
    }

    console.log(
      `Creating dump of ${this.config.database} database from ${this.config.host}...`
    );
    console.log(`Running command: ${command} ${pgDumpArgs.join(" ")}`);

    const dump = spawn(command, pgDumpArgs, {
      env: { ...process.env, PGPASSWORD: this.config.password },
      cwd: this.tempFolder,
    });

    dump.stdout.on("data", (data) => {
      console.log(`pg_dump stdout: ${data}`);
    });

    dump.stderr.on("data", (data) => {
      console.error(`pg_dump stderr: ${data}`);
    });

    dump.on("close", (code) => {
      console.log(`pg_dump process exited with code ${code}`);
    });

    const gzip = createGzip();
    const output = createWriteStream(outputFile);

    try {
      await pipeline(dump.stdout, gzip, output);
      console.log(`Backup successfully created at ${outputFile}`);
    } catch (error) {
      console.error("Error during backup pipeline:", error);
      throw error;
    }

    return outputFile;
  }
}

module.exports = PostgresService;
