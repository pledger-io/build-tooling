package com.jongsoft.finance;

import org.junit.jupiter.api.BeforeAll;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.output.Slf4jLogConsumer;
import org.testcontainers.images.builder.ImageFromDockerfile;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.shaded.com.fasterxml.jackson.core.JsonProcessingException;
import org.testcontainers.shaded.com.fasterxml.jackson.databind.ObjectMapper;

import java.net.http.HttpClient;
import java.nio.file.Path;
import java.time.Duration;
import java.time.temporal.ChronoUnit;
import java.util.Map;

import static org.testcontainers.utility.MountableFile.forHostPath;

@Testcontainers
public abstract class TestSetup {

    protected final Logger logger;

    public TestSetup() {
        logger = LoggerFactory.getLogger(getClass());
    }

    private static final GenericContainer<?> applicationContainer =
            new GenericContainer(
                    new ImageFromDockerfile()
                            .withDockerfile(Path.of("src/test/resources/Dockerfile")))
                    .withCopyFileToContainer(forHostPath("src/main/rsa-2048bit-key-pair.pem"), "/opt/storage/rsa-2048bit-key-pair.pem")
                    .withCopyFileToContainer(forHostPath("build/scripts/fintrack"), "/opt/app/bin/pledger.sh")
                    .withCopyFileToContainer(forHostPath("build/layers/libs"), "/opt/app/lib")
                    .withWorkingDirectory("/opt/app")
                    .withReuse(true)
                    .withExposedPorts(8080)
                    .withEnv("JAVA_OPTS", "-Dmicronaut.environments=h2,docker")
                    .withCommand("/opt/app/bin/pledger.sh")
                    .withLogConsumer(new Slf4jLogConsumer(LoggerFactory.getLogger("personal-ledger")));

    static {
        applicationContainer.start();
    }

    private static String applicationBaseUri;
    private static HttpClient httpClient;
    private static ObjectMapper objectMapper;

    @BeforeAll
    static void beforeAll() {
        httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.of(3, ChronoUnit.SECONDS))
                .version(HttpClient.Version.HTTP_2)
                .build();

        objectMapper = new ObjectMapper();
        applicationBaseUri = "http://%s:%d/api/".formatted(
                applicationContainer.getHost(),
                applicationContainer.getMappedPort(8080));
    }

    protected String generatePath(String endPoint) {
        return applicationBaseUri + endPoint;
    }

    protected String buildBody(Map<String, ?> body) throws JsonProcessingException {
        return objectMapper.writeValueAsString(body);
    }

}
