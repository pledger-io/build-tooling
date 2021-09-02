package com.jongsoft.finance.account;

import com.jongsoft.finance.TestSetup;
import io.restassured.http.ContentType;
import org.hamcrest.CoreMatchers;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.testcontainers.shaded.com.fasterxml.jackson.core.JsonProcessingException;

import java.util.Map;

import static io.restassured.RestAssured.given;

@DisplayName("Authentication scenario's")
class AuthenticationFlowIT extends TestSetup {

    public static final String AUTHENTICATION_END_POINT = "security/authenticate";

    @Test
    @DisplayName("Authenticate with unknown user")
    void authenticate_failure() throws Exception {
        final var body = super.buildBody(Map.of(
                "username", "unkown-user@pledger.io",
                "password", "1235542"
        ));

        given()
            .body(body)
            .contentType(ContentType.JSON)
        .when()
            .post(generatePath(AUTHENTICATION_END_POINT))
        .then()
            .statusCode(401);
    }

    @Test
    @DisplayName("Authenticate with known user")
    void authenticate_success() throws JsonProcessingException {
        final var body = super.buildBody(Map.of(
                "username", "sample@e",
                "password", "Zomer2020.1"));

        given()
            .body(body)
            .contentType(ContentType.JSON)
        .when()
            .post(generatePath(AUTHENTICATION_END_POINT))
        .then()
            .statusCode(200)
            .body("accessToken", CoreMatchers.instanceOf(String.class));
    }

}
