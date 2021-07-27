package com.jongsoft.finance.account;

import com.jongsoft.finance.TestSetup;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static com.jongsoft.finance.ResponseAssert.assertResponse;

class AuthenticationFlowIT extends TestSetup {

    @Test
    void authenticate_failure() throws Exception {
        final var body = super.buildBody(Map.of(
                "username", "unkown-user@pledger.io",
                "password", "1235542"
        ));

        assertResponse(super.post("security/authenticate", body))
                .hasStatus(401);
    }

}
