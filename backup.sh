#!/usr/bin/env bash

# Enable strict mode
set -euo pipefail
IFS=$'\n\t'

# Function for error handling
error_handler() {
    local line_no=$1
    local error_code=$2
    echo >&2 "Error occurred in line ${line_no}, with exit code ${error_code}"
}
trap 'error_handler ${LINENO} $?' ERR

# Function to validate required environment variables
check_required_var() {
    local var_name=$1
    local var_value=$2
    if [ "${var_value}" = "**None**" ]; then
        echo "Error: You need to set the ${var_name} environment variable."
        exit 1
    fi
}

>&2 echo "Starting backup process..."

# Validate required environment variables
check_required_var "S3_ACCESS_KEY_ID" "${S3_ACCESS_KEY_ID}"
check_required_var "S3_SECRET_ACCESS_KEY" "${S3_SECRET_ACCESS_KEY}"
check_required_var "S3_BUCKET" "${S3_BUCKET}"
check_required_var "POSTGRES_DATABASE" "${POSTGRES_DATABASE}"
check_required_var "POSTGRES_USER" "${POSTGRES_USER}"
check_required_var "POSTGRES_PASSWORD" "${POSTGRES_PASSWORD}"

# Check and set POSTGRES_HOST
if [ "${POSTGRES_HOST}" = "**None**" ]; then
    if [ -n "${POSTGRES_PORT_5432_TCP_ADDR-}" ]; then
        POSTGRES_HOST=$POSTGRES_PORT_5432_TCP_ADDR
        POSTGRES_PORT=$POSTGRES_PORT_5432_TCP_PORT
    else
        echo "Error: You need to set the POSTGRES_HOST environment variable."
        exit 1
    fi
fi

# Configure AWS arguments
AWS_ARGS=""
if [ "${S3_ENDPOINT}" != "**None**" ]; then
    AWS_ARGS="--endpoint-url ${S3_ENDPOINT}"
fi

# Set AWS and PostgreSQL environment variables
export AWS_ACCESS_KEY_ID=$S3_ACCESS_KEY_ID
export AWS_SECRET_ACCESS_KEY=$S3_SECRET_ACCESS_KEY
export AWS_DEFAULT_REGION=$S3_REGION
export PGPASSWORD=$POSTGRES_PASSWORD

POSTGRES_HOST_OPTS="-h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER $POSTGRES_EXTRA_OPTS"

# Create timestamp with UTC
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
SRC_FILE="/tmp/dump.sql.gz"
DEST_FILE="${POSTGRES_DATABASE}_${TIMESTAMP}.sql.gz"

echo "Creating dump of ${POSTGRES_DATABASE} database from ${POSTGRES_HOST}..."

# Perform database dump
if [ "${POSTGRES_DATABASE}" = "all" ]; then
    pg_dumpall $POSTGRES_HOST_OPTS | gzip > "$SRC_FILE"
else
    pg_dump $POSTGRES_HOST_OPTS "$POSTGRES_DATABASE" | gzip > "$SRC_FILE"
fi

# Handle encryption if required
if [ "${ENCRYPTION_PASSWORD}" != "**None**" ]; then
    >&2 echo "Encrypting ${SRC_FILE}"
    if ! openssl enc -aes-256-cbc -pbkdf2 -in "$SRC_FILE" -out "${SRC_FILE}.enc" -k "$ENCRYPTION_PASSWORD"; then
        >&2 echo "Error: Encryption failed"
        exit 1
    fi
    rm "$SRC_FILE"
    SRC_FILE="${SRC_FILE}.enc"
    DEST_FILE="${DEST_FILE}.enc"
fi

echo "Uploading dump to $S3_BUCKET"

# Upload to S3
if ! cat "$SRC_FILE" | aws $AWS_ARGS s3 cp - "s3://$S3_BUCKET/$S3_PREFIX/$DEST_FILE"; then
    echo "Error: Failed to upload backup to S3"
    exit 1
fi

# Clean up old backups if configured
if [ "${DELETE_OLDER_THAN}" != "**None**" ]; then
    >&2 echo "Checking for files older than ${DELETE_OLDER_THAN}"
    
    # Handle date commands for both Linux and macOS
    if [ "$(uname)" = "Darwin" ]; then
        # macOS date command
        get_timestamp() {
            date -j -f "%Y-%m-%d %H:%M:%S" "$1" "+%s" 2>/dev/null
        }
        older_than=$(date -j -v-"${DELETE_OLDER_THAN}" "+%s")
    else
        # GNU date command
        get_timestamp() {
            date -d "$1" "+%s"
        }
        older_than=$(date -d "-${DELETE_OLDER_THAN}" "+%s")
    fi

    aws $AWS_ARGS s3 ls "s3://$S3_BUCKET/$S3_PREFIX/" | grep -v " PRE " | while read -r line; do
        fileName=$(echo "$line" | awk '{print $4}')
        created=$(echo "$line" | awk '{print $1" "$2}')
        created_ts=$(get_timestamp "$created")
        
        if [ -n "$fileName" ] && [ "$created_ts" -lt "$older_than" ]; then
            >&2 echo "DELETING ${fileName}"
            aws $AWS_ARGS s3 rm "s3://$S3_BUCKET/$S3_PREFIX/$fileName"
        else
            >&2 echo "${fileName} not older than ${DELETE_OLDER_THAN}"
        fi
    done
fi

echo "SQL backup completed successfully"
>&2 echo "-----"