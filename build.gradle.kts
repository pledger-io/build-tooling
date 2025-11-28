plugins {
    id("io.micronaut.application")
    id("org.graalvm.buildtools.native") version "0.10.4"
}

java {
    sourceCompatibility = JavaVersion.toVersion("25")
    targetCompatibility = JavaVersion.toVersion("25")
}

micronaut {
    version = "4.9.3"
    runtime("jetty")
}

application {
    mainClass = "com.jongsoft.finance.Pledger"
}

graalvmNative {
    toolchainDetection.set(true)
    binaries {
        named("main") {
            imageName.set("pledger-io")
            buildArgs.addAll(listOf(
                "--no-fallback",
                "-H:+AllowDeprecatedBuilderClassesOnImageClasspath",
                "--initialize-at-build-time=io.micronaut.flyway.StaticResourceProvider",
                "--initialize-at-build-time=io.micronaut.flyway.StaticResourceProvider\$StaticLoadableResource"
            ))
            resources {
                autodetect()
                includedPatterns.add("application.yaml")
                includedPatterns.add("application-*.yaml")
            }
        }
    }
}

dependencies {
    implementation(pledger.api)
    implementation(pledger.ux)
}
