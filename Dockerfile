ARG BASE_IMAGE
FROM ${BASE_IMAGE} as builder
ARG BUILD_VERSION

RUN mkdir /opt/core-libs && mkdir /opt/fintrack
COPY build/distributions/fintrack-*.tar /opt/fintrack.tar

WORKDIR /opt
RUN \
    tar -xvf /opt/fintrack.tar -C /opt \
    && mv /opt/fintrack-${BUILD_VERSION}/* /opt/fintrack/ \
    && rm -rf /opt/fintrack-*

RUN mv /opt/fintrack/lib/domain-*.jar /opt/core-libs/
RUN mv /opt/fintrack/lib/bpmn-process-*.jar /opt/core-libs/
RUN mv /opt/fintrack/lib/core-*.jar /opt/core-libs/
RUN mv /opt/fintrack/lib/fintrack-ui-*.jar /opt/core-libs/
RUN mv /opt/fintrack/lib/fintrack-api-*.jar /opt/core-libs/
RUN mv /opt/fintrack/lib/jpa-repository-*.jar /opt/core-libs/
RUN mv /opt/fintrack/lib/rule-engine-*.jar /opt/core-libs/



FROM ${BASE_IMAGE}
ARG BUILD_VERSION
LABEL \
    maintainer="g.jongerius@jong-soft.com" \
    description="FinTrack ${BUILD_VERSION}, a self hosted financial application" \
    version="${BUILD_VERSION}"

# Expose the volumen mappings
VOLUME ["/opt/storage/db"]
VOLUME ["/opt/storage/upload"]
VOLUME ["/opt/storage/logs"]

EXPOSE 8080

ENV JAVA_OPTS="--enable-preview -Dmicronaut.application.storage.location=/opt/storage"

RUN mkdir -p /opt/fintrack/bin && mkdir -p /opt/fintrack/lib
WORKDIR /opt/fintrack

# Setup application in the container
COPY src/main/rsa-2048bit-key-pair.pem /opt/storage/
COPY src/main/bash/runner /opt/fintrack/runner
COPY --from=builder /opt/fintrack/bin/* /opt/fintrack/bin/
COPY --from=builder /opt/fintrack/lib/*.jar /opt/fintrack/lib/

# Application libraries as last to reduce docker layer size
COPY --from=builder /opt/core-libs/*.jar /opt/fintrack/lib/

CMD ['sh', '/opt/fintrack/runner']
