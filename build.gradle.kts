plugins {
    id("io.micronaut.application")
}

java {
    sourceCompatibility = JavaVersion.toVersion("24")
    targetCompatibility = JavaVersion.toVersion("24")
}

micronaut {
    version = "4.8.2"
}

application {
    mainClass = "com.jongsoft.finance.Application"
}

dependencies {
    implementation(pledger.api)
    implementation(pledger.ux)
}
