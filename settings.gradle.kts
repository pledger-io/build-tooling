rootProject.name = "pledger-io"

pluginManagement {
    plugins {
        id("java")
        id("io.micronaut.application").version("4.3.4")
    }
}

dependencyResolutionManagement {
    @Suppress("UnstableApiUsage") // It's gradle, any of their APIs can be considered unstable
    repositories {
        mavenCentral()
        maven {
            url = uri("https://maven.pkg.github.com/pledger-io/build-tooling")
            credentials {
                username = System.getenv("GITHUB_ACTOR")
                password = System.getenv("GITHUB_TOKEN")
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