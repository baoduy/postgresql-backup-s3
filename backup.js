const { spawn, execSync } = require('child_process');
const { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { createGzip } = require('zlib');
const { pipeline } = require('stream/promises');
const { createReadStream, createWriteStream, unlinkSync } = require('fs');
const path = require('path');

// Configuration validation
const requiredEnvVars = [
    'S3_ACCESS_KEY_ID',
    'S3_SECRET_ACCESS_KEY',
    'S3_BUCKET',
    'POSTGRES_DATABASE',
    'POSTGRES_USER',
    'POSTGRES_PASSWORD',
    'POSTGRES_HOST'
];

function validateConfig() {
    for (const envVar of requiredEnvVars) {
        if (!process.env[envVar] || process.env[envVar] === '**None**') {
            throw new Error(`Missing required environment variable: ${envVar}`);
        }
    }
}

// S3 Client configuration
function getS3Client() {
    const config = {
        region: process.env.S3_REGION || 'us-east-1',
        credentials: {
            accessKeyId: process.env.S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
        }
    };

    if (process.env.S3_ENDPOINT && process.env.S3_ENDPOINT !== '**None**') {
        config.endpoint = process.env.S3_ENDPOINT;
        config.forcePathStyle = true; // Required for MinIO
    }

    return new S3Client(config);
}

// PostgreSQL backup function
async function createPostgresBackup(outputFile) {
    const pgDumpArgs = [
        '-h', process.env.POSTGRES_HOST,
        '-p', process.env.POSTGRES_PORT || '5432',
        '-U', process.env.POSTGRES_USER
    ];

    if (process.env.POSTGRES_EXTRA_OPTS) {
        pgDumpArgs.push(...process.env.POSTGRES_EXTRA_OPTS.split(' '));
    }

    const command = process.env.POSTGRES_DATABASE === 'all' ? 'pg_dumpall' : 'pg_dump';
    if (process.env.POSTGRES_DATABASE !== 'all') {
        pgDumpArgs.push(process.env.POSTGRES_DATABASE);
    }

    console.log(`Creating dump of ${process.env.POSTGRES_DATABASE} database from ${process.env.POSTGRES_HOST}...`);

    const dump = spawn(command, pgDumpArgs, {
        env: { ...process.env, PGPASSWORD: process.env.POSTGRES_PASSWORD }
    });

    const gzip = createGzip();
    const output = createWriteStream(outputFile);

    await pipeline(dump.stdout, gzip, output);
    return outputFile;
}

// Encryption function
async function encryptFile(inputFile) {
    if (!process.env.ENCRYPTION_PASSWORD || process.env.ENCRYPTION_PASSWORD === '**None**') {
        return inputFile;
    }

    const outputFile = `${inputFile}.enc`;
    console.log(`Encrypting ${inputFile}`);

    try {
        execSync(`openssl enc -aes-256-cbc -pbkdf2 -in "${inputFile}" -out "${outputFile}" -k "${process.env.ENCRYPTION_PASSWORD}"`);
        unlinkSync(inputFile);
        return outputFile;
    } catch (error) {
        throw new Error(`Encryption failed: ${error.message}`);
    }
}

// S3 upload function
async function uploadToS3(s3Client, filePath) {
    const fileName = path.basename(filePath);
    const timestamp = new Date().toISOString();
    const destFile = `${process.env.S3_PREFIX || 'backup'}/${process.env.POSTGRES_DATABASE}_${timestamp}_${fileName}`;

    console.log(`Uploading dump to ${process.env.S3_BUCKET}/${destFile}`);

    const fileStream = createReadStream(filePath);
    const command = new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: destFile,
        Body: fileStream
    });

    await s3Client.send(command);
    unlinkSync(filePath);
}

// Cleanup old backups
async function cleanupOldBackups(s3Client) {
    if (!process.env.DELETE_OLDER_THAN || process.env.DELETE_OLDER_THAN === '**None**') {
        return;
    }

    console.log(`Checking for files older than ${process.env.DELETE_OLDER_THAN} days`);
    const deleteOlderThan = new Date();
    deleteOlderThan.setDate(deleteOlderThan.getDate() - parseInt(process.env.DELETE_OLDER_THAN));

    const command = new ListObjectsV2Command({
        Bucket: process.env.S3_BUCKET,
        Prefix: process.env.S3_PREFIX || 'backup'
    });

    const response = await s3Client.send(command);
    if (!response.Contents) return;

    for (const object of response.Contents) {
        if (object.LastModified < deleteOlderThan) {
            console.log(`Deleting ${object.Key}`);
            await s3Client.send(new DeleteObjectCommand({
                Bucket: process.env.S3_BUCKET,
                Key: object.Key
            }));
        }
    }
}

// Main function
async function main() {
    try {
        validateConfig();
        const s3Client = getS3Client();
        
        let backupFile = await createPostgresBackup('/tmp/dump.sql.gz');
        backupFile = await encryptFile(backupFile);
        await uploadToS3(s3Client, backupFile);
        await cleanupOldBackups(s3Client);
        
        console.log('SQL backup completed successfully');
    } catch (error) {
        console.error('Backup failed:', error);
        process.exit(1);
    }
}

main();