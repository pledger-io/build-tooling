ARG BASE_IMAGE
FROM ${BASE_IMAGE} as builder
ARG BUILD_VERSION

RUN mkdir /opt/core-libs && mkdir /opt/pledger
COPY build/install/pledger-io /opt/pledger

RUN chmod +x /opt/pledger/bin/pledger-io

WORKDIR /opt

RUN mv /opt/pledger/lib/domain-*.jar /opt/core-libs/
RUN mv /opt/pledger/lib/bpmn-process-*.jar /opt/core-libs/
RUN mv /opt/pledger/lib/core-*.jar /opt/core-libs/
RUN mv /opt/pledger/lib/pledger-ui-*.jar /opt/core-libs/
RUN mv /opt/pledger/lib/fintrack-api-*.jar /opt/core-libs/
RUN mv /opt/pledger/lib/jpa-repository-*.jar /opt/core-libs/
RUN mv /opt/pledger/lib/rule-engine-*.jar /opt/core-libs/


FROM ${BASE_IMAGE}
ARG BUILD_VERSION
LABEL \
    maintainer="g.jongerius@jong-soft.com" \
    description="Pledger ${BUILD_VERSION}, a self hosted financial application" \
    version="${BUILD_VERSION}"

# Install required packages
#RUN microdnf install findutils

# Expose the volumen mappings
VOLUME ["/opt/storage/db"]
VOLUME ["/opt/storage/upload"]
VOLUME ["/opt/storage/logs"]

EXPOSE 8080

ENV JAVA_OPTS="--enable-preview -Dmicronaut.application.storage.location=/opt/storage"

RUN mkdir -p /opt/pledger/bin && mkdir -p /opt/pledger/lib
WORKDIR /opt/pledger

# Setup application in the container
COPY src/main/rsa-2048bit-key-pair.pem /opt/storage/
COPY src/main/bash/runner /opt/pledger/runner
COPY --from=builder /opt/pledger/bin/* /opt/pledger/bin/
COPY --from=builder /opt/pledger/lib/*.jar /opt/pledger/lib/

# Application libraries as last to reduce docker layer size
COPY --from=builder /opt/core-libs/*.jar /opt/pledger/lib/

CMD ["/opt/pledger/runner"]
