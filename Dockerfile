# Use a specific version of the Alpine image for reproducibility
FROM alpine:3.18

RUN apk update \
	&& apk add --no-cache \
	   coreutils \
	   postgresql16-client \
	   python3 py3-pip \
	   openssl \
	   curl \
	&& pip3 install --upgrade pip \
	&& pip3 install awscli \
	&& curl -L https://github.com/odise/go-cron/releases/download/v0.0.7/go-cron-linux.gz | zcat > /usr/local/bin/go-cron \
	&& chmod u+x /usr/local/bin/go-cron \
	&& apk del curl \
	&& rm -rf /var/cache/apk/*

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
ENV SCHEDULE **None**
ENV ENCRYPTION_PASSWORD **None**
ENV DELETE_OLDER_THAN **None**

ADD run.sh run.sh
ADD backup.sh backup.sh

CMD ["sh", "run.sh"]