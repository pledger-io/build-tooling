package com.jongsoft.finance.account;

import com.jongsoft.finance.TestSetup;
import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.MediaType;
import org.assertj.core.api.Assertions;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.net.URISyntaxException;
import java.util.Map;

import static com.jongsoft.finance.ResponseAssert.assertResponse;
import static org.assertj.core.api.Assertions.assertThat;

class RegistrationFlowIT extends TestSetup {

    @Test
    void register() throws URISyntaxException, IOException, InterruptedException {
        final var body = super.buildBody(
                Map.of(
                        "username", "test@pledger.io",
                        "password", "my-secret"
                ));

        assertResponse(super.put("security/create-account", body))
                .hasStatus(201)
                .headerSatisfies(HttpHeaders.CONTENT_LENGTH, headers -> {
                    assertThat(headers).contains("0");
                });
    }

    @Test
    void register_missingEmail() throws URISyntaxException, IOException, InterruptedException {
        final var body = super.buildBody(
                Map.of(
                        "password", "my-secret"
                ));

        assertResponse(super.put("security/create-account", body))
                .hasStatus(400)
                .headerSatisfies(HttpHeaders.CONTENT_LENGTH, headers -> {
                    assertThat(headers).contains("0");
                });
    }

}
