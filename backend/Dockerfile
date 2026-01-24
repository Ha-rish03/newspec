# --- Stage 1: Build the Application ---
FROM maven:3.8.5-openjdk-17 AS build
WORKDIR /app

# Copy all project files to the container
COPY . .

# Build the JAR file (skipping tests to speed it up)
RUN mvn clean package -DskipTests

# --- Stage 2: Run the Application ---
FROM openjdk:17.0.1-jdk-slim
WORKDIR /app

# Copy the built JAR file from the build stage
# We use *.jar so it works regardless of your specific version number
COPY --from=build /app/target/*.jar app.jar

# Expose the port Spring Boot runs on
EXPOSE 8080

# Command to start the application
ENTRYPOINT ["java", "-jar", "app.jar"]