plugins {
    id("io.micronaut.application")
}

java {
    sourceCompatibility = JavaVersion.toVersion("21")
    targetCompatibility = JavaVersion.toVersion("21")
}

micronaut {
    version = "4.3.4"
}

application {
    mainClass = "com.jongsoft.finance.Application"
}

dependencies {
    implementation(pledger.api)
    implementation(pledger.ux)
}
