plugins {
    id("io.micronaut.application")
}

java {
    sourceCompatibility = JavaVersion.toVersion("25")
    targetCompatibility = JavaVersion.toVersion("25")
}

micronaut {
    version = "4.10.11"
    runtime("jetty")
}

application {
    mainClass = "com.jongsoft.finance.Pledger"
}

dependencies {
    implementation(pledger.api)
    implementation(pledger.ux)
}
