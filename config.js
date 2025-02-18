// Configuration settings
const config = {
    required: {
        envVars: [
            'S3_ACCESS_KEY_ID',
            'S3_SECRET_ACCESS_KEY',
            'S3_BUCKET',
            'POSTGRES_DATABASE',
            'POSTGRES_USER',
            'POSTGRES_PASSWORD',
            'POSTGRES_HOST'
        ]
    },
    s3: {
        region: process.env.S3_REGION || 'us-east-1',
        bucket: process.env.S3_BUCKET,
        prefix: process.env.S3_PREFIX || 'backup',
        endpoint: process.env.S3_ENDPOINT,
    },
    postgres: {
        host: process.env.POSTGRES_HOST,
        port: process.env.POSTGRES_PORT || '5432',
        database: process.env.POSTGRES_DATABASE,
        user: process.env.POSTGRES_USER,
        password: process.env.POSTGRES_PASSWORD,
        extraOpts: process.env.POSTGRES_EXTRA_OPTS || ''
    },
    backup: {
        tempFile: '/tmp/dump.sql.gz',
        encryptionPassword: process.env.ENCRYPTION_PASSWORD,
        deleteOlderThan: process.env.DELETE_OLDER_THAN
    }
};

module.exports = config;