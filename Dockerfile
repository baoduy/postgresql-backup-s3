FROM node:lts-alpine
# Set the PostgreSQL version
ARG POSTGRES_VERSION=17

# Set environment variables
ENV POSTGRES_DATABASE ""
ENV POSTGRES_HOST ""
ENV POSTGRES_PORT 5432
ENV POSTGRES_USER ""
ENV POSTGRES_PASSWORD ""
ENV POSTGRES_EXTRA_OPTS ""
ENV S3_ACCESS_KEY_ID ""
ENV S3_SECRET_ACCESS_KEY ""
ENV S3_BUCKET ""
ENV S3_REGION us-east-1
ENV S3_PREFIX "backup"
ENV S3_ENDPOINT ""
ENV ENCRYPTION_PASSWORD ""
ENV DELETE_OLDER_THAN ""

# Echo the PostgreSQL version
RUN echo "Using PostgreSQL-Client version ${POSTGRES_VERSION}"

# Install required system dependencies
RUN apk add --no-cache \
    postgresql${POSTGRES_VERSION}-client \
    openssl

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application files
COPY . .

# Create a non-root user
RUN adduser --disabled-password \
    --home /app \
    --gecos '' appuser && chown -R appuser /app

# Switch to non-root user
USER appuser

# Run backup script
CMD ["node", "backup.js"]