const { spawn } = require('child_process');
const { createGzip } = require('zlib');
const { pipeline } = require('stream/promises');
const { createWriteStream } = require('fs');

class PostgresService {
    constructor(config) {
        this.config = config;
    }

    async createBackup(outputFile) {
        const pgDumpArgs = [
            '-h', this.config.host,
            '-p', this.config.port,
            '-U', this.config.user
        ];

        if (this.config.extraOpts) {
            pgDumpArgs.push(...this.config.extraOpts.split(' '));
        }

        const command = this.config.database === 'all' ? 'pg_dumpall' : 'pg_dump';
        if (this.config.database !== 'all') {
            pgDumpArgs.push(this.config.database);
        }

        console.log(`Creating dump of ${this.config.database} database from ${this.config.host}...`);

        const dump = spawn(command, pgDumpArgs, {
            env: { ...process.env, PGPASSWORD: this.config.password }
        });

        const gzip = createGzip();
        const output = createWriteStream(outputFile);

        await pipeline(dump.stdout, gzip, output);
        return outputFile;
    }
}

module.exports = PostgresService;