package com.jongsoft.finance;

import org.junit.jupiter.api.Assertions;

import java.net.http.HttpResponse;
import java.util.List;
import java.util.function.Consumer;
import java.util.function.Supplier;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.fail;

public class ResponseAssert {

    public static ResponseAssert assertResponse(HttpResponse<String> response) {
        return new ResponseAssert(response);
    }

    private final HttpResponse<String> response;

    private ResponseAssert(HttpResponse<String> response) {
        this.response = response;
    }

    public ResponseAssert isOk() {
        assertThat(response.statusCode())
                .withFailMessage(generateFailure("The status code of the call was not successful."))
                .isGreaterThanOrEqualTo(200)
                .isLessThan(300);
        return this;
    }

    public ResponseAssert hasStatus(int statusCode) {
        assertThat(response.statusCode())
                .withFailMessage(generateFailure("Expected status code %d but got %d".formatted(statusCode, response.statusCode())))
                .isEqualTo(statusCode);
        return this;
    }

    public ResponseAssert headerSatisfies(String header, Consumer<List<String>> valueConsumer) {
        try {
            valueConsumer.accept(response.headers().allValues(header));
        } catch (AssertionError e) {
            fail(generateFailure("Header %s does not satisfy requirements: %s".formatted(header, e.getMessage())));
        }

        return this;
    }

    private Supplier<String> generateFailure(String message) {
        return () -> """
                %s
                Requested URI: %s
                Response status: %d
                Response headers: %s
                Response body: %s"""
                .formatted(
                        message,
                        response.uri(),
                        response.statusCode(),
                        response.headers().map(),
                        response.body());
    }
}
