ARG BASE_IMAGE
FROM ${BASE_IMAGE}

LABEL \
    maintainer="g.jongerius@jong-soft.com" \
    description="FinTrack ${BUILD_VERSION}, a self hosted financial application" \
    version="${BUILD_VERSION}"

# Expose the volumen mappings
VOLUME ["/opt/storage/db"]
VOLUME ["/opt/storage/upload"]
VOLUME ["/opt/storage/logs"]

ENV JAVA_OPTS="--enable-preview -Dmicronaut.application.storage.location=/opt/storage"

WORKDIR /opt

# Setup application in the container
ARG BUILD_VERSION

COPY src/main/rsa-2048bit-key-pair.pem /opt/storage/
COPY src/main/bash/runner /opt/fintrack/runner
COPY build/distributions/fintrack-deployment-${BUILD_VERSION}.tar /opt/fintrack-${BUILD_VERSION}.tar

RUN \
    tar -xf /opt/fintrack-${BUILD_VERSION}.tar \
    && mv /opt/fintrack-deployment-${BUILD_VERSION}/* /opt/fintrack/ \
    && rm -rf /opt/fintrack-*

# Correct the working directory
WORKDIR /opt/fintrack

CMD 'runner'

EXPOSE 8080