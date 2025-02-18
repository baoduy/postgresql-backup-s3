# Use a specific version of the Alpine image for reproducibility
FROM alpine:latest

RUN apk update

RUN apk add --no-cache \
	coreutils \
	postgresql17-client \
	openssl

RUN apk add --no-cache \
	   python3 py3-pip \
	   aws-cli

RUN rm -rf /var/cache/apk/*

ENV POSTGRES_DATABASE **None**
ENV POSTGRES_HOST **None**
ENV POSTGRES_PORT 5432
ENV POSTGRES_USER **None**
ENV POSTGRES_PASSWORD **None**
ENV POSTGRES_EXTRA_OPTS ''
ENV S3_ACCESS_KEY_ID **None**
ENV S3_SECRET_ACCESS_KEY **None**
ENV S3_BUCKET **None**
ENV S3_REGION us-west-1
ENV S3_PREFIX 'backup'
ENV S3_ENDPOINT **None**
ENV S3_S3V4 no
ENV ENCRYPTION_PASSWORD **None**
ENV DELETE_OLDER_THAN **None**

ADD run.sh run.sh
ADD backup.sh backup.sh

CMD ["sh", "run.sh"]