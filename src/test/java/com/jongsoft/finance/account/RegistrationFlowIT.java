package com.jongsoft.finance.account;

import com.jongsoft.finance.TestSetup;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.util.Map;

import static io.restassured.RestAssured.given;

@DisplayName("Register user scenario's")
class RegistrationFlowIT extends TestSetup {

    @Test
    @DisplayName("Create a new user account")
    void register() throws IOException {
        final var body = super.buildBody(
                Map.of(
                        "username", "test@pledger.io",
                        "password", "my-secret"
                ));

        given()
            .body(body)
            .contentType(ContentType.JSON)
            .accept(ContentType.JSON)
        .when()
            .put(generatePath("security/create-account"))
        .then()
            .statusCode(201);
    }

    @Test
    @DisplayName("Create a new user, missing e-mail address")
    void register_missingEmail() throws IOException {
        final var body = super.buildBody(
                Map.of(
                        "username", "/not-a-valid-email@@",
                        "password", "my-secret"
                ));

        given()
            .body(body)
            .contentType(ContentType.JSON)
        .when()
            .put(generatePath("security/create-account"))
        .then()
            .statusCode(400);
    }

}
