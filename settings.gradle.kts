rootProject.name = "pledger-io"

pluginManagement {
    plugins {
        id("java")
        id("io.micronaut.application").version("4.4.2")
    }
}

dependencyResolutionManagement {
    val gpr_user: String by settings
    val gpr_token: String by settings
    @Suppress("UnstableApiUsage") // It's gradle, any of their APIs can be considered unstable
    repositories {
        mavenCentral()
        maven {
            url = uri("https://maven.pkg.github.com/pledger-io/build-tooling")
            credentials {
                username = gpr_user
                password = gpr_token
            }
        }
    }

    versionCatalogs {
        create("pledger") {
            val apiVersion: String by settings
            val uxVersion: String by settings

            library("api", "com.jongsoft.finance", "fintrack-api").version(apiVersion)
            library("ux", "com.jongsoft.finance", "pledger-ui").version(uxVersion)
        }
    }
}