package com.jongsoft.finance;

import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.MediaType;
import org.junit.jupiter.api.BeforeAll;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.output.Slf4jLogConsumer;
import org.testcontainers.images.builder.ImageFromDockerfile;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.shaded.com.fasterxml.jackson.core.JsonProcessingException;
import org.testcontainers.shaded.com.fasterxml.jackson.databind.ObjectMapper;
import org.testcontainers.utility.DockerImageName;
import org.testcontainers.utility.MountableFile;

import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Path;
import java.time.Duration;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.function.Consumer;

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

    protected HttpResponse<String> post(String endPoint, String body) throws URISyntaxException, IOException, InterruptedException {
        return exchange(endPoint, builder ->
                builder.POST(HttpRequest.BodyPublishers.ofString(body))
                        .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON));
    }

    protected HttpResponse<String> put(String endPoint, String body) throws IOException, URISyntaxException, InterruptedException {
        return exchange(endPoint, builder ->
                builder.PUT(HttpRequest.BodyPublishers.ofString(body))
                        .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON));
    }

    protected String buildBody(Map<String, ?> body) throws JsonProcessingException {
        return objectMapper.writeValueAsString(body);
    }

    private HttpResponse<String> exchange(String endPoint, Consumer<HttpRequest.Builder> builder) throws IOException, InterruptedException, URISyntaxException {
        final var requestBuilder = HttpRequest.newBuilder(new URI(applicationBaseUri + endPoint))
                .header(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON);

        builder.accept(requestBuilder);

        return httpClient.send(requestBuilder.build(), HttpResponse.BodyHandlers.ofString());
    }
}
