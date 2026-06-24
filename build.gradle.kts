import io.micronaut.gradle.docker.NativeImageDockerfile
import org.gradle.internal.os.OperatingSystem

// GraalVM native-image args files must share a Windows drive with the project root.
// https://github.com/graalvm/native-build-tools/issues/754
if (System.getProperty("os.name", "").lowercase().contains("windows")) {
    val nativeBuildTmp = layout.buildDirectory.dir("tmp").get().asFile.apply { mkdirs() }
    System.setProperty("java.io.tmpdir", nativeBuildTmp.absolutePath)
}

plugins {
    id("io.micronaut.application")
    id("org.graalvm.buildtools.native")
}

java {
    sourceCompatibility = JavaVersion.toVersion("25")
    targetCompatibility = JavaVersion.toVersion("25")
}

micronaut {
    version = "4.10.14"
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
            buildArgs.addAll(
                listOf(
                    "--no-fallback",
                    "-H:+AllowDeprecatedBuilderClassesOnImageClasspath",
                    "--initialize-at-build-time=io.micronaut.flyway.StaticResourceProvider",
                    "--initialize-at-build-time=io.micronaut.flyway.StaticResourceProvider\$StaticLoadableResource",
                    // JNI/native libs must initialize at runtime (ONNX + Hugging Face tokenizers)
                    "--initialize-at-run-time=ai.onnxruntime",
                    "--initialize-at-run-time=ai.djl.huggingface.tokenizers",
                    "--initialize-at-run-time=ai.djl.util.Platform",
                    "--initialize-at-run-time=dev.langchain4j.model.embedding.onnx",
                    // Must match flyway.datasources.default.locations (see src/main/resources/application-h2.properties)
                    "-Dflyway.locations=classpath:db/migration/mysql",
                ),
            )
            resources {
                autodetect()
                includedPatterns.add("application.*\\.properties")
                includedPatterns.add("application.*\\.yaml")
                includedPatterns.add("application.*\\.yml")
                includedPatterns.add("logback\\.xml")
                includedPatterns.add("micronaut-banner\\.txt")
                includedPatterns.add("docs/.*")
                includedPatterns.add("db/.*")
                includedPatterns.add("public/.*")
                includedPatterns.add("i18n/.*")
                includedPatterns.add(".*\\.onnx")
                includedPatterns.add("all-minilm-l6-v2-tokenizer\\.json")
                includedPatterns.add("bert-tokenizer\\.json")
                includedPatterns.add("native/lib/.*")
                includedPatterns.add("META-INF/.*")
            }
            runtimeArgs.addAll(
                listOf(
                    "--enable-native-access=ALL-UNNAMED",
                    "-Dmicronaut.environments=h2,jpa,demo",
                    "-Dmicronaut.server.host=0.0.0.0",
                    "-Dmicronaut.application.storage.location=${layout.buildDirectory.get().asFile}/native-run",
                ),
            )
        }
    }
}

dependencies {
    implementation(pledger.api)
    implementation(pledger.ux)
}

val onnxNativePlatformDir =
    when {
        OperatingSystem.current().isWindows -> "win-x64"
        OperatingSystem.current().isMacOsX ->
            if (System.getProperty("os.arch").contains("aarch")) "osx-aarch64" else "osx-x64"
        OperatingSystem.current().isLinux() && System.getProperty("os.arch").contains("aarch") -> "linux-aarch64"
        else -> "linux-x64"
    }

val djlNativeLibDir =
    when {
        OperatingSystem.current().isWindows -> "win-x86_64/cpu"
        OperatingSystem.current().isMacOsX ->
            if (System.getProperty("os.arch").contains("aarch")) "osx-aarch64/cpu" else "osx-x86_64/cpu"
        OperatingSystem.current().isLinux() && System.getProperty("os.arch").contains("aarch") -> "linux-aarch64/cpu"
        else -> "linux-x86_64/cpu"
    }

val copyNativeRuntimeLibraries =
    tasks.register<Copy>("copyNativeRuntimeLibraries") {
        group = "native"
        description = "Copies ONNX Runtime and Hugging Face tokenizer native libraries next to the native executable"
        val nativeOutputDir = layout.buildDirectory.dir("native/nativeCompile")
        into(nativeOutputDir)
        val onnxRuntimeJar =
            configurations.runtimeClasspath.get().files.single { jar ->
                jar.name.startsWith("onnxruntime-") && jar.extension == "jar"
            }
        from(zipTree(onnxRuntimeJar)) {
            include("ai/onnxruntime/native/$onnxNativePlatformDir/*.dll")
            include("ai/onnxruntime/native/$onnxNativePlatformDir/*.so")
            include("ai/onnxruntime/native/$onnxNativePlatformDir/*.dylib")
            eachFile { path = name }
            includeEmptyDirs = false
        }
        val tokenizersJar =
            configurations.runtimeClasspath.get().files.single { jar ->
                jar.name.startsWith("tokenizers-") && jar.extension == "jar"
            }
        from(zipTree(tokenizersJar)) {
            include("native/lib/$djlNativeLibDir/*")
            eachFile { path = name }
            includeEmptyDirs = false
        }
    }

val nativeRunStorageDir = layout.buildDirectory.dir("native-run")

val prepareNativeRunStorage =
    tasks.register<Copy>("prepareNativeRunStorage") {
        group = "native"
        description = "Copies JWT signing key into the nativeRun storage directory"
        from(layout.projectDirectory.file("src/main/rsa-2048bit-key-pair.pem"))
        into(nativeRunStorageDir)
    }

tasks.named("nativeCompile").configure { finalizedBy(copyNativeRuntimeLibraries) }
tasks.named("nativeRun").configure {
    dependsOn(copyNativeRuntimeLibraries, prepareNativeRunStorage)
}
tasks.matching { it.name.equals("dockerBuildNative", ignoreCase = true) }.configureEach {
    dependsOn(copyNativeRuntimeLibraries)
}

val desktopDist =
    tasks.register<Exec>("desktopDist") {
        group = "distribution"
        description = "Builds the Windows desktop installer (native backend + Electron shell)"
        dependsOn("nativeCompile")
        workingDir = layout.projectDirectory.asFile
        val yarn = if (OperatingSystem.current().isWindows()) "yarn.cmd" else "yarn"
        commandLine(yarn, "dist")
    }
